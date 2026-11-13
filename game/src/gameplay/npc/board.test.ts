import { describe, expect, it } from 'vitest';
import { boardArea, layoutBoard, lineCapacity, wrapLine } from './board';

const WHITEBOARD: [number, number, number] = [1.6, 0.9, 0.06];

describe('board lines', () => {
  it('keeps a short line whole', () => {
    expect(wrapLine('Given: h = 2 m', 40)).toEqual(['Given: h = 2 m']);
  });

  it('breaks after a "; ", else at a space, the lines after the first indented', () => {
    expect(wrapLine('Given: U = 12 V; R1 = 470 Ω; R2 = 1000 Ω', 30)).toEqual([
      'Given: U = 12 V; R1 = 470 Ω;',
      '  R2 = 1000 Ω',
    ]);
    expect(wrapLine('Example 1 · Measuring the frequency of a sound', 30)).toEqual([
      'Example 1 · Measuring the',
      '  frequency of a sound',
    ]);
    // A word longer than a line stays whole.
    expect(wrapLine('Abc Cdefghijklmnopqrstuvwxyz', 10)).toEqual([
      'Abc',
      '  Cdefghijklmnopqrstuvwxyz',
    ]);
  });

  it('lays texts out within what a line holds, and says where each starts', () => {
    const long =
      'Given: The two half-cells (left | right): Zn | Cu (the Daniell cell); c_L = 1 mol/L';
    const { lines, from, area } = layoutBoard(WHITEBOARD, [
      'Example 1 · Cells',
      long,
      'Find: E = ?',
    ]);
    expect(lines.length).toBeGreaterThan(3);
    expect(from[0]).toBe(0);
    expect(from[1]).toBe(1);
    expect(from[3]).toBe(lines.length);
    expect(lines.slice(from[1], from[2]).join(' ').replace(/ {2,}/g, ' ')).toBe(long);
    expect(area).toEqual(boardArea(WHITEBOARD, lines.length));
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(lineCapacity(area));
  });
});
