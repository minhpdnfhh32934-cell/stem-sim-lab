import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Type scale (#205 A1): every stylesheet sizes text with the `--text-*` tokens of tokens.css, in
 * rem so Cỡ chữ scales it, and nothing goes below the 12px floor (--text-caption at 100 %).
 * Pixel sizes are allowed only where the text belongs to a drawing that scales by itself.
 */
const SRC = resolve(__dirname, '../..');
const ROOT = resolve(SRC, '..');
const FLOOR_REM = 12 / 14;

/** `file selector` → why its text is sized in pixels. */
const PX_OK: Record<string, string> = {
  'src/app/theme/base.css html': 'the root size itself, scaled by --font-scale',
  'src/teacher/board/board.css .board__mark-label': 'board units, scaled by the board zoom',
  'src/teacher/board/board.css .board__draw text': 'board units, scaled by the board zoom',
  'src/teacher/board/board.css .board__draw .board__tick': 'board units, scaled by the board zoom',
  'src/teacher/board/board.css .board__table': 'board units, scaled by the board zoom',
  'src/studio/chemistry/chemistry.css .chem-tube__label': 'SVG text, scales with the test tube',
  'src/chemistry/chem.css .eq-energy__text': 'SVG text, scales with the energy diagram',
  'src/chemistry/chem.css .tit-label': 'SVG text, scales with the titration picture',
  'src/app/ai/ai.css .guide-art__text': 'SVG text, scales with the guide drawing',
  'src/app/ai/ai.css .guide-art__text--small': 'SVG text, scales with the guide drawing',
};
/** `file selector` → why it is below the floor for now. */
const BELOW_FLOOR_OK: Record<string, string> = {
  'src/chemistry/chem.css .pt__group': '#205 B7 lays the periodic table out again',
  'src/chemistry/chem.css .pt-cell__z': '#205 B7 lays the periodic table out again',
};

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : [],
  );
}

interface Decl {
  key: string;
  value: string;
}

/** Every `font-size` with the selector of its rule (comments removed; good enough for our CSS). */
function fontSizes(): Decl[] {
  return cssFiles(SRC).flatMap((file) => {
    const rel = relative(ROOT, file).split('\\').join('/');
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const out: Decl[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1]!.trim().split('\n').pop()!.trim();
      for (const d of m[2]!.matchAll(/font-size:\s*([^;]+);/g)) {
        out.push({ key: `${rel} ${selector}`, value: d[1]!.trim() });
      }
    }
    return out;
  });
}

describe('type scale (#205 A1)', () => {
  const sizes = fontSizes();

  it('finds the stylesheets', () => {
    expect(sizes.length).toBeGreaterThan(300);
  });

  it('the tokens: caption is the 12px floor, note 13px, larger steps in rem', () => {
    const tokens = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
    expect(tokens).toContain('--text-caption: calc(12rem / 14);');
    expect(tokens).toContain('--text-note: calc(13rem / 14);');
  });

  it('no stylesheet writes its own calc(N rem / 14) size: it uses a --text-* token', () => {
    const raw = sizes.filter(
      (d) => !d.key.startsWith('src/app/theme/tokens.css') && /calc\(\d+rem \/ 14\)/.test(d.value),
    );
    expect(raw).toEqual([]);
  });

  it('pixel sizes only where the text belongs to a drawing, each with its reason', () => {
    const px = sizes.filter((d) => /\d+px/.test(d.value) && !/^max\(12px,/.test(d.value));
    expect(px.filter((d) => !(d.key in PX_OK))).toEqual([]);
    // A listed exception that no longer exists must leave the list.
    expect(Object.keys(PX_OK).filter((k) => !px.some((d) => d.key === k))).toEqual([]);
  });

  it('nothing below the 12px floor in rem', () => {
    const small = sizes.filter((d) => {
      const m = /^([\d.]+)rem$/.exec(d.value);
      return m !== null && Number(m[1]) < FLOOR_REM - 1e-4;
    });
    expect(small.filter((d) => !(d.key in BELOW_FLOOR_OK))).toEqual([]);
    expect(Object.keys(BELOW_FLOOR_OK).filter((k) => !small.some((d) => d.key === k))).toEqual([]);
  });
});
