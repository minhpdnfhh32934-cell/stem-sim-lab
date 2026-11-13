import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { thinLensModel } from '../../../simulation/models/lens';
import { opticalBench } from './optical-bench';

// The optical bench against its item (as drafted for content: 1.2 × 0.3 × 0.16 m, the rig's
// origin at the scale's 0 mark on the rail), posed from samples of the real model: the lens rider
// at u and the screen at u + s₀ before a run, the screen at the run's s with the image on it at
// the model's lateral scale and blur (crisp where it is sharp, a large faint patch when the screen
// caught nothing), the lamp lit only while a run exists; all inside the item's box; posing only
// assigns; freeing everything.

const item = ItemDefinitionSchema.parse({
  id: 'optical-bench',
  displayName: 'Optical bench',
  category: 'equipment',
  physical: { massKg: 6 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'optical-bench', top: [-0.5, 0.05, 0] },
  visual: { shape: 'box', size: [1.2, 0.3, 0.16], color: '#5b6670', material: 'painted' },
});
const [W, H, D] = item.visual.size;
const ORIGIN = new THREE.Vector3(-0.5, 0.05 - H / 2, 0);

/** The definition draft's inputs (initial conditions) with the dials `over`. */
const inputs = (over: Record<string, number> = {}): Record<string, number> => ({
  objectHeight: 0.03,
  apertureDiameter: 0.04,
  screenStart: 0.05,
  benchLength: 1,
  screenSpeed: 0.1,
  focalLength: 0.1,
  objectDistance: 0.3,
  resolution: 0.001,
  ...over,
});

/** The model's sample `seconds` into a run (held once the search is over). */
function sampleAt(parameters: Record<string, number>, seconds: number) {
  const state = new Float64Array(thinLensModel.variables.length);
  thinLensModel.init(parameters, state);
  for (let i = Math.round(seconds / 0.02); i > 0; i--) thinLensModel.step(state, 0.02, parameters);
  return Object.fromEntries(thinLensModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const none = Object.fromEntries(thinLensModel.variables.map((v) => [v, NaN]));
const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Record<string, number> = none,
): BenchPose => ({ status, parameters, sample });

/** A 2D context that draws nothing: every method a no-op, every property settable. */
function stubCanvas() {
  const context = new Proxy<Record<string, unknown>>(
    {},
    {
      get: (target, key) => target[key as string] ?? (() => undefined),
      set: (target, key, value) => ((target[key as string] = value), true),
    },
  );
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
}
afterEach(() => vi.unstubAllGlobals());

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = opticalBench.frame(item, painted);
  const rig = opticalBench.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const uniforms = () => (named('image').material as THREE.ShaderMaterial).uniforms;
  const uniform = (name: string) => uniforms()[name]!.value as number;
  /** The screen's face, in the rig's frame (x from the 0 mark). */
  const screenAt = () => named('screen-rider').position.x;
  const lensAt = () => named('lens-rider').position.x;
  const lampOn = () => (named('object').material as THREE.Material).type === 'MeshBasicMaterial';
  return { frame, rig, root, painted, named, uniforms, uniform, screenAt, lensAt, lampOn };
}

const worldBox = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root, true);
};

