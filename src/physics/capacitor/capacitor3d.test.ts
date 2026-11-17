import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { CHARGE_TIME, CapacitorEngine } from './engine';
import { DOTS_MAX, capLayout, dotsOn } from './capacitor3d';
import { MODE, bankInput, parts } from './model';
import { capacitor } from './scenes';
import { buildCapacitorScene } from './scene3d';

const charged = (p: Record<string, number>) => {
  const e = new CapacitorEngine();
  e.reset(p);
  for (let i = 0; i < Math.ceil(CHARGE_TIME * 60) + 1; i++) e.step();
  const s = new Float64Array(e.stateSize);
  e.readState(s);
  return s;
};

describe('capacitor 3D binding', () => {
  it('series (p. 86): the same charge on 2, 3, 4 µF, so the same dots on each', () => {
    const p = { ...capacitor.defaults };
    const b = bankInput(p);
    expect(b.mode).toBe(MODE.series);
    expect(dotsOn(b, charged(p))).toEqual([DOTS_MAX, DOTS_MAX, DOTS_MAX]);
    expect(dotsOn(b, null)).toEqual([0, 0, 0]);
  });

  it('parallel: q = CU, dots in the ratio 2 : 3 : 4 of the model’s charges', () => {
    const p = { ...capacitor.defaults, mode: MODE.parallel };
    const b = bankInput(p);
    const Q = parts(b).map((x) => x.Q);
    const qMax = Math.max(...Q);
    expect(dotsOn(b, charged(p))).toEqual(Q.map((q) => Math.round((DOTS_MAX * q) / qMax)));
    expect(dotsOn(b, charged(p))).toEqual([18, 27, 36]);
    // Side by side along z; a series chain lies along x.
    expect(capLayout(b).map((c) => c.center[0])).toEqual([0, 0, 0]);
  });
});

describe('capacitor 3D scene', () => {
  it('counts the dots from the engine’s state, frees all', () => {
    const { kit, track, start } = testKit();
    const p = { ...capacitor.defaults, mode: MODE.parallel };
    let state: Float64Array | null = null;
    const scene = buildCapacitorScene(kit, {
      bank: bankInput(p),
      names: ['C₁', 'C₂', 'C₃'],
      read: () => state,
    });
    expect(scene.state().dots).toEqual([0, 0, 0]);
    state = charged(p);
    scene.tick?.(1 / 60);
    expect(scene.state().dots).toEqual([18, 27, 36]);
    expectAllFreed(kit, track, start);
  });
});
