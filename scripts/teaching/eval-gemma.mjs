// Runs the AI Teacher evaluation set (tests/teaching/teaching-eval.json) on the in-app Gemma, in
// Microsoft Edge (same engine as WebView2), through the app's own code, and scores the answers
// with scripts/teaching/rubric.mjs. Compares the on-device prompt of main (before the 2026-10-13
// audit) with the current one.
//
//   npm run dev                                   (dev server, default http://localhost:1420)
//   node scripts/teaching/eval-gemma.mjs --model gemma3-1b --profile <folder> --out <folder>
//
// SAFETY (audit GPU-01): runs only on a discrete NVIDIA GPU (--force_high_performance_gpu) and
// stops otherwise: long Gemma work on an integrated card crashed a test machine (bugcheck 0x119).
// The model must already be downloaded in <profile> (the script never starts a big download).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreAnswer, summarize } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const model = arg('model', 'gemma3-1b');
const profile = arg('profile');
const out = arg('out', resolve(root, '.agent-logs/teaching-eval'));
const base = arg('base', 'http://localhost:1420');
const only = arg('only');
if (!profile)
  throw new Error('--profile <Edge profile folder that already holds the model> is required');
mkdirSync(out, { recursive: true });

const set = JSON.parse(readFileSync(resolve(root, 'tests/teaching/teaching-eval.json'), 'utf8'));
const items = only ? set.items.filter((i) => only.split(',').includes(i.id)) : set.items;

const context = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
  args: ['--force_high_performance_gpu'],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(base);
await page.waitForLoadState('networkidle');

const adapter = await page.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  return a ? `${a.info.vendor} ${a.info.architecture}` : 'none';
});
if (!adapter.startsWith('nvidia')) {
  console.error(`Refusing to run on "${adapter}": discrete NVIDIA GPU only (audit GPU-01).`);
  await context.close();
  process.exit(2);
}
const ready = await page.evaluate(
  async (id) => (await import('/src/ai/webGemma.ts')).webGemmaStatus(id),
  model,
);
if (ready !== 'ready') {
  console.error(`${model} is not downloaded in this profile; download it in the app first.`);
  await context.close();
  process.exit(3);
}

// The on-device prompt of main before the audit (src/teacher/chat/chatService.ts @ c25ad9d).
const BEFORE_SYSTEM =
  'Bạn là AI Teacher, trợ lý học tập (bạn là AI). Trả lời đúng câu hỏi của học sinh bằng tiếng Việt, ngắn gọn, từng bước, dễ hiểu. Chỉ dùng số liệu có trong ngữ cảnh; nếu không chắc thì nói rõ.';

const results = [];
for (const item of items) {
  for (const variant of ['before', 'after']) {
    const r = await page.evaluate(
      async ({ item, variant, model, BEFORE_SYSTEM }) => {
        const k = await import('/src/teacher/chat/knowledge.ts');
        const c = await import('/src/teacher/chat/chatService.ts');
        const g = await import('/src/ai/webGemma.ts');
        let system;
        if (variant === 'before') {
          const notes = k
            .searchKnowledge(item.question, 'vi', 4)
            .map((n) => ({ ...n, text: n.text.slice(0, 1500) }));
          system = notes.length
            ? `${BEFORE_SYSTEM}\n\nTrích đoạn thư viện kiến thức cục bộ (tham khảo; có thể chưa bao quát):\n${notes.map((n) => `[${n.name}] ${n.text}`).join('\n\n')}`
            : BEFORE_SYSTEM;
        } else {
          system = (await c.contextPrompt(item.question, 'vi', false, false, 'compact')).system;
        }
        const messages = [...(item.history ?? []), { role: 'user', content: item.question }];
        const t0 = performance.now();
        let first = null;
        try {
          const res = await g.webGemmaChat({
            model,
            system,
            messages,
            maxTokens: 1024,
            onPartial: () => {
              if (first === null) first = performance.now() - t0;
            },
          });
          return {
            ok: true,
            answer: res.content,
            truncated: res.truncated,
            firstMs: first && Math.round(first),
            ms: Math.round(performance.now() - t0),
            promptChars: system.length,
          };
        } catch (e) {
          return {
            ok: false,
            answer: '',
            error: String(e),
            ms: Math.round(performance.now() - t0),
            promptChars: system.length,
          };
        }
      },
      { item, variant, model, BEFORE_SYSTEM },
    );
    const score = scoreAnswer(item, r.answer);
    results.push({ id: item.id, subject: item.subject, type: item.type, variant, ...r, score });
    console.log(
      `${item.id} ${variant}: ${r.ok ? 'ok' : 'FAIL'} ${r.ms} ms facts ${score.keyFacts.toFixed(2)} errors ${score.wrong.length} q ${score.checkQuestion}`,
    );
    writeFileSync(
      resolve(out, `eval-${model}.json`),
      JSON.stringify({ model, adapter, results }, null, 2),
    );
  }
}
const summary = {};
for (const variant of ['before', 'after']) {
  const rs = results.filter((r) => r.variant === variant);
  summary[variant] = {
    ...summarize(rs.map((r) => r.score)),
    failures: rs.filter((r) => !r.ok).length,
    truncated: rs.filter((r) => r.truncated).length,
    meanFirstPieceMs: Math.round(
      rs.reduce((a, r) => a + (r.firstMs ?? 0), 0) / Math.max(1, rs.length),
    ),
    meanMs: Math.round(rs.reduce((a, r) => a + r.ms, 0) / Math.max(1, rs.length)),
    meanPromptChars: Math.round(rs.reduce((a, r) => a + r.promptChars, 0) / Math.max(1, rs.length)),
  };
}
writeFileSync(
  resolve(out, `eval-${model}.json`),
  JSON.stringify({ model, adapter, summary, results }, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
await context.close();
