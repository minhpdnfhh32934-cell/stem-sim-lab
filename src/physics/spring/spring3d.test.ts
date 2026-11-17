import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { SP, springInput } from './engine';
import { buildSpringScene } from './scene3d';
import { blockSize } from './scenes';
import { COIL_POINTS, writeCoil } from './spring3d';

const texts = { v: 'v', F: 'F', P: 'P', O: 'O', eq: 'eq', l0: 'l0' };

function buffer(x: number, v: number, F: number) {
  const b = new Float64Array(5);
  b[SP.x] = x;
  b[SP.v] = v;
  b[SP.F] = F;
  return b;
}

describe('spring 3D', () => {
  it('the coil starts and ends on its axis, exactly at the two ends', () => {
    const out = new Float32Array(COIL_POINTS * 3);
    writeCoil(out, -0.3, 0.05, 0, 0.02, 0.01);
    expect([out[0], out[1], out[2]]).toEqual([Math.fround(-0.3), Math.fround(0.02), 0]);
    const j = 3 * (COIL_POINTS - 1);
    expect(out[j]).toBeCloseTo(0.05, 6);
    expect(out[j + 1]).toBeCloseTo(0.02, 6);
    expect(out[j + 2]).toBeCloseTo(0, 6);
    writeCoil(out, 0.4, -0.1, 1, 0, 0.01);
    expect(out[j + 1]).toBeCloseTo(-0.1, 6);
    expect(out[j]).toBeCloseTo(0, 6);
  });

  it('horizontal: the block at the engine’s x, the coil on its face, F towards O', () => {
    const q = springInput({ m: 0.25, k: 100, x0: 0.05, l0: 0.3, vertical: 0 });
    const bs = blockSize(q);
    const { kit, track, start } = testKit();
    let s = buffer(0.03, -0.4, -3);
    const sc = buildSpringScene(kit, { q, texts, read: () => s });
    expect(sc.state().block).toEqual([0.03, bs / 2, 0]);
    expect(sc.state().coilEnd).toEqual([0.03 - bs / 2, bs / 2, 0]);
    const F = kit.scene.getObjectByName('spring-F');
    expect(F?.up.clone().applyQuaternion(F.quaternion).x).toBeCloseTo(-1, 9);
    s = buffer(-0.02, 0.5, 2);
    sc.tick?.(1 / 60);
    expect(sc.state().x).toBe(-0.02);
    expect(F?.up.clone().applyQuaternion(F.quaternion).x).toBeCloseTo(1, 9);
    expectAllFreed(kit, track, start);
  });

  it('vertical: the block hangs at the engine’s x, the coil from the ceiling to its top', () => {
    const q = springInput({ m: 0.25, k: 100, x0: 0.05, l0: 0.3, vertical: 1, g: 9.8 });
    const bs = blockSize(q);
    const { kit, track, start } = testKit();
    const sc = buildSpringScene(kit, { q, texts, read: () => buffer(-0.04, 0, 2.45 + 4) });
    expect(sc.state().block).toEqual([0, -0.04, 0]);
    expect(sc.state().coilEnd).toEqual([0, -0.04 + bs / 2, 0]);
    const P = kit.scene.getObjectByName('spring-P');
    expect(P?.up.clone().applyQuaternion(P.quaternion).y).toBeCloseTo(-1, 9);
    expectAllFreed(kit, track, start);
  });
});
