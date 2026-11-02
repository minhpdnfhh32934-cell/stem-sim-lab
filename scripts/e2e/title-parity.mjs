// Bench spec parity (0.8.1, docs/BENCH_DESIGN.md §14): a bench spec that copies a classic one
// (tests/e2e/bench/<name>.spec.ts beside tests/e2e/<name>.spec.ts) keeps every classic test title,
// so no check is lost when the bench becomes the default (B8). Bench-only specs have no twin.
// Usage: node scripts/e2e/title-parity.mjs   (exit code 1 lists the missing titles)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** The literal titles of `test(...)` calls (template titles keep their `${…}` text). */
export function testTitles(source) {
  const out = [];
  for (const m of source.matchAll(
    /\btest(?:\.(?:only|skip|fixme|fail))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g,
  ))
    out.push(m[2]);
  return out;
}

/** Classic titles the bench twin lacks. */
export function missingTitles(classic, bench) {
  const have = new Set(testTitles(bench));
  return testTitles(classic).filter((t) => !have.has(t));
}

/** Every bench spec with a classic twin under `e2eDir`, and the titles it lacks. */
export function parityReport(e2eDir) {
  const benchDir = resolve(e2eDir, 'bench');
  if (!existsSync(benchDir)) return [];
  return readdirSync(benchDir)
    .filter((f) => f.endsWith('.spec.ts') && existsSync(resolve(e2eDir, f)))
    .map((f) => ({
      spec: f,
      missing: missingTitles(
        readFileSync(resolve(e2eDir, f), 'utf8'),
        readFileSync(resolve(benchDir, f), 'utf8'),
      ),
    }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = parityReport(resolve(fileURLToPath(import.meta.url), '../../../tests/e2e'));
  const bad = report.filter((r) => r.missing.length > 0);
  for (const r of bad) {
    console.error(`tests/e2e/bench/${r.spec} lacks ${r.missing.length} classic title(s):`);
    for (const t of r.missing) console.error(`  - ${t}`);
  }
  console.log(`title parity: ${report.length} bench twin(s) checked, ${bad.length} incomplete`);
  process.exit(bad.length > 0 ? 1 : 0);
}
