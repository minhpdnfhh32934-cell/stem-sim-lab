import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TagLayer } from '@/ui/three/tagLayer';
import { expectDisposes } from '@/ui/three/testing';
import { osmosisData } from '../osmosisData';
import { diffusionFrameAt, diffusionModel3d, type DiffusionInputs } from './diffusion';
import { BOX } from './diffusionLayout';
import { buildDiffusionScene } from './diffusionScene';
import { SOLUTE_DRAWN, TUBE, WATER_DRAWN, osmosisFrameAt, osmosisModel3d } from './osmosis';
import { buildOsmosisScene } from './osmosisScene';

const token = () => '#808080';
const opts = (tier: 'medium' | 'high' = 'medium') => ({
  tier,
  segments: tier === 'high' ? 24 : 16,
  token,
});
const inputs = (over: Partial<DiffusionInputs> = {}): DiffusionInputs => ({
  particles: 160,
  pores: 4,
  c1: 10,
  c2: 0,
  v1: 1,
  v2: 1,
  pa: 0.2,
  run: 0,
  ...over,
});
const osmosis = (over: Partial<{ c0: number; i: number; tC: number; h0: number }> = {}) =>
  osmosisModel3d(osmosisData({ c0: 1, i: 1, tC: 25, h0: 0.2, ...over }));

/** A ray from the front (+z) straight onto a point. */
const frontRay = (x: number, y: number) =>
  new THREE.Raycaster(new THREE.Vector3(x, y, 40), new THREE.Vector3(0, 0, -1));

const instances = (scene: THREE.Scene) => {
  let n = 0;
  scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.visible) n += o.count;
  });
  return n;
};

describe('3D diffusion scene', () => {
  it('draws the model’s count on each side at every t, on every tier', () => {
    for (const tier of ['medium', 'high'] as const)
      for (const over of [{}, { c1: 2, c2: 18, v1: 3, v2: 0.5, pores: 1 }]) {
        const m = diffusionModel3d(inputs(over));
        const sc = buildDiffusionScene(m, opts(tier));
        for (let s = 0; s <= 20; s++) {
          const f = diffusionFrameAt(m, (s / 20) * m.tEnd);
          sc.setFrame(f, true);
          expect(sc.sides()).toEqual({ left: f.n1, right: f.n2 });
        }
        sc.dispose();
      }
  });

  it('picks a particle, a pore, the membrane and each compartment', () => {
    const m = diffusionModel3d(inputs());
    const sc = buildDiffusionScene(m, opts());
    sc.setFrame(diffusionFrameAt(m, m.tEnd / 3), true);
    const at = sc.focusPoint({ kind: 'particle', index: 120 });
    expect(at).not.toBeNull();
    expect(sc.pick(frontRay(at?.[0] ?? 0, at?.[1] ?? 0))?.kind).toBe('particle');
    const lay = sc.plan.layout;
    // The front pore of the top row (pores 0 and 1: z = −1,05 and 1,05).
    const pore = lay.pores[1];
    expect(sc.pick(frontRay(lay.xm, (pore?.y ?? 0) + BOX.poreR))).toEqual({
      kind: 'pore',
      index: 1,
    });
    expect(sc.pick(frontRay(lay.xm, 0))).toEqual({ kind: 'membrane' });
    sc.dispose();
    // Without solute the compartments are clear to pick.
    const empty = diffusionModel3d(inputs({ c1: 0, c2: 0, v1: 1, v2: 3 }));
    const sc2 = buildDiffusionScene(empty, opts());
    sc2.setFrame(diffusionFrameAt(empty, 0), true);
    const l2 = sc2.plan.layout;
    expect(sc2.pick(frontRay(l2.x0 + l2.w1 / 2, 1))).toEqual({ kind: 'compartment', side: 1 });
    expect(sc2.pick(frontRay(l2.x1 - l2.w2 / 2, 1))).toEqual({ kind: 'compartment', side: 2 });
    sc2.dispose();
  });

  it('names its parts and puts each side’s count over it', () => {
    const m = diffusionModel3d(inputs());
    const sc = buildDiffusionScene(m, opts());
    const f = diffusionFrameAt(m, m.tEnd / 2);
    sc.setFrame(f, true);
    expect(sc.labelAnchors().map((a) => a.id)).toEqual(
      expect.arrayContaining(['compartment1', 'compartment2', 'membrane', 'pore', 'particle']),
    );
    const host = document.createElement('div');
    const layer = new TagLayer(host);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    cam.position.set(0, 4, 30);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    layer.begin(cam, 800, 800, { left: 0, top: 0, right: 800, bottom: 800 });
    sc.tags(layer, { count: (n) => `${String(n)} hạt`, dh: () => '', tick: () => '' });
    layer.end();
    const shown = [...host.querySelectorAll('span')]
      .filter((e) => !e.hidden)
      .map((e) => e.textContent);
    expect(shown).toEqual([`${String(f.n1)} hạt`, `${String(f.n2)} hạt`]);
    layer.dispose();
    sc.dispose();
  });

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => {
        const m = diffusionModel3d(inputs({ particles: 400, pores: 8 }));
        const sc = buildDiffusionScene(m, opts());
        sc.setFrame(diffusionFrameAt(m, m.tEnd / 2), true);
        sc.setSelection({ kind: 'pore', index: 2 });
        sc.setSelection({ kind: 'compartment', side: 2 });
        return sc;
      },
      (sc) => {
        sc.dispose();
        expect(sc.scene.children).toHaveLength(0);
      },
    );
  });

  it('draw budget at 400 particles: one call per instanced set, never one per particle', () => {
    const m = diffusionModel3d(inputs({ particles: 400, pores: 8 }));
    const sc = buildDiffusionScene(m, opts());
    sc.setFrame(diffusionFrameAt(m, m.tEnd / 2), true);
    sc.setSelection({ kind: 'particle', index: 0 });
    const stats = sc.drawStats();
    // Measured 2026-10-20 (CPU count, no GPU): 9 calls, about 36 000 triangles on Medium (High:
    // about 83 000). A bigger change must update this budget on purpose.
    expect(stats.calls).toBeLessThanOrEqual(10);
    expect(stats.triangles).toBeLessThan(45_000);
    // Medium's 3D instance budget is 600 (quality3d: 4000 × 15 %).
    expect(instances(sc.scene)).toBeLessThanOrEqual(600);
    sc.dispose();
  });
});

