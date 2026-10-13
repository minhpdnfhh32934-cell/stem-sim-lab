// Re-scores a saved AI Teacher evaluation (the JSON written by scripts/teaching/eval-gemma.mjs)
// with the current rubric (scripts/teaching/rubric.mjs) and evaluation set
// (tests/teaching/teaching-eval.json). Only reads the saved answers: no browser, no GPU, no model.
//
//   node scripts/teaching/rescore.mjs <eval-….json> [--out <rescored.json>] [--changes]
//
// Prints a summary per variant (before/after) next to the summary saved with the run, and with
// --changes every answer whose check changed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreAnswer, summarizeRuns } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
if (!input) {
  console.error(
    'usage: node scripts/teaching/rescore.mjs <eval-….json> [--out <file>] [--changes]',
  );
  process.exit(1);
}
const out = flag('out');

const saved = JSON.parse(readFileSync(resolve(input), 'utf8'));
const set = JSON.parse(readFileSync(resolve(root, 'tests/teaching/teaching-eval.json'), 'utf8'));
const items = new Map(set.items.map((i) => [i.id, i]));

const results = saved.results.map((r) => {
  const item = items.get(r.id);
  if (!item) throw new Error(`question ${r.id} is not in tests/teaching/teaching-eval.json`);
  return { ...r, savedScore: r.score, score: scoreAnswer(item, r.answer ?? '') };
});
const variants = [...new Set(results.map((r) => r.variant))];
const summary = Object.fromEntries(
  variants.map((v) => [v, summarizeRuns(results.filter((r) => r.variant === v))]),
);

const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
const num = (x) => (x === null || x === undefined ? '–' : String(Math.round(x)));
const rows = [
  ['key facts', (s) => pct(s.keyFacts)],
  ['no known errors', (s) => pct(s.noKnownErrors)],
  ['ends with a check question', (s) => pct(s.checkQuestion)],
  ['asks for missing data', (s) => pct(s.asksClarification)],
  ['mean characters', (s) => num(s.meanChars)],
  ['mean first piece (ms)', (s) => num(s.meanFirstPieceMs)],
  ['median first piece (ms)', (s) => num(s.medianFirstPieceMs)],
  ['mean answer time (ms)', (s) => num(s.meanMs)],
  ['answers / failures', (s) => (s ? `${s.n} / ${s.failures ?? 0}` : '–')],
];
console.log(`${saved.model ?? '?'} on ${saved.adapter ?? '?'}: ${results.length} answers`);
for (const v of variants) {
  const was = saved.summary?.[v];
  console.log(`\n${v}${was ? ' (saved → re-scored)' : ''}`);
  for (const [label, show] of rows) {
    const now = show(summary[v]);
    console.log(`  ${label.padEnd(28)} ${was ? `${show(was)} → ${now}` : now}`);
  }
}

if (args.includes('--changes')) {
  console.log('\nchanged checks:');
  for (const r of results) {
    const before = r.savedScore ?? {};
    for (const key of ['noKnownErrors', 'checkQuestion', 'asksClarification', 'keyFacts']) {
      if (before[key] !== undefined && before[key] !== r.score[key]) {
        console.log(`  ${r.id} ${r.variant} ${key}: ${before[key]} → ${r.score[key]}`);
      }
    }
  }
}

if (out) {
  writeFileSync(
    resolve(out),
    JSON.stringify(
      { ...saved, rescoredWith: 'scripts/teaching/rubric.mjs', summary, results },
      null,
      2,
    ),
  );
}
