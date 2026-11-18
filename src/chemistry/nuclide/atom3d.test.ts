import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { atom3d } from './atom3d';
import { buildAtomScene } from './scene3d';
import { N_MAX, Z_MAX } from './composition';

const len = (p: readonly number[]) => Math.hypot(...p);

describe('atom composition 3D', () => {
  it('draws exactly Z protons, N neutrons and the electrons asked for', () => {
    for (const [z, n, e] of [
      [1, 0, 1],
      [1, 0, 0],
      [6, 6, 6],
      [26, 30, 23],
      [Z_MAX, N_MAX, Z_MAX + 3],
    ] as const) {
      const a = atom3d(z, n, e);
      expect(a.nucleons).toHaveLength(z + n);
      expect(a.proton.filter(Boolean)).toHaveLength(z);
      expect(a.electrons).toHaveLength(e);
    }
  });

  it('keeps nucleons inside the nucleus and electrons outside it, within reach', () => {
    const a = atom3d(26, 30, 26);
    for (const p of a.nucleons) expect(len(p)).toBeLessThanOrEqual(a.R + 1e-9);
    for (const p of a.electrons) {
      expect(len(p)).toBeGreaterThan(a.R + 1);
      expect(len(p)).toBeLessThanOrEqual(a.reach + 1e-9);
    }
  });

  it('is seeded: the same atom gives the same picture', () => {
    expect(atom3d(8, 8, 8)).toEqual(atom3d(8, 8, 8));
  });

  it('scene counts match the model and everything is freed', () => {
    const { kit, track, start } = testKit();
    const s = buildAtomScene(kit, { atom: atom3d(11, 12, 10) });
    expect(s.state()).toEqual({ protons: 11, neutrons: 12, electrons: 10 });
    const count = (name: string) =>
      (kit.scene.getObjectByName(name) as { count?: number } | undefined)?.count;
    expect(count('atom-protons')).toBe(11);
    expect(count('atom-neutrons')).toBe(12);
    expect(count('atom-electrons')).toBe(10);
    expectAllFreed(kit, track, start);
  });

  it('hydrogen-1 has no neutron mesh', () => {
    const { kit, track, start } = testKit();
    const s = buildAtomScene(kit, { atom: atom3d(1, 0, 1) });
    expect(s.state()).toEqual({ protons: 1, neutrons: 0, electrons: 1 });
    expect(kit.scene.getObjectByName('atom-neutrons')).toBeUndefined();
    expectAllFreed(kit, track, start);
  });
});
