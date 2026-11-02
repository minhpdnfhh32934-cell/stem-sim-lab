// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  extraSwitchOffs,
  missingTitles,
  parityReport,
  testTitles,
} from '../scripts/e2e/title-parity.mjs';

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

  it('lists the classic titles that run but not in the bench copy', () => {
    const bench = "test('opens without errors', a);\ntest('nested', b);\ntest('bench only', c);";
    // The classic skipped test is not owed; its runnable template title is.
    expect(missingTitles(CLASSIC, bench)).toEqual(['${name}: fits 1366×768']);
    expect(missingTitles(CLASSIC, CLASSIC)).toEqual([]);
  });

  it('a twin that is skipped, fixme or commented out does not count', () => {
    const classic = "test('a', x);\ntest('b', x);\ntest('c', x);\ntest('d', x);";
    const bench = [
      "test.skip('a', x);",
      "test.fixme('b', x);",
      "// test('c', x);",
      '/*',
      "test('d', x);",
      '*/',
    ].join('\n');
    expect(missingTitles(classic, bench)).toEqual(['a', 'b', 'c', 'd']);
    // A URL inside a string is not a comment.
    expect(testTitles("test('opens https://example.org // ok', x);")).toEqual([
      'opens https://example.org // ok',
    ]);
  });

  it('a twin switched off inside its body or by a describe is reported; a copied classic skip is not', () => {
    const classic = [
      "test('a', async () => {",
      "  test.skip(!coarse, 'no touch pointer');",
      '});',
      "test('b', x);",
    ].join('\n');
    const bench = [
      "test('a', async () => {",
      "  test.skip(!coarse, 'no touch pointer');",
      '  test.skip();',
      "  test.fixme(true, 'later');",
      '});',
      "test.describe.skip('group', () => {",
      "  test('b', x);",
      '});',
      "test.describe.fixme('other', () => {});",
    ].join('\n');
    expect(extraSwitchOffs(classic, bench)).toEqual([
      'test.skip();',
      "test.fixme(true, 'later');",
      "test.describe.skip('group', () => {",
      "test.describe.fixme('other', () => {});",
    ]);
    expect(extraSwitchOffs(classic, classic)).toEqual([]);
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
    expect(parityReport(dir)).toEqual([
      { spec: 'physics.spec.ts', missing: ['b'], switchedOff: [] },
    ]);
  });

  it('the repository passes today', () => {
    const report = parityReport(resolve(import.meta.dirname, 'e2e'));
    expect(report.filter((r) => r.missing.length > 0 || r.switchedOff.length > 0)).toEqual([]);
  });
});
