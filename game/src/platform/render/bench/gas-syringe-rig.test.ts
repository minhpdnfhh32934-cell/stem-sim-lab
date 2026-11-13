import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import enzymeJson from '../../../content/experiments/enzyme-activity.json';
import items from '../../../content/items.json';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { enzymeModel } from '../../../simulation/models/enzyme';
import {
  BUBBLE,
  EXTRACT_PER_ML,
  GAS_SYRINGE,
  INNER_BOTTOM,
  TUBE,
  gasSyringeRig,
  glyphMasks,
  tubeLevel,
} from './gas-syringe-rig';

// The enzyme bench against its item (as shipped: 0.8 × 0.36 × 0.3 m, the rig from the
// floor centre): it fits its box, frees all it made, and draws the run as the model gives it —
// the plunger on the oxygen, the bubbles on the rate, the stopwatch on the clock — and the dials
// before a run, posing only by assignment.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'gas-syringe-rig'));
const [w, h, d] = item.visual.size;
/** The shipped definition's dial defaults and initial conditions (enzyme-activity.json). */
const DEFAULTS: Record<string, number> = {
  ...Object.fromEntries(enzymeJson.parameters.map((p) => [p.id, p.default])),
  ...enzymeJson.initialConditions,
};

/** The model's sample `seconds` into a run with these inputs (as the station's pose gives it). */
function sampleAt(seconds: number, inputs: Record<string, number> = DEFAULTS) {
  const state = new Float64Array(enzymeModel.variables.length);
  enzymeModel.init(inputs, state);
  for (let t = 0; t < seconds - 1e-9;)
    t += enzymeModel.step(state, Math.min(0.5, seconds - t), inputs);
  return Object.fromEntries(enzymeModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const NO_RUN = Object.fromEntries(enzymeModel.variables.map((v) => [v, NaN]));
const pose = (
  status: SessionState,
  sample: Record<string, number> = NO_RUN,
  parameters: Record<string, number> = DEFAULTS,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = gasSyringeRig.frame(item, painted);
  const rig = gasSyringeRig.rig!(item);
  const root = new THREE.Group();
  const body = new THREE.Mesh(frame.body, painted);
  root.add(body, frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, root, body, painted, named };
}
const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) n++;
  });
  return n;
};

