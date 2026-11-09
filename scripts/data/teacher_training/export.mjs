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
  /^thầy (rất vui|sẵn sàng|(đã |vừa |sẽ |cũng )*(nhận được|nghe|đọc|xem|thấy em(?! (đã |vừa )?(quên|thiếu|chưa|không))|hiểu (ý|bài|câu|rồi)|hướng dẫn em|giúp em|giải (giúp|chi tiết|bài|cho)|bắt đầu))/iu;

/**
 * Without the opening courtesy: the app asks for the answer in the first sentence, and a model
 * taught "Chào em, thầy đã nhận được câu hỏi của em." spends its few tokens on it every time.
 * Only a sentence with no number and no formula is removed, and never the whole answer.
 */
export function withoutGreeting(text) {
  const rest = text.replace(/^(Chào em|Thầy chào em|Em thân mến|Em nghe đây|Em à)[,!.]?\s*/u, '');
  const first = rest.split(/(?<=[.!?])\s/u)[0] ?? '';
  const empty = NOTHING_SAID.test(first) && !/[\d$]/.test(first);
  // "Tuy nhiên" opposed the courtesy just removed.
  const after = rest
    .slice(first.length)
    .trimStart()
    .replace(/^(Tuy nhiên|Tuy vậy|Nhưng)[,\s]+/u, '');
  const body = (empty && after) || rest;
  return body.charAt(0).toUpperCase() + body.slice(1);
}

/** The writer sometimes ends the tutor's own question as a student would: "... chưa thầy?". */
export const asTeacher = (text) =>
  text.replace(/(?<!\p{L})(chưa|không|nhé|nha) thầy\s*([?!.])/giu, '$1$2');

/** What only a writer handed the results and the rules would say to a student. */
const WRITER_TRACE = /tự tính thêm|kết quả đã cho|và kết quả đã có/iu;

const GREEK = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  Delta: 'Δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  eta: 'η',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  varphi: 'φ',
  omega: 'ω',
  Omega: 'Ω',
  max: 'max',
  min: 'min',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
};
const POWER = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * A question as a learner types it: "H2 + O2 → H2O", not "$H_2 + O_2 \rightarrow H_2O$". The model
 * must learn from the input it will really get, and the app's own balancer reads the typed form.
 * What cannot be typed this way (a fraction) stays as written.
 */
export function asTyped(question) {
  const typed = question
    .replace(/\$/g, '')
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, '$1')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/\\(?:longrightarrow|rightarrow|to)(?![a-zA-Z])/g, '→')
    .replace(/\^\{?\\circ\}?/g, '°')
    .replace(/\\cdot(?![a-zA-Z])/g, '·')
    .replace(/\\times(?![a-zA-Z])/g, '×')
    .replace(/\\([a-zA-Z]+)/g, (all, name) => GREEK[name] ?? all)
    .replace(/_\{([^{}]*)\}/g, '$1')
    .replace(/_([A-Za-z0-9])/g, '$1')
    .replace(/\^\{?(-?\d+)\}?/g, (_, e) =>
      e.replace('-', '⁻').replace(/\d/g, (d) => POWER[Number(d)]),
    )
    .replace(/ {2,}/g, ' ');
  return /[\\{}]/.test(typed) ? question : typed;
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
  assert(
    withoutGreeting('Thầy sẽ hướng dẫn em giải bài này nhé. Ta dùng F = ma.') === 'Ta dùng F = ma.',
    'a courtesy without a greeting goes too',
  );
  assert(
    withoutGreeting('Chào em, thầy rất vui khi em hỏi. Ta dùng F = ma.') === 'Ta dùng F = ma.',
    'being glad says nothing',
  );
  assert(
    withoutGreeting('Thầy thấy em quên ghi m. Em cho thầy m nhé?') ===
      'Thầy thấy em quên ghi m. Em cho thầy m nhé?',
    'saying what is missing stays',
  );
  assert(
    withoutGreeting('Thầy sẽ hướng dẫn em nhé.') === 'Thầy sẽ hướng dẫn em nhé.',
    'never the whole answer',
  );
  assert(
    asTeacher('Em hiểu chưa thầy?') === 'Em hiểu chưa?',
    'the tutor does not call itself thầy',
  );
  assert(asTeacher('Em làm được không thầy !') === 'Em làm được không!', 'spaced mark');
  assert(
    asTeacher('Em hiểu chưa, thầy giảng lại nhé.') === 'Em hiểu chưa, thầy giảng lại nhé.',
    'thầy as the subject stays',
  );
  assert(asTyped('$H_2 + O_2 \\rightarrow H_2O$') === 'H2 + O2 → H2O', 'an equation');
  assert(
    asTyped('$r = 1,6\\,\\text{m}$ và $g = 9,81 \\text{ m/s}^2$') === 'r = 1,6 m và g = 9,81 m/s²',
    'a unit',
  );
  assert(asTyped('$V_{max}$, $\\theta = 50^\\circ$') === 'Vmax, θ = 50°', 'an index and an angle');
  assert(asTyped('$C_6H_{12}O_6$') === 'C6H12O6', 'a long index');
  assert(asTyped('$t_{\\max} = 12$ s') === 'tmax = 12 s', 'a named index');
  assert(
    withoutGreeting('Thầy đã nhận được đề. Tuy nhiên, em còn thiếu m.') === 'Em còn thiếu m.',
    'no "however" left against nothing',
  );
  assert(asTyped('$q = 5 \\cdot 10^{-8}$') === 'q = 5 · 10⁻⁸', 'a power of ten');
  assert(asTyped('$\\frac{a}{b}$') === '$\\frac{a}{b}$', 'what cannot be typed stays');
  assert(asTyped("Mạch 5'→3'") === "Mạch 5'→3'", 'plain text stays');
  assert(WRITER_TRACE.test('mà không cần tự tính thêm số liệu'), 'a trace of the rules is found');
  assert(
    !WRITER_TRACE.test('dựa trên kết quả đã có, quãng đường là'),
    'an earlier step is no trace',
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

const textsOf = (name) => {
  const data = JSON.parse(readFileSync(resolve(root, 'tests/teaching', name), 'utf8'));
  return (data.items ?? data).flatMap((item) => [item.question, item.expected].filter(Boolean));
};
// A short item of the tuning set ("Tính nồng độ mol của dung dịch") is one phrase, found in every
// problem on its topic. The held-out set stays strict: it decides whether the model ships.
const benchmark = [
  ...textsOf('teaching-heldout.json'),
  ...textsOf('teaching-eval.json').filter((t) => words(t).length >= 12),
];

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
  const question = asTyped(row.question);
  if (benchmark.some((b) => overlap(question, b) >= 0.5 || overlap(row.answer, b) >= 0.5)) {
    drop('too close to the benchmark');
    continue;
  }
  if (/\\\\(?=[a-zA-Z,;:! ])/.test(row.answer + row.question)) {
    drop('broken LaTeX');
    continue;
  }
  if (WRITER_TRACE.test(row.answer)) {
    drop('tells what the writer was handed');
    continue;
  }
  const solved = row.kind === 'problem';
  const carriesResults = solved && !fact.tool && share(`${fact.id}:tool`) < 0.5;
  const results = carriesResults
    ? fact.answers.map((a) => `${a.name} = ${a.value}${a.unit ? ` ${a.unit}` : ''}`)
    : [];
  const made = await instruction(question, results);
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
      { role: 'user', content: question },
      { role: 'assistant', content: withoutGreeting(asTeacher(row.answer)) },
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
