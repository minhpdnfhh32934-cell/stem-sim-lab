import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { heatingModel } from '../../../simulation/models/heating';
import {
  BEAKER,
  BULB,
  chunksOf,
  hotPlate,
  levelOf,
  readingHeight,
  STIR_BAR,
  THERMOMETER,
} from './hot-plate';

// The heating curve's bench against its item (as drafted for items.json: a 0.34 × 0.46 × 0.25 m
// box, bench.top on the heating plate) and the model's own states: the rig shows the set-up from
// the dials without a run, then the run's ice, water, temperature and boiling; everything stays in
// the item's box; posing only assigns. (Freeing in every state: registry.test.ts.)

const item = ItemDefinitionSchema.parse({
  id: 'hot-plate',
  displayName: 'Hot plate',
  category: 'equipment',
  physical: { massKg: 3.5 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'hot-plate', top: [0.065, 0.08, -0.02] },
  visual: { shape: 'box', size: [0.34, 0.46, 0.25], color: '#e3e7ea', material: 'painted' },
});
const [w, h, d] = item.visual.size;
const DIALS = { power: 500, mass: 0.1, startTemperature: -10, resolution: 0.1 };
/** The definition draft's smallest mass of ice (definition.json, parameter `mass`, min). */
const MASS_MIN = 0.05;
const INPUTS = {
  ...DIALS,
  iceHeatCapacity: 2100,
  fusionHeat: 334000,
  waterHeatCapacity: 4180,
  vaporisationHeat: 2257000,
  meltingPoint: 0,
  boilingPoint: 100,
  boilOffFraction: 0.05,
};
const NONE = Object.fromEntries(heatingModel.variables.map((v) => [v, NaN]));