describe('optical bench model', () => {
  it('draws the housing and feet as the entity’s mesh, the rest in a few meshes, in its box', () => {
    const { frame, rig, root, painted } = build();
    expect((root.children[0] as THREE.Mesh).geometry).toBe(frame.body);
    frame.body.computeBoundingBox();
    const body = frame.body.boundingBox!;
    // The housing behind the 0 mark (item x −0.595 … −0.508) to the far foot's end, base to top.
    expect(body.min.x).toBeCloseTo(-0.595, 3);
    expect(body.max.x).toBeCloseTo(0.565, 3);
    expect(body.min.y).toBeCloseTo(-H / 2, 6);
    expect(body.max.y).toBeCloseTo(-0.1 + 0.2, 6);
    const names: string[] = [];
    frame.parts.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        names.push(o.name);
        expect(o.material).not.toBe(painted);
      }
    });
    expect(names.sort()).toEqual(['details', 'rail', 'scale']);
    expect(rig.group.position).toEqual(ORIGIN);
    for (const [f, u, status, seconds] of [
      [0.1, 0.08, 'configured', 0],
      [0.2, 0.6, 'running', 2],
      [0.1, 0.6, 'completed', 5], // the screen at the end of the bench, 1 m from the object
      [0.1, 0.08, 'completed', 10], // virtual: the screen at the end too
      [0.15, 0.3, 'completed', 10],
    ] as const) {
      const p = inputs({ focalLength: f, objectDistance: u });
      rig.pose(pose(status, p, seconds ? sampleAt(p, seconds) : none), 1 / 60);
      const box = worldBox(root);
      expect(box.min.x).toBeGreaterThanOrEqual(-W / 2);
      expect(box.max.x).toBeLessThanOrEqual(W / 2);
      expect(box.min.y).toBeGreaterThanOrEqual(-H / 2 - 1e-6); // float32 positions
      expect(box.max.y).toBeLessThanOrEqual(H / 2);
      expect(box.min.z).toBeGreaterThanOrEqual(-D / 2);
      expect(box.max.z).toBeLessThanOrEqual(D / 2);
    }
  });

  it('before a run: lamp off, the lens at u, the screen s₀ behind it, no image, the lens’s sag from f', () => {
    const { rig, named, lensAt, screenAt, lampOn } = build();
    for (const status of ['idle', 'configured'] as const) {
      for (const [f, u] of [
        [0.1, 0.3],
        [0.15, 0.08],
        [0.2, 0.6],
      ] as const) {
        rig.pose(pose(status, inputs({ focalLength: f, objectDistance: u })), 1 / 60);
        expect(lampOn()).toBe(false);
        expect(lensAt()).toBeCloseTo(u, 12);
        expect(screenAt()).toBeCloseTo(u + 0.05, 12);
        expect(named('image').visible).toBe(false);
        // Each face of the 40 mm lens: sag A²/(8.4·f), 1.9 mm for f = 0.10 m.
        for (const face of ['lens-front', 'lens-back']) {
          expect(named(face).visible).toBe(true);
          expect(named(face).scale.y).toBeCloseTo(0.0016 / (8.4 * f), 12);
        }
      }
    }
    // The faces are mirror images: one cap along +x, the other along −x.
    const along = (name: string) =>
      new THREE.Vector3(0, 1, 0).applyQuaternion(named(name).quaternion).x;
    expect(along('lens-front')).toBeCloseTo(1, 12);
    expect(along('lens-back')).toBeCloseTo(-1, 12);
    // The screen's face is at the rider's origin, facing the lens.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(named('screen').quaternion);
    expect(normal.x).toBeCloseTo(-1, 12);
    expect(named('screen').position.x).toBeLessThan(0);
    expect(named('screen').position.x).toBeGreaterThan(-0.001);
  });

  it('during a run: the screen at s, the image inverted at −s/u, soft over the model’s blur', () => {
    const { rig, named, uniform, screenAt, lensAt, lampOn } = build();
    const p = inputs({ focalLength: 0.1, objectDistance: 0.3 }); // v = 0.15 m
    for (const seconds of [0.3, 0.6, 0.9]) {
      const s = sampleAt(p, seconds);
      rig.pose(pose('running', p, s), 1 / 60);
      expect(s.screenDistance).toBeCloseTo(0.05 + 0.1 * seconds, 9);
      expect(lampOn()).toBe(true);
      expect(lensAt()).toBe(0.3);
      expect(screenAt()).toBeCloseTo(0.3 + s.screenDistance!, 12);
      expect(named('image').visible).toBe(true);
      expect(uniform('uM')).toBeCloseTo(-s.screenDistance! / 0.3, 12); // = screenImageHeight / h
      expect(uniform('uM')).toBeCloseTo(s.screenImageHeight! / 0.03, 12);
      expect(uniform('uBlur')).toBe(s.blur);
      expect(uniform('uBlur')).toBeCloseTo(0.04 * Math.abs(1 - s.screenDistance! / 0.15), 12);
      expect(uniform('uHeight')).toBe(0.03);
      // Brighter than the object while the image is smaller: full; (h/h′)² once larger.
      const k = s.screenDistance! / 0.3;
      expect(uniform('uGlow')).toBeCloseTo(Math.min(1, Math.max(0.2, 1 / k ** 2)), 12);
    }
    // STOP holds the screen where it is, the lamp on.
    const held = sampleAt(p, 0.6);
    rig.pose(pose('stopped', p, held), 1 / 60);
    expect(screenAt()).toBeCloseTo(0.3 + held.screenDistance!, 12);
    expect(lampOn()).toBe(true);
    // RESET: the screen back at s₀, the lamp off, no image.
    rig.pose(pose('configured', p), 1 / 60);
    expect(screenAt()).toBeCloseTo(0.35, 12);
    expect(lampOn()).toBe(false);
    expect(named('image').visible).toBe(false);
  });

  it('a sharp image: the screen stops at v with no blur; an uncaught one: a large faint patch at the end', () => {
    const { rig, named, uniform, screenAt } = build();
    const real = inputs({ focalLength: 0.1, objectDistance: 0.3 });
    const done = sampleAt(real, 5);
    expect(done.sharp).toBe(1);
    rig.pose(pose('completed', real, done), 1 / 60);
    expect(screenAt()).toBeCloseTo(0.45, 12); // u + v
    expect(uniform('uBlur')).toBe(0);
    expect(uniform('uM')).toBeCloseTo(-0.5, 12); // k = −v/u
    expect(uniform('uGlow')).toBe(1);
    // u < f: virtual, the screen goes to the end of the bench with a 13.2 cm blur disc.
    const virtual = inputs({ focalLength: 0.1, objectDistance: 0.08 });
    const end = sampleAt(virtual, 10);
    expect(end.sharp).toBe(0);
    expect(end.screenDistance).toBeCloseTo(0.92, 12);
    rig.pose(pose('completed', virtual, end), 1 / 60);
    expect(screenAt()).toBeCloseTo(1, 12);
    expect(named('image').visible).toBe(true);
    expect(uniform('uBlur')).toBeCloseTo(0.04 * (1 + 0.92 / 0.4), 12);
    expect(uniform('uM')).toBeCloseTo(-0.92 / 0.08, 12);
    expect(uniform('uGlow')).toBe(0.2); // the floor: 1/11.5² would be invisible
    // Beyond the bench (f 0.20, u 0.25: v = 1 m): the screen at 0.75 m behind the lens, 1 cm blur.
    const far = inputs({ focalLength: 0.2, objectDistance: 0.25 });
    const stopped = sampleAt(far, 10);
    rig.pose(pose('completed', far, stopped), 1 / 60);
    expect(screenAt()).toBeCloseTo(1, 12);
    expect(uniform('uBlur')).toBeCloseTo(0.01, 12);
  });

  it('reads only variables the model outputs, and shows nothing it lacks', () => {
    for (const v of opticalBench.reads ?? []) expect(thinLensModel.variables).toContain(v);
    const { rig, named, lensAt, screenAt } = build();
    rig.pose(
      pose('running', { focalLength: 0.1, objectDistance: 0.3 }, { v: 1, level: 1 }),
      1 / 60,
    );
    expect(named('image').visible).toBe(false);
    expect(lensAt()).toBe(0.3);
    expect(screenAt()).toBeCloseTo(0.35, 12); // s₀, since no screen position is known
    // Without u (no dials) the riders are not placed; without f the lens has no faces.
    rig.pose(pose('running', {}, { screenDistance: 1, blur: 1, screenImageHeight: 1 }), 1 / 60);
    expect(named('lens-rider').visible).toBe(false);
    expect(named('screen-rider').visible).toBe(false);
    expect(named('lens-front').visible).toBe(false);
  });

  it('poses by assignment: the same objects, materials and uniforms throughout', () => {
    const { rig, root, uniforms } = build();
    const count = () => {
      let n = 0;
      const materials = new Set<unknown>();
      const geometries = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (!(o instanceof THREE.Mesh)) return;
        materials.add(o.material);
        geometries.add(o.geometry);
      });
      return { n, materials: materials.size, geometries: geometries.size };
    };
    const p = inputs();
    rig.pose(pose('configured', p), 1 / 60);
    const before = count();
    const u = uniforms();
    for (let i = 0; i <= 60; i++) {
      rig.pose(pose(i % 3 ? 'running' : 'completed', p, sampleAt(p, i / 20)), 1 / 60);
    }
    rig.pose(pose('configured', p), 1 / 60);
    // The lamp's two looks are the only materials swapped; both exist from the start.
    expect(count()).toEqual(before);
    expect(uniforms()).toBe(u);
  });

  it('frees every geometry, material and texture it made, never the entity material', () => {
    stubCanvas();
    const { frame, rig, root, painted } = build();
    const p = inputs();
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, p, status === 'idle' ? none : sampleAt(p, 0.5)), 1 / 60);
    }
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      made.add(o.geometry as THREE.BufferGeometry);
      const material = o.material as THREE.MeshStandardMaterial;
      made.add(material);
      if (material.map) made.add(material.map);
    });
    made.delete(painted);
    expect([...made].some((m) => m instanceof THREE.Texture)).toBe(true);
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
