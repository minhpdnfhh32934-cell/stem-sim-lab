// Breaks saved AI Teacher evaluations down by question type and subject, and lists the answers
// with a serious problem (no key fact, a known wrong claim, an invented number on a missing-data
// question, agreement with a wrong learner claim). Re-scores every answer with the current rubric,
// like compare.mjs. Reads files only: no browser, no GPU.
//
//   node scripts/teaching/breakdown.mjs <eval-….json> [more files…] [--json <out>]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupKey, scoreAnswer } from './rubric.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (jsonAt < 0 || i !== jsonAt + 1));
const set = JSON.parse(readFileSync(resolve(root, 'tests/teaching/teaching-eval.json'), 'utf8'));
const items = new Map(set.items.map((i) => [i.id, i]));

const runs = files
  .flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).results)
  .filter((r) => r.ok && items.has(r.id))
  .map((r) => ({ ...r, score: scoreAnswer(items.get(r.id), r.answer), group: groupKey(r) }));
const groups = [...new Set(runs.map((r) => r.group))].sort();
const kindOf = (item) =>
  item.expectsClarify ? 'missing-data' : item.history?.length ? 'feedback' : item.type;
const pct = (x) => `${(x * 100).toFixed(0)} %`;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

const table = (title, keyOf) => {
  const keys = [...new Set(runs.map(keyOf))].sort();
  console.log(`\n${title}: mean key facts (answers)`);
  console.log(['', ...groups].map((g) => g.padEnd(18)).join(''));
  const rows = {};
  for (const k of keys) {
    const cells = groups.map((g) => {
      const rs = runs.filter((r) => r.group === g && keyOf(r) === k);
      return rs.length ? `${pct(mean(rs.map((r) => r.score.keyFacts)))} (${rs.length})` : '–';
    });
    rows[k] = cells;
    console.log([k, ...cells].map((c) => String(c).padEnd(18)).join(''));
  }
  return rows;
};
const byKind = table('By question kind', (r) => kindOf(items.get(r.id)));
const bySubject = table('By subject', (r) => r.subject);

/** Answers a teacher must look at first. */
const serious = runs
  .map((r) => {
    const item = items.get(r.id);
    const why = [];
    if (r.score.keyFacts === 0) why.push('no key fact');
    if (r.score.wrong.length) why.push(`known wrong claim (${r.score.wrong.length})`);
    if (item.expectsClarify && r.score.invented.length)
      why.push(`invented ${r.score.invented.join(', ')}`);
    if (item.history?.length && r.score.trapHandled === false) why.push('agrees with an error');
    if (r.score.mangled.length) why.push(`corrupted terms: ${r.score.mangled.join(', ')}`);
    return { id: r.id, group: r.group, why };
  })
  .filter((x) => x.why.length);
console.log('\nSerious problems per group (answers):');
for (const g of groups) {
  const s = serious.filter((x) => x.group === g);
  const none = s.filter((x) => x.why.includes('no key fact')).length;
  console.log(`  ${g}: ${s.length} answers flagged; ${none} with no key fact`);
}
const everyGroupFails = [...items.keys()].filter((id) =>
  groups.every((g) =>
    serious.some((x) => x.id === id && x.group === g && x.why.includes('no key fact')),
  ),
);
console.log(
  `\nQuestions with no key fact in EVERY group (${everyGroupFails.length}): ${everyGroupFails.join(', ')}`,
);
if (jsonOut)
  writeFileSync(
    jsonOut,
    JSON.stringify({ groups, byKind, bySubject, serious, everyGroupFails }, null, 2),
  );
