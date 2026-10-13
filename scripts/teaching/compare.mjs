// Compares saved AI Teacher evaluations (JSON files written by scripts/teaching/eval-gemma.mjs).
// Every answer is re-scored with the current rubric (scripts/teaching/rubric.mjs) and evaluation
// set (tests/teaching/teaching-eval.json), so all files are judged alike. Only reads the files:
// no browser, no GPU, no model.
//
//   node scripts/teaching/compare.mjs <eval-….json> [more files…] [--a <group>] [--b <group>]
//
// Groups are configurations "variant/decoding/temperature" (rubric.mjs groupKey; files from
// before 2026-10-14 count as decoding "legacy", temperature 0.2). Prints one column per group,
// then a paired comparison of group A against group B on the questions both answered: per
// question (mean keyFacts over repeats: A better / B better / tie, exact sign test) and per
// key-fact group (paired by question and repeat, exact McNemar test). Without --a/--b the pair
// is compared only when there are exactly two groups.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupKey, pairedComparison, scoreAnswer, summarizeRuns } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const files = args.filter((a, i) => !a.startsWith('--') && !['--a', '--b'].includes(args[i - 1]));
if (!files.length) {
  console.error(
    'usage: node scripts/teaching/compare.mjs <eval-….json> [more files…] [--a <group>] [--b <group>]',
  );
  process.exit(1);
}

const set = JSON.parse(readFileSync(resolve(root, 'tests/teaching/teaching-eval.json'), 'utf8'));
const items = new Map(set.items.map((i) => [i.id, i]));

// Re-score, and number the runs of one question within a group in reading order: two files with
// the same configuration become repeats 0, 1, … of it.
const runs = [];
const seen = new Map();
for (const f of files) {
  const saved = JSON.parse(readFileSync(resolve(f), 'utf8'));
  for (const r of saved.results ?? []) {
    const item = items.get(r.id);
    if (!item)
      throw new Error(`${f}: question ${r.id} is not in tests/teaching/teaching-eval.json`);
    const key = `${groupKey(r)} ${r.id}`;
    const repeat = seen.get(key) ?? 0;
    seen.set(key, repeat + 1);
    runs.push({ ...r, repeat, file: f, score: scoreAnswer(item, r.answer ?? '') });
  }
}
const groups = [...new Set(runs.map(groupKey))].sort();
const of = (g) => runs.filter((r) => groupKey(r) === g);
const summary = Object.fromEntries(groups.map((g) => [g, summarizeRuns(of(g))]));

const pct = (x) => (x === null || x === undefined ? '–' : `${(x * 100).toFixed(1)} %`);
const num = (x) => (x === null || x === undefined ? '–' : String(Math.round(x)));
const rows = [
  ['answers (questions)', (s) => `${s.n} (${s.items})`],
  ['failures', (s) => String(s.failures)],
  ['key facts (mean)', (s) => pct(s.keyFacts)],
  ['no known errors', (s) => pct(s.noKnownErrors)],
  ['ends with a check question', (s) => pct(s.checkQuestion)],
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
const width = Math.max(14, ...groups.map((g) => g.length)) + 2;
console.log(
  `${runs.length} answers from ${files.length} file(s), re-scored with the current rubric\n`,
);
console.log(`${''.padEnd(30)}${groups.map((g) => g.padStart(width)).join('')}`);
for (const [label, show] of rows) {
  console.log(`${label.padEnd(30)}${groups.map((g) => show(summary[g]).padStart(width)).join('')}`);
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
console.log(`\nA = ${a}  vs  B = ${b}: ${p.items} questions answered by both`);
console.log(
  `  per question (mean key facts): A better ${p.wins}, B better ${p.losses}, ties ${p.ties}; exact sign test p = ${p.signP.toFixed(3)}`,
);
console.log(`  mean key-fact difference A − B: ${points(p.meanDiff)}`);
console.log(
  `  per key-fact group (paired by question and repeat): only A ${p.groups.onlyA}, only B ${p.groups.onlyB}, both ${p.groups.both}, neither ${p.groups.neither}; exact McNemar p = ${p.mcnemarP.toFixed(3)}`,
);
console.log(
  '  (keyword checks only: a teacher still has to judge whether the core answer is right)',
);
