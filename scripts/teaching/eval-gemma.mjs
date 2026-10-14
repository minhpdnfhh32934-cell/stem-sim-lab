// Runs the AI Teacher evaluation set (tests/teaching/teaching-eval.json) on the in-app Gemma, in
// Microsoft Edge (same engine as WebView2), through the app's own code, and scores the answers
// with scripts/teaching/rubric.mjs. Compares prompt variants and decodings on the same questions.
//
//   npm run dev                                   (dev server, default http://localhost:1420)
//   node scripts/teaching/eval-gemma.mjs --model gemma3-1b --profile <folder> --out <folder>
//        [--variants legacy,current] [--decoding app] [--temperature 0] [--repeats 1]
//        [--label <name>] [--only P1,C3] [--base <url>] [--skip <file,...>] [--retries 0]
//
// --variants   legacy   = the on-device prompt of main before the 2026-10-13 audit (below);
//              current  = the live prompt of the 0.6.0 build, contextPrompt(question, 'vi', false,
//                         false, 'compact', history), with the note placed and the echo removed as
//                         askTeacher does;
//              improved = the same live prompt, served by the improved build (feat/teacher-quality).
//              current and improved run the same code, so the label must match the build --base
//              serves: current refuses a chatService.ts that imports ./missingData (the improved
//              build), improved refuses one that does not. Run the script once per build.
// --decoding   passed to webGemmaChat as `decoding` (legacy = the worker's pre-audit decoding,
//              app = the decoding the app uses now). The app must support the option.
// --temperature 0 = greedy (default): the same prompt gives the same answer, so a difference
//              between variants is not sampling noise. With sampling, use --repeats > 1. The app
//              itself samples at 0.2: label greedy results as greedy.
// --label      output file eval-<model>-<label>.json (default eval-<model>.json). An existing
//              file is never overwritten: pick a new label (results of an earlier run stay as
//              they are).
// --skip       earlier result files: every (question, variant, decoding, temperature, repeat)
//              they hold with an answer is not run again (to finish an interrupted run). A file
//              of another model or another build is refused.
// --retries    0–2 more attempts for a run that failed for another reason than the GPU or a
//              stall. Every attempt is kept; a failed attempt is never scored as an answer. A GPU
//              failure or a stalled answer stops the run.
// Variants (and decodings) are interleaved per question so drift during the run (heat, other
// load) hits them alike. Every result records how it was made: the system prompt and the turn
// asked (for blind judging and audits), the model and the build = { commit: git rev-parse HEAD of
// the repository this script runs in, dirty: tracked files differ from it, chatServiceSha256:
// SHA-256 of /src/teacher/chat/chatService.ts as --base serves it, model }. Compare runs with
// scripts/teaching/compare.mjs (it never merges two builds into one group); re-score a saved run
// with the current rubric (no browser, no GPU) with scripts/teaching/rescore.mjs.
//
// SAFETY (audit GPU-01): runs only on a discrete NVIDIA GPU (--force_high_performance_gpu) and
// stops otherwise: long Gemma work on an integrated card crashed a test machine (bugcheck 0x119).
// Checked before the first question: the page's default adapter (the Gemma worker asks for the
// default one) and the high-performance one, then the adapter the worker reports after loading the
// model (one-token warm-up); re-checked after every answer.
// The model must already be downloaded in <profile> (the script never starts a big download).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evalSetPath,
  gpuRefusal,
  groupKey,
  repoPath,
  scoreAnswer,
  skipRefusal,
  stopsRun,
  summarizeRuns,
  variantRefusal,
} from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
/** A comma-separated option whose values must come from `allowed`. */
const list = (name, fallback, allowed) => {
  const values = [
    ...new Set(
      String(arg(name, fallback))
        .split(',')
        .map((s) => s.trim()),
    ),
  ].filter(Boolean);
  const bad = values.filter((v) => !allowed.includes(v));
  if (!values.length || bad.length) {
    throw new Error(
      `--${name}: expected some of ${allowed.join(', ')}, got "${arg(name, fallback)}"`,
    );
  }
  return values;
};
const model = arg('model', 'gemma3-1b');
const profile = arg('profile');
const out = arg('out', resolve(root, '.agent-logs/teaching-eval'));
const base = arg('base', 'http://localhost:1420');
const only = arg('only');
const variants = list('variants', 'legacy,current', ['legacy', 'current', 'improved']);
// --improved-name <name>: how results of the 'improved' variant are labelled (e.g. improved-v2),
// so two improved builds never share a group in compare.mjs. Must start with "improved".
const improvedName = arg('improved-name', 'improved');
if (!/^improved[\w.-]{0,20}$/.test(improvedName))
  throw new Error('--improved-name must start with "improved" (letters, digits, - _ . only)');
