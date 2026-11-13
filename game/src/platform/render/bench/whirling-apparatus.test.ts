import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { circularModel } from '../../../simulation/models/circular';
import { SEGMENTS } from './osmosis-rack';
import {
  BELOW_CLIP,
  BUNG,
  CLIP_RUNNING,
  DISC,
  HANGER,
  STANDING_HOOK,
  TUBE,
  whirlingApparatus,
} from './whirling-apparatus';

// The whirling-bung apparatus against its item (0.9 × 0.62 × 0.9 m, the rig at its base centre),
// posed from samples of the real model: the bung at the run's (x, tube top − drop, z) with the
// string straight from the tube top to it, L long; parked on the tube's rim without a run; the
// clip L along the string and the hanger below it, with (M − 0.05)/0.05 discs; the stopwatch
// reading t to d and counting the turns; all inside the item's box; posing only assigns; freeing
// everything.

const item = ItemDefinitionSchema.parse({
  id: 'whirling-apparatus',
  displayName: 'Whirling-bung apparatus',
  category: 'equipment',
  physical: { massKg: 6 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'whirling-apparatus', top: [0, 0, 0] },
  visual: { shape: 'box', size: [0.9, 0.62, 0.9], color: '#4a5560', material: 'painted' },
});
const [W, H, D] = item.visual.size;

/** The draft definition's inputs (initial conditions and dial defaults), with `over` dialled. */
const inputs = (over: Record<string, number> = {}): Record<string, number> => ({
  gravity: 9.81,
  timedTurns: 10,
  length: 0.3,
  hangingMass: 0.2,
  bungMass: 0.04,
  stopwatchResolution: 0.01,
  ...over,
});

/** The model's sample `seconds` into the run (1 ms steps, as the definition runs it). */
function sampleAt(parameters: Record<string, number>, seconds: number) {
  const state = new Float64Array(circularModel.variables.length);
  circularModel.init(parameters, state);
  for (let i = Math.round(seconds / 0.001); i > 0; i--)
    circularModel.step(state, 0.001, parameters);
  return Object.fromEntries(circularModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const none = Object.fromEntries(circularModel.variables.map((v) => [v, NaN]));
const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Record<string, number> = none,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = whirlingApparatus.frame(item, painted);
  const rig = whirlingApparatus.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const instanced = (name: string) => root.getObjectByName(name) as THREE.InstancedMesh;
  /** What the stopwatch shows: two lap places, then four time places (blank places as spaces). */
  const reads = () => {
    const mesh = instanced('stopwatch-digits');
    const m = new THREE.Matrix4();
    const lit = (slot: number) => (mesh.getMatrixAt(slot, m), m.determinant() !== 0);
    let text = '';
    for (let place = 0; place < 6; place++) {
      let bits = 0;
      for (let k = 0; k < 7; k++) if (lit(place * 8 + k)) bits |= 1 << k;
      const digit = SEGMENTS.indexOf(bits as (typeof SEGMENTS)[number]);
      text += digit >= 0 ? String(digit) : bits === 0x40 ? '-' : bits === 0 ? ' ' : '?';
      if (lit(place * 8 + 7)) text += '.';
    }
    return text;
  };
  /** The world box of what is drawn now (instanced bounds recomputed: the strings move). */
  const bounds = () => {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.boundingBox = null;
    });
    return new THREE.Box3().setFromObject(root, true);
  };
  /** The string piece `i`: where it starts, its direction and its length, from the base centre. */
  const string = (i: number) => {
    const m = new THREE.Matrix4();
    instanced('string').getMatrixAt(i, m);
    const from = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(from, q, s);
    return { from, along: new THREE.Vector3(0, 1, 0).applyQuaternion(q), length: s.y };
  };
  return { frame, rig, root, painted, named, instanced, reads, bounds, string };
}

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
  return n;
};

/** The dial corners: the steepest droop (β = 30°) and the widest, flattest circle (r = 0.399). */
const STEEP = inputs({ length: 0.4, hangingMass: 0.1, bungMass: 0.05 });
const WIDE = inputs({ length: 0.4, hangingMass: 0.4, bungMass: 0.03 });

