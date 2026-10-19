import { describe, expect, it } from 'vitest';
import { CLASS_SHAPES, LESSON_ROLES, ROLES, readBioPalette } from './palette';
import { apportion, drawScale } from './sampling';

describe('figures for the model numbers', () => {
  it('one figure per individual while they fit; otherwise a nice step', () => {
    expect(drawScale(0, 100)).toBe(1);
    expect(drawScale(100, 100)).toBe(1);
    expect(drawScale(101, 100)).toBe(2);
    expect(drawScale(450, 100)).toBe(5);
    expect(drawScale(1500, 600)).toBe(5);
    expect(drawScale(12_345, 600)).toBe(50);
    for (const [n, cap] of [
      [999, 7],
      [10_000, 1500],
      [3, 1],
    ] as const) {
      const k = drawScale(n, cap);
      expect(Math.ceil(n / k)).toBeLessThanOrEqual(cap);
      expect(String(k)).toMatch(/^[125]0*$/);
    }
  });

  it('classes share the figures by largest remainders and add up exactly', () => {
    // Hardy–Weinberg-like genotype counts.
    const counts = [49, 42, 9];
    expect(apportion(counts, 1)).toEqual(counts);
    const two = apportion(counts, 2);
    expect(two.reduce((s, v) => s + v, 0)).toBe(50);
    expect(two).toEqual([25, 21, 4]);
    // Rounding each class alone would give 3 + 3 + 3 = 9, not round(10 / 1.1) = 9 … check ties.
    const even = apportion([1, 1, 1], 2);
    expect(even.reduce((s, v) => s + v, 0)).toBe(2);
    expect(even).toEqual([1, 1, 0]);
    expect(apportion([], 5)).toEqual([]);
  });
});

describe('biology palette', () => {
  it('every role has a theme token and a shape cue; classes cycle', () => {
    const p = readBioPalette((name) => `var(${name})`);
    expect(p.role('maternal').color).toBe('var(--chart-4)');
    expect(p.role('paternal').color).toBe('var(--chart-1)');
    for (const r of Object.values(ROLES)) expect(r.token).toMatch(/^--/);
    expect(p.cls(0)).toEqual({ color: 'var(--chart-1)', shape: CLASS_SHAPES[0] });
    expect(p.cls(7)).toEqual(p.cls(0));
    // Within a lesson no two roles look alike (colour and shape together are unique), and
    // roles of the same colour differ in shape (colour is never the only cue).
    for (const [lesson, roles] of Object.entries(LESSON_ROLES)) {
      const looks = roles.map((r) => `${ROLES[r].token}|${ROLES[r].shape}`);
      expect(new Set(looks).size, lesson).toBe(roles.length);
    }
  });
});