/** The label a result is stored under (the prompt used is still the variant's). */
const storedVariant = (variant) => (variant === 'improved' ? improvedName : variant);
const decodings = list('decoding', 'app', ['legacy', 'app']);
const temperature = Number(arg('temperature', '0'));
const repeats = Number(arg('repeats', '1'));
const label = arg('label');
const skipFiles = arg('skip') ? String(arg('skip')).split(',').filter(Boolean) : [];
const retries = Number(arg('retries', '0'));
if (!profile)
  throw new Error('--profile <Edge profile folder that already holds the model> is required');
if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
  throw new Error('--temperature must be a number from 0 (greedy) to 2');
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
  throw new Error('--repeats must be a whole number from 1 to 20');
if (label !== undefined && !/^[\w.-]{1,40}$/.test(label))
  throw new Error('--label: letters, digits, "-", "_" and "." only');
if (!Number.isInteger(retries) || retries < 0 || retries > 2)
  throw new Error('--retries must be 0, 1 or 2');
if (temperature === 0 && repeats > 1)
  console.warn('Greedy decoding (--temperature 0): repeats give the same answers (timing only).');
mkdirSync(out, { recursive: true });
const file = resolve(out, label ? `eval-${model}-${label}.json` : `eval-${model}.json`);
if (existsSync(file))
  throw new Error(`${file} already exists: choose another --label (earlier results are kept)`);
const settings = {
  variants,
  decodings,
  temperature,
  repeats,
  label: label ?? null,
  improvedName,
  set: repoPath(root, arg('set') ?? 'tests/teaching/teaching-eval.json'),
  skip: skipFiles.map((f) => repoPath(root, f)),
  retries,
};
/** One run of the evaluation, the same in every result file. */
const runKey = (r) => [r.id, r.variant, r.decoding, r.temperature, r.repeat].join('|');
const skipped = skipFiles.map((f) => ({ f, saved: JSON.parse(readFileSync(f, 'utf8')) }));
const done = new Set(
  skipped.flatMap(({ saved }) => saved.results.filter((r) => r.ok && r.answer.trim()).map(runKey)),
);
/** Load on the NVIDIA card before a run (another app using it slows Gemma down). */
function gpuLoad() {
  try {
    const [util, memory] = execFileSync(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,memory.used', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 5000 },
    )
      .trim()
      .split(',')
      .map((x) => Number(x.trim()));
    return { util, memoryMiB: memory };
  } catch {
    return null;
  }
}
/** A git query in the repository this script runs in (null when git is not available). */
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

const set = JSON.parse(readFileSync(evalSetPath(root, process.argv), 'utf8'));
const items = only ? set.items.filter((i) => only.split(',').includes(i.id)) : set.items;

const context = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
  args: ['--force_high_performance_gpu'],
});
// Never download: the model must already be stored; any request to the model hosts is refused.
await context.route(/^https:\/\/(?:[a-z0-9-]+\.)*(?:huggingface\.co|hf\.co)\//i, (route) =>
  route.abort(),
);
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(base);
await page.waitForLoadState('networkidle');

/** Stops before any GPU work with an error message and exit code. */
async function stop(message, code) {
  console.error(message);
  await context.close();
  process.exit(code);
}

// Results labelled with a decoding the app ignores would be wrong: check the option exists in the
// served webGemma module before anything else (no GPU work).
const knowsDecoding = await page.evaluate(async () =>
  /\bdecoding\b/.test(await (await fetch('/src/ai/webGemma.ts')).text()),
);
if (!knowsDecoding) {
  await stop('This app version has no `decoding` option in webGemmaChat; update the app first.', 5);
}

// The build the server under --base serves (no GPU work): a live-prompt variant must carry the
// label of that build, and every result records it so compare.mjs never mixes two builds.
const chatService = await page.evaluate(async () => {
  const res = await fetch('/src/teacher/chat/chatService.ts');
  return res.ok ? await res.text() : null;
});
if (chatService === null) await stop(`${base} does not serve src/teacher/chat/chatService.ts.`, 7);
const refusal = variantRefusal(variants, chatService);
if (refusal) await stop(`Refusing to run: ${refusal}.`, 7);
const status = git('status', '--porcelain', '--untracked-files=no');
const build = {
  commit: git('rev-parse', 'HEAD'),
  dirty: status === null ? null : status !== '',
  chatServiceSha256: createHash('sha256').update(chatService).digest('hex'),
  model,
};
if (build.dirty) console.warn('Tracked files differ from the commit: the build is marked dirty.');
for (const { f, saved } of skipped) {
  const why = skipRefusal(saved, { model, build });
  if (why) await stop(`--skip ${f}: ${why}; it cannot complete this run.`, 8);
}

