import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cssDeclarations } from './cssTesting';

/**
 * Type scale (#205 A1): every stylesheet sizes text with the `--text-*` tokens of tokens.css, in
 * rem so Cỡ chữ scales it, and nothing goes below the 12px floor (--text-caption at 100 %).
 * Pixel sizes are allowed only where the text belongs to a drawing that scales by itself.
 */
const FLOOR_REM = 12 / 14;

/** `file selector` → why its text is sized in pixels. */
const PX_OK: Record<string, string> = {
  'src/app/theme/base.css html': 'the root size itself, scaled by --font-scale',
  'src/teacher/board/board.css .board__mark-label': 'board units, scaled by the board zoom',
  'src/teacher/board/board.css .board__draw text': 'board units, scaled by the board zoom',
  'src/teacher/board/board.css .board__draw .board__tick': 'board units, scaled by the board zoom',
  'src/teacher/board/board.css .board__table': 'board units, scaled by the board zoom',
  'src/studio/chemistry/chemistry.css .chem-tube__label':
    'SVG units, 14px on screen (svg-text.spec.ts)',
  'src/chemistry/chem.css .eq-energy__text': 'SVG units, 13.1px on screen (svg-text.spec.ts)',
  'src/chemistry/chem.css .tit-label': 'SVG units, 12.7px on screen (svg-text.spec.ts)',
  'src/app/ai/ai.css .guide-art__text':
    'SVG units, ≥ 12px on screen down to 0.8 scale (svg-text.spec.ts)',
};
/** `file selector` → why it is below the floor for now. */
const BELOW_FLOOR_OK: Record<string, string> = {
  'src/chemistry/chem.css .pt__group': '#205 B7 lays the periodic table out again',
  'src/chemistry/chem.css .pt-cell__z': '#205 B7 lays the periodic table out again',
};

/** Every `font-size` with the selector of its rule. */
function fontSizes() {
  return cssDeclarations().filter((d) => d.prop === 'font-size');
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
