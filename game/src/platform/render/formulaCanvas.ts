import { isFraction, type Item } from '../../core/formula';

/** Sizes and offsets per letter size: a sub- or superscript, a fraction's parts and its bar. */
const SMALL = 0.62;
const SUB_DOWN = 0.22;
const SUP_UP = 0.42;
const PART = 0.72;
/** The fraction bar's height above the baseline, and its numerator's and denominator's baselines. */
const BAR = 0.3;
const NUM_UP = 0.12;
const DEN_DOWN = 0.66;
const BAR_PAD = 0.12;

/**
 * Formula items (`core/formula.ts`) drawn on a 2D canvas as a hand writes them: subscripts small and
 * low, exponents small and raised, fractions stacked over a bar; `font` the CSS font at a size. `shown`: source characters written
 * so far (a board line appears letter by letter); Infinity: all. Returns the width drawn (px), or
 * with `draw` false only measures. The context's fill and stroke style are the ink.
 */
export function drawFormula(
  c: CanvasRenderingContext2D,
  items: readonly Item[],
  font: (px: number) => string,
  size: number,
  x: number,
  y: number,
  shown: number,
  draw: boolean,
): number {
  let at = x;
  for (const item of items) {
    if (isFraction(item)) {
      const part = size * PART;
      const num = drawFormula(c, item.num, font, part, 0, 0, Infinity, false);
      const den = drawFormula(c, item.den, font, part, 0, 0, Infinity, false);
      const pad = size * BAR_PAD;
      const width = Math.max(num, den) + 2 * pad;
      if (draw && shown > item.from) {
        const bar = y - size * BAR;
        drawFormula(
          c,
          item.num,
          font,
          part,
          at + (width - num) / 2,
          bar - size * NUM_UP,
          shown,
          true,
        );
        drawFormula(
          c,
          item.den,
          font,
          part,
          at + (width - den) / 2,
          bar + size * DEN_DOWN,
          shown,
          true,
        );
        c.lineWidth = Math.max(1.5, size * 0.05);
        c.beginPath();
        c.moveTo(at, bar);
        c.lineTo(at + width, bar);
        c.stroke();
      }
      at += width;
      continue;
    }
    const small = item.level !== 'base';
    const px = small ? size * SMALL : size;
    c.font = font(px);
    const width = c.measureText(item.text).width;
    if (draw) {
      const count = Math.max(0, Math.min(item.text.length, shown - item.from));
      if (count > 0) {
        const dy =
          item.level === 'sub' ? size * SUB_DOWN : item.level === 'sup' ? -size * SUP_UP : 0;
        c.fillText(item.text.slice(0, count), at, y + dy);
      }
    }
    at += width;
  }
  return at - x;
}
