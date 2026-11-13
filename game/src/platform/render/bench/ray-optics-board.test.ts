import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bundledContent } from '../../../content';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { refractionModel } from '../../../simulation/models/refraction';
import { DISC_TOP, rayOpticsBoard } from './ray-optics-board';

// Counts every math object made through 'three' (the board's modules included), so a `new` in
// `pose` shows. three's own internals keep their classes; they are not the board's code.
const made = vi.hoisted(() => ({ n: 0 }));
vi.mock('three', async (load) => {
  const three = await load<typeof THREE>();
  const counted = <T extends object>(Base: T) =>
    new Proxy(Base, {
      construct(target, args, newTarget) {
        made.n++;
        return Reflect.construct(target as never, args, newTarget) as object;
      },
    });
  return {
    ...three,
    Vector2: counted(three.Vector2),
    Vector3: counted(three.Vector3),
    Quaternion: counted(three.Quaternion),
    Euler: counted(three.Euler),
    Matrix4: counted(three.Matrix4),
    Color: counted(three.Color),
  };
});

// The ray-optics board against its shipped item: the board is the item's box floor, the rig
// stands on the disc at bench.top, and everything stays in the box at every angle either way
// round. Posed from real runs of the refraction model: the ray box at the incidence, the
// reflected ray mirrored in the normal, the refracted ray at the model's angle on the far side and
// gone under total internal reflection; no rays without a run. Posing only assigns; freeing
// includes the disc's texture. (Freeing the rest in every state: registry.test.ts.)

const item = ItemDefinitionSchema.parse(
  (bundledContent.items as { id: string }[]).find((i) => i.id === 'ray-optics-board'),
);
const [w, h, d] = item.visual.size;
const DEG = Math.PI / 180;
const NONE = Object.fromEntries(refractionModel.variables.map((v) => [v, NaN]));

/** The model's sample (every variable by name) at the end of a run: index n, direction, angle. */
function runTo(index: number, direction: number, angle: number): Record<string, number> {
  const inputs = { index, direction, angle, sweepRate: 10 };
  const state = new Float64Array(refractionModel.variables.length);
  refractionModel.init(inputs, state);
  for (let k = 0; k < 10_000 && !refractionModel.isComplete!(state, inputs); k++)
    refractionModel.step(state, 0.01, inputs);
  return Object.fromEntries(refractionModel.variables.map((v, k) => [v, state[k]!]));
}

const params = (index: number, direction: number, angle: number) => ({
  index,
  direction,
  angle,
  resolution: 1,
  sweepRate: 10,
});
const pose = (
  status: BenchPose['status'],
  p: Record<string, number>,
  sample: Record<string, number>,
): BenchPose => ({ status, parameters: p, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = rayOpticsBoard.frame(item, painted);
  const rig = rayOpticsBoard.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, root, painted, named };
}

/** The direction a ray (or the ray box) points along, in the item's x–z plane. */
const along = (o: THREE.Object3D) => {
  const v = new THREE.Vector3(1, 0, 0).applyQuaternion(o.quaternion);
  return [v.x, v.z] as const;
};
const opacity = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).opacity;

afterEach(() => vi.unstubAllGlobals());

