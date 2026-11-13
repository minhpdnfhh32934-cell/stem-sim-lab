import { describe, expect, it } from 'vitest';
import { easeInspect, INSPECT_ZOOM, inspectFov, lookScale } from './inspect';

const tanHalf = (deg: number) => Math.tan((deg * Math.PI) / 360);

describe('close-inspection view', () => {
  it('leaves the base view alone at 0 and narrows it at 1', () => {
    expect(inspectFov(70, 0)).toBeCloseTo(70, 10);
    const narrow = inspectFov(70, 1);
    expect(narrow).toBeLessThan(70);
    expect(tanHalf(narrow) / tanHalf(70)).toBeCloseTo(INSPECT_ZOOM, 10);
  });

  it('narrows monotonically and clamps the amount to 0–1', () => {
    let last = Infinity;
    for (let a = 0; a <= 1.0001; a += 0.1) {
      const fov = inspectFov(90, a);
      expect(fov).toBeLessThan(last + 1e-12);
      last = fov;
    }
    expect(inspectFov(90, -3)).toBeCloseTo(90, 10);
    expect(inspectFov(90, 7)).toBeCloseTo(inspectFov(90, 1), 10);
  });

  it('scales the mouse by the ratio of the half-angle tangents, for any base field of view', () => {
    for (const base of [40, 70, 110]) {
      for (const a of [0, 0.25, 0.6, 1]) {
        expect(lookScale(a)).toBeCloseTo(tanHalf(inspectFov(base, a)) / tanHalf(base), 10);
      }
    }
    expect(lookScale(0)).toBe(1);
    expect(lookScale(1)).toBeCloseTo(INSPECT_ZOOM, 10);
  });

  it('eases to its target at the same pace at any frame rate, and then stops', () => {
    const seconds = 0.2;
    const at = (hz: number) => {
      let a = 0;
      for (let i = 0; i < Math.round(seconds * hz); i++) a = easeInspect(a, 1, 1 / hz);
      return a;
    };
    expect(at(30)).toBeCloseTo(at(300), 9);
    expect(at(60)).toBeGreaterThan(0.9);
    // Back down, and settled exactly at the ends (no tail of tiny changes).
    let a = 1;
    for (let i = 0; i < 120; i++) a = easeInspect(a, 0, 1 / 60);
    expect(a).toBe(0);
    expect(easeInspect(0.5, 1, 0)).toBe(0.5);
  });
});
