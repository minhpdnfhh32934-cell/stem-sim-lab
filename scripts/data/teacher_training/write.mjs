// Has a local Qwen (LM Studio, loopback only) write training conversations from facts.jsonl, then
// keeps only those that pass the app's own number check and safety filter.
//
//   node scripts/data/teacher_training/write.mjs --facts <in.jsonl> --out <out.jsonl>
//        [--base http://localhost:1440] [--model qwen/qwen3.5-9b] [--per-topic 1]
//        [--kinds problem,missing] [--concurrency 2]
//
// Qwen receives numbers, formulas and quantity names only, never the app's sentences, so all the
// wording in the dataset is its own. The question is written first, without the results, so a
// student never recites the answers. Every row keeps review_status "pending": a teacher has not
// read it. Rejected rows go to <out>.rejected.jsonl with the reason, to see what fails.
import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');
const { foreignScript } = await import(
  pathToFileURL(resolve(root, 'scripts/teaching/rubric.mjs')).href
);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const factsFile = arg('facts');
const out = arg('out');
if (!factsFile || !out) throw new Error('--facts <in.jsonl> and --out <out.jsonl> are required');
const base = arg('base', 'http://localhost:1440');
const model = arg('model', 'qwen/qwen3.5-9b');
const perTopic = Number(arg('per-topic', '1'));
const kinds = String(arg('kinds', 'problem,missing')).split(',');
const concurrency = Number(arg('concurrency', '2'));
const LM_STUDIO = 'http://127.0.0.1:1234/v1/chat/completions';

const RULES = `Quy tắc:
- Chỉ dùng đúng các con số có trong dữ kiện. Không tự tính thêm, không làm tròn khác, không thêm số mới.
- Viết công thức bằng LaTeX giữa hai dấu $, dùng đúng các ký hiệu đã cho.
- Giọng ấm áp, rõ ràng, ngắn gọn, đúng thuật ngữ tiếng Việt; không dùng tiếng Anh hay chữ Trung.
- Gia sư xưng "thầy" và gọi học sinh là "em"; học sinh gọi gia sư là "thầy".`;
const WRITE_QUESTION = `Bạn viết lời một học sinh hỏi gia sư Vật lí bằng tiếng Việt, từ dữ kiện dạng JSON.
${RULES}
- Không nêu kết quả. Chỉ viết lời học sinh, không thêm tiêu đề hay giải thích.`;
const WRITE_ANSWER = `Bạn viết lời một gia sư Vật lí trả lời học sinh bằng tiếng Việt, từ dữ kiện dạng JSON.
${RULES}
- Chỉ viết lời gia sư, không thêm tiêu đề hay giải thích.`;

/** "9{,}81" as a person writes it (the number reader splits the braced form); "\\sin" as "\sin". */
const plain = (text) => text.replace(/\{([,.])\}/g, '$1').replace(/\\\\(?=[a-zA-Z])/g, '\\');

const GREEK =
  /\\(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|varphi|omega|Delta|Omega)(?![a-zA-Z])/g;
const greekIn = (text) => [...text.matchAll(GREEK)].map((m) => m[1]);

/** Only what the solution uses: a slider such as "Thời gian xét" is not part of the problem. */
function used(fact, g) {
  if (g.required) return true;
  return fact.steps.some((s) => s.tex.includes(g.symbol) || plain(s.tex).includes(g.value));
}

function given(fact, skip) {
  return fact.given
    .filter((g) => g.key !== skip && g.symbol && used(fact, g))
    .map((g) => ({ ten: g.name, ky_hieu: g.symbol, gia_tri: g.value, don_vi: g.unit }));
}

const results = (fact) =>
  fact.answers.map((a) => ({ ten: a.name, gia_tri: a.value, don_vi: a.unit }));

function plan(fact, kind) {
  if (kind === 'problem') {
    return {
      question: {
        chu_de: fact.title,
        du_kien: given(fact),
        can_tim: fact.answers.map((a) => a.name),
      },
      answer: (asked) => ({
        de_bai: asked,
        du_kien: given(fact),
        cong_thuc_da_the_so: fact.steps.map((s) => plain(s.tex)).filter(Boolean),
        ket_qua: results(fact),
        pham_vi_ap_dung: fact.validity,
        yeu_cau:
          'Giải từng bước theo các công thức đã cho và nêu đủ mọi kết quả. Nếu dữ kiện nằm ngoài phạm vi áp dụng thì nói rõ điều đó. Kết thúc bằng một câu hỏi ngắn kiểm tra hiểu bài.',
      }),
    };
  }
  // Only a quantity the engine says the asked result depends on: otherwise the "missing" story
  // is false (the spring force at rest needs no k).
  const candidates = fact.given.filter((g) => g.required && g.symbol && g.changes?.length);
  const drop = candidates[Math.floor(candidates.length / 2)];
  const target = drop && fact.answers.find((a) => a.id === drop.changes[0]);
  if (!target) return null;
  return {
    drop,
    question: {
      chu_de: fact.title,
      du_kien: given(fact, drop.key),
      can_tim: [target.name],
      yeu_cau: `Học sinh nêu đề bài, quên cho ${drop.name} và vẫn hỏi đại lượng cần tìm.`,
    },
    answer: (asked) => ({
      de_bai: asked,
      du_kien_co: given(fact, drop.key),
      dai_luong_con_thieu: { ten: drop.name, ky_hieu: drop.symbol },
      dai_luong_can_tim: target.name,
      yeu_cau:
        'Không tính ra số. Chỉ rõ còn thiếu đại lượng nào, vì sao đại lượng cần tìm phụ thuộc vào nó, rồi hỏi lại học sinh giá trị đó. Tuyệt đối không tự đoán giá trị.',
    }),
  };
}