/** The model's sample after `seconds` of the default run (or at its end). */
function sampleAt(seconds: number, inputs: Record<string, number> = INPUTS) {
  const state = new Float64Array(heatingModel.variables.length);
  heatingModel.init(inputs, state);
  for (let t = 0; t < seconds && !heatingModel.isComplete!(state, inputs);) {
    t += heatingModel.step(state, Math.min(0.01, seconds - t), inputs);
  }
  return Object.fromEntries(heatingModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const theory = heatingModel.predict!(INPUTS);
const pose = (
  status: BenchPose['status'],
  sample: Record<string, number>,
  parameters: Record<string, number> = INPUTS,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = hotPlate.frame(item, painted);
  const rig = hotPlate.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, root, named };
}
/** The world height of the reading the column's top shows. */
const columnTop = (column: THREE.Mesh) => column.position.y + column.scale.y;

describe('hot plate bench model', () => {
  it('reads only variables the heating model outputs', () => {
    for (const v of hotPlate.reads ?? []) expect(heatingModel.variables).toContain(v);
  });

  it('stands the housing on the box floor, the rig on the plate, all inside the box', () => {
    const { frame, rig, root } = build();
    frame.body.computeBoundingBox();
    expect(frame.body.boundingBox!.min.y).toBeCloseTo(-h / 2 + 0.006, 6); // on its feet
    expect(frame.body.boundingBox!.max.y).toBeCloseTo(-h / 2 + 0.072, 6); // under the plate
    expect(rig.group.position.toArray()).toEqual([0.065, 0.08 - h / 2, -0.02]);
    // At its fullest: boiling at the highest power, steam over the beaker, at several moments.
    const boiling = sampleAt(theory.boilStartTime! + 1);
    const box = new THREE.Box3();
    for (let i = 0; i < 40; i++) {
      rig.pose(pose('running', boiling, { ...INPUTS, power: 800 }), 0.05);
      root.updateMatrixWorld(true);
      box.union(new THREE.Box3().setFromObject(root, true));
    }
    const eps = 1e-6;
    expect(box.min.x).toBeGreaterThanOrEqual(-w / 2 - eps);
    expect(box.max.x).toBeLessThanOrEqual(w / 2 + eps);
    expect(box.min.y).toBeGreaterThanOrEqual(-h / 2 - eps);
    expect(box.max.y).toBeLessThanOrEqual(h / 2 + eps);
    expect(box.min.z).toBeGreaterThanOrEqual(-d / 2 - eps);
    expect(box.max.z).toBeLessThanOrEqual(d / 2 + eps);
  });

  it('shows the set-up from the dials without a run: all ice at T₀, no water, plate off', () => {
    const { rig, named } = build();
    rig.pose(pose('configured', NONE, DIALS), 1 / 60);
    expect((named('ice') as THREE.InstancedMesh).count).toBe(64); // 0.1 kg: the full pile
    expect(named('water').visible).toBe(false);
    expect(columnTop(named('column'))).toBeCloseTo(readingHeight(-10), 9);
    expect(named('bubbles').visible).toBe(false);
    expect((named('plate').material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0);
    rig.pose(pose('configured', NONE, { ...DIALS, mass: MASS_MIN, startTemperature: -25 }), 1 / 60);
    expect((named('ice') as THREE.InstancedMesh).count).toBe(32); // half the pile
    expect(columnTop(named('column'))).toBeCloseTo(readingHeight(-25), 9);
  });

  it('follows the run: ice melts into water at 0 °C, the water warms, boils with bubbles', () => {
    const { rig, named } = build();
    const lamp = named('lamp');
    const off = lamp.material;
    const ice = named('ice') as THREE.InstancedMesh;
    const water = named('water');
    const column = named('column');
    const plate = named('plate').material as THREE.MeshStandardMaterial;

    // Halfway through melting: half the ice left, half its mass as water, 0 °C.
    const melting = sampleAt(theory.iceWarmingTime! + theory.meltingTime! / 2);
    expect(melting.iceFraction).toBeCloseTo(0.5, 6);
    rig.pose(pose('running', melting), 1 / 60);
    expect(lamp.material).not.toBe(off);
    expect(plate.emissiveIntensity).toBeGreaterThan(0);
    expect(ice.count).toBe(32);
    expect(water.visible).toBe(true);
    expect(water.scale.y).toBeCloseTo(levelOf(0.05), 12);
    expect(levelOf(0.05)).toBeCloseTo(
      0.05 / 1000 / (Math.PI * (BEAKER.radius - BEAKER.wall) ** 2),
      12,
    );
    expect(columnTop(column)).toBeCloseTo(readingHeight(0), 9);
    expect(named('bubbles').visible).toBe(false);

    // Warming water: no ice, all the mass as water, between 0 and 100 °C.
    const warm = sampleAt(
      theory.iceWarmingTime! + theory.meltingTime! + theory.waterWarmingTime! / 2,
    );
    rig.pose(pose('running', warm), 1 / 60);
    expect(ice.count).toBe(0);
    expect(ice.visible).toBe(false);
    expect(water.scale.y).toBeCloseTo(levelOf(0.1), 12);
    expect(columnTop(column)).toBeCloseTo(readingHeight(warm.temperature!), 9);
    expect(warm.temperature).toBeCloseTo(50, 6);

    // Boiling: 100 °C, bubbles and steam that move from frame to frame.
    const boiling = sampleAt(theory.boilStartTime! + theory.boilingTime! / 2);
    rig.pose(pose('running', boiling), 1 / 60);
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    expect(bubbles.visible).toBe(true);
    expect(named('steam').visible).toBe(true);
    expect(columnTop(column)).toBeCloseTo(readingHeight(100), 9);
    const before = Array.from(bubbles.instanceMatrix.array);
    rig.pose(pose('running', boiling), 1 / 60);
    expect(Array.from(bubbles.instanceMatrix.array)).not.toEqual(before);
    // Every bubble is in the water.
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let i = 0; i < bubbles.count; i++) {
      bubbles.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(p.y).toBeGreaterThanOrEqual(BEAKER.base);
      expect(p.y).toBeLessThanOrEqual(BEAKER.base + water.scale.y + 1e-9);
    }

    // Completed: 5 % boiled away, the plate off, no bubbles; the last state stays shown.
    const done = sampleAt(theory.totalTime! + 1);
    rig.pose(pose('completed', done), 1 / 60);
    expect(lamp.material).toBe(off);
    expect(plate.emissiveIntensity).toBe(0);
    expect(bubbles.visible).toBe(false);
    expect(water.scale.y).toBeCloseTo(levelOf(0.095), 9);
    expect(columnTop(column)).toBeCloseTo(readingHeight(100), 9);

    // RESET: the set-up again.
    rig.pose(pose('configured', NONE, DIALS), 1 / 60);
    expect(ice.count).toBe(64);
    expect(water.visible).toBe(false);
  });

  it('keeps the thermometer bulb in the water at the smallest mass, once the ice has melted', () => {
    const { rig, named } = build();
    const bulb = named('bulb');
    const water = named('water');
    const small = { ...INPUTS, mass: MASS_MIN };
    const t = heatingModel.predict!(small);
    const bulbTop = bulb.position.y + bulb.scale.y;
    expect(bulbTop).toBeCloseTo(BULB.y + BULB.half, 12);
    // All melted (water warming), then the end of the run with 5 % boiled away: the least water.
    for (const [status, seconds] of [
      ['running', t.iceWarmingTime! + t.meltingTime! + 1],
      ['completed', t.totalTime! + 1],
    ] as const) {
      rig.pose(pose(status, sampleAt(seconds, small), small), 1 / 60);
      expect(water.visible).toBe(true);
      expect(bulbTop).toBeLessThan(BEAKER.base + water.scale.y);
    }
    expect(water.scale.y).toBeCloseTo(levelOf(0.95 * MASS_MIN), 9);
    // The bulb's glass stands clear of the beaker's floor.
    expect(THERMOMETER.bulb).toBeGreaterThan(BEAKER.base);
  });

  it('stirs: the bar turns only while running, and its sweep clears the thermometer', () => {
    const { rig, named } = build();
    const bar = named('stir-bar');
    const sweep = Math.hypot(STIR_BAR.length / 2, STIR_BAR.radius);
    expect(sweep).toBeLessThan(Math.hypot(THERMOMETER.x, THERMOMETER.z) - 0.0031); // bulb radius
    expect(bar.position.y).toBeCloseTo(BEAKER.base + STIR_BAR.radius, 12); // on the floor
    rig.pose(pose('configured', NONE, DIALS), 0.1);
    expect(bar.rotation.y).toBe(0);
    rig.pose(pose('running', sampleAt(10)), 0.1);
    const turned = bar.rotation.y;
    expect(turned).not.toBe(0);
    rig.pose(pose('stopped', sampleAt(10)), 0.1);
    expect(bar.rotation.y).toBe(turned);
    for (let i = 0; i < 1000; i++) rig.pose(pose('running', sampleAt(10)), 0.1);
    expect(Math.abs(bar.rotation.y)).toBeLessThan(2 * Math.PI); // wrapped, never growing
  });

  it('turns the knob with the power and draws the scale where the column reads', () => {
    const { rig, named } = build();
    const knob = named('knob');
    rig.pose(pose('configured', NONE, { ...DIALS, power: 200 }), 1 / 60);
    const low = knob.rotation.y;
    rig.pose(pose('configured', NONE, { ...DIALS, power: 800 }), 1 / 60);
    expect(Math.abs(knob.rotation.y)).toBeGreaterThan(Math.abs(low));
    expect(readingHeight(THERMOMETER.low)).toBe(THERMOMETER.bottom);
    expect(readingHeight(THERMOMETER.high)).toBeCloseTo(THERMOMETER.bottom + THERMOMETER.span, 12);
    expect(chunksOf(0)).toBe(0);
    expect(chunksOf(1e-6)).toBe(1); // a last sliver of ice still shows
  });

  it('poses by assignment: the same objects, materials and buffers, however often', () => {
    const { rig, root, named } = build();
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    const buffer = bubbles.instanceMatrix.array;
    const count = () => {
      let n = 0;
      const materials = new Set<unknown>();
      const geometries = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) {
          materials.add(o.material);
          geometries.add(o.geometry);
        }
      });
      return { n, materials: materials.size, geometries: geometries.size };
    };
    const before = count();
    const samples = [0, 30, 60, 100, 150, 170, 200].map((t) => sampleAt(t));
    for (let i = 0; i <= 200; i++) {
      const status = i % 3 ? 'running' : 'stopped';
      rig.pose(pose(status, samples[i % samples.length]!), 1 / 60);
    }
    rig.pose(pose('configured', NONE, DIALS), 1 / 60);
    expect(count()).toEqual(before);
    expect(bubbles.instanceMatrix.array).toBe(buffer);
  });

  it('keeps its draws modest: the body and 4 frame meshes, 10 rig meshes', () => {
    const { frame, rig } = build();
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
      return n;
    };
    expect(meshes(frame.parts)).toBe(4); // stand, steel, glass, marks (+ the body)
    expect(meshes(rig.group)).toBe(10);
  });

  it('draws the see-through contents before the glass around them', () => {
    const { named } = build();
    const glass = named('glass');
    expect((glass.material as THREE.Material).depthWrite).toBe(false);
    for (const name of ['water', 'bubbles', 'steam']) {
      expect(named(name).renderOrder).toBeGreaterThan(0);
      expect(named(name).renderOrder).toBeLessThan(glass.renderOrder);
    }
    // The bubbles are inside the water: drawn after it, never the same order (they could swap).
    expect(named('bubbles').renderOrder).toBeGreaterThan(named('water').renderOrder);
  });

  // As bench/registry.test.ts does for every registered model (this one is not registered yet).
  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const painted = new THREE.MeshStandardMaterial();
    const frame = hotPlate.frame(item, painted);
    const rig = hotPlate.rig!(item);
    const root = new THREE.Group();
    root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    const collect = () =>
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          made.add(o.geometry as THREE.BufferGeometry);
          made.add(o.material as THREE.Material);
        }
        if (o instanceof THREE.InstancedMesh) made.add(o);
      });
    const boiling = sampleAt(theory.boilStartTime! + 1);
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, status === 'running' ? boiling : NONE), 1 / 60);
      collect();
    }
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });
});