describe('ray-optics board', () => {
  it('reads only variables the refraction model outputs', () => {
    for (const v of rayOpticsBoard.reads!) expect(refractionModel.variables).toContain(v);
    // The experiment the board is shipped for runs this model.
    const refraction = (bundledContent.experiments as { id: string; model: string }[]).find(
      (e) => e.id === 'refraction',
    );
    expect(refraction?.model).toBe(refractionModel.id);
  });

  it('stands on the item’s base, the rig on the disc at bench.top, all inside the box', () => {
    const { frame, rig, root } = build();
    frame.body.computeBoundingBox();
    expect(frame.body.boundingBox!.min.y).toBeGreaterThanOrEqual(-h / 2);
    expect(rig.group.position.toArray()).toEqual([0, DISC_TOP - h / 2, 0]);
    expect(item.bench!.top[1]).toBeCloseTo(DISC_TOP, 12);
    const box = new THREE.Box3();
    for (const direction of [0, 1])
      for (let a = 0; a <= 85; a += 5) {
        rig.pose(pose('completed', params(1.62, direction, a), runTo(1.62, direction, a)), 1 / 60);
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

  it('rests on the normal (0°, where a run starts), lamp off and no rays, before a run', () => {
    const { rig, named } = build();
    rig.pose(pose('configured', params(1.33, 0, 40), NONE), 1 / 60);
    const [bx, bz] = along(named('ray-box'));
    expect(bx).toBeCloseTo(-1, 9); // entering: on the −x side, not at the set 40°
    expect(bz).toBeCloseTo(0, 9);
    for (const ray of ['incident', 'reflected', 'refracted'])
      expect(named(ray).visible).toBe(false);
    rig.pose(pose('configured', params(1.33, 1, 40), NONE), 1 / 60);
    expect(along(named('ray-box'))[0]).toBeCloseTo(1, 9); // leaving: on the +x side
    // RUN's first sample (the model's init) leaves the ray box where it rests.
    const inputs = { index: 1.33, direction: 1, angle: 40, sweepRate: 10 };
    const state = new Float64Array(refractionModel.variables.length);
    refractionModel.init(inputs, state);
    const first = Object.fromEntries(refractionModel.variables.map((v, k) => [v, state[k]!]));
    rig.pose(pose('running', params(1.33, 1, 40), first), 1 / 60);
    expect(along(named('ray-box'))[0]).toBeCloseTo(1, 9);
  });

  it('keeps the block colourless: only its opacity follows n', () => {
    const { rig, named } = build();
    const glass = named('block').material as THREE.MeshStandardMaterial;
    rig.pose(pose('configured', params(1.33, 0, 40), NONE), 1 / 60);
    const colour = glass.color.getHex();
    const water = glass.opacity;
    rig.pose(pose('configured', params(1.62, 0, 40), NONE), 1 / 60);
    expect(glass.color.getHex()).toBe(colour);
    expect(glass.opacity).toBeGreaterThan(water);
    expect(glass.transparent && !glass.depthWrite).toBe(true);
  });

  it('stands the ray box on the board beyond the disc’s edge, not in the air', () => {
    const { frame, root, named } = build();
    root.updateMatrixWorld(true);
    frame.body.computeBoundingBox();
    const housing = new THREE.Box3().setFromObject(named('housing'), true);
    expect(housing.min.y).toBeCloseTo(frame.body.boundingBox!.max.y, 6);
  });

  it('draws a run entering the block: incident, reflected (R) and refracted (Snell) rays', () => {
    const { rig, named } = build();
    const slit = named('slit');
    const off = slit.material;
    const sample = runTo(1.49, 0, 50);
    rig.pose(pose('running', params(1.49, 0, 50), sample), 1 / 60);
    expect(slit.material).not.toBe(off);
    const i = sample.incidence!;
    const r = sample.refraction!;
    expect(Math.sin(i)).toBeCloseTo(1.49 * Math.sin(r), 12);
    const [ix, iz] = along(named('incident'));
    expect([ix, iz].map((c) => +c.toFixed(9))).toEqual(
      [-Math.cos(i), Math.sin(i)].map((c) => +c.toFixed(9)),
    );
    const [fx, fz] = along(named('reflected'));
    expect(fx).toBeCloseTo(-Math.cos(i), 9); // mirrored in the normal, same side
    expect(fz).toBeCloseTo(-Math.sin(i), 9);
    const [tx, tz] = along(named('refracted'));
    expect(tx).toBeCloseTo(Math.cos(r), 9); // across the face, into the block
    expect(tz).toBeCloseTo(-Math.sin(r), 9);
    expect(opacity(named('reflected'))).toBeCloseTo(0.9 * Math.sqrt(sample.reflectance!), 12);
    expect(opacity(named('refracted'))).toBeCloseTo(0.9 * Math.sqrt(1 - sample.reflectance!), 12);
    expect(named('refracted').visible).toBe(true);
  });

  it('turns the ray box to the curved side leaving the block, and hides the refracted ray past C', () => {
    const { rig, named } = build();
    const below = runTo(1.49, 1, 30); // C = 42.2° for acrylic
    rig.pose(pose('completed', params(1.49, 1, 30), below), 1 / 60);
    const [bx] = along(named('ray-box'));
    expect(bx).toBeCloseTo(Math.cos(30 * DEG), 9); // on the +x, curved side
    const [tx, tz] = along(named('refracted'));
    expect(tx).toBeCloseTo(-Math.cos(below.refraction!), 9); // out into the air on −x
    expect(tz).toBeCloseTo(-Math.sin(below.refraction!), 9);
    expect(below.refraction!).toBeGreaterThan(30 * DEG); // bent away from the normal

    const past = runTo(1.49, 1, 60);
    expect(past.tir).toBe(1);
    rig.pose(pose('completed', params(1.49, 1, 60), past), 1 / 60);
    expect(named('refracted').visible).toBe(false); // the held last value is never drawn
    expect(named('reflected').visible).toBe(true);
    expect(opacity(named('reflected'))).toBeCloseTo(0.9, 12);

    rig.pose(pose('configured', params(1.49, 1, 60), NONE), 1 / 60); // RESET
    expect(named('incident').visible).toBe(false);
    expect(named('reflected').visible).toBe(false);
  });

  it('poses by assignment: the same objects, materials and geometries, however often', () => {
    const { rig, root } = build();
    const count = () => {
      const meshes = new Set<unknown>();
      const parts = new Set<unknown>();
      let n = 0;
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) {
          meshes.add(o.geometry);
          parts.add(o.material);
        }
      });
      return { n, geometries: meshes.size, materials: parts.size };
    };
    const runs = [runTo(1.33, 0, 20), runTo(1.62, 1, 70), NONE];
    rig.pose(pose('running', params(1.33, 0, 20), runs[0]!), 1 / 60);
    const before = count();
    const glass = (root.getObjectByName('block') as THREE.Mesh).material as THREE.Material;
    const poses = Array.from({ length: 90 }, (_, k) =>
      pose(k % 2 ? 'running' : 'stopped', params(1.33 + k / 300, k % 2, k), runs[k % 3]!),
    );
    const madeBefore = made.n;
    expect(madeBefore).toBeGreaterThan(0); // the counter sees the board's own `new`s
    for (const p of poses) rig.pose(p, 0);
    rig.pose(pose('running', params(1.33, 0, 20), runs[0]!), 1 / 60);
    expect(made.n).toBe(madeBefore); // no Vector2/3, Quaternion, Euler, Matrix4 or Color made
    expect(count()).toEqual(before);
    expect((root.getObjectByName('block') as THREE.Mesh).material).toBe(glass);
  });

  it('keeps its draws modest: five frame meshes with the board, seven in the rig', () => {
    const { frame, rig } = build();
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((m) => (n += m instanceof THREE.Mesh ? 1 : 0));
      return n;
    };
    expect(1 + meshes(frame.parts)).toBe(5);
    expect(meshes(rig.group)).toBe(7);
  });

  it('frees every geometry, material and the disc’s texture, never the entity material', () => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
    const { frame, rig, root, painted, named } = build();
    const texture = (named('disc').material as THREE.MeshStandardMaterial).map!;
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>([texture]);
    // Posed lit and dark, so both slit materials have been on a mesh.
    for (const sample of [runTo(1.49, 0, 30), NONE]) {
      rig.pose(pose('running', params(1.49, 0, 30), sample), 1 / 60);
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          made.add(o.geometry as THREE.BufferGeometry);
          made.add(o.material as THREE.Material);
        }
      });
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
