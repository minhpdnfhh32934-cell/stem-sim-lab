import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deltaEOK, oklch } from '@/ui/three/color';

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

/** Tokens shared by both themes (the first `:root` block), then each theme's own. */
const ROOT = themeTokens(':root {');
const LIGHT = themeTokens(":root[data-theme='light']");
const DARK = themeTokens(":root[data-theme='dark']");
/** The bench shell (#113): its shared block, then its light or dark block, over the classic theme. */
const BENCH = themeTokens(":root[data-shell='bench'] {");
const BENCH_LIGHT = themeTokens(":root[data-shell='bench']:not([data-theme='dark'])");
const BENCH_DARK = themeTokens(":root[data-shell='bench'][data-theme='dark']");
const THEMES = {
  light: theme(ROOT, LIGHT),
  dark: theme(ROOT, DARK),
  'bench light': theme(ROOT, LIGHT, BENCH, BENCH_LIGHT),
  'bench dark': theme(ROOT, DARK, BENCH, BENCH_DARK),
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

/**
 * The bench shell's contrast table (design `.agent-logs/bench-spec.md` §4): text ≥ 4.5 : 1,
 * borders, rings and data colours ≥ 3 : 1. Plots draw only on the stage, the paper or a panel,
 * never on a sunken or active surface, so those are the data colours' backgrounds.
 */
const PAPER = ['--bg-app', '--bg-panel', '--bg-panel-2', '--bg-active'];
const FRAME = ['--frame', '--frame-raised'];
const ON_PAPER = ['--bg-app', '--bg-panel'];
const BENCH_PAIRS: readonly (readonly [string, readonly string[], number])[] = [
  ['--text', [...PAPER, '--bg-stage', '--stage-grid'], 4.5],
  ['--text-muted', [...PAPER, '--bg-stage'], 4.5],
  ['--text-faint', PAPER, 4.5],
  ['--border-input', PAPER, 3],
  ['--frame-line', FRAME, 3],
  ['--on-frame', FRAME, 4.5],
  ['--on-frame-muted', FRAME, 4.5],
  ['--accent', ['--bg-app', '--bg-panel', '--bg-panel-2', '--bg-stage', '--accent-soft'], 4.5],
  ['--text-on-accent', ['--accent', '--accent-hover'], 4.5],
  ['--play', FRAME, 3],
  ['--on-play', ['--play'], 4.5],
  ['--focus-ring', [...PAPER, '--bg-stage'], 3],
  ['--focus-frame', FRAME, 3],
  ['--danger', ON_PAPER, 4.5],
  ['--on-danger', ['--danger'], 4.5],
  ['--warning', ['--warning-soft', ...ON_PAPER], 4.5],
  ['--conf-exact', ['--conf-exact-soft', ...ON_PAPER], 4.5],
  ['--conf-approx', ['--conf-approx-soft', ...ON_PAPER], 4.5],
  ['--conf-qual', ['--conf-qual-soft', ...ON_PAPER], 4.5],
  ['--pending', ['--pending-soft', ...ON_PAPER], 4.5],
  ['--ink-ai', ['--ink-ai-soft', ...ON_PAPER], 4.5],
  ['--ink-learner', ['--ink-learner-soft', ...ON_PAPER], 4.5],
  ['--subject-physics', ON_PAPER, 4.5],
  ['--subject-chemistry', ON_PAPER, 4.5],
  ['--subject-biology', ON_PAPER, 4.5],
  ['--stage-accent', ['--bg-stage'], 3],
  ['--stage-tool', ['--bg-stage', '--stage-grid'], 3],
  ...CHARTS.map((c) => [c, ['--bg-stage', ...ON_PAPER], 3] as const),
];

describe('bench tokens (#113)', () => {
  for (const name of ['bench light', 'bench dark'] as const) {
    it(`${name}: every pair of the contrast table reaches its floor`, () => {
      const tokens = THEMES[name];
      const failures: string[] = [];
      for (const [fg, bgs, floor] of BENCH_PAIRS) {
        for (const bg of bgs) {
          const a = tokens.get(fg);
          const b = tokens.get(bg);
          if (!a || !b) failures.push(`${fg} or ${bg} missing`);
          else if (contrast(a, b) < floor)
            failures.push(`${fg} ${a} on ${bg} ${b}: ${contrast(a, b).toFixed(2)} < ${floor}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('dark has its own value for every colour light sets, except the light-only re-steps', () => {
    const names = (m: Map<string, string>) =>
      [...m.keys()].filter((n) => !n.startsWith('--chart-') && n !== '--bio3d-soil').sort();
    expect(names(BENCH_DARK)).toEqual(names(BENCH_LIGHT));
  });

  it('the classic shell keeps its own values (bench values live only in the bench blocks)', () => {
    for (const [classic, bench] of [
      [THEMES.light, THEMES['bench light']],
      [THEMES.dark, THEMES['bench dark']],
    ] as const) {
      expect(classic.get('--accent')).not.toBe(bench.get('--accent'));
      expect(classic.get('--frame')).toBeUndefined();
    }
    expect(THEMES.light.get('--chart-2')).toBe('#e69f00');
  });

  it('nothing is blurred under data-shell="bench": every backdrop-filter is a token set to none', () => {
    const src = resolve(__dirname, '../..');
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' });
    const blurs: string[] = [];
    for (const f of files.filter((n) => /\.(css|tsx?)$/.test(n) && !/\.test\.tsx?$/.test(n))) {
      const text = readFileSync(resolve(src, f), 'utf8');
      if (/backdropFilter/.test(text)) blurs.push(`${f}: inline backdropFilter`);
      // `(backdrop-filter: …)` inside @supports is a condition, not a declaration.
      for (const m of text.matchAll(/(?<!\()backdrop-filter:\s*([^;{}]+);/g)) {
        const token = /^var\((--[\w-]+)\)$/.exec(m[1]?.trim() ?? '')?.[1];
        if (!token) blurs.push(`${f}: backdrop-filter: ${m[1] ?? ''}`);
        else if (BENCH.get(token) !== 'none')
          blurs.push(`${f}: ${token} is not none under the bench`);
      }
    }
    expect(blurs).toEqual([]);
  });
});
