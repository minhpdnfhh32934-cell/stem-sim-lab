import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../../view3d/kit';
import { expectAllFreed, testKit } from '../../view3d/testing';
import {
  GENOTYPES,
  genotypeToken,
  hwModel3d,
  slotClasses,
  slotKeys,
  type HwModel3D,
} from './binding';
import { HW_CLOSE_VIEW, HW_VIEW, hwLayout } from './layout';
import type { Bio3DScene, Vec3 } from '../../view3d/kit';
import { buildHwHabitat, type HwScene } from './scene';

const LESSON = { AA: 360, Aa: 480, aa: 160, N: 1000, seed: 1 };
const texts = (m: HwModel3D) => ({
  pool: 'Vốn gen',
  dial: m.generations.map((g) => `p ${String(g.p)}`),
});

const TOKENS: Record<string, string> = {
  '--chart-1': '#0072b2',
  '--chart-2': '#e69f00',
  '--chart-3': '#009e73',
};

function mesh(
  kit: SceneKit,
  name: string,
): { count: number; getColorAt: (i: number, c: THREE.Color) => void } {
  const m: unknown = kit.scene.getObjectByName(name);
  if (!(m instanceof THREE.InstancedMesh)) throw new Error(`no ${name}`);
  const im = m as THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;
  return {
    count: im.count,
    getColorAt: (i, c) => {
      im.getColorAt(i, c);
    },
  };
}

/** Triangles drawn by the scene (instanced meshes count every instance shown). */
function triangles(kit: SceneKit): number {
  let n = 0;
  kit.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    const g = o.geometry as THREE.BufferGeometry;
    const per = (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
    n += per * (o instanceof THREE.InstancedMesh ? o.count : 1);
  });
  return n;
}

