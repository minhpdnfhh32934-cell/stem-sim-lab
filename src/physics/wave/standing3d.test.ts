import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { STRING_POINTS, verticalScale } from './draw';
import { MODE, SW, StandingWaveEngine, standingInput, waveOf } from './engine';
import { standing } from './model';
import { buildStandingScene } from './scene3d';

const texts = { N: 'N', B: 'B', P: 'P', none: 'none' };

describe('standing wave 3D scene', () => {
  it('beads at the model’s y = 2A sin kx sin ωt (×S) at the engine’s instant; P is the engine’s y', () => {
    const { kit, track, start } = testKit();
    const q = standingInput({});
    const w = waveOf(q);
    if (!w) throw new Error('no wave');
    const engine = new StandingWaveEngine();
    engine.reset({});
    const state = new Float64Array(engine.stateSize);
    const scene = buildStandingScene(kit, { q, texts, read: () => state });
    for (let i = 0; i < 37; i++) engine.step();
    engine.readState(state);
    scene.tick?.(1 / 60);
    const t = (state[SW.phi] ?? 0) / w.omega;
    expect(scene.state().t).toBeCloseTo(t, 15);
    const beads = kit.scene.getObjectByName('sw-string') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const S = verticalScale(q);
    for (const i of [0, 40, 81, 120, 200, STRING_POINTS - 1]) {
      beads.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      const x = (i * q.L) / (STRING_POINTS - 1);
      // Instance matrices are 32-bit floats.
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.y).toBeCloseTo(S * standing(w, x, t), 6);
    }
    expect(scene.state().yP).toBeCloseTo((state[SW.y] ?? 0) * S, 15);
    expect(kit.scene.getObjectByName('sw-loops')).toBeDefined();
    expectAllFreed(kit, track, start);
  });

  it('no whole number of half wavelengths: a still string and the notice; frees all', () => {
    const { kit, track, start } = testKit();
    const q = standingInput({ mode: MODE.harmonic, f: 26.3 });
    expect(waveOf(q)).toBeNull();
    buildStandingScene(kit, { q, texts, read: () => null });
    expect(kit.scene.getObjectByName('sw-loops')).toBeUndefined();
    expectAllFreed(kit, track, start);
  });
});
