import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneKit } from '../../view3d/kit';
import { expectAllFreed, testKit } from '../../view3d/testing';
import { logistic } from '../ecology';
import {
  CAPACITY_TOKEN,
  POPULATION_TOKEN,
  grazedPatches,
  logisticModel3d,
  momentAt,
  type LogisticModel3D,
} from './binding';
import { ARROW_SHARE } from './gauge';
import { foodCount, logiLayout } from './layout';
import { buildLogisticHabitat } from './scene';

const LESSON = { N0: 10, r: 0.5, K: 1000, tEnd: 30 };
const TOKENS: Record<string, string> = {
  '--chart-1': '#0072b2',
  '--chart-2': '#e69f00',
  '--chart-3': '#009e73',
};
const texts = {
  title: 'N(t)',
  k: 'K = 1.000',
  half: 'K/2 = 500',
  moment: (m: { N: number }) => `N = ${String(Math.round(m.N))}`,
};

function instanced(kit: SceneKit, name: string): THREE.InstancedMesh {
  const m: unknown = kit.scene.getObjectByName(name);
  if (!(m instanceof THREE.InstancedMesh)) throw new Error(`no ${name}`);
  return m as THREE.InstancedMesh;
}

describe('logistic growth habitat scene', () => {
  it('draws round(N(t) / per) animals, fills the column to N(t) and grazes by N/K; frees all', () => {
    const { kit, track, start } = testKit();
    const model = logisticModel3d(LESSON, 200);
    const scene = buildLogisticHabitat(kit, { model, texts });
    const food = foodCount('medium');
    for (const t of [0, 3, 9.19, 12, 20, 30, 6]) {
      scene.setTime?.(t);
      const N = logistic(10, 0.5, 1000, t);
      const s = scene.state();
      expect(s.N).toBeCloseTo(N, 9);
      expect(s.drawn).toBe(Math.round(N / model.per));
      expect(instanced(kit, 'logi-figures').count).toBe(s.drawn);
      expect(instanced(kit, 'logi-shadows').count).toBe(s.drawn);
      // The column's liquid is proportional to N (the scale's top is 1,08 · max(K, peak)).
      expect(s.fill / s.column).toBeCloseTo(N / model.top, 12);
      expect(s.food.grazed).toBe(grazedPatches(food, N / 1000));
      expect(s.food.grazed + s.food.lush).toBe(food);
      expect(instanced(kit, 'logi-food-grazed').count).toBe(s.food.grazed);
      // The arrow's length is dN/dt over its largest value (hidden near 0).
      const arrow = momentAt(model, t).arrow;
      expect(s.arrow).toBeCloseTo(Math.abs(arrow) < 0.02 ? 0 : arrow * ARROW_SHARE * s.column, 9);
      // The label beside the column is the view's text for this moment.
      const label = kit.scene.getObjectByName('logi-moment-label') as unknown as {
        element: HTMLElement;
      };
      expect(label.element.textContent).toBe(`N = ${String(Math.round(N))}`);
    }
    expect(scene.state().per).toBe(5);
    expectAllFreed(kit, track, start);
  });

  it('the liquid height is proportional to N, and the K ring sits at K / top', () => {
    const { kit, track, start } = testKit();
    const model = logisticModel3d(LESSON, 200);
    const scene = buildLogisticHabitat(kit, { model, texts });
    scene.setTime?.(4);
    const a = scene.state();
    scene.setTime?.(15);
    const b = scene.state();
    expect(a.fill / b.fill).toBeCloseTo(a.N / b.N, 12);
    const base =
      (kit.scene.getObjectByName('logi-ring-half')?.position.y ?? 0) * 2 -
      (kit.scene.getObjectByName('logi-ring-k')?.position.y ?? 0);
    const k = kit.scene.getObjectByName('logi-ring-k')?.position.y ?? 0;
    expect((k - base) / b.column).toBeCloseTo(1000 / model.top, 9);
    expectAllFreed(kit, track, start);
  });

  it('newcomers grow in while it animates; the first animals never move', () => {
    const { kit, track, start } = testKit();
    const model = logisticModel3d(LESSON, 200);
    const scene = buildLogisticHabitat(kit, { model, texts });
    scene.setTime?.(8);
    const body = instanced(kit, 'logi-figures');
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const before: number[][] = [];
    for (let i = 0; i < body.count; i++) {
      body.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      before.push([p.x, p.z]);
    }
    scene.tick?.(0.016);
    scene.setTime?.(14);
    expect(scene.state().settling).toBe(true);
    for (let k = 0; k < 60; k++) scene.tick?.(0.05);
    expect(scene.state().settling).toBe(false);
    scene.rest?.();
    before.forEach(([x, z], i) => {
      body.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(p.x).toBeCloseTo(x ?? 0, 9);
      expect(p.z).toBeCloseTo(z ?? 0, 9);
    });
    expect(body.count).toBe(Math.round(logistic(10, 0.5, 1000, 14) / model.per));
    expectAllFreed(kit, track, start);
  });

  it('N₀ > K: the animals above K stand outside the fence and leave as N falls', () => {
    const { kit, track, start } = testKit();
    const model: LogisticModel3D = logisticModel3d({ N0: 1500, r: 0.5, K: 500, tEnd: 20 }, 200);
    const scene = buildLogisticHabitat(kit, { model, texts });
    scene.setTime?.(0);
    expect(scene.state().drawn).toBe(model.slots);
    expect(scene.state().arrow).toBeLessThan(0);
    scene.setTime?.(20);
    const end = Math.round(logistic(1500, 0.5, 500, 20) / model.per);
    expect(scene.state().drawn).toBe(end);
    expect(end).toBeLessThan(model.slots);
    const L = logiLayout(model.slots, model.kSlots, foodCount('medium'));
    expect(
      L.slots.slice(model.kSlots).every((s) => Math.hypot(s.x - L.meadow.x, s.z) > L.fenceR),
    ).toBe(true);
    expectAllFreed(kit, track, start);
  });

  it('the animals have the N(t) curve’s colour; the K ring the K line’s', () => {
    const kit = new SceneKit({
      tier: 'medium',
      segments: 16,
      maxParticles: 4000,
      token: (n) => TOKENS[n] ?? '#808080',
      look: 'outdoor',
    });
    const scene = buildLogisticHabitat(kit, { model: logisticModel3d(LESSON, 200), texts });
    scene.setTime?.(12);
    const body = instanced(kit, 'logi-figures');
    const c = new THREE.Color();
    const want = new THREE.Color(TOKENS[POPULATION_TOKEN]).getHexString();
    for (let i = 0; i < body.count; i++) {
      body.getColorAt(i, c);
      expect(c.getHexString()).toBe(want);
    }
    const ring = kit.scene.getObjectByName('logi-ring-k') as THREE.Mesh;
    expect((ring.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      new THREE.Color(TOKENS[CAPACITY_TOKEN]).getHexString(),
    );
    const liquid = kit.scene.getObjectByName('logi-gauge-liquid') as THREE.Mesh;
    expect((liquid.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(want);
    kit.dispose();
  });

  it('a tap picks the animal, the column or the clover under it; marks and names them', () => {
    const { kit, track, start } = testKit();
    const model = logisticModel3d(LESSON, 200);
    const scene = buildLogisticHabitat(kit, { model, texts });
    scene.setTime?.(12);
    kit.scene.updateMatrixWorld(true);
    const down = (x: number, z: number) =>
      new THREE.Raycaster(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0));
    const s = scene.state();
    const fp = s.figurePoint;
    expect(fp).not.toBeNull();
    expect(scene.pick?.(down(fp?.[0] ?? 0, fp?.[2] ?? 0))).toMatch(/^figure:\d+$/);
    const L = logiLayout(model.slots, model.kSlots, foodCount('medium'));
    expect(scene.pick?.(down(L.gauge.x + L.gauge.plinthR * 0.9, L.gauge.z))).toBe('gauge');
    // The last clover patch (the outermost, still lush at t = 12).
    const patch = L.food[L.food.length - 1];
    expect(scene.pick?.(down(patch?.x ?? 0, patch?.z ?? 0))).toMatch(/^(food|figure:\d+)$/);
    expect(scene.pick?.(down(L.gauge.x, L.gauge.z + L.habitatR * 0.6))).toBeNull();
    scene.select?.('figure:2');
    expect(kit.scene.getObjectByName('logi-pick-ring')?.visible).toBe(true);
    scene.select?.('gauge');
    expect(kit.scene.getObjectByName('logi-pick-ring')?.visible).toBe(false);
    expect(kit.scene.getObjectByName('logi-gauge-ring')?.visible).toBe(true);
    const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 500);
    camera.position.set(0, 25, 45);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const ids = scene.callouts?.(camera).map((c) => c.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining(['figure', 'fence', 'food']));
    expectAllFreed(kit, track, start);
  });

  it('frames a herd close-up and one close-up per pick; the column’s labels wait for its card', () => {
    const { kit, track, start } = testKit();
    const model = logisticModel3d(LESSON, 200);
    const scene = buildLogisticHabitat(kit, { model, texts });
    scene.setTime?.(12);
    const L = logiLayout(model.slots, model.kSlots, foodCount('medium'));
    const frames = scene.frames ?? {};
    // "Cận cảnh đàn", the column, the clover and every slot the run can draw.
    expect(Object.keys(frames)).toEqual(
      expect.arrayContaining(['closeup', 'gauge', 'food', 'figure:0']),
    );
    expect(Object.keys(frames)).toHaveLength(3 + model.slots);
    expect(frames[`figure:${String(model.slots)}`]).toBeUndefined();
    // Close-ups are much tighter than the whole subject (the camera moves in, never out).
    const whole = scene.bounds.radius;
    for (const id of ['closeup', 'gauge', 'food', 'figure:0', `figure:${String(model.slots - 1)}`])
      expect(frames[id]?.bounds.radius ?? Infinity, id).toBeLessThan(whole * 0.62);
    // A picked animal's close-up is centred near its slot; the column's on the column.
    const slot = L.slots[model.slots - 1];
    const fc = frames[`figure:${String(model.slots - 1)}`]?.bounds.center ?? [0, 0, 0];
    expect(Math.hypot(fc[0] - (slot?.x ?? 0), fc[2] - (slot?.z ?? 0))).toBeLessThan(2);
    const gc = frames.gauge?.bounds.center ?? [0, 0, 0];
    expect(Math.abs(gc[0] - L.gauge.x)).toBeLessThan(L.gauge.tubeR + 1.5);
    // The column's labels hide while an animal's or the clover's card is open.
    const label = kit.scene.getObjectByName('logi-moment-label');
    const title = kit.scene.getObjectByName('logi-gauge-title');
    expect(label?.visible).toBe(true);
    scene.select?.('figure:2');
    expect(label?.visible).toBe(false);
    scene.select?.('food');
    expect(label?.visible).toBe(false);
    expect(title?.visible).toBe(false);
    scene.select?.('gauge');
    expect(label?.visible).toBe(true);
    expect(title?.visible).toBe(true);
    scene.select?.(null);
    expect(label?.visible).toBe(true);
    // The glass has lip rings at its top and foot.
    expect(kit.scene.getObjectByName('logi-glass-lip')).toBeTruthy();
    expect(kit.scene.getObjectByName('logi-glass-foot')).toBeTruthy();
    expectAllFreed(kit, track, start);
  });
});
