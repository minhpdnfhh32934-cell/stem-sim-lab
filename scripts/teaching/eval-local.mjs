// Runs the AI Teacher evaluation set on a local llama-server that holds the trained adapter, with
// the app's own prompt, and scores the answers with scripts/teaching/rubric.mjs. Every question is
// asked with the adapter off (variant base) and on (variant trained), order alternating per
// question, so scripts/teaching/compare.mjs can pair the two.
//
//   npm run dev
//   llama-server -m <model.gguf> --lora <adapter.gguf> --lora-init-without-apply -np 1 -c 6000 \
//     --jinja --port 18765        (a CUDA build: only the NVIDIA card can be used)
//   node scripts/teaching/eval-local.mjs --model qwen3.5-9b --out <folder> --label <name>
//        [--set tests/teaching/teaching-heldout.json] [--url http://127.0.0.1:18765]
//        [--base http://localhost:1420] [--only P1,C3] [--variants base,trained]
//
// The browser only builds the prompt (no GPU work). Temperature 0: the same prompt gives the same
// answer, so a difference between the variants is not sampling noise. An existing result file is
// never overwritten.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalSetPath, groupKey, repoPath, scoreAnswer, summarizeRuns } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(resolve(root, 'package.json'))('@playwright/test');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://127.0.0.1:18765');
const base = arg('base', 'http://localhost:1420');
const model = arg('model', 'qwen3.5-9b');
const label = arg('label');
const only = arg('only');
const out = arg('out');
if (!out || !label) throw new Error('--out <folder> and --label <name> are required');
mkdirSync(out, { recursive: true });
const file = resolve(out, `eval-${model}-${label}.json`);
if (existsSync(file)) throw new Error(`${file} already exists: choose another --label`);

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const set = JSON.parse(readFileSync(evalSetPath(root, process.argv), 'utf8'));
const items = only ? set.items.filter((i) => only.split(',').includes(i.id)) : set.items;
const wanted = String(arg('variants', 'base,trained')).split(',');
const VARIANTS = [
  ['base', 0],
  ['trained', 1],
].filter(([name]) => wanted.includes(name));
if (!VARIANTS.length) throw new Error('--variants: expected base, trained or both');
const TEMPERATURE = 0;

async function ask(system, messages, scale) {
  const t0 = Date.now();
  const res = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 1024,
      temperature: TEMPERATURE,
      seed: 1,
      cache_prompt: false,
      chat_template_kwargs: { enable_thinking: false },
      lora: [{ id: 0, scale }],
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) return { ok: false, answer: '', error: `${res.status} ${await res.text()}`, ms };
  const [choice] = (await res.json()).choices;
  return {
    ok: true,
    answer: choice.message.content ?? '',
    truncated: choice.finish_reason === 'length',
    ms,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(base);
await page.waitForLoadState('networkidle');
const chatService = await page.evaluate(async () =>
  (await fetch('/src/teacher/chat/chatService.ts')).text(),
);
const build = {
  commit: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  chatServiceSha256: createHash('sha256').update(chatService).digest('hex'),
  model,
};
const settings = {
  temperature: TEMPERATURE,
  label,
  url,
  set: repoPath(root, arg('set') ?? 'tests/teaching/teaching-eval.json'),
};

const results = [];
for (const [index, item] of items.entries()) {
  // The same prompt as askTeacher: the note moves in front of the question after earlier turns.
  const { system, asked } = await page.evaluate(async (item) => {
    const c = await import('/src/teacher/chat/chatService.ts');
    const history = item.history ?? [];
    const prompt = await c.contextPrompt(item.question, 'vi', false, false, 'compact', history);
    const noteInTurn = Boolean(prompt.note) && history.length > 0;
    return {
      system: noteInTurn ? prompt.system.slice(0, -prompt.note.length) : prompt.system,
      asked: noteInTurn ? `${prompt.note.trim()}\n\n${item.question}` : item.question,
    };
  }, item);
  const messages = [...(item.history ?? []), { role: 'user', content: asked }];
  for (const [variant, scale] of index % 2 ? [...VARIANTS].reverse() : VARIANTS) {
    const startedAt = new Date().toISOString();
    const r = await ask(system, messages, scale);
    const score = scoreAnswer(item, r.answer);
    results.push({
      id: item.id,
      subject: item.subject,
      type: item.type,
      model,
      build,
      variant,
      decoding: 'server',
      temperature: TEMPERATURE,
      repeat: 0,
      attempt: 0,
      startedAt,
      promptChars: system.length,
      system,
      asked,
      firstMs: null,
      ...r,
      score,
    });
    console.log(
      `${item.id} ${variant}: ${r.ok ? 'ok' : `FAIL ${r.error}`} ${r.ms} ms facts ${score.keyFacts.toFixed(2)} errors ${score.wrong.length} correct ${score.correct} invented ${score.invented.length}`,
    );
    writeFileSync(file, JSON.stringify({ model, build, settings, results }, null, 2));
    if (!r.ok) {
      await browser.close();
      process.exit(6);
    }
  }
}
const summary = {};
for (const key of new Set(results.map(groupKey))) {
  summary[key] = summarizeRuns(results.filter((r) => groupKey(r) === key));
}
writeFileSync(file, JSON.stringify({ model, build, settings, summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
