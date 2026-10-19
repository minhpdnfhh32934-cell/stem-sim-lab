// Compares saved AI Teacher evaluations (JSON files written by scripts/teaching/eval-gemma.mjs).
// Every answer is re-scored with the current rubric (scripts/teaching/rubric.mjs) and evaluation
// set (tests/teaching/teaching-eval.json), so all files are judged alike. Only reads the files:
// no browser, no GPU, no model.
//
//   node scripts/teaching/compare.mjs <eval-….json> [more files…] [--a <group>] [--b <group>]
//
// Groups are configurations "model/variant/decoding/temperature" (rubric.mjs groupKey; files from
// before 2026-10-14 count as decoding "legacy", temperature 0.2; a result without a model takes
// the file's). Runs of two app builds (another commit or another served chatService.ts, see
// eval-gemma.mjs `build`) are never merged into one group: the script stops instead. Results
// without a build (the 2026-10-14 baseline, whose "current" is the PR #20 (f527f18) prompt) are
// accepted as they are. Prints one column per group,
// then a paired comparison of group A against group B on the questions both answered, with ONE
// outcome per question (averaged over its repeats): mean keyFacts (A better / B better / tie,
// exact sign test) and the share of correct answers (every key fact, no known error; exact
// McNemar test). Key-fact groups paired by repeat are printed as a description only. Without
// --a/--b the pair is compared only when there are exactly two groups.
//
// Repeats: a run keeps the repeat number it was saved with (a rerun of `--skip` or `--retries`
// pairs like the attempt that failed); only answered runs without one (files up to 2026-10-13)
// are numbered, in reading order (rubric.mjs numberRepeats). Failed runs are counted in the
// "failures" row and never paired.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildConflicts,
  evalSetPath,
  fileRuns,
  groupKey,
  numberRepeats,
  pairedComparison,
  scoreAnswer,
  summarizeRuns,
} from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const files = args.filter(
  (a, i) => !a.startsWith('--') && !['--a', '--b', '--set'].includes(args[i - 1]),
);
if (!files.length) {
  console.error(
    'usage: node scripts/teaching/compare.mjs <eval-….json> [more files…] [--a <group>] [--b <group>]',
  );
  process.exit(1);
}

const set = JSON.parse(readFileSync(evalSetPath(root, process.argv), 'utf8'));
const items = new Map(set.items.map((i) => [i.id, i]));

const read = [];
for (const f of files) {
  const saved = JSON.parse(readFileSync(resolve(f), 'utf8'));
  for (const r of fileRuns(saved, f)) {
    const item = items.get(r.id);
    if (!item)
      throw new Error(`${f}: question ${r.id} is not in tests/teaching/teaching-eval.json`);
    read.push({ ...r, score: scoreAnswer(item, r.answer ?? '') });
  }
}
const conflicts = buildConflicts(read);
if (conflicts.length) {
  for (const c of conflicts) {
    console.error(`${c.key}: results of different builds (commit, chatService.ts hash):`);
    for (const b of c.builds) console.error(`  ${b}`);
  }
  console.error('Refusing to merge them into one group: compare them as separate files.');
  process.exit(1);
}
const runs = numberRepeats(read);
const groups = [...new Set(runs.map(groupKey))].sort();
const of = (g) => runs.filter((r) => groupKey(r) === g);
const summary = Object.fromEntries(groups.map((g) => [g, summarizeRuns(of(g))]));

// Answered runs that share configuration, question and repeat (the same settings saved twice):
// the per-question tests average them; the key-fact group description pairs only one of them.
const slots = new Map();
for (const r of runs.filter((x) => x.ok)) {
  const k = `${groupKey(r)} ${r.id} #${r.repeat}`;
  slots.set(k, (slots.get(k) ?? 0) + 1);
}
const shared = [...slots.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);

const pct = (x) => (x === null || x === undefined ? '–' : `${(x * 100).toFixed(1)} %`);
const num = (x) => (x === null || x === undefined ? '–' : String(Math.round(x)));
const rows = [
  ['answers (questions)', (s) => `${s.n} (${s.items})`],
  ['failures', (s) => String(s.failures)],
  ['key facts (mean)', (s) => pct(s.keyFacts)],
  ['no known errors', (s) => pct(s.noKnownErrors)],
  ['correct (all key facts, no known error)', (s) => pct(s.correct)],
  ['check question (concept/misconception)', (s) => pct(s.checkQuestion)],
  ['asks for missing data', (s) => pct(s.asksClarification)],
  ['names the missing data', (s) => pct(s.namesMissing)],
  ['steps in order (mean)', (s) => pct(s.steps)],
  ['trap handled', (s) => pct(s.trapHandled)],
  ['foreign script (mean share)', (s) => pct(s.foreignScript)],
  ['answers with foreign script', (s) => pct(s.foreignScriptAnswers)],
  ['answers with corrupted terms', (s) => pct(s.mangledTerms)],
  ['first piece p50 (ms)', (s) => num(s.medianFirstPieceMs)],
  ['first piece mean (ms)', (s) => num(s.meanFirstPieceMs)],
  ['answer time mean (ms)', (s) => num(s.meanMs)],
  ['answer length (chars)', (s) => num(s.meanChars)],
  ['prompt length (chars)', (s) => num(s.meanPromptChars)],
];
const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 2;
const width = Math.max(14, ...groups.map((g) => g.length)) + 2;
console.log(
  `${runs.length} answers from ${files.length} file(s), re-scored with the current rubric\n`,
);
if (shared) {
  console.log(
    `Note: ${shared} answers share configuration, question and repeat number with another answer; the per-question tests average them.\n`,
  );
}
console.log(`${''.padEnd(labelWidth)}${groups.map((g) => g.padStart(width)).join('')}`);
for (const [label, show] of rows) {
  console.log(
    `${label.padEnd(labelWidth)}${groups.map((g) => show(summary[g]).padStart(width)).join('')}`,
  );
}

const a = valueOf('a') ?? (groups.length === 2 ? groups[0] : undefined);
const b = valueOf('b') ?? (groups.length === 2 ? groups[1] : undefined);
if (!a || !b) {
  if (groups.length > 2) console.log('\nChoose a pair to compare: --a <group> --b <group>.');
  process.exit(0);
}
for (const g of [a, b]) {
  if (!groups.includes(g)) {
    console.error(`\nNo group "${g}". Groups: ${groups.join(', ')}`);
    process.exit(1);
  }
}
const p = pairedComparison(of(a), of(b));
const points = (x) => (x === null ? '–' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} points`);
console.log(
  `\nA = ${a}  vs  B = ${b}: ${p.items} questions answered by both (one outcome per question, averaged over its repeats)`,
);
console.log(
  `  key facts per question: A better ${p.wins}, B better ${p.losses}, ties ${p.ties}; exact sign test p = ${p.signP.toFixed(3)}`,
);
console.log(`  mean key-fact difference A − B: ${points(p.meanDiff)}`);
console.log(
  `  correct answer per question (all key facts, no known error): only A ${p.correct.onlyA}, only B ${p.correct.onlyB}, both ${p.correct.both}, neither ${p.correct.neither}; exact McNemar p = ${p.mcnemarP.toFixed(3)}`,
);
console.log(
  `  key-fact groups paired by question and repeat (description, not a test): only A ${p.groups.onlyA}, only B ${p.groups.onlyB}, both ${p.groups.both}, neither ${p.groups.neither}`,
);
console.log(
  '  (keyword checks only: a teacher still has to judge whether the core answer is right)',
);
