import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { collisionModel } from '../../../simulation/models/collision';
import { airTrack, bumperKind, discsFor, LAYOUT, SEGMENTS } from './air-track';

// The air track against its item (as drafted for content: 1.8 × 0.3 × 0.3 m, the launcher face at
// bench.top), posed from samples of the real model: the gliders at the model's positions (at their
// starts without a run), the discs from the masses, the bumpers from e, the gates where the
// layout puts them with an LED lit while a card is in the beam, the timer's windows reading each
// gate time to d; all inside the item's box; posing only assigns; freeing everything.

const item = ItemDefinitionSchema.parse({
  id: 'air-track',
  displayName: 'Air track with two gliders',
  category: 'equipment',
  physical: { massKg: 8 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'air-track', top: [-0.75, 0.12, 0] },
  visual: { shape: 'box', size: [1.8, 0.3, 0.3], color: '#59636e', material: 'painted' },
});
const [W, H, D] = item.visual.size;

/** The drafted definition's inputs (dial defaults and initial conditions), with `over` dialled. */
const inputs = (over: Record<string, number> = {}): Record<string, number> => ({
  ...LAYOUT,
  speed: 0.3,
  ...over,
});

/** The model's sample `seconds` into a run (held once the run is over). */
function sampleAt(parameters: Record<string, number>, seconds: number) {
  const state = new Float64Array(collisionModel.variables.length);
  collisionModel.init(parameters, state);
  for (let t = 0; t < seconds - 1e-9; t += 0.001) collisionModel.step(state, 0.001, parameters);
  return Object.fromEntries(collisionModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const none = Object.fromEntries(collisionModel.variables.map((v) => [v, NaN]));
const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Record<string, number> = none,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = airTrack.frame(item, painted);
  const rig = airTrack.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const instanced = (name: string) => root.getObjectByName(name) as THREE.InstancedMesh;
  const m = new THREE.Matrix4();
  /** Instance `i`'s x, in the track frame. */
  const xOf = (name: string, i: number) => {
    instanced(name).getMatrixAt(i, m);
    return new THREE.Vector3().setFromMatrixPosition(m).x;
  };
  /** What the timer's window `w` shows, e.g. "0.250" (blank places as spaces). */
  const reads = (w: number) => {
    const mesh = instanced('timer-digits');
    const lit = (slot: number) => (mesh.getMatrixAt(slot, m), m.determinant() !== 0);
    let text = '';
    for (let place = w * 5; place < w * 5 + 5; place++) {
      let bits = 0;
      for (let k = 0; k < 7; k++) if (lit(place * 8 + k)) bits |= 1 << k;
      const digit = SEGMENTS.indexOf(bits as (typeof SEGMENTS)[number]);
      text += digit >= 0 ? String(digit) : bits === 0x40 ? '-' : bits === 0 ? ' ' : '?';
      if (lit(place * 8 + 7)) text += '.';
    }
    return text.trim();
  };
  const led = (i: number) => {
    const c = new THREE.Color();
    instanced('leds').getColorAt(i, c);
    return c.r > 0.5;
  };
  const bounds = () => {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root, true);
  };
  return { frame, rig, root, painted, named, instanced, xOf, reads, led, bounds };
}