describe('Hardy–Weinberg habitat scene', () => {
  it('draws each generation’s figures, allele beads and gene pool from the model, and frees everything', () => {
    const { kit, track, start } = testKit();
    const model = hwModel3d(LESSON, 250, 200);
    const scene: HwScene = buildHwHabitat(kit, { model, texts: texts(model) });
    for (const g of [0, 1, 4, 10, 2]) {
      scene.setTime?.(g + 0.4);
      const gen = model.generations[g];
      if (!gen) throw new Error('no generation');
      const s = scene.state();
      expect(s.generation).toBe(g);
      expect(s.drawn).toEqual(gen.figures);
      expect(s.beads).toEqual(gen.beads);
      const f = gen.figures;
      expect(mesh(kit, 'hw-creatures').count).toBe(f.AA + f.Aa + f.aa);
      expect(mesh(kit, 'hw-shadows').count).toBe(f.AA + f.Aa + f.aa);
      // Two gene copies per figure: A = 2·AA + Aa, a = Aa + 2·aa (in figures).
      expect(mesh(kit, 'hw-allele-A').count).toBe(2 * f.AA + f.Aa);
      expect(mesh(kit, 'hw-allele-a').count).toBe(f.Aa + 2 * f.aa);
      expect(mesh(kit, 'hw-pool-A').count).toBe(gen.beads.A);
      expect(mesh(kit, 'hw-pool-a').count).toBe(gen.beads.a);
      // The dial label is the generation's.
      const label = kit.scene.getObjectByName('hw-dial-label') as unknown as {
        element: HTMLElement;
      };
      expect(label.element.querySelector('strong')?.textContent).toBe('Vốn gen');
      expect(label.element.querySelector('span')?.textContent).toBe(`p ${String(gen.p)}`);
    }
    expect(scene.state().per).toBe(5);
    scene.tick?.(0.5);
    scene.select?.('figure:3');
    expect(kit.scene.getObjectByName('hw-pick-ring')?.visible).toBe(true);
    scene.select?.('pool');
    expect(kit.scene.getObjectByName('hw-pick-ring')?.visible).toBe(false);
    expect(kit.scene.getObjectByName('hw-pool-ring')?.visible).toBe(true);
    expectAllFreed(kit, track, start);
  });

  it('each figure’s body has its genotype’s chart colour', () => {
    const kit = new SceneKit({
      tier: 'medium',
      segments: 16,
      maxParticles: 4000,
      token: (n) => TOKENS[n] ?? '#808080',
      look: 'outdoor',
    });
    const model = hwModel3d(LESSON, 250, 200);
    const scene = buildHwHabitat(kit, { model, texts: texts(model) });
    scene.setTime?.(3);
    const body = mesh(kit, 'hw-creatures');
    const f = model.generations[3]?.figures ?? { AA: 0, Aa: 0, aa: 0 };
    const cls = slotClasses([f.AA, f.Aa, f.aa], slotKeys(model.slots, 3));
    const c = new THREE.Color();
    for (let i = 0; i < body.count; i++) {
      body.getColorAt(i, c);
      const want = new THREE.Color(TOKENS[genotypeToken(GENOTYPES[cls[i] ?? 0] ?? 'AA')]);
      expect(c.getHexString()).toBe(want.getHexString());
    }
    kit.dispose();
  });

  it('a tap picks the figure under it or the gene pool', () => {
    const { kit, track, start } = testKit();
    const model = hwModel3d({ AA: 36, Aa: 48, aa: 16, N: 100, seed: 2 }, 250, 200);
    const scene = buildHwHabitat(kit, { model, texts: texts(model) });
    kit.scene.updateMatrixWorld(true);
    const state = scene.state();
    const down = (x: number, z: number) =>
      new THREE.Raycaster(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0));
    const fp = state.figurePoint;
    expect(fp).not.toBeNull();
    expect(scene.pick?.(down(fp?.[0] ?? 0, fp?.[2] ?? 0))).toBe('figure:0');
    const L = hwLayout(model.slots, model.beadSlots);
    // The plinth's rim (outside the jar, which is never pickable).
    expect(scene.pick?.(down(L.pool.x + L.pool.plinthR * 0.9, L.pool.z))).toBe('pool');
    expect(scene.pick?.(down(L.pool.x, L.pool.z + L.habitatR * 0.5))).toBeNull();
    expectAllFreed(kit, track, start);
  });

  it('frames a close-up beside the jar and names one figure of each genotype, the antennae, the beads and the ring', () => {
    const { kit, track, start } = testKit();
    const model = hwModel3d(LESSON, 150, 200);
    const scene = buildHwHabitat(kit, { model, texts: texts(model) });
    kit.scene.updateMatrixWorld(true);
    const close = scene.frames?.closeup;
    expect(close?.dir).toEqual(HW_CLOSE_VIEW);
    expect(close?.bounds.radius ?? Infinity).toBeLessThan(scene.bounds.radius * 0.7);
    // The camera where the view frames the whole subject.
    const look = (b: Bio3DScene['bounds'], dir: Vec3, k: number) => {
      const cam = new THREE.PerspectiveCamera(34, 2.4, 0.1, 1000);
      const d = new THREE.Vector3(...dir).normalize().multiplyScalar(b.radius * k);
      cam.position.set(b.center[0] + d.x, b.center[1] + d.y, b.center[2] + d.z);
      cam.lookAt(...b.center);
      cam.updateMatrixWorld();
      return cam;
    };
    const L = hwLayout(model.slots, model.beadSlots);
    const f = model.generations[0]?.figures ?? { AA: 0, Aa: 0, aa: 0 };
    const cls = slotClasses([f.AA, f.Aa, f.aa], slotKeys(model.slots, 0));
    for (const [view, b, dir] of [
      [undefined, scene.bounds, HW_VIEW],
      ['closeup', close?.bounds ?? scene.bounds, HW_CLOSE_VIEW],
    ] as const) {
      const callouts = scene.callouts?.(look(b, dir, 2.2)) ?? [];
      expect(callouts.map((c) => c.id)).toEqual(['antennae', 'AA', 'Aa', 'aa', 'beads', 'dial']);
      // Each genotype's name points at a figure of that genotype.
      for (const c of callouts.filter((x) => (GENOTYPES as readonly string[]).includes(x.id))) {
        const slot = L.slots.findIndex((s) => s.x === c.point[0] && s.z === c.point[2]);
        expect(GENOTYPES[cls[slot] ?? -1]).toBe(c.id);
      }
      // Names keep off the jar and, seen whole, the herd; up close, the three named figures.
      const o = scene.calloutObstacles?.(view);
      expect(o?.regions).toHaveLength(2);
      expect(o?.avoid).toHaveLength(view === 'closeup' ? 4 : 2);
    }
    expectAllFreed(kit, track, start);
  });

  it('an empty population: no figures, no beads, no p / q ring and no callouts', () => {
    const { kit, track, start } = testKit();
    const model = hwModel3d({ AA: 0, Aa: 0, aa: 0, N: 50, seed: 2 }, 150, 200);
    const scene = buildHwHabitat(kit, { model, texts: texts(model) });
    for (const g of [0, 1, 10]) {
      scene.setTime?.(g);
      expect(scene.state().drawn).toEqual({ AA: 0, Aa: 0, aa: 0 });
      expect(scene.state().beads).toEqual({ A: 0, a: 0 });
      expect(kit.scene.getObjectByName('hw-dial-A')?.visible).toBe(false);
      expect(kit.scene.getObjectByName('hw-dial-a')?.visible).toBe(false);
      const cam = new THREE.PerspectiveCamera(34, 2.4, 0.1, 1000);
      cam.position.set(0, 20, 40);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      expect(scene.callouts?.(cam)).toEqual([]);
    }
    expectAllFreed(kit, track, start);
  });

  it('stays within the triangle budget at the largest crowd (High tier)', () => {
    const { kit, track, start } = testKit('high', 10000);
    const model = hwModel3d({ AA: 25_000, Aa: 50_000, aa: 25_000, N: 100_000, seed: 1 }, 250, 200);
    expect(model.slots).toBeLessThanOrEqual(250);
    const scene = buildHwHabitat(kit, { model, texts: texts(model) });
    scene.setTime?.(5);
    expect(triangles(kit)).toBeLessThan(160_000);
    expectAllFreed(kit, track, start);
  });
});