/** Stops before any (more) Gemma work unless every adapter seen is a discrete NVIDIA card. */
async function refuseUnlessNvidia(seen) {
  const why = gpuRefusal(seen);
  if (!why) return;
  await stop(`Refusing to run: ${why} (discrete NVIDIA GPU only, audit GPU-01).`, 2);
}

// The Gemma worker asks WebGPU for the default adapter (no options): check that one, and the
// high-performance one, before anything touches the GPU.
const pageAdapters = await page.evaluate(async () => {
  const name = (a) => (a ? `${a.info.vendor} ${a.info.architecture}`.trim() : 'none');
  const gpu = navigator.gpu;
  return {
    default: name(await gpu?.requestAdapter()),
    highPerformance: name(await gpu?.requestAdapter({ powerPreference: 'high-performance' })),
  };
});
await refuseUnlessNvidia(pageAdapters);
const ready = await page.evaluate(
  async (id) => (await import('/src/ai/webGemma.ts')).webGemmaStatus(id),
  model,
);
if (ready !== 'ready') {
  await stop(`${model} is not downloaded in this profile; download it in the app first.`, 3);
}

// Load the model with a one-token warm-up (not an evaluation question) and read the adapter the
// worker really used: its "loaded" message sets useGpuStore.gemmaInfo. This also keeps the model
// load out of the first question's timing.
const warmUp = await page.evaluate(async (id) => {
  const g = await import('/src/ai/webGemma.ts');
  const { useGpuStore } = await import('/src/ai/gpu.ts');
  useGpuStore.getState().setGemmaInfo(null);
  let error = null;
  try {
    await g.webGemmaChat({
      model: id,
      system: 'Trả lời ngắn.',
      messages: [{ role: 'user', content: 'Xin chào' }],
      maxTokens: 1,
    });
  } catch (e) {
    error = String(e);
  }
  const info = useGpuStore.getState().gemmaInfo;
  return { gemma: info ? `${info.vendor} ${info.architecture}`.trim() : 'none', error };
}, model);
const adapters = { ...pageAdapters, gemma: warmUp.gemma };
await refuseUnlessNvidia(adapters);
// One token may decode to nothing ("empty reply"); any other error means Gemma is not usable.
if (warmUp.error && !warmUp.error.includes('empty reply')) {
  await stop(`Gemma warm-up failed: ${warmUp.error}`, 4);
}
const adapter = warmUp.gemma;

// The on-device prompt of main before the audit (src/teacher/chat/chatService.ts @ c25ad9d).
const LEGACY_SYSTEM =
  'Bạn là AI Teacher, trợ lý học tập (bạn là AI). Trả lời đúng câu hỏi của học sinh bằng tiếng Việt, ngắn gọn, từng bước, dễ hiểu. Chỉ dùng số liệu có trong ngữ cảnh; nếu không chắc thì nói rõ.';

