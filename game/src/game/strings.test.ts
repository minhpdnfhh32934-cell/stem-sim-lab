import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { placeholders } from '../core/i18n';

// Interface text is written in English where it is shown, as `texts.ui('key', 'English', …)`,
// and translated by key in src/content/strings.json. Like an extraction tool, this reads every
// such call in the source and checks the translations against them.

const CALL = /\.ui\(\s*'([a-z][\w.-]*)',\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

/** English texts by key, as written in the code; and how many `.ui(` calls there are. */
const english = new Map<string, Set<string>>();
let calls = 0;
let literal = 0;
for (const file of sources('src')) {
  const code = readFileSync(file, 'utf8');
  calls += code.split('.ui(').length - 1;
  for (const m of code.matchAll(CALL)) {
    literal++;
    const text = (m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1');
    english.set(m[1]!, (english.get(m[1]!) ?? new Set()).add(text));
  }
}
const vi = (bundledContent.strings as { vi: Record<string, string> }).vi;

describe('interface text', () => {
  it('is written as a literal key and English at every use', () => {
    expect(english.size).toBeGreaterThan(0);
    expect(literal).toBe(calls);
  });

  it('has one English text per key', () => {
    const ambiguous = [...english].filter(([, texts]) => texts.size > 1).map(([key]) => key);
    expect(ambiguous).toEqual([]);
  });

  it('has every key in Vietnamese, filling the same placeholders', () => {
    const missing = [...english.keys()].filter((key) => vi[key] === undefined);
    expect(missing).toEqual([]);
    const mismatched = [...english].filter(([key, [text]]) => {
      const translation = vi[key];
      return (
        translation !== undefined && placeholders(translation).join() !== placeholders(text!).join()
      );
    });
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it('keeps no Vietnamese text the code no longer shows', () => {
    expect(Object.keys(vi).filter((key) => !english.has(key))).toEqual([]);
  });
});
