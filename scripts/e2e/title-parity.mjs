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

/** Lines that switch tests off: `test.skip(…)`, `test.fixme(…)`, `test.describe.skip/fixme(…)`. */
function switchOffs(source) {
  return code(source)
    .split('\n')
    .filter((l) => /\btest(?:\.describe)?\.(?:skip|fixme)\(/.test(l))
    .map((l) => l.trim());
}

/**
 * Lines of the bench twin that switch tests off (in a test's body too) and that the classic spec
 * does not have word for word: a twin may copy a classic conditional skip, nothing more.
 */
export function extraSwitchOffs(classic, bench) {
  const allowed = new Set(switchOffs(classic));
  return switchOffs(bench).filter((l) => !allowed.has(l));
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
    for (const l of r.switchedOff) console.error(`  - switches a test off: ${l}`);
  }
  console.log(`title parity: ${report.length} bench twin(s) checked, ${bad.length} incomplete`);
  process.exit(bad.length > 0 ? 1 : 0);
}
