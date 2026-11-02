// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { missingTitles, parityReport, testTitles } from '../scripts/e2e/title-parity.mjs';

const CLASSIC = `
test('opens without errors', async () => {});
test.skip("a skipped one", async () => {});
for (const [name] of TOPICS) {
  test(\`\${name}: fits 1366×768\`, async () => {});
}
test.describe('group', () => {
  test('nested', async () => {});
});
`;

describe('bench title parity', () => {
  it('reads every test title, quotes and templates alike (not describe titles)', () => {
    expect(testTitles(CLASSIC)).toEqual([
      'opens without errors',
      'a skipped one',
      '${name}: fits 1366×768',
      'nested',
    ]);
  });

  it('lists the classic titles a bench copy lacks', () => {
    const bench = "test('opens without errors', a);\ntest('nested', b);\ntest('bench only', c);";
    expect(missingTitles(CLASSIC, bench)).toEqual(['a skipped one', '${name}: fits 1366×768']);
    expect(missingTitles(CLASSIC, CLASSIC)).toEqual([]);
  });

  const dir = mkdtempSync(resolve(tmpdir(), 'parity-'));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('checks only bench specs that have a classic twin', () => {
    mkdirSync(resolve(dir, 'bench'));
    writeFileSync(resolve(dir, 'physics.spec.ts'), "test('a', x);\ntest('b', x);");
    writeFileSync(resolve(dir, 'bench', 'physics.spec.ts'), "test('a', x);");
    writeFileSync(resolve(dir, 'bench', 'frame.spec.ts'), "test('bench only', x);");
    expect(parityReport(dir)).toEqual([{ spec: 'physics.spec.ts', missing: ['b'] }]);
  });

  it('the repository passes today', () => {
    const report = parityReport(resolve(import.meta.dirname, 'e2e'));
    expect(report.filter((r) => r.missing.length > 0)).toEqual([]);
  });
});