describe('gas syringe rig (enzyme activity)', () => {
  it('reads only variables the enzyme model outputs', () => {
    expect(gasSyringeRig.reads).toEqual(['oxygen', 'rate', 'clock']);
    for (const v of gasSyringeRig.reads!) expect(enzymeModel.variables).toContain(v);
  });

  it('stands in its box at full scale, in a few draws', () => {
    const { frame, rig, root } = build();
    const full = { ...sampleAt(60), oxygen: GAS_SYRINGE.capacity, rate: 1 };
    const most = { ...DEFAULTS, temperature: 65, enzymeVolume: 2 };
    // Running: the gas plunger fully out; idle with E = 2 mL: the extract plunger at its highest.
    for (const posed of [pose('running', full, most), pose('configured', NO_RUN, most)]) {
      rig.pose(posed, 1 / 60);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root, true);
      for (const [lo, hi, size] of [
        [box.min.x, box.max.x, w],
        [box.min.y, box.max.y, h],
        [box.min.z, box.max.z, d],
      ] as const) {
        expect(lo).toBeGreaterThanOrEqual(-size / 2 - 1e-6);
        expect(hi).toBeLessThanOrEqual(size / 2 + 1e-6);
      }
      expect(box.min.y).toBeCloseTo(-h / 2, 6); // on the bench
    }
    expect(rig.group.position.toArray()).toEqual([0, -h / 2, 0]); // bench.top: the floor centre
    expect(1 + meshes(frame.parts)).toBe(6); // body, plastic, steel, inner glass, water, glass
    expect(meshes(rig.group)).toBe(9);
  });

  it('draws the see-through parts inside out: mixture, tube glass, bath water, outer glass', () => {
    const { named } = build();
    const order = ['mixture', 'inner-glass', 'water', 'glass'].map((n) => named(n).renderOrder);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(4);
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    expect(bubbles.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, status === 'idle' ? NO_RUN : sampleAt(5)), 1 / 60);
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          made.add(o.geometry as THREE.BufferGeometry);
          made.add(o.material as THREE.Material);
        }
        if (o instanceof THREE.InstancedMesh) made.add(o);
      });
    }
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const r of made) r.addEventListener('dispose', () => freed.add(r));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('idle: the extract drawn up in its syringe, the plunger at 0 mL, nothing bubbling', () => {
    const { rig, named } = build();
    rig.pose(pose('configured', NO_RUN, { ...DEFAULTS, enzymeVolume: 1.5 }), 1 / 60);
    const plunger = named('gas-plunger');
    expect(plunger.position.x).toBeCloseTo(GAS_SYRINGE.zero, 12);
    expect(named('extract').visible).toBe(true);
    expect(named('extract').scale.y).toBeCloseTo(1.5 * EXTRACT_PER_ML, 12);
    expect(named('mixture').scale.y).toBeCloseTo(tubeLevel(3.5) - 0.0113, 12); // 5 − E mL
    expect(named('froth').visible).toBe(false);
    expect((named('bubbles') as THREE.InstancedMesh).count).toBe(0);
  });

  it('running and completed: the plunger on the oxygen, the extract in, bubbles on the rate', () => {
    const { rig, named } = build();
    const plunger = named('gas-plunger');
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    const at10 = sampleAt(10);
    expect(at10.oxygen).toBeCloseTo(3.02, 2); // NOTES: O₂(10 s) at the defaults
    rig.pose(pose('running', at10), 1 / 60);
    const mm = (ml: number) => GAS_SYRINGE.zero + (ml / GAS_SYRINGE.capacity) * GAS_SYRINGE.length;
    expect(plunger.position.x).toBeCloseTo(mm(at10.oxygen!), 12);
    expect(named('extract').visible).toBe(false); // pushed in
    expect(named('mixture').scale.y).toBeCloseTo(tubeLevel(5) - 0.0113, 12);
    expect(bubbles.count).toBeGreaterThan(0);
    const fast = bubbles.count;
    const at60 = sampleAt(60);
    expect(at60.oxygen).toBeCloseTo(16.9, 1); // NOTES: O₂(60 s)
    rig.pose(pose('completed', at60), 1 / 60);
    expect(plunger.position.x).toBeCloseTo(mm(at60.oxygen!), 12);
    expect(bubbles.count).toBeLessThan(fast); // the rate has fallen
    // At most full; and RESET (no run) puts everything back.
    rig.pose(pose('running', { ...at60, oxygen: 250 }), 1 / 60);
    expect(plunger.position.x).toBeCloseTo(mm(GAS_SYRINGE.capacity), 12);
    rig.pose(pose('configured'), 1 / 60);
    expect(plunger.position.x).toBeCloseTo(GAS_SYRINGE.zero, 12);
    expect(named('extract').visible).toBe(true);
    expect(bubbles.count).toBe(0);
  });

  it('the thermometer follows the bath temperature; the slowest corner barely bubbles', () => {
    const { rig, named } = build();
    const spirit = named('thermometer');
    rig.pose(pose('configured', NO_RUN, { ...DEFAULTS, temperature: 20 }), 1 / 60);
    const at20 = spirit.scale.y;
    rig.pose(pose('configured', NO_RUN, { ...DEFAULTS, temperature: 50 }), 1 / 60);
    expect(spirit.scale.y - at20).toBeCloseTo((30 / 120) * 0.2, 12); // 0.2 m for 120 °C
    // The slowest corner the dials reach (their presets): S₀ 0.05, T 50, pH 4, E 0.5.
    const slow = { ...DEFAULTS, substrate: 0.05, temperature: 50, pH: 4, enzymeVolume: 0.5 };
    rig.pose(pose('running', sampleAt(10, slow), slow), 1 / 60);
    expect((named('bubbles') as THREE.InstancedMesh).count).toBeLessThanOrEqual(1);
  });

  it('prints numbers as seven-segment glyphs, blanking leading zeros', () => {
    const masks = (v: number, decimals: number) =>
      Array.from(glyphMasks(v, decimals, new Uint8Array(3)));
    expect(masks(30, 1)).toEqual([0x4f, 0x3f, 0x3f]); // 30.0
    expect(masks(5, 1)).toEqual([0, 0x6d, 0x3f]); // _5.0
    expect(masks(6.5, 1)).toEqual([0, 0x7d, 0x6d]); // _6.5
    expect(masks(0.05, 2)).toEqual([0x3f, 0x3f, 0x6d]); // 0.05
    expect(masks(1, 2)).toEqual([0x06, 0x3f, 0x3f]); // 1.00
    expect(masks(NaN, 1)).toEqual([0x40, 0x40, 0x40]);
    expect(masks(100, 1)).toEqual([0x40, 0x40, 0x40]); // does not fit
  });

  it('switches display segments in place when a value changes', () => {
    const { rig, named } = build();
    const digits = named('digits') as THREE.InstancedMesh;
    rig.pose(pose('configured'), 1 / 60);
    const before = Float32Array.from(digits.instanceMatrix.array);
    rig.pose(pose('configured', NO_RUN, { ...DEFAULTS, pH: 8 }), 1 / 60);
    const after = digits.instanceMatrix.array;
    let changed = 0;
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) changed++;
    expect(changed).toBeGreaterThan(0);
    rig.pose(pose('configured'), 1 / 60);
    expect(Array.from(digits.instanceMatrix.array)).toEqual(Array.from(before));
  });

  // The segments' order: the bath's T (3 glyphs and a point), °, C; the stopwatch's clock (3 and a
  // point) from 36; p, h; the buffer's pH from 72; the peroxide's S₀ from 94.
  const [TEMPERATURE, CLOCK, PH, SUBSTRATE] = [0, 36, 72, 94];
  /** The glyphs three places from segment `first` show: a segment is lit unless folded to 0. */
  const shownAt = (digits: THREE.InstancedMesh, first: number) =>
    [0, 1, 2].map((j) => {
      let mask = 0;
      for (let s = 0; s < 7; s++) {
        const i = (first + j * 7 + s) * 16;
        if (digits.instanceMatrix.array.slice(i, i + 12).some((e) => e !== 0)) mask |= 1 << s;
      }
      return mask;
    });
  const glyphs = (v: number, decimals: number) =>
    Array.from(glyphMasks(v, decimals, new Uint8Array(3)));

  it('shows the clock, the dials, and dashes for a value it does not have', () => {
    const { rig, named } = build();
    const digits = named('digits') as THREE.InstancedMesh;
    // As built (posed with no parameters): dashes, not every segment lit.
    for (const first of [TEMPERATURE, PH, SUBSTRATE])
      expect(shownAt(digits, first)).toEqual([0x40, 0x40, 0x40]);
    expect(shownAt(digits, CLOCK)).toEqual(glyphs(0, 1));
    const at10 = sampleAt(10);
    expect(at10.clock).toBeCloseTo(10, 9);
    rig.pose(pose('running', at10), 1 / 60);
    expect(shownAt(digits, CLOCK)).toEqual(glyphs(10, 1));
    expect(shownAt(digits, TEMPERATURE)).toEqual(glyphs(30, 1));
    expect(shownAt(digits, PH)).toEqual(glyphs(6, 1));
    expect(shownAt(digits, SUBSTRATE)).toEqual(glyphs(0.5, 2));
    rig.pose(pose('configured', NO_RUN, { ...DEFAULTS, pH: NaN }), 1 / 60);
    expect(shownAt(digits, PH)).toEqual([0x40, 0x40, 0x40]);
  });

  it('uploads the segments only when a display shows something new', () => {
    const { rig, named } = build();
    const matrices = (named('digits') as THREE.InstancedMesh).instanceMatrix;
    const at10 = sampleAt(10);
    rig.pose(pose('running', at10), 1 / 60);
    const version = matrices.version;
    rig.pose(pose('running', { ...at10, clock: 10.04 }), 1 / 60); // still 10.0
    expect(matrices.version).toBe(version);
    rig.pose(pose('running', { ...at10, clock: 10.06 }), 1 / 60); // 10.1
    expect(matrices.version).toBeGreaterThan(version);
  });

  it('keeps every bubble inside the tube, in the liquid, as they rise', () => {
    const { rig, named } = build();
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    const sample = { ...sampleAt(10), rate: 1 };
    const [m, p] = [new THREE.Matrix4(), new THREE.Vector3()];
    const centre = INNER_BOTTOM + TUBE.inner; // the round bottom's centre
    const surface = INNER_BOTTOM + tubeLevel(5);
    for (let frame = 0; frame < 240; frame++) {
      rig.pose(pose('running', sample), 1 / 60);
      expect(bubbles.count).toBe(18);
      for (let i = 0; i < bubbles.count; i++) {
        bubbles.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        const across = Math.hypot(p.x - TUBE.x, p.z);
        const out = p.y < centre ? Math.hypot(across, p.y - centre) : across;
        expect(out + BUBBLE).toBeLessThanOrEqual(TUBE.inner);
        expect(p.y + BUBBLE).toBeLessThanOrEqual(surface);
      }
    }
  });

  it('poses by assignment: the same objects, materials and buffers, however often', () => {
    const { rig, root } = build();
    const count = () => {
      const seen = new Set<unknown>();
      let n = 0;
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) {
          seen.add(o.material);
          seen.add(o.geometry);
          for (const a of Object.values((o.geometry as THREE.BufferGeometry).attributes))
            seen.add(a.array);
        }
        if (o instanceof THREE.InstancedMesh) seen.add(o.instanceMatrix.array);
      });
      return { n, seen };
    };
    const before = count();
    const samples = [0, 3, 10, 30, 60].map((t) => sampleAt(t));
    for (let i = 0; i <= 200; i++)
      rig.pose(pose(i % 3 ? 'running' : 'stopped', samples[i % samples.length]), 1 / 60);
    rig.pose(pose('completed', samples[4]), 1 / 60);
    rig.pose(pose('configured'), 1 / 60);
    const after = count();
    expect(after.n).toBe(before.n);
    expect([...after.seen]).toEqual([...before.seen]);
  });
});
