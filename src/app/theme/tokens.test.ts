import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deltaEOK, oklch } from '@/ui/three/color';

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

  /** Chart colours carry data in the 3D views; terrain and water must never look like one. */
  const CHARTS = [
    '--chart-1',
    '--chart-2',
    '--chart-3',
    '--chart-4',
    '--chart-5',
    '--chart-6',
    '--chart-7',
  ];
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: 3D terrain and water stay ΔE_OK ≥ 0.15 from every chart colour`, () => {
      const failures: string[] = [];
      for (const ground of ['--bio3d-grass', '--bio3d-soil', '--bio3d-water']) {
        const g = tokens.get(ground);
        expect(g, ground).toBeTruthy();
        for (const chart of CHARTS) {
          const c = tokens.get(chart);
          expect(c, chart).toBeTruthy();
          const d = deltaEOK(g ?? '', c ?? '');
          if (d < 0.15)
            failures.push(`${ground} ${g ?? ''} vs ${chart} ${c ?? ''}: ${d.toFixed(3)}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${theme}: 3D structures are muted (grass is a low-chroma sage)`, () => {
      for (const name of [
        '--bio3d-protein',
        '--bio3d-glass',
        '--bio3d-liquid',
        '--bio3d-sky-top',
        '--bio3d-sky-horizon',
        '--bio3d-grass',
        '--bio3d-grass-2',
        '--bio3d-soil',
        '--bio3d-rock',
        '--bio3d-water',
        '--m3d-spindle',
      ]) {
        const c = oklch(tokens.get(name) ?? '');
        expect(c, name).not.toBeNull();
        // Far less saturated than the least saturated chart colour (chart-6, C ≈ 0.11).
        expect(c?.C ?? 1, name).toBeLessThanOrEqual(0.07);
      }
      expect(oklch(tokens.get('--bio3d-grass') ?? '')?.C ?? 1).toBeLessThanOrEqual(0.05);
    });
  }

  it('spindle: light steel, lighter than the old muted-text grey in light, softer than white in dark', () => {
    const lightSpindle = oklch(THEMES.light.get('--m3d-spindle') ?? '');
    const oldLight = oklch(THEMES.light.get('--text-muted') ?? '');
    expect(lightSpindle && oldLight).toBeTruthy();
    expect(lightSpindle!.L).toBeGreaterThan(oldLight!.L);
    const darkSpindle = oklch(THEMES.dark.get('--m3d-spindle') ?? '');
    expect(darkSpindle!.L).toBeLessThan(0.9);
    expect(darkSpindle!.L).toBeGreaterThan(oklch(THEMES.dark.get('--bg-stage') ?? '')!.L + 0.4);
  });
});
