import { describe, expect, it } from 'vitest';
import { flipOffset } from './AppIntro';

// translate(t) scale(s) about the element's top-left `box` maps p to box + t + s·(p − box).
const apply = (
  box: { x: number; y: number },
  t: { x: number; y: number },
  s: number,
  p: { x: number; y: number },
) => ({
  x: box.x + t.x + s * (p.x - box.x),
  y: box.y + t.y + s * (p.y - box.y),
});

describe('the opening logo flies onto the menu’s', () => {
  it('carries its anchor exactly onto the target, scaled', () => {
    const box = { x: 700, y: 420 };
    const from = { x: 712, y: 431 }; // the first letter, inside the element
    const to = { x: 150, y: 520 };
    for (const scale of [0.5, 1, 1.37]) {
      const end = apply(box, flipOffset(box, from, to, scale), scale, from);
      expect(end.x).toBeCloseTo(to.x, 9);
      expect(end.y).toBeCloseTo(to.y, 9);
    }
  });

  it('moves a box whose anchor is its corner by the plain difference', () => {
    expect(flipOffset({ x: 10, y: 20 }, { x: 10, y: 20 }, { x: 50, y: 5 }, 2)).toEqual({
      x: 40,
      y: -15,
    });
  });
});
