import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cssDeclarations } from './cssTesting';

/**
 * Colours live in tokens.css (#205 A2, CLAUDE.md "never hard-code colors"): no other stylesheet
 * writes a colour value of its own — hex, rgb()/hsl()/oklch() with numbers, white or black.
 * Values built from tokens (color-mix, hsl(var(--h) …)) are fine.
 */
const LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]|(?:^|[\s,(])(?:white|black)(?![-\w])/i;

/** `file selector` → why it keeps a literal colour. */
const LITERAL_OK: Record<string, string> = {};

describe('colour tokens (#205 A2)', () => {
  const decls = cssDeclarations().filter((d) => d.file !== 'src/app/theme/tokens.css');

  it('finds the stylesheets', () => {
    expect(decls.length).toBeGreaterThan(3000);
  });

  it('no stylesheet but tokens.css writes a colour value', () => {
    const literal = decls
      .filter((d) => !d.prop.startsWith('--cat-') && LITERAL.test(d.value))
      .map((d) => `${d.key} { ${d.prop}: ${d.value} }`);
    expect(literal.filter((l) => !Object.keys(LITERAL_OK).some((k) => l.startsWith(k)))).toEqual(
      [],
    );
  });

  it('the scan catches what it must (hex, rgb, hsl, white) and leaves tokens alone', () => {
    for (const v of ['#fff', '#0b4f8a', 'rgba(8, 12, 20, 0.5)', 'rgb(10 22 34 / 8%)', 'white'])
      expect(LITERAL.test(v), v).toBe(true);
    for (const v of [
      'var(--scrim)',
      'hsl(var(--h) var(--cat-s) var(--cat-l))',
      'color-mix(in srgb, var(--accent) 78%, transparent)',
      'white-space',
    ])
      expect(LITERAL.test(v), v).toBe(false);
  });

  it('the moved values stay the same (A2 moves colours, it does not change them)', () => {
    const tokens = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
    for (const t of [
      '--scrim: rgba(8, 12, 20, 0.45);',
      '--scrim-strong: rgba(8, 12, 20, 0.5);',
      '--data-seq-lo: #e8f0fb;',
      '--data-seq-hi: #0b4f8a;',
      '--data-seq-lo: #1d2a3b;',
      '--data-seq-hi: #7db8ee;',
      '--text-on-data: #ffffff;',
    ])
      expect(tokens, t).toContain(t);
    expect(tokens.replace(/\s+/g, ' ')).toContain(
      '--data-spectrum: rgb(97, 0, 97) 0%, rgb(0, 0, 255) 16%, rgb(0, 255, 255) 30%, rgb(0, 255, 0) 36%, rgb(255, 255, 0) 57%, rgb(255, 128, 0) 69%, rgb(255, 0, 0) 84%, rgb(97, 0, 0) 100%;',
    );
  });
});
