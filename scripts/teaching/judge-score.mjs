// Unblinds AI judges' scores (made from judge-prep.mjs files with scripts/teaching/judge-rubric.md)
// and summarises them per group: correctness (0–2), clarity and completeness (1–5), flags; per
// subject and question kind; and how much two judges agreed (exact agreement and Cohen's kappa on
// correctness, mean absolute difference on the 1–5 scales). AI judgement, not a teacher's.
//
//   node scripts/teaching/judge-score.mjs --key <judge-key.SECRET.json> [--json <out>] <scores…>
//
// A scores file: { "judge": "j0", "scores": [ { "id", "code", "correctness", "clarity",
// "completeness", "flags": {…}, "note" } ] }.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalSetPath } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const keyFile = opt('key');
const jsonOut = opt('json');
const valued = new Set(['--key', '--json', '--set']);
const files = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1] ?? ''));
if (!keyFile || !files.length) throw new Error('usage: --key <key> [--json <out>] <scores…>');
const { key, groups } = JSON.parse(readFileSync(keyFile, 'utf8'));
const set = JSON.parse(readFileSync(evalSetPath(root, process.argv), 'utf8'));
const items = new Map(set.items.map((i) => [i.id, i]));
const kindOf = (item) =>
  item.expectsClarify ? 'missing-data' : item.history?.length ? 'feedback' : item.type;

const rows = [];
for (const f of files) {
  const { judge, scores } = JSON.parse(readFileSync(f, 'utf8'));
  for (const s of scores) {
    const group = key[judge]?.[s.id]?.[s.code];
    if (!group) throw new Error(`${f}: no key for ${judge} ${s.id} ${s.code}`);
    const item = items.get(s.id);
    rows.push({ ...s, judge, group, subject: item.subject, kind: kindOf(item) });
  }
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '–');
const pct = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)} %` : '–');
const summary = {};
for (const g of groups) {
  const rs = rows.filter((r) => r.group === g);
  summary[g] = {
    answers: rs.length,
    correctness: mean(rs.map((r) => r.correctness)),
    fullyCorrect: mean(rs.map((r) => (r.correctness === 2 ? 1 : 0))),
    clarity: mean(rs.map((r) => r.clarity)),
    completeness: mean(rs.map((r) => r.completeness)),
    inventedNumbers: mean(rs.map((r) => (r.flags?.invented_numbers ? 1 : 0))),
    endorsesError: mean(rs.map((r) => (r.flags?.endorses_error ? 1 : 0))),
    languageProblem: mean(rs.map((r) => (r.flags?.language_problem ? 1 : 0))),
    asksMissing: mean(
      rs
        .filter((r) => r.kind === 'missing-data')
        .map((r) => (r.flags?.asks_for_missing_data ? 1 : 0)),
    ),
  };
}
console.log(`${rows.length} judged answers (AI judges, labels hidden, order shuffled per judge)\n`);
const line = (label, fn) =>
  console.log([label.padEnd(34), ...groups.map((g) => fn(summary[g]).padEnd(28))].join(''));
console.log([''.padEnd(34), ...groups.map((g) => g.padEnd(28))].join(''));
line('correctness (0–2, mean)', (s) => f2(s.correctness));
line('fully correct (score 2)', (s) => pct(s.fullyCorrect));
line('clarity (1–5)', (s) => f2(s.clarity));
line('completeness (1–5)', (s) => f2(s.completeness));
line('invented numbers', (s) => pct(s.inventedNumbers));
line('agrees with an error', (s) => pct(s.endorsesError));
line('language problems', (s) => pct(s.languageProblem));
line('asks for missing data (9 items)', (s) => pct(s.asksMissing));

for (const by of ['subject', 'kind']) {
  console.log(`\nCorrectness (0–2) by ${by}`);
  for (const v of [...new Set(rows.map((r) => r[by]))].sort()) {
    console.log(
      [
        v.padEnd(34),
        ...groups.map((g) =>
          f2(
            mean(rows.filter((r) => r.group === g && r[by] === v).map((r) => r.correctness)),
          ).padEnd(28),
        ),
      ].join(''),
    );
  }
}

// Agreement between the first two judges on the same (question, group).
const judgesSeen = [...new Set(rows.map((r) => r.judge))].sort();
let agreement = null;
if (judgesSeen.length >= 2) {
  const [a, b] = judgesSeen;
  const byKey = (j) =>
    new Map(rows.filter((r) => r.judge === j).map((r) => [`${r.id}|${r.group}`, r]));
  const A = byKey(a);
  const B = byKey(b);
  const pairs = [...A.keys()].filter((k) => B.has(k)).map((k) => [A.get(k), B.get(k)]);
  const po = mean(pairs.map(([x, y]) => (x.correctness === y.correctness ? 1 : 0)));
  const pe = [0, 1, 2].reduce(
    (s, c) =>
      s +
      mean(pairs.map(([x]) => (x.correctness === c ? 1 : 0))) *
        mean(pairs.map(([, y]) => (y.correctness === c ? 1 : 0))),
    0,
  );
  agreement = {
    pairs: pairs.length,
    correctnessExact: po,
    correctnessKappa: (po - pe) / (1 - pe),
    clarityMeanAbsDiff: mean(pairs.map(([x, y]) => Math.abs(x.clarity - y.clarity))),
    completenessMeanAbsDiff: mean(pairs.map(([x, y]) => Math.abs(x.completeness - y.completeness))),
  };
  console.log(
    `\nJudges ${a} vs ${b} on ${pairs.length} answers: correctness agree ${pct(po)}, Cohen's kappa ${f2(agreement.correctnessKappa)}; clarity mean |diff| ${f2(agreement.clarityMeanAbsDiff)}; completeness mean |diff| ${f2(agreement.completenessMeanAbsDiff)}`,
  );
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ groups, summary, agreement, rows }, null, 2));