describe('3D osmosis scene', () => {
  it('the columns stand at the model’s heights on one scale; the solute sample stays whole', () => {
    for (const over of [{}, { c0: 5, i: 3, h0: 0.05 }]) {
      const m = osmosis(over);
      const sc = buildOsmosisScene(m, opts());
      for (const k of [0, 30, 120, 240]) {
        const f = osmosisFrameAt(m, m.traj.t[k] ?? 0);
        sc.setFrame(f);
        const lv = sc.levels();
        expect(lv.left / m.perMetre).toBeCloseTo(f.hL, 9);
        expect(lv.right / m.perMetre).toBeCloseTo(f.hR, 9);
        expect(sc.drawn()).toEqual({ solute: SOLUTE_DRAWN, water: WATER_DRAWN });
      }
      sc.dispose();
    }
  });

  it('picks a column, the membrane and a molecule', () => {
    const m = osmosis();
    const sc = buildOsmosisScene(m, opts());
    const f = osmosisFrameAt(m, m.tEnd / 2);
    sc.setFrame(f);
    const yl = f.hL * m.perMetre;
    // Beside the solute (which stays within 0,9 of the bore).
    expect(sc.pick(frontRay(-TUBE.a + 0.92 * TUBE.r, yl / 2))).toEqual({
      kind: 'column',
      side: 'solution',
    });
    expect(sc.pick(frontRay(TUBE.a + 0.92 * TUBE.r, 0.1))).toEqual({
      kind: 'column',
      side: 'water',
    });
    // The membrane's rim in the bottom channel.
    expect(sc.pick(frontRay(0.02, -TUBE.r + 0.3))).toEqual({ kind: 'membrane' });
    const s = sc.focusPoint({ kind: 'solute', index: 7 });
    expect(sc.pick(frontRay(s?.[0] ?? 0, s?.[1] ?? 0))?.kind).toBe('solute');
    const w = sc.focusPoint({ kind: 'water', index: 3 });
    expect(sc.pick(frontRay(w?.[0] ?? 0, w?.[1] ?? 0))?.kind).toMatch(/water|solute/);
    sc.dispose();
  });

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => {
        const m = osmosis();
        const sc = buildOsmosisScene(m, opts('high'));
        sc.setFrame(osmosisFrameAt(m, m.tEnd));
        sc.setPhase(1.5);
        sc.setSelection({ kind: 'column', side: 'water' });
        return sc;
      },
      (sc) => {
        sc.dispose();
        expect(sc.scene.children).toHaveLength(0);
      },
    );
  });

  it('draw budget: a dozen calls (static glass and liquid bottoms merged, marks instanced)', () => {
    const m = osmosis();
    const sc = buildOsmosisScene(m, opts());
    sc.setFrame(osmosisFrameAt(m, m.tEnd / 2));
    sc.setSelection({ kind: 'solute', index: 0 });
    const stats = sc.drawStats();
    // Measured 2026-10-20: 13 calls, about 15 000 triangles on Medium (High: about 33 000).
    expect(stats.calls).toBeLessThanOrEqual(13);
    expect(stats.triangles).toBeLessThan(20_000);
    expect(instances(sc.scene)).toBeLessThanOrEqual(600);
    sc.dispose();
  });
});
