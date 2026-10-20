// Re-scores a saved AI Teacher evaluation (the JSON written by scripts/teaching/eval-gemma.mjs)
// with the current rubric (scripts/teaching/rubric.mjs) and evaluation set
// (tests/teaching/teaching-eval.json). Only reads the saved answers: no browser, no GPU, no model.
//
//   node scripts/teaching/rescore.mjs <eval-….json> [--out <rescored.json>] [--changes]
//
// Prints a summary per configuration (model/variant/decoding/temperature, see groupKey) next to
// the summary saved with the run, and with --changes every answer whose check changed.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evalSetPath,
  fileRuns,
  groupKey,
  repoPath,
  scoreAnswer,
  summarizeRuns,
  writeNew,
} from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--set',
);
if (!input) {
  console.error(
    'usage: node scripts/teaching/rescore.mjs <eval-….json> [--out <file>] [--changes]',
  );
  process.exit(1);
}
const out = flag('out');

const saved = JSON.parse(readFileSync(resolve(input), 'utf8'));
const set = JSON.parse(readFileSync(evalSetPath(root, process.argv), 'utf8'));
const items = new Map(set.items.map((i) => [i.id, i]));

const results = fileRuns(saved, repoPath(root, input)).map((r) => {
  const item = items.get(r.id);
  if (!item) throw new Error(`question ${r.id} is not in tests/teaching/teaching-eval.json`);
  return { ...r, savedScore: r.score, score: scoreAnswer(item, r.answer ?? '') };
});
const groups = [...new Set(results.map(groupKey))];
const summary = Object.fromEntries(
  groups.map((g) => [g, summarizeRuns(results.filter((r) => groupKey(r) === g))]),
);
// Older files keyed their summary without the model ("current/app/0", up to 2026-10-14) or by
// variant only ("before", "after", up to 2026-10-13).
const savedSummary = (g) => {
  const r = results.find((x) => groupKey(x) === g);
  return (
    saved.summary?.[g] ??
    (r ? saved.summary?.[groupKey({ ...r, model: undefined }).replace(/^\?\//, '')] : undefined) ??
    saved.summary?.[r?.variant]
  );
};

const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
const num = (x) => (x === null || x === undefined ? '–' : String(Math.round(x)));
const rows = [
  ['key facts', (s) => pct(s.keyFacts)],
  ['no known errors', (s) => pct(s.noKnownErrors)],
  ['correct (all key facts, no error)', (s) => pct(s.correct)],
  ['check q. (concept/misconception)', (s) => pct(s.checkQuestion)],
  ['asks for missing data', (s) => pct(s.asksClarification)],
  ['names the missing data', (s) => pct(s.namesMissing)],
  ['steps in order', (s) => pct(s.steps)],
  ['trap handled', (s) => pct(s.trapHandled)],
  ['answers with foreign script', (s) => pct(s.foreignScriptAnswers)],
  ['answers with corrupted terms', (s) => pct(s.mangledTerms)],
  ['mean characters', (s) => num(s.meanChars)],
  ['mean first piece (ms)', (s) => num(s.meanFirstPieceMs)],
  ['median first piece (ms)', (s) => num(s.medianFirstPieceMs)],
  ['mean answer time (ms)', (s) => num(s.meanMs)],
  ['answers / failures', (s) => (s ? `${s.n} / ${s.failures ?? 0}` : '–')],
];
console.log(`${saved.model ?? '?'} on ${saved.adapter ?? '?'}: ${results.length} answers`);
for (const g of groups) {
  const was = savedSummary(g);
  console.log(`\n${g}${was ? ' (saved → re-scored)' : ''}`);
  for (const [label, show] of rows) {
    const now = show(summary[g]);
    console.log(`  ${label.padEnd(34)} ${was ? `${show(was)} → ${now}` : now}`);
  }
}

if (args.includes('--changes')) {
  console.log('\nchanged checks:');
  for (const r of results) {
    const before = r.savedScore ?? {};
    for (const key of [
      'noKnownErrors',
      'correct',
      'checkQuestion',
      'asksClarification',
      'namesMissing',
      'steps',
      'trapHandled',
      'keyFacts',
    ]) {
      if (before[key] !== undefined && before[key] !== r.score[key]) {
        console.log(
          `  ${r.id} ${groupKey(r)} #${r.repeat ?? 0} ${key}: ${before[key]} → ${r.score[key]}`,
        );
      }
    }
  }
}

if (out) {
  // A new file only: never the raw input or an earlier rescore.
  writeNew(
    resolve(out),
    JSON.stringify(
      { ...saved, rescoredWith: 'scripts/teaching/rubric.mjs', summary, results },
      null,
      2,
    ),
  );
}
