import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import type { Params } from '../types';
import { PotentialEngine, PT } from './engine';
import { CHARGE, PATH, potential, platesInput } from './model';
import { potential3d } from './potential3d';
import { electricPotential } from './scenes';
import { buildPotentialScene } from './scene3d';

const base: Params = { ...electricPotential.defaults };
const texts = {
  plus: '+',
  minus: '−',
  E: 'E',
  planes: { M: 'Vₘ', N: 'Vₙ' },
  F: 'F',
};

describe('electric potential 3D binding', () => {
  it('the example of p. 81: planes at V = 18 V (M) and 0 (N); the path is the model’s', () => {
    const m = potential3d(base);
    expect(m.planes.map((p) => p.V)).toEqual([18, 0]);
    const q = platesInput(base);
    expect(m.planes[0]?.V).toBe(potential(q, q.M.y));
    expect(m.path).toEqual([
      [q.M.x, q.M.y, 0],
      [q.N.x, q.N.y, 0],
    ]);
    expect(potential3d({ ...base, path: PATH.broken }).path).toHaveLength(3);
  });

  it('the force qE points from + to − for a positive charge, the other way for an electron', () => {
    expect(potential3d(base).force).toEqual([0, -1, 0]);
    expect(potential3d({ ...base, kind: CHARGE.electron }).force).toEqual([0, 1, 0]);
    expect(potential3d({ ...base, U: 0 }).force).toBeNull();
  });
});

describe('electric potential 3D scene', () => {
  it('puts the charge where the engine has it, moves it without rebuilding, frees all', () => {
    const { kit, track, start } = testKit();
    const engine = new PotentialEngine();
    engine.reset(base);
    const state = new Float64Array(engine.stateSize);
    engine.readState(state);
    const scene = buildPotentialScene(kit, {
      model: potential3d(base),
      texts,
      read: () => state,
    });
    expect(scene.state().charge).toEqual([state[PT.x], state[PT.y], 0]);
    for (let i = 0; i < 120; i++) engine.step();
    engine.readState(state);
    scene.tick?.(1 / 60);
    const ball = kit.scene.getObjectByName('pot-charge');
    expect(ball?.position.x).toBeCloseTo(state[PT.x] ?? NaN, 12);
    expect(ball?.position.y).toBeCloseTo(state[PT.y] ?? NaN, 12);
    expect(scene.state().planes).toBe(2);
    expectAllFreed(kit, track, start);
  });
});
