// Turns written conversations into the chat files a training run reads, each with the instruction
// the app really sends to the on-device model (`contextPrompt`, first turn, 'compact' size).
//
//   node scripts/data/teacher_training/export.mjs --rows a.jsonl,b.jsonl --facts f1.jsonl,f2.jsonl
//        --out <dir> [--base http://localhost:1440] [--valid 0.1] [--sample 60] [--check]
//
// Half of the solved problems carry the app-computed results, as a tool block in the instruction;
// the other half do not. If every problem had the block, "no block" would mean "ask for the missing
// value" and the model would stop solving complete problems that no tool has read.
// A row close to tests/teaching/* is dropped, so the benchmark keeps measuring something unseen.
// Every row stays review_status "pending": no teacher has read it.
//
// --check runs the file's own assertions and writes nothing.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** FNV-1a mapped to [0, 1): the same id lands on the same side on every machine. */
export function share(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

const words = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];

/** Runs of four words: a shared run says "copied", a shared word only says "same subject". */
const grams = (tokens) => {
  const out = new Set();
  for (let i = 0; i + 4 <= tokens.length; i += 1) out.add(tokens.slice(i, i + 4).join(' '));
  return out;
};

/** How much of `reference` is found in `text`, from 0 to 1. */
export function overlap(text, reference) {
  const inText = grams(words(text));
  const inReference = grams(words(reference));
  if (!inReference.size) return 0;
  let found = 0;
  for (const g of inReference) if (inText.has(g)) found += 1;
  return found / inReference.size;
}

const NOTHING_SAID =
  /^thầy (đã |vừa |rất vui |sẽ |cũng )*(nhận được|nghe|đọc|xem|thấy em|hiểu (ý|bài|câu|rồi))/iu;

/**
 * Without the opening courtesy: the app asks for the answer in the first sentence, and a model
 * taught "Chào em, thầy đã nhận được câu hỏi của em." spends its few tokens on it every time.
 * Only a sentence with no number and no formula is removed.
 */
export function withoutGreeting(text) {
  const rest = text.replace(/^(Chào em|Em thân mến|Em à)[,!.]?\s*/u, '');
  if (rest === text) return text;
  const first = rest.split(/(?<=[.!?])\s/u)[0] ?? '';
  const body =
    NOTHING_SAID.test(first) && !/[\d$]/.test(first) ? rest.slice(first.length).trimStart() : rest;
  return body.charAt(0).toUpperCase() + body.slice(1);
}

if (process.argv.includes('--check')) {
  const assert = (ok, what) => {
    if (!ok) throw new Error(`check failed: ${what}`);
  };
  assert(share('a') === share('a') && share('a') !== share('b'), 'share is stable');
  assert(share('physics.freeFall.001') >= 0 && share('physics.freeFall.001') < 1, 'share in [0,1)');
  const q = 'Thả rơi tự do một hòn bi từ độ cao 20 m. Tính thời gian rơi.';
  assert(overlap(`Thầy ơi, ${q}`, q) === 1, 'a copied question is found');
  assert(overlap('Em hỏi về định luật Ôm cho đoạn mạch', q) === 0, 'another topic is not');
  assert(overlap('THẢ RƠI TỰ DO một hòn bi từ độ cao 20 m', q) > 0.4, 'case and accents ignored');
  assert(overlap('x', 'ab') === 0, 'too short to have a run');
  assert(
    withoutGreeting('Chào em, thầy đã nhận được câu hỏi của em. Để tính a, ta dùng F = ma.') ===
      'Để tính a, ta dùng F = ma.',
    'a sentence that says nothing goes',
  );
  assert(
    withoutGreeting('Chào em, thầy hiểu là em quên ghi khối lượng. Em cho thầy m nhé?') ===
      'Thầy hiểu là em quên ghi khối lượng. Em cho thầy m nhé?',
    'a sentence that says something stays',
  );
  assert(
    withoutGreeting('Em thân mến, thầy đã nhận được m = 2 kg. Vậy a = 5.') ===
      'Thầy đã nhận được m = 2 kg. Vậy a = 5.',
    'a sentence with a number stays',
  );
  assert(
    withoutGreeting('Để tính a, ta dùng F = ma.') === 'Để tính a, ta dùng F = ma.',
    'no greeting',
  );
  console.log('export.mjs checks passed');
  process.exit(0);
}

const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const list = (name) => String(arg(name, '')).split(',').filter(Boolean);
const outDir = arg('out');
if (!outDir || !list('rows').length || !list('facts').length) {
  throw new Error('--rows, --facts and --out are required');
}
const base = arg('base', 'http://localhost:1440');
const validShare = Number(arg('valid', '0.1'));
const sampleSize = Number(arg('sample', '60'));

const jsonl = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const facts = new Map(
  list('facts')
    .flatMap(jsonl)
    .map((f) => [f.id, f]),
);
const rows = [
  ...new Map(
    list('rows')
      .flatMap(jsonl)
      .map((r) => [r.id, r]),
  ).values(),
];

