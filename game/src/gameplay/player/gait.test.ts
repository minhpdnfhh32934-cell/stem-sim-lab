import { describe, expect, it } from 'vitest';
import { Gait, STRIDE } from './gait';

const H = 1 / 60;

/** Walks `seconds` at `speed` m/s along x; the feet that came down, in order. */
function walk(gait: Gait, speed: number, seconds: number, from = 0): number[] {
  const feet: number[] = [];
  for (let t = H; t <= seconds + 1e-9; t += H) {
    const foot = gait.step(H, from + speed * t, 0);
    if (foot) feet.push(foot);
  }
  return feet;
}

describe('the walk’s rhythm (Gait)', () => {
  it('a foot comes down once a stride, left and right by turns', () => {
    const gait = new Gait();
    walk(gait, 2.2, 1); // up to speed
    const feet = walk(gait, 2.2, 7, 2.2);
    expect(feet.length).toBeCloseTo((2.2 * 7) / STRIDE, -0.5); // 22 strides, ±1
    for (let i = 1; i < feet.length; i++) expect(feet[i]).not.toBe(feet[i - 1]);
    expect(gait.speed).toBeCloseTo(2.2, 2);
  });

  it('running steps faster; shuffling and standing make no step', () => {
    const run = new Gait();
    walk(run, 4.5, 1);
    expect(walk(run, 4.5, 2, 4.5).length).toBeGreaterThan(walk(new Gait(), 2.2, 2).length);
    const shuffle = new Gait();
    expect(walk(shuffle, 0.2, 3)).toEqual([]);
    const still = new Gait();
    walk(still, 2.2, 1);
    walk(still, 0, 1, 2.2); // slowing down
    expect(walk(still, 0, 2, 2.2)).toEqual([]);
  });

  it('a jump (a scene change) after a reset is not a walk', () => {
    const gait = new Gait();
    walk(gait, 0, 0.5);
    gait.reset();
    expect(gait.step(H, 40, 12)).toBe(0);
    expect(gait.speed).toBe(0);
  });
});
