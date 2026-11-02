// Bench spec parity (0.8.1, docs/BENCH_DESIGN.md §14): a bench spec that copies a classic one
// (tests/e2e/bench/<name>.spec.ts beside tests/e2e/<name>.spec.ts) keeps every classic test title,
// so no check is lost when the bench becomes the default (B8). Bench-only specs have no twin.
// Usage: node scripts/e2e/title-parity.mjs   (exit code 1 lists the missing titles)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** The source without comment lines and block comments that start a line (commented-out tests). */
function code(source) {
  return source.replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The literal titles of `test(...)` calls (template titles keep their `${…}` text). `runs` keeps
 * only tests that run: no `test.skip(...)` or `test.fixme(...)`.
 */
export function testTitles(source, { runs = false } = {}) {
  const out = [];
  for (const m of code(source).matchAll(
    /\btest(?:\.(only|skip|fixme|fail))?\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g,
  ))
    if (!runs || (m[1] !== 'skip' && m[1] !== 'fixme')) out.push(m[3]);
  return out;
}

/** Titles that run in the classic spec but do not run in its bench twin. */
export function missingTitles(classic, bench) {
  const have = new Set(testTitles(bench, { runs: true }));
  return testTitles(classic, { runs: true }).filter((t) => !have.has(t));
}

/** Index of the `)` that closes the `(` at `open`, skipping string literals. */
function closing(text, open) {
  let depth = 0;
  let quote = '';
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return text.length - 1;
}

/**
 * Every call that switches tests off (`test.skip(…)`, `test.fixme(…)`, `test.describe.skip/fixme
 * (…)`), whole to its closing `)` however Prettier broke it, with its spacing and trailing comma
 * normalised.
 */
function switchOffs(source) {
  const text = code(source);
  return [...text.matchAll(/\btest(?:\.describe)?\.(?:skip|fixme)\(/g)].map((m) =>
    text
      .slice(m.index, closing(text, m.index + m[0].length - 1) + 1)
      .replace(/\s+/g, ' ')
      .replace(/,\s?\)/g, ')')
      .replace(/\(\s/g, '(')
      .replace(/\s\)/g, ')'),
  );
}

/**
 * Calls of the bench twin that switch tests off (in a test's body too) beyond those of the classic
 * spec, compared whole and counted (a multiset): a twin may copy a classic conditional skip, as
 * often as the classic spec has it, nothing more.
 */
export function extraSwitchOffs(classic, bench) {
  const allowed = new Map();
  for (const call of switchOffs(classic)) allowed.set(call, (allowed.get(call) ?? 0) + 1);
  return switchOffs(bench).filter((call) => {
    const left = allowed.get(call) ?? 0;
    allowed.set(call, left - 1);
    return left <= 0;
  });
}

/** Every bench spec with a classic twin under `e2eDir`: titles it lacks, tests it switches off. */
export function parityReport(e2eDir) {
  const benchDir = resolve(e2eDir, 'bench');
  if (!existsSync(benchDir)) return [];
  return readdirSync(benchDir)
    .filter((f) => f.endsWith('.spec.ts') && existsSync(resolve(e2eDir, f)))
    .map((f) => {
      const classic = readFileSync(resolve(e2eDir, f), 'utf8');
      const bench = readFileSync(resolve(benchDir, f), 'utf8');
      return {
        spec: f,
        missing: missingTitles(classic, bench),
        switchedOff: extraSwitchOffs(classic, bench),
      };
    });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = parityReport(resolve(fileURLToPath(import.meta.url), '../../../tests/e2e'));
  const bad = report.filter((r) => r.missing.length > 0 || r.switchedOff.length > 0);
  for (const r of bad) {
    console.error(`tests/e2e/bench/${r.spec}:`);
    for (const t of r.missing) console.error(`  - lacks the classic title: ${t}`);
    for (const call of r.switchedOff)
      console.error(`  - switches a test off: ${call.slice(0, 120)}`);
  }
  console.log(`title parity: ${report.length} bench twin(s) checked, ${bad.length} incomplete`);
  process.exit(bad.length > 0 ? 1 : 0);
}