const pct = (x) => (x === null ? '–' : x.toFixed(2));
const results = [];
for (const item of items) {
  const index = items.indexOf(item);
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const decoding of decodings) {
      // Alternate which variant goes first, so neither always runs right after a model switch.
      const order = (index + repeat) % 2 ? [...variants].reverse() : variants;
      for (const variant of order) {
        if (
          done.has(
            runKey({ id: item.id, variant: storedVariant(variant), decoding, temperature, repeat }),
          )
        ) {
          console.log(`${item.id} ${variant}/${decoding} #${repeat}: already done (skipped)`);
          continue;
        }
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          const startedAt = new Date().toISOString();
          const load = gpuLoad();
          const r = await page.evaluate(
            async ({ item, variant, decoding, temperature, model, LEGACY_SYSTEM }) => {
              const k = await import('/src/teacher/chat/knowledge.ts');
              const c = await import('/src/teacher/chat/chatService.ts');
              const g = await import('/src/ai/webGemma.ts');
              const { useGpuStore } = await import('/src/ai/gpu.ts');
              // The adapter the worker reported for its current model (a restarted worker reloads it).
              const gpu = () => {
                const info = useGpuStore.getState().gemmaInfo;
                return info ? `${info.vendor} ${info.architecture}`.trim() : 'none';
              };
              let system;
              // What the learner's question turns into: the app (askTeacher) moves the on-device
              // note in front of the question when earlier turns come in between.
              let asked = item.question;
              if (variant === 'legacy') {
                const notes = k
                  .searchKnowledge(item.question, 'vi', 4)
                  .map((n) => ({ ...n, text: n.text.slice(0, 1500) }));
                system = notes.length
                  ? `${LEGACY_SYSTEM}\n\nTrích đoạn thư viện kiến thức cục bộ (tham khảo; có thể chưa bao quát):\n${notes.map((n) => `[${n.name}] ${n.text}`).join('\n\n')}`
                  : LEGACY_SYSTEM;
              } else {
                // current and improved: the live prompt of the served build (checked above).
                const history = item.history ?? [];
                const prompt = await c.contextPrompt(
                  item.question,
                  'vi',
                  false,
                  false,
                  'compact',
                  history,
                );
                // The 0.6.0 build returns no `note`: nothing moves there.
                const noteInTurn = Boolean(prompt.note) && history.length > 0;
                system = noteInTurn ? prompt.system.slice(0, -prompt.note.length) : prompt.system;
                if (noteInTurn) asked = `${prompt.note.trim()}\n\n${item.question}`;
              }
              const messages = [...(item.history ?? []), { role: 'user', content: asked }];
              const t0 = performance.now();
              let first = null;
              try {
                const res = await g.webGemmaChat({
                  model,
                  system,
                  messages,
                  maxTokens: 1024,
                  temperature,
                  decoding,
                  // The app strips the question a small model repeats first (askTeacher's echo).
                  // The 0.6.0 build ignores the option and strips the last user turn, which is
                  // the question there.
                  echo: item.question,
                  onPartial: () => {
                    if (first === null) first = performance.now() - t0;
                  },
                });
                return {
                  ok: true,
                  answer: res.content,
                  truncated: res.truncated,
                  // null when no piece was seen (never 0 ms).
                  firstMs: first === null ? null : Math.round(first),
                  ms: Math.round(performance.now() - t0),
                  promptChars: system.length,
                  system,
                  asked,
                  gpu: gpu(),
                };
              } catch (e) {
                return {
                  ok: false,
                  answer: '',
                  error: String(e),
                  firstMs: null,
                  ms: Math.round(performance.now() - t0),
                  promptChars: system.length,
                  system,
                  asked,
                  gpu: gpu(),
                };
              }
            },
            { item, variant, decoding, temperature, model, LEGACY_SYSTEM },
          );
          const score = scoreAnswer(item, r.answer);
          results.push({
            id: item.id,
            subject: item.subject,
            type: item.type,
            model,
            build,
            variant: storedVariant(variant),
            decoding,
            temperature,
            repeat,
            attempt,
            startedAt,
            gpuLoad: load,
            ...r,
            score,
          });
          console.log(
            `${item.id} ${variant}/${decoding} #${repeat}: ${r.ok ? 'ok' : 'FAIL'} ${r.ms} ms facts ${score.keyFacts.toFixed(2)} errors ${score.wrong.length} correct ${score.correct} q ${score.endsWithQuestion} ask ${score.asksClarification} names ${score.namesMissing} steps ${score.steps === null ? '–' : pct(score.steps)} trap ${score.trapHandled} invented ${score.invented.length} foreign ${pct(score.foreignScript)} mangled ${score.mangled.length}`,
          );
          writeFileSync(
            file,
            JSON.stringify({ model, build, adapter, adapters, settings, results }, null, 2),
          );
          await refuseUnlessNvidia({ gemma: r.gpu });
          if (r.ok) break;
          if (stopsRun(r.error ?? '')) {
            await stop(
              `Stopping: ${r.error}; no retry and no further question (audit GPU-01: GPU failure or stalled answer).`,
              6,
            );
          }
          if (attempt < retries) console.log(`  retry ${attempt + 1}/${retries} after: ${r.error}`);
        }
      }
    }
  }
}
// Means of time and length over the answers that came back; failures are counted separately.
const summary = {};
for (const key of [...new Set(results.map(groupKey))]) {
  summary[key] = summarizeRuns(results.filter((r) => groupKey(r) === key));
}
writeFileSync(
  file,
  JSON.stringify({ model, build, adapter, adapters, settings, summary, results }, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
await context.close();