const benchmark = ['teaching-eval.json', 'teaching-heldout.json'].flatMap((name) => {
  const data = JSON.parse(readFileSync(resolve(root, 'tests/teaching', name), 'utf8'));
  return (data.items ?? data).flatMap((item) => [item.question, item.expected].filter(Boolean));
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(base);
await page.waitForLoadState('networkidle');

/** The first-turn instruction as chatService composes it, with `results` where tools go. */
const instruction = (question, results) =>
  page.evaluate(
    async ({ question, results }) => {
      const { contextPrompt } = await import('/src/teacher/chat/chatService.ts');
      const { TOOL_HEADER } = await import('/src/teacher/chat/promptLabels.ts');
      const p = await contextPrompt(question, 'vi', false, false, 'compact', []);
      const core = p.note ? p.system.slice(0, -p.note.length) : p.system;
      const block = results.length
        ? `\n\n${TOOL_HEADER.vi}\n${results.map((r) => `- ${r}`).join('\n')}`
        : '';
      return {
        system: `${core}${block}${p.note}`,
        appTool: core.includes(TOOL_HEADER.vi),
        missingNotice: p.missingData !== null,
      };
    },
    { question, results },
  );

const dropped = {};
const drop = (reason) => {
  dropped[reason] = (dropped[reason] ?? 0) + 1;
};
const kept = [];
for (const row of rows) {
  const fact = facts.get(row.fact);
  if (!fact) {
    drop('fact not found');
    continue;
  }
  if (benchmark.some((b) => overlap(row.question, b) >= 0.5 || overlap(row.answer, b) >= 0.5)) {
    drop('too close to the benchmark');
    continue;
  }
  if (/\\\\(?=[a-zA-Z,;:! ])/.test(row.answer + row.question)) {
    drop('broken LaTeX');
    continue;
  }
  const solved = row.kind === 'problem';
  const carriesResults = solved && !fact.tool && share(`${fact.id}:tool`) < 0.5;
  const results = carriesResults
    ? fact.answers.map((a) => `${a.name} = ${a.value}${a.unit ? ` ${a.unit}` : ''}`)
    : [];
  const made = await instruction(row.question, results);
  // A balancing answer stands on the app's own balancer: without it the coefficients are unbacked.
  if (fact.tool && !made.appTool) {
    drop('the app did not read the equation');
    continue;
  }
  // A whole problem must not be told "no numbers given" (missingData.ts misread it).
  if (solved && made.missingNotice) {
    drop('problem read as having no numbers');
    continue;
  }
  kept.push({
    id: row.id,
    fact: fact.id,
    subject: fact.subject,
    topic: fact.topic,
    kind: row.kind,
    tool: carriesResults || Boolean(fact.tool),
    review_status: 'pending',
    messages: [
      { role: 'system', content: made.system },
      { role: 'user', content: row.question },
      { role: 'assistant', content: withoutGreeting(row.answer) },
    ],
  });
}
await browser.close();

// Whole facts stay on one side: its "problem" and "missing" versions share all their numbers.
const isValid = (r) => share(r.fact) < validShare;
const train = kept.filter((r) => !isValid(r));
const valid = kept.filter(isValid);

const tally = (key, items) =>
  items.reduce((a, r) => {
    const k = key(r);
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});

// The sample for the teacher: an even spread over topics, in a stable order.
const byTopic = new Map();
for (const r of [...kept].sort((a, b) => share(`${a.id}:s`) - share(`${b.id}:s`))) {
  if (!byTopic.has(r.topic)) byTopic.set(r.topic, []);
  byTopic.get(r.topic).push(r);
}
const sample = [];
for (let round = 0; sample.length < sampleSize && round < 100; round += 1) {
  for (const items of byTopic.values()) {
    if (items[round] && sample.length < sampleSize) sample.push(items[round]);
  }
}
const sheet = [
  '# Mẫu dữ liệu huấn luyện AI Teacher, xin giáo viên đọc',
  '',
  `${sample.length} hội thoại lấy đều theo chủ đề. Số trong "Kết quả của app" do chương trình tính.`,
  'Lời của thầy do một model viết, có thể sai kiến thức. Xin ghi "Đạt" hoặc chỗ cần sửa dưới mỗi mục.',
  '',
  ...sample.flatMap((r, i) => {
    const f = facts.get(r.fact);
    return [
      `## ${i + 1}. ${f.title} (${r.kind === 'missing' ? 'đề thiếu dữ kiện' : 'giải bài'})`,
      '',
      `Mã: \`${r.id}\``,
      '',
      `**Học sinh:** ${r.messages[1].content}`,
      '',
      `**Thầy:** ${r.messages[2].content}`,
      '',
      r.kind === 'missing'
        ? ''
        : `**Kết quả của app:** ${f.answers.map((a) => `${a.name} = ${a.value}${a.unit ? ` ${a.unit}` : ''}`).join('; ')}`,
      '',
      '**Nhận xét:** ',
      '',
    ];
  }),
].join('\n');

mkdirSync(outDir, { recursive: true });
const write = (name, items) =>
  writeFileSync(join(outDir, name), items.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
write('train.jsonl', train);
write('valid.jsonl', valid);
writeFileSync(join(outDir, 'teacher-sample.md'), sheet, 'utf8');
const longest = Math.max(...kept.map((r) => r.messages[0].content.length));
const report = {
  rows: rows.length,
  kept: kept.length,
  train: train.length,
  valid: valid.length,
  dropped,
  bySubject: tally((r) => r.subject, kept),
  byKind: tally((r) => r.kind, kept),
  withResults: kept.filter((r) => r.tool).length,
  longestInstructionChars: longest,
};
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
