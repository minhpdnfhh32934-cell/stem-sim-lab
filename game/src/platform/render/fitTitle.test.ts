import { describe, expect, it } from 'vitest';
import { fitTitle } from './ExperimentView';

/** A canvas whose letters are 0.6 of the font size wide; it records what is drawn. */
function fakeContext() {
  const drawn: { text: string; y: number; size: number; maxWidth: number | undefined }[] = [];
  const ctx = {
    font: '',
    measureText: (text: string) => ({ width: text.length * size() * 0.6 }) as TextMetrics,
    fillText: (text: string, _x: number, y: number, maxWidth?: number) =>
      drawn.push({ text, y, size: size(), maxWidth }),
  };
  const size = () => Number(/ ([\d.]+)px/.exec(ctx.font)?.[1]);
  return { ctx, drawn };
}

describe('a screen title kept clear of what stands beside it (fitTitle)', () => {
  it('stays at its size when it fits', () => {
    const { ctx, drawn } = fakeContext();
    expect(fitTitle(ctx, 'HOOKE', 0, 8, 100, 5, 3)).toBe(1);
    expect(drawn).toEqual([{ text: 'HOOKE', y: 8, size: 5, maxWidth: undefined }]);
  });

  it('shrinks to fit, never below its minimum', () => {
    const { ctx, drawn } = fakeContext();
    fitTitle(ctx, 'ABCDEFGHIJ', 0, 8, 24, 5, 3); // 30 wide at 5: 4 fits it
    expect(drawn[0]?.size).toBeCloseTo(4, 9);
    expect(drawn[0]!.text.length * drawn[0]!.size * 0.6).toBeLessThanOrEqual(24 + 1e-9);
  });

  it('goes on two lines at its minimum when shrinking is not enough, each within the width', () => {
    const { ctx, drawn } = fakeContext();
    const title = 'KHÚC XẠ ÁNH SÁNG VÀ PHẢN XẠ TOÀN PHẦN';
    expect(fitTitle(ctx, title, 0, 8, 40, 5, 3.4)).toBe(2);
    expect(drawn.map((d) => d.text).join(' ')).toBe(title);
    expect(drawn.map((d) => d.size)).toEqual([3.4, 3.4]);
    expect(drawn[0]!.y).toBeLessThan(8);
    expect(drawn[1]!.y).toBeGreaterThan(8);
    expect(drawn.every((d) => d.maxWidth === 40)).toBe(true);
    expect(drawn[0]!.text.length * 3.4 * 0.6).toBeLessThanOrEqual(40);
  });
});
