import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The theme stylesheet, read as text (no browser needed). */
const CSS = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');

/** Hex colour tokens of one theme block (the block starting at `selector`). */
function themeTokens(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`no block ${selector}`);
  const end = CSS.indexOf('\n}', start);
  const out = new Map<string, string>();
  for (const m of CSS.slice(start, end).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g))
    if (m[1] && m[2]) out.set(m[1], m[2]);
  return out;
}

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (s: number) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0] ?? 0) + 0.7152 * f(c[1] ?? 0) + 0.0722 * f(c[2] ?? 0);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Tokens shared by both themes (the first `:root` block), then each theme's own. */
const ROOT = themeTokens(':root {');
const THEMES = {
  light: new Map([...ROOT, ...themeTokens(":root[data-theme='light']")]),
  dark: new Map([...ROOT, ...themeTokens(":root[data-theme='dark']")]),
};
const BACKGROUNDS = ['--bg-app', '--bg-panel', '--bg-panel-2'];
/** Tokens used for readable text (dimmed codons, hints, counts, warnings). */
const TEXT = ['--text', '--text-muted', '--text-faint', '--warning'];

describe('theme tokens', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: every text colour reaches WCAG AA (4.5 : 1) on every panel background`, () => {
      const failures: string[] = [];
      for (const fg of TEXT) {
        for (const bg of BACKGROUNDS) {
          const a = tokens.get(fg);
          const b = tokens.get(bg);
          if (!a || !b) {
            failures.push(`${fg} or ${bg} missing`);
            continue;
          }
          const r = contrast(a, b);
          if (r < 4.5) failures.push(`${fg} ${a} on ${bg} ${b}: ${r.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: a picked 3D part glows in a colour unlike both chromosome colours`, () => {
      const hi = tokens.get('--m3d-highlight') ?? '';
      const chromosomes = [tokens.get('--chart-1'), tokens.get('--chart-4')];
      for (const c of chromosomes) {
        expect(c, 'chromosome colour').toBeTruthy();
        expect(contrast(hi, c ?? '')).toBeGreaterThanOrEqual(2.5);
      }
      expect(tokens.get('--m3d-nucleolus')).toBeTruthy();
      expect(tokens.get('--m3d-nucleolus')).not.toBe(tokens.get('--chart-6'));
    });
  }
});