async function ask(system, user) {
  const r = await fetch(LM_STUDIO, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) },
      ],
      temperature: 0.6,
      max_tokens: 1200,
      // Its hidden reasoning is on by default and used the whole budget: the reply came back empty.
      reasoning_effort: 'none',
    }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!r.ok) throw new Error(`LM Studio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text = plain(data.choices[0].message.content ?? '').trim();
  if (!text) throw new Error('empty reply');
  if (data.choices[0].finish_reason === 'length') throw new Error('reply cut off');
  return text;
}

const facts = readFileSync(factsFile, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
const taken = {};
const chosen = facts.filter((f) => {
  taken[f.topic] = (taken[f.topic] ?? 0) + 1;
  return taken[f.topic] <= perTopic;
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(base);
await page.waitForLoadState('networkidle');

/** The app's own checks, run in the page: numbers must come from the facts; output must be safe. */
const check = (args) =>
  page.evaluate(async ({ text, known, tex, banned }) => {
    const { unknownNumbers } = await import('/src/ai/explain.ts');
    const { numbersIn } = await import('/src/ai/numbers.ts');
    const { texNumbers } = await import('/src/physics/common/tex.ts');
    const { outputIsSafe } = await import('/src/safety/moderation.ts');
    const allowed = [...known.flatMap((v) => numbersIn(v)), ...tex.flatMap((t) => texNumbers(t))];
    return {
      unknown: unknownNumbers(text, allowed),
      safe: outputIsSafe(text),
      guessed: banned.some((v) => numbersIn(text).some((n) => numbersIn(v).includes(n) && n > 4)),
    };
  }, args);

async function makeOne(fact, kind) {
  const steps = plan(fact, kind);
  if (!steps) return null;
  const row = { id: `${fact.id}.${kind}`, fact: fact.id, kind, model, review_status: 'pending' };
  const started = Date.now();
  row.question = await ask(WRITE_QUESTION, steps.question);
  row.answer = await ask(WRITE_ANSWER, steps.answer(row.question));
  row.ms = Date.now() - started;

  const shown = fact.given.filter((g) => g.key !== steps.drop?.key).map((g) => g.value);
  const banned = steps.drop ? [steps.drop.value] : [];
  const ofQuestion = await check({ text: row.question, known: shown, tex: [], banned });
  const ofAnswer = await check({
    text: row.answer,
    known: kind === 'problem' ? [...shown, ...fact.answers.map((a) => a.value)] : shown,
    tex: kind === 'problem' ? fact.steps.map((s) => s.tex) : [],
    banned,
  });
  const allowedGreek = new Set(
    greekIn([...fact.given.map((g) => g.symbol ?? ''), ...fact.steps.map((s) => s.tex)].join(' ')),
  );
  const stray = [
    ...new Set(greekIn(row.question + row.answer).filter((g) => !allowedGreek.has(g))),
  ];
  row.reasons = [
    ofQuestion.unknown.length ? `question has numbers ${ofQuestion.unknown.join(' ')}` : '',
    ofAnswer.unknown.length ? `answer has numbers ${ofAnswer.unknown.join(' ')}` : '',
    ofAnswer.safe && ofQuestion.safe ? '' : 'unsafe',
    ofAnswer.guessed || ofQuestion.guessed ? 'stated the missing value' : '',
    foreignScript(row.answer) > 0 || foreignScript(row.question) > 0 ? 'foreign script' : '',
    stray.length ? `symbols not in the facts: ${stray.join(' ')}` : '',
    /^\s*(Em chào|Thầy ơi|Dạ)/.test(row.answer) || /^\s*Chào em/.test(row.question)
      ? 'wrong speaker'
      : '',
    /[\u0000-\u0009\u000b-\u001f]/.test(row.question + row.answer) ? 'control character' : '',
  ].filter(Boolean);
  return row;
}

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, '');
writeFileSync(`${out}.rejected.jsonl`, '');
const jobs = chosen.flatMap((fact) => kinds.map((kind) => ({ fact, kind })));
let next = 0;
let kept = 0;
let rejected = 0;
async function worker() {
  while (next < jobs.length) {
    const { fact, kind } = jobs[next++];
    const id = `${fact.id}.${kind}`;
    try {
      const row = await makeOne(fact, kind);
      if (!row) continue;
      if (row.reasons.length) {
        rejected += 1;
        appendFileSync(`${out}.rejected.jsonl`, JSON.stringify(row) + '\n');
      } else {
        kept += 1;
        delete row.reasons;
        appendFileSync(out, JSON.stringify(row) + '\n');
      }
      console.log(
        `${id}: ${row.reasons?.length ? `rejected (${row.reasons.join('; ')})` : 'kept'}`,
      );
    } catch (e) {
      rejected += 1;
      appendFileSync(`${out}.rejected.jsonl`, JSON.stringify({ id, reasons: [String(e)] }) + '\n');
      console.log(`${id}: error ${String(e).slice(0, 160)}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
await browser.close();
console.log(`kept ${kept}, rejected ${rejected}`);
