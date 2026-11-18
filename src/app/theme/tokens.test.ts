import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deltaEOK, hexOfLinear, linearOf, mixLinear, oklch, type Rgb } from '@/ui/three/color';

/** The theme stylesheet, read as text (no browser needed). */
const CSS = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');

/** Hex colour tokens of one theme block (the block starting at `selector`), `var(--x)` aliases and `none`. */
function themeTokens(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`no block ${selector}`);
  const end = CSS.indexOf('\n}', start);
  const out = new Map<string, string>();
  for (const m of CSS.slice(start, end).matchAll(
    /(--[\w-]+):\s*(#[0-9a-fA-F]{6}\b|var\(--[\w-]+\)|none\b)/g,
  ))
    if (m[1] && m[2]) out.set(m[1], m[2]);
  return out;
}

/** Blocks merged in cascade order, each `var(--x)` alias replaced by the value of `--x`. */
function theme(...blocks: Map<string, string>[]): Map<string, string> {
  const all = new Map(blocks.flatMap((b) => [...b]));
  for (const [name, value] of all) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    if (ref) all.set(name, all.get(ref) ?? value);
  }
  return all;
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

/** Machado et al. (2009) dichromacy matrices, severity 1.0, applied to linear RGB. */
const MACHADO: Record<'deutan' | 'protan', readonly Rgb[]> = {
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
};
/** A colour as seen with normal vision or a red–green deficiency. */
function cvd(hex: string, view: 'normal' | 'deutan' | 'protan'): string {
  const lin = linearOf(hex);
  if (!lin || view === 'normal') return hex;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const [r, g, b] = lin;
  return hexOfLinear(MACHADO[view].map((m) => clamp(m[0] * r + m[1] * g + m[2] * b)) as Rgb);
}

/** Tokens shared by both themes (the first `:root` block), then each theme's own. */
const ROOT = themeTokens(':root {');
const LIGHT = themeTokens(":root[data-theme='light']");
const DARK = themeTokens(":root[data-theme='dark']");
const THEMES = {
  light: theme(ROOT, LIGHT),
  dark: theme(ROOT, DARK),
};
const BACKGROUNDS = ['--bg-app', '--bg-panel', '--bg-panel-2'];
/** Tokens used for readable text (dimmed codons, hints, counts, warnings). */
const TEXT = ['--text', '--text-muted', '--text-faint', '--warning'];

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
    it(`${theme}: each confidence badge's ink reaches 4.5 : 1 on its own tint (#195 axe)`, () => {
      const low: string[] = [];
      for (const ink of ['--conf-exact', '--conf-approx', '--conf-qual', '--pending']) {
        const a = tokens.get(ink);
        const b = tokens.get(`${ink}-soft`);
        if (!a || !b) {
          low.push(`${ink} or its -soft missing`);
          continue;
        }
        const r = contrast(a, b);
        if (r < 4.5) low.push(`${ink} ${a} on ${b}: ${r.toFixed(2)}`);
      }
      expect(low).toEqual([]);
    });
  }

  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: the stage accent (selection, cursors, halos) stays ΔE_OK ≥ 0.2 from the text`, () => {
      const accent = tokens.get('--stage-accent');
      const text = tokens.get('--text');
      expect(accent, '--stage-accent').toBeTruthy();
      expect(text, '--text').toBeTruthy();
      expect(deltaEOK(accent ?? '', text ?? '')).toBeGreaterThanOrEqual(0.2);
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

  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`${theme}: 3D terrain and water stay ΔE_OK ≥ 0.15 from every chart colour`, () => {
      const failures: string[] = [];
      for (const ground of [
        '--bio3d-grass',
        '--bio3d-island-grass',
        '--bio3d-island-grass-2',
        '--bio3d-soil',
        '--bio3d-water',
        '--bio3d-sand',
        '--bio3d-creature',
        '--bio3d-foliage',
        '--bio3d-foliage-2',
        '--bio3d-bark',
      ]) {
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
        '--bio3d-glass-edge',
        '--bio3d-liquid',
        '--bio3d-sky-top',
        '--bio3d-sky-horizon',
        '--bio3d-grass',
        '--bio3d-grass-2',
        '--bio3d-island-grass',
        '--bio3d-island-grass-2',
        '--bio3d-soil',
        '--bio3d-rock',
        '--bio3d-water',
        '--bio3d-sand',
        '--bio3d-creature',
        '--bio3d-foliage',
        '--bio3d-foliage-2',
        '--bio3d-bark',
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

describe('3D data colours', () => {
  it('the codon marks are the confidence inks, unchanged', () => {
    for (const theme of [THEMES.light, THEMES.dark]) {
      expect(theme.get('--dna3d-start')).toBe(theme.get('--conf-exact'));
      expect(theme.get('--dna3d-stop')).toBe(theme.get('--conf-approx'));
    }
  });

  /**
   * Data on the 3D meadow (logistic growth): the number of grazed patches is round(patches · N/K),
   * so a clover patch must not look like a grazed one (bare soil, and its grass rim) for normal or
   * deutan vision. Floor near today's level (classic dark deutan 0.086).
   */
  for (const [name, tokens] of Object.entries(THEMES)) {
    it(`${name}: a clover patch and a grazed patch stay apart (normal and deutan)`, () => {
      const clover = tokens.get('--bio3d-island-grass') ?? '';
      const soil = tokens.get('--bio3d-soil') ?? '';
      const rim = mixLinear(tokens.get('--bio3d-grass') ?? '', soil, 0.35);
      for (const grazed of [soil, rim])
        for (const view of ['normal', 'deutan'] as const)
          expect(
            deltaEOK(cvd(clover, view), cvd(grazed, view)),
            `${view} ${grazed}`,
          ).toBeGreaterThanOrEqual(0.085);
    });
  }
});

/** AI Teacher's page stylesheets, read as text without their comments (issue numbers). */
const TEACHER_CSS = ['teacher.css', 'teacherViews.css'].map((f) =>
  readFileSync(resolve(__dirname, '../../teacher/screen', f), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  ),
);

describe("AI Teacher's page in the app's look (18/11/2026; #234's station before)", () => {
  for (const name of ['light', 'dark'] as const) {
    const get = (key: string) => {
      const v = THEMES[name].get(key);
      if (!v) throw new Error(`${name}: no ${key}`);
      return v;
    };

    it(`${name}: text, labels, the accent and amber reach 4.5 : 1 on the page, its panel and its cards`, () => {
      const low: string[] = [];
      for (const ink of ['--text', '--text-muted', '--accent', '--warning'])
        for (const ground of ['--bg-stage', '--bg-panel', '--bg-panel-2']) {
          const c = contrast(get(ink), get(ground));
          if (c < 4.5) low.push(`${ink} on ${ground}: ${c.toFixed(2)}`);
        }
      expect(low).toEqual([]);
    });

    it(`${name}: the orb (the stage accent) reaches 3 : 1 on the page`, () => {
      expect(contrast(get('--stage-accent'), get('--bg-stage'))).toBeGreaterThanOrEqual(3);
    });
  }

  it("its stylesheets use the app's tokens only: no colour, no station token of their own", () => {
    const defined = new Set([...CSS.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    for (const sheet of TEACHER_CSS) {
      const used = [...sheet.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] ?? '');
      expect(used.filter((v) => !defined.has(v))).toEqual([]);
      // The rings' warm/cool pair (fallback picture) is the B4 face's, shared with the home page.
      expect(used.filter((v) => /^--teacher-(?!warm$|cool$)/.test(v))).toEqual([]);
      expect(sheet.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull();
    }
  });
});