describe('air track bench model', () => {
  it('reads only variables the collision model outputs, from the drafted layout', () => {
    for (const v of airTrack.reads ?? []) expect(collisionModel.variables).toContain(v);
    // The fallbacks are the definition's defaults and initial conditions (collisions.json).
    expect(LAYOUT).toEqual({
      massA: 0.3,
      restitution: 1,
      timerResolution: 0.001,
      massB: 0.3,
      flagLength: 0.1,
      gliderLength: 0.2,
      startA: 0.15,
      startB: 0.8,
      gate1: 0.35,
      gate2: 1,
      trackLength: 1.5,
    });
  });

  it('draws the beam as the entity’s mesh, the rest in a few meshes, inside the item’s box', () => {
    const { frame, rig, root, painted, bounds } = build();
    expect((root.children[0] as THREE.Mesh).geometry).toBe(frame.body);
    frame.body.computeBoundingBox();
    const beam = frame.body.boundingBox!.getSize(new THREE.Vector3());
    expect(beam.x).toBeCloseTo(1.66, 6); // under the launcher to under the buffer
    expect(beam.y).toBeCloseTo(0.09, 6);
    const names = (o: THREE.Object3D) => {
      const found: string[] = [];
      o.traverse((c) => {
        if (c instanceof THREE.Mesh) found.push(c.name);
      });
      return found.sort();
    };
    expect(names(frame.parts)).toEqual(['metal', 'panels', 'plastic', 'ruler', 'timer']);
    expect(names(rig.group)).toEqual([
      'bumper-a',
      'bumper-b',
      'discs',
      'gates',
      'gliders',
      'leds',
      'timer-digits',
    ]);
    let paintedUsed = false;
    frame.parts.traverse((o) => (paintedUsed ||= (o as THREE.Mesh).material === painted));
    expect(paintedUsed).toBe(false);
    for (const [massA, e, status, seconds] of [
      [0.3, 1, 'configured', 0],
      [0.5, 0, 'running', 1],
      [0.5, 0, 'completed', 20],
      [0.2, 1, 'completed', 20], // A bounced back towards the launcher
      [0.2, 0.5, 'running', 2.5],
    ] as const) {
      const p = inputs({ massA, restitution: e });
      rig.pose(pose(status, p, seconds ? sampleAt(p, seconds) : none), 1 / 60);
      const box = bounds();
      expect(box.min.x).toBeGreaterThanOrEqual(-W / 2);
      expect(box.max.x).toBeLessThanOrEqual(W / 2);
      expect(box.min.y).toBeGreaterThanOrEqual(-H / 2 - 1e-9);
      expect(box.max.y).toBeLessThanOrEqual(H / 2);
      expect(box.min.z).toBeGreaterThanOrEqual(-D / 2);
      expect(box.max.z).toBeLessThanOrEqual(D / 2);
    }
    // The track frame: the launcher face at bench.top's x, on the item's base; the apex at its y.
    expect(rig.group.position.toArray()).toEqual([-0.75, -H / 2, 0]);
    expect(frame.parts.position.toArray()).toEqual([-0.75, -H / 2, 0]);
    expect(frame.body.boundingBox!.max.y).toBeCloseTo(0.12 - H / 2, 6);
  });

  it('without a run: the gliders at their starts, discs by mass, bumpers by e, 0.000 twice', () => {
    const { rig, named, instanced, xOf, reads, led } = build();
    rig.pose(pose('configured', inputs()), 1 / 60);
    expect(xOf('gliders', 0)).toBeCloseTo(0.15, 6); // float32 matrices
    expect(xOf('gliders', 1)).toBeCloseTo(0.8, 6); // float32 matrices
    // 0.3 kg each: two 50 g discs on each peg, one a side.
    expect(instanced('discs').count).toBe(4);
    expect(discsFor(0.2)).toBe(0);
    expect(discsFor(0.5)).toBe(6);
    expect(discsFor(NaN)).toBe(0);
    const m = new THREE.Matrix4();
    const disc = (i: number) => (instanced('discs').getMatrixAt(i, m), m.elements.slice(12, 15));
    expect(disc(0)[0]).toBeCloseTo(0.15, 6);
    expect(disc(1)[0]).toBeCloseTo(0.15, 6);
    expect(disc(0)[2]).toBeCloseTo(-disc(1)[2]!, 12);
    expect(disc(2)[0]).toBeCloseTo(0.8, 6);
    // e = 1: bright loops; 0.9: blued loops; 0.5: pads; 0: Velcro, each its own geometry.
    expect(bumperKind(1)).toBe('elastic');
    expect(bumperKind(0.9)).toBe('spring');
    expect(bumperKind(0.5)).toBe('pad');
    expect(bumperKind(0)).toBe('velcro');
    expect(bumperKind(0.7)).toBe('spring');
    expect(bumperKind(0.95)).toBe('elastic');
    const looks = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const e of [1, 0.9, 0.5, 0]) {
      rig.pose(pose('configured', inputs({ restitution: e })), 1 / 60);
      looks.add(named('bumper-a').geometry);
      materials.add(named('bumper-a').material as THREE.Material);
      expect(named('bumper-b').geometry).toBe(named('bumper-a').geometry);
    }
    expect(looks.size).toBe(4);
    expect(materials.size).toBe(2); // steel loops, rubber pads
    // A's front bumper and B's back bumper face each other, 0.02 m out of each glider's end.
    expect(named('bumper-a').position.x).toBeCloseTo(0.15 + 0.1 - 0.02, 12);
    expect(named('bumper-b').position.x).toBeCloseTo(0.8 - 0.1 + 0.02, 12);
    expect(named('bumper-b').rotation.y).toBe(Math.PI);
    expect(xOf('gates', 0)).toBeCloseTo(0.35, 6);
    expect(xOf('gates', 1)).toBeCloseTo(1, 6);
    expect(led(0)).toBe(false);
    expect(led(1)).toBe(false);
    expect(reads(0)).toBe('0.000');
    expect(reads(1)).toBe('0.000');
    rig.pose(pose('configured', inputs({ timerResolution: 0.01 })), 1 / 60);
    expect(reads(0)).toBe('0.00');
    rig.pose(pose('configured', inputs({ timerResolution: 0.0001 })), 1 / 60);
    expect(reads(1)).toBe('0.0000');
  });

  it('during a run: the gliders where the model has them, the LED lit while a card is in the beam', () => {
    const { rig, xOf, led, named } = build();
    const p = inputs({ massA: 0.2, speed: 0.4, restitution: 0.5 }); // the hand-worked case
    // A's card (0.1 m on its centre) enters gate 1's beam at x 0.30 and leaves it at 0.40.
    for (const [t, lit] of [
      [0.3, false],
      [0.4, true],
      [0.6, true],
      [0.7, false],
    ] as const) {
      const s = sampleAt(p, t);
      rig.pose(pose('running', p, s), 1 / 60);
      expect(xOf('gliders', 0)).toBeCloseTo(s.positionA!, 6); // float32 matrices
      expect(xOf('gliders', 1)).toBeCloseTo(s.positionB!, 6); // float32 matrices
      expect(Math.abs(s.positionA! - 0.35) < 0.05).toBe(lit);
      expect(led(0)).toBe(lit);
      expect(led(1)).toBe(false);
    }
    // After the impact (1.125 s) B moves on at 0.24 m/s: its card is in gate 2's beam 1.75–2.17 s.
    const after = sampleAt(p, 2);
    rig.pose(pose('running', p, after), 1 / 60);
    expect(after.collided).toBe(1);
    expect(xOf('gliders', 1)).toBeCloseTo(after.positionB!, 6); // float32 matrices
    expect(led(1)).toBe(true);
    expect(led(0)).toBe(false);
    // At the end B's front is at the buffer face; A is where the model left it, still moving.
    const end = sampleAt(p, 4);
    rig.pose(pose('completed', p, end), 1 / 60);
    expect(end.positionB).toBe(1.4);
    expect(xOf('gliders', 1)).toBeCloseTo(1.4, 6); // float32 matrices
    expect(xOf('gliders', 0)).toBeCloseTo(end.positionA!, 6); // float32 matrices
    expect(led(1)).toBe(false);
    // STOP holds the sample; RESET (NaN positions) puts the gliders back.
    rig.pose(pose('stopped', p, after), 1 / 60);
    expect(xOf('gliders', 0)).toBeCloseTo(after.positionA!, 6); // float32 matrices
    rig.pose(pose('configured', p), 1 / 60);
    expect(xOf('gliders', 0)).toBeCloseTo(0.15, 6); // float32 matrices
    expect(xOf('gliders', 1)).toBeCloseTo(0.8, 6); // float32 matrices
    expect(named('bumper-a').position.x).toBeCloseTo(0.23, 12);
  });

  it('with Velcro the stuck pair touch bumper to bumper, and both cards light gate 2 together', () => {
    const { rig, xOf, named, led } = build();
    const p = inputs({ massA: 0.3, speed: 0.5, restitution: 0 });
    const s = sampleAt(p, 3);
    expect(s.collided).toBe(1);
    rig.pose(pose('running', p, s), 1 / 60);
    expect(xOf('gliders', 1) - xOf('gliders', 0)).toBeCloseTo(0.2, 6); // centres ℓ apart
    const faceA = named('bumper-a').position.x + 0.02;
    const faceB = named('bumper-b').position.x - 0.02;
    expect(faceA).toBeCloseTo(faceB, 9);
    // The pair passes gate 2 (not timed by the model, but the beam is cut): the LED shows it.
    const passing = sampleAt(p, 1.8); // impact 0.9 s, then 0.25 m/s: in the beam 1.5–2.1 s
    rig.pose(pose('running', p, passing), 1 / 60);
    expect(Math.abs(passing.positionB! - 1) < 0.05 || Math.abs(passing.positionA! - 1) < 0.05).toBe(
      true,
    );
    expect(led(1)).toBe(true);
  });

  it('shows each gate time as the timer reads it: counting in the beam, then held, to d', () => {
    const { rig, reads } = build();
    for (const d of [0.001, 0.01, 0.0001]) {
      const p = inputs({ massA: 0.2, speed: 0.4, restitution: 0.5, timerResolution: d });
      const text = (t: number) => quantize(t, d).toFixed(String(d).length - 2);
      const during = sampleAt(p, 0.5); // A's card half-way through gate 1
      rig.pose(pose('running', p, during), 1 / 60);
      expect(during.gateTimeA).toBeGreaterThan(0);
      expect(during.gateTimeA).toBeLessThan(0.25);
      expect(reads(0)).toBe(text(during.gateTimeA!));
      expect(reads(1)).toBe(text(0));
      const end = sampleAt(p, 4);
      rig.pose(pose('completed', p, end), 1 / 60);
      expect(end.gateTimeA).toBeCloseTo(0.25, 9);
      expect(end.gateTimeB).toBeCloseTo(0.1 / 0.24, 9);
      expect(reads(0)).toBe(text(0.25));
      expect(reads(1)).toBe(text(0.1 / 0.24));
    }
    // The run's inputs set d, not the dial: 1 ms here, so 0.4167 s reads 0.417.
    const p = inputs({ massA: 0.2, speed: 0.4, restitution: 0.5, timerResolution: 0.001 });
    rig.pose(pose('completed', p, sampleAt(p, 4)), 1 / 60);
    expect(reads(1)).toBe('0.417');
    // Nothing it lacks: no d shows blank windows; a time too long for five places shows dashes.
    rig.pose(pose('running', {}, { v: 1 }), 1 / 60);
    expect(reads(0)).toBe('0.000'); // the definition's d, 0 until a card arrives
    rig.pose(pose('running', { timerResolution: NaN }, {}), 1 / 60);
    expect(reads(0)).toBe('');
    rig.pose(pose('running', { timerResolution: 0.0001 }, { gateTimeA: 12 }), 1 / 60);
    expect(reads(0)).toBe('-----');
  });

  it('poses by assignment: the same objects, and a readout is rewritten only when it changes', () => {
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
    const p = inputs({ massA: 0.5, restitution: 0.9 });
    rig.pose(pose('configured', p), 1 / 60);
    const before = snapshot();
    for (let i = 0; i <= 60; i++) {
      const e = [1, 0.9, 0.5, 0][i % 4]!;
      rig.pose(
        pose(i % 3 ? 'running' : 'completed', { ...p, restitution: e }, sampleAt(p, i / 10)),
        1 / 60,
      );
    }
    rig.pose(pose('configured', p), 1 / 60);
    const after = snapshot();
    expect(after.length).toBe(before.length);
    after.forEach((o, i) => expect(o).toBe(before[i]));
    const versions = () =>
      ['timer-digits', 'gliders', 'gates', 'discs'].map((n) => instanced(n).instanceMatrix.version);
    const s = sampleAt(p, 2);
    rig.pose(pose('running', p, s), 1 / 60);
    const once = versions();
    rig.pose(pose('running', p, s), 1 / 60);
    expect(versions()).toEqual(once);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const p = inputs();
    for (const [status, e] of [
      ['idle', 1],
      ['configured', 0.9],
      ['running', 0.5],
      ['stopped', 0],
      ['completed', 1],
    ] as const) {
      const q = { ...p, restitution: e };
      rig.pose(pose(status, q, status === 'running' ? sampleAt(q, 2) : none), 1 / 60);
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