describe('whirling apparatus bench model', () => {
  it('reads only variables the circular-motion model outputs', () => {
    for (const v of whirlingApparatus.reads ?? []) expect(circularModel.variables).toContain(v);
  });

  it('draws in a few meshes and keeps frame and rig, in every state, inside the item’s box', () => {
    const { frame, rig, root, painted, bounds } = build();
    expect((root.children[0] as THREE.Mesh).geometry).toBe(frame.body);
    const names: string[] = [];
    frame.parts.traverse((o) => {
      if (o instanceof THREE.Mesh) names.push(o.name);
    });
    expect(names.sort()).toEqual(['backlit', 'glass', 'metal', 'plastic']);
    expect(meshes(rig.group)).toBe(6); // bung, string, clip, hanger, discs, digits
    let casts = 0;
    rig.group.traverse((o) => (casts += o instanceof THREE.Mesh && o.castShadow ? 1 : 0));
    expect(casts).toBe(1); // the bung alone
    frame.parts.traverse((o) => {
      if (o instanceof THREE.Mesh) expect(o.material).not.toBe(painted);
    });
    expect(rig.group.position.toArray()).toEqual([0, -H / 2, 0]); // bench.top [0, 0, 0]
    for (const p of [STEEP, WIDE, inputs({ length: 0.2 })]) {
      for (const [status, seconds] of [
        ['configured', null],
        ['running', 0],
        ['running', 0.3],
        ['stopped', 1.1],
        ['completed', 12],
      ] as const) {
        rig.pose(pose(status, p, seconds === null ? none : sampleAt(p, seconds)), 1 / 60);
        const box = bounds();
        expect(box.min.y).toBeCloseTo(-H / 2, 6); // the base on the item's floor
        expect(box.min.x).toBeGreaterThanOrEqual(-W / 2);
        expect(box.max.x).toBeLessThanOrEqual(W / 2);
        expect(box.max.y).toBeLessThanOrEqual(H / 2);
        expect(box.min.z).toBeGreaterThanOrEqual(-D / 2);
        expect(box.max.z).toBeLessThanOrEqual(D / 2);
      }
    }
  });

  it('puts the bung at the run’s (x, tube top − drop, z), the string straight to it, L long', () => {
    const { rig, named, instanced, string } = build();
    const bung = named('bung');
    const axis = new THREE.Vector3();
    for (const p of [inputs(), STEEP, WIDE]) {
      for (const seconds of [0, 0.05, 0.37, 2.2]) {
        const s = sampleAt(p, seconds);
        rig.pose(pose('running', p, s), 1 / 60);
        expect(bung.position.x).toBeCloseTo(s.x!, 12);
        expect(bung.position.y).toBeCloseTo(TUBE.top - s.drop!, 12);
        expect(bung.position.z).toBeCloseTo(s.z!, 12);
        expect(Math.hypot(s.x!, s.z!)).toBeCloseTo(s.radius!, 9);
        expect(instanced('string').count).toBe(2);
        const { from, along, length } = string(1);
        expect(from.distanceTo(new THREE.Vector3(0, TUBE.top, 0))).toBeLessThan(1e-6);
        expect(length).toBeCloseTo(p.length!, 6); // instance matrices are float32
        expect(from.addScaledVector(along, length).distanceTo(bung.position)).toBeLessThan(1e-6);
        // The bung's axis lies along its string, narrow end towards the tube.
        axis.set(0, 1, 0).applyQuaternion(bung.quaternion);
        expect(axis.distanceTo(along)).toBeLessThan(1e-6);
        expect(bung.scale.x).toBeCloseTo(Math.cbrt(p.bungMass! / BUNG.mass), 12);
      }
      // Anticlockwise seen from above: just after the start mark on +x it is at −z.
      const early = sampleAt(p, 0.02);
      expect(early.x).toBeGreaterThan(0);
      expect(early.z).toBeLessThan(0);
    }
    // The run's other piece: tube top down to the hanger's hook, just below the tube.
    const drop = string(0);
    expect(drop.from.x).toBe(0);
    expect(drop.from.z).toBe(0);
    expect(drop.from.y).toBeCloseTo(CLIP_RUNNING - BELOW_CLIP, 6);
    expect(drop.along.toArray()).toEqual([0, 1, 0]);
    expect(drop.length).toBeCloseTo(TUBE.top - (CLIP_RUNNING - BELOW_CLIP), 6);
  });

  it('parks the bung on the tube’s rim without a run, the clip L along the string, the hanger below', () => {
    const { rig, named, instanced, string } = build();
    const bung = named('bung');
    for (const status of ['idle', 'configured'] as const) {
      for (const [L, hook] of [
        [0.2, TUBE.top - 0.2 - BELOW_CLIP], // hanging from the clip
        [0.3, STANDING_HOOK], // just touching the base
        [0.4, STANDING_HOOK], // standing on the base, the string slack
      ] as const) {
        const p = inputs({ length: L });
        rig.pose(pose(status, p), 1 / 60);
        const k = Math.cbrt(p.bungMass! / BUNG.mass);
        expect(bung.position.toArray()).toEqual([0, TUBE.top + (k * BUNG.h) / 2, 0]);
        expect(bung.quaternion.w).toBe(1);
        expect(instanced('string').count).toBe(1); // nothing between the tube top and the bung
        expect(named('clip').visible).toBe(true);
        expect(named('clip').position.y).toBeCloseTo(TUBE.top - L, 12);
        expect(named('hanger').position.y).toBeCloseTo(hook, 12);
        expect(string(0).length).toBeCloseTo(TUBE.top - hook, 6);
        expect(named('hanger').position.y).toBeGreaterThanOrEqual(STANDING_HOOK - 1e-12);
      }
    }
    // While a run exists the clip sits just below the tube, whatever L; the hanger hangs free.
    for (const [L, status] of [
      [0.2, 'running'],
      [0.4, 'stopped'],
      [0.3, 'completed'],
    ] as const) {
      const p = inputs({ length: L });
      rig.pose(pose(status, p, sampleAt(p, status === 'completed' ? 12 : 0.5)), 1 / 60);
      expect(named('clip').position.y).toBe(CLIP_RUNNING);
      expect(named('hanger').position.y).toBeCloseTo(CLIP_RUNNING - BELOW_CLIP, 12);
      expect(CLIP_RUNNING - BELOW_CLIP - HANGER.length).toBeGreaterThan(0.03); // clear of the base
    }
    // Completed: frozen where the run ended, at the start mark after N turns.
    const p = inputs();
    const end = sampleAt(p, 12);
    expect(end.turnsCounted).toBe(10);
    rig.pose(pose('completed', p, end), 1 / 60);
    expect(bung.position.x).toBeCloseTo(end.radius!, 9);
    expect(Math.abs(bung.position.z)).toBeLessThan(1e-9);
    // Another model's pose (no length): no clip; the hanger stands on the base.
    rig.pose(pose('running', {}, { v: 0.5, i: 0.5 }), 1 / 60);
    expect(named('clip').visible).toBe(false);
    expect(named('hanger').position.y).toBe(STANDING_HOOK);
    expect(instanced('string').count).toBe(1);
  });

  it('stacks (M − 0.05)/0.05 slotted discs on the hanger’s plate', () => {
    const { rig, named, instanced } = build();
    const discs = instanced('discs');
    const m = new THREE.Matrix4();
    const at = (i: number) => (
      discs.getMatrixAt(i, m),
      new THREE.Vector3().setFromMatrixPosition(m)
    );
    for (const [M, n] of [
      [0.1, 1],
      [0.2, 3],
      [0.3, 5],
      [0.4, 7],
    ] as const) {
      rig.pose(pose('configured', inputs({ hangingMass: M })), 1 / 60);
      expect(discs.count).toBe(n);
      const plateTop = named('hanger').position.y - HANGER.length + HANGER.plateH;
      for (let i = 0; i < n; i++) {
        expect(at(i).y).toBeCloseTo(plateTop + DISC.h / 2 + i * DISC.h, 6);
        expect(at(i).x).toBeCloseTo(HANGER.hook, 6); // on the rod, beside the hook
      }
    }
    expect(DISC.max * DISC.mass + HANGER.mass).toBeCloseTo(0.4, 12); // the dial's most
    rig.pose(pose('configured', inputs({ hangingMass: 0.05 })), 1 / 60); // the hanger alone
    expect(discs.count).toBe(0);
  });

  it('shows the stopwatch at zero in d’s places without a run, then t to d and the turns counted', () => {
    const { rig, reads } = build();
    for (const [d, zero] of [
      [0.01, ' 0 0.00'],
      [0.1, ' 0  0.0'],
      [0.2, ' 0  0.0'],
    ] as const) {
      rig.pose(pose('configured', inputs({ stopwatchResolution: d })), 1 / 60);
      expect(reads()).toBe(zero);
    }
    for (const d of [0.01, 0.1, 0.2]) {
      const p = inputs({ stopwatchResolution: d });
      const point = decimals(d);
      for (const seconds of [0.004, 0.5, 1.234, 3.07, 4.9]) {
        const s = sampleAt(p, seconds);
        rig.pose(pose('running', p, s), 1 / 60);
        const text = reads();
        expect(Number(text.slice(0, 2))).toBe(s.turnsCounted);
        expect(text.slice(2).trim()).toBe(quantize(s.stopwatch!, d).toFixed(point));
      }
      // Completed: exactly the instrument's reading of t_N, 10 turns counted.
      const end = sampleAt(p, 12);
      rig.pose(pose('completed', p, end), 1 / 60);
      expect(reads()).toBe(`10${quantize(end.stopwatch!, d).toFixed(point).padStart(5)}`);
      expect(end.stopwatch).toBeCloseTo(10 * circularModel.predict!(p).period!, 9);
    }
    // No d (another model's pose): the time is blank; too long for its places: dashes.
    rig.pose(pose('running', {}, { v: 0.5 }), 1 / 60);
    expect(reads().slice(2)).toBe('    ');
    rig.pose(
      pose('running', inputs({ stopwatchResolution: 0.001 }), {
        ...none,
        x: 0.1,
        z: 0,
        drop: 0.01,
        stopwatch: 11,
        turnsCounted: 7,
      }),
      1 / 60,
    );
    expect(reads()).toBe(' 7----');
  });

  it('poses by assignment: the same objects, and buffers rewritten only when they change', () => {
    const { rig, root, instanced } = build();
    const snapshot = () => {
      const objects: unknown[] = [];
      root.traverse((o) => {
        objects.push(o);
        if (o instanceof THREE.Mesh) {
          const g = o.geometry as THREE.BufferGeometry;
          objects.push(o.material, g, g.getAttribute('position').array);
          if (o instanceof THREE.InstancedMesh) objects.push(o.instanceMatrix.array);
        }
      });
      return objects;
    };
    const p = inputs();
    rig.pose(pose('configured', p), 1 / 60);
    const before = snapshot();
    for (let i = 0; i <= 120; i++) {
      const dials = [inputs(), STEEP, WIDE][i % 3]!;
      rig.pose(pose(i % 4 ? 'running' : 'completed', dials, sampleAt(dials, i / 50)), 1 / 60);
    }
    rig.pose(pose('configured', p), 1 / 60);
    const after = snapshot();
    expect(after.length).toBe(before.length);
    after.forEach((o, i) => expect(o).toBe(before[i]));
    const versions = () =>
      ['stopwatch-digits', 'discs', 'string'].map((n) => instanced(n).instanceMatrix.version);
    const s = sampleAt(p, 1);
    rig.pose(pose('stopped', p, s), 1 / 60);
    const once = versions();
    rig.pose(pose('stopped', p, s), 1 / 60);
    const [digits, discs] = versions();
    expect([digits, discs]).toEqual(once.slice(0, 2)); // the string moves while a run exists
    rig.pose(pose('configured', p), 1 / 60);
    const parked = versions();
    rig.pose(pose('configured', p), 1 / 60);
    expect(versions()).toEqual(parked);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const p = inputs();
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, p, status === 'running' ? sampleAt(p, 1) : none), 1 / 60);
    }
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
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
});
