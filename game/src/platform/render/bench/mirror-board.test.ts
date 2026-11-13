import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { reflectionModel } from '../../../simulation/models/reflection';
import { DISC_TOP, mirrorBoard } from './mirror-board';

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

// The plane-mirror board against its item (the `mirror-board` apparatus, 0.38 × 0.08 × 0.38 m,
// the rig on the disc at bench.top): posed from real runs of the reflection model, the ray box at
// `rayBox` on the −x side, the mirror turned by the dialled α, the reflected ray at `reflected` on
// the +x side — checked against the law worked out here from the vectors — and the arcs' sweeps
// at `incidence` and `reflection`; no rays or arcs without a run; everything inside the box at
// every setting; posing only assigns; freeing includes the disc's texture.

const item = ItemDefinitionSchema.parse({
  id: 'mirror-board',
  displayName: 'Plane-mirror board',
  description: 'A plane mirror on a turntable at the centre of a protractor disc.',
  category: 'equipment',
  tags: ['apparatus', 'optics'],
  physical: { massKg: 1.5 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'mirror-board', top: [0, 0.021, 0] },
  visual: { shape: 'box', size: [0.38, 0.08, 0.38], color: '#3d5566', material: 'painted' },
});
const [w, h, d] = item.visual.size;
const DEG = Math.PI / 180;
const NONE = Object.fromEntries(reflectionModel.variables.map((v) => [v, NaN]));

/** The model's sample (every variable by name) at the end of a run: ray box θ, mirror α. */
function runTo(theta: number, alpha: number): Record<string, number> {
  const inputs = params(theta, alpha);
  const state = new Float64Array(reflectionModel.variables.length);
  reflectionModel.init(inputs, state);
  for (let k = 0; k < 10_000 && !reflectionModel.isComplete!(state, inputs); k++)
    reflectionModel.step(state, 0.01, inputs);
  return Object.fromEntries(reflectionModel.variables.map((v, k) => [v, state[k]!]));
}

const params = (rayAngle: number, mirrorTurn: number) => ({
  rayAngle,
  mirrorTurn,
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
  const frame = mirrorBoard.frame(item, painted);
  const rig = mirrorBoard.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  return { frame, rig, root, painted, named };
}

/** The direction a turning part points along (its local +z), in the item's x–z plane. */
const along = (o: THREE.Object3D) => {
  const v = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion);
  return [v.x, v.z] as const;
};
/** The angle an arc shows, in degrees, from its draw range (¼° steps). */
const sweepOf = (arc: THREE.Mesh) => arc.geometry.drawRange.count / 6 / 4;
const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((m) => (n += m instanceof THREE.Mesh ? 1 : 0));
  return n;
};

afterEach(() => vi.unstubAllGlobals());

describe('plane-mirror board', () => {
  it('reads only variables the reflection model outputs', () => {
    for (const v of mirrorBoard.reads!) expect(reflectionModel.variables).toContain(v);
  });

  it('stands on the item’s base, the rig on the disc at bench.top, all inside the box', () => {
    const { frame, rig, root } = build();
    frame.body.computeBoundingBox();
    expect(frame.body.boundingBox!.min.y).toBeGreaterThanOrEqual(-h / 2);
    expect(rig.group.position.toArray()).toEqual([0, DISC_TOP - h / 2, 0]);
    expect(item.bench!.top[1]).toBeCloseTo(DISC_TOP, 12);
    const box = new THREE.Box3();
    for (const alpha of [0, 15, 40])
      for (let theta = 0; theta + alpha < 90; theta += 5) {
        rig.pose(pose('completed', params(theta, alpha), runTo(theta, alpha)), 1 / 60);
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

  it('stands the ray box on the board beyond the disc’s edge, not in the air', () => {
    const { frame, root, named } = build();
    root.updateMatrixWorld(true);
    frame.body.computeBoundingBox();
    const housing = new THREE.Box3().setFromObject(named('housing'), true);
    expect(housing.min.y).toBeCloseTo(frame.body.boundingBox!.max.y, 6);
  });

  it('rests at the 0° mark, lamp off, no rays or arcs, the mirror at the dial’s α, before a run', () => {
    const { rig, named } = build();
    rig.pose(pose('configured', params(45, 10), NONE), 1 / 60);
    const [bx, bz] = along(named('ray-box'));
    expect(bx).toBeCloseTo(0, 9); // on the 0° line, not at the set 45°
    expect(bz).toBeCloseTo(1, 9);
    for (const part of ['incident', 'reflected', 'incidence-arc', 'reflection-arc'])
      expect(named(part).visible).toBe(false);
    const [mx, mz] = along(named('mirror')); // its normal, turned 10° towards +x
    expect(mx).toBeCloseTo(Math.sin(10 * DEG), 9);
    expect(mz).toBeCloseTo(Math.cos(10 * DEG), 9);
    rig.pose(pose('configured', params(45, 0), NONE), 1 / 60);
    expect(along(named('mirror'))[0]).toBeCloseTo(0, 9);
    // RUN's first sample (the model's init) leaves the ray box where it rests, lamp lit.
    const inputs = params(45, 10);
    const state = new Float64Array(reflectionModel.variables.length);
    reflectionModel.init(inputs, state);
    const first = Object.fromEntries(reflectionModel.variables.map((v, k) => [v, state[k]!]));
    rig.pose(pose('running', inputs, first), 1 / 60);
    expect(along(named('ray-box'))[1]).toBeCloseTo(1, 9);
    expect(named('incident').visible).toBe(true);
  });

  it('draws a run: the ray box at θ, the reflected ray by the law, the arcs at i and i′', () => {
    const { rig, named } = build();
    const slit = named('slit');
    const off = slit.material;
    const sample = runTo(30, 10);
    rig.pose(pose('completed', params(30, 10), sample), 1 / 60);
    expect(slit.material).not.toBe(off);
    const t = sample.rayBox!;
    expect(t).toBeCloseTo(30 * DEG, 12);
    const [bx, bz] = along(named('ray-box'));
    expect(bx).toBeCloseTo(-Math.sin(t), 9); // on the −x side
    expect(bz).toBeCloseTo(Math.cos(t), 9);
    expect(along(named('incident'))).toEqual([bx, bz]);
    // The law, from the vectors: r = d − 2(d·n)n for d from the ray box to the centre and the
    // mirror's normal n = (sin α, cos α) — the drawn reflected ray must point along r.
    const [nx, nz] = along(named('mirror'));
    const dn = -bx * nx - bz * nz;
    const [rx, rz] = [-bx - 2 * dn * nx, -bz - 2 * dn * nz];
    const [fx, fz] = along(named('reflected'));
    expect(fx).toBeCloseTo(rx, 9);
    expect(fz).toBeCloseTo(rz, 9);
    expect(fx).toBeGreaterThan(0); // on the other side of the normal
    expect(Math.atan2(fx, fz)).toBeCloseTo(50 * DEG, 9); // φ = θ + 2α
    for (const part of ['incident', 'reflected', 'incidence-arc', 'reflection-arc'])
      expect(named(part).visible).toBe(true);
    expect(sweepOf(named('incidence-arc'))).toBeCloseTo(sample.incidenceDeg!, 0.6); // ±⅛°
    expect(sweepOf(named('reflection-arc'))).toBeCloseTo(sample.reflectionDeg!, 0.6);
    expect(sweepOf(named('incidence-arc'))).toBe(40);
    // The arcs start at the normal: one sweeps towards the ray box, the other away from it.
    expect(named('incidence-arc').scale.x).toBe(-1);
    expect(named('reflection-arc').scale.x).toBe(1);
    expect(named('incidence-arc').parent).toBe(named('mirror'));

    rig.pose(pose('configured', params(30, 10), NONE), 1 / 60); // RESET
    for (const part of ['incident', 'reflected', 'incidence-arc', 'reflection-arc'])
      expect(named(part).visible).toBe(false);
    expect(slit.material).toBe(off);
  });

  it('turns the reflected ray by 2α when the mirror turns, the ray box fixed', () => {
    const { rig, named } = build();
    const bearing = (alpha: number) => {
      rig.pose(pose('completed', params(45, alpha), runTo(45, alpha)), 1 / 60);
      const [fx, fz] = along(named('reflected'));
      return Math.atan2(fx, fz) / DEG;
    };
    const square = bearing(0);
    expect(square).toBeCloseTo(45, 9);
    expect(bearing(15) - square).toBeCloseTo(30, 9);
    expect(along(named('ray-box'))[0]).toBeCloseTo(-Math.sin(45 * DEG), 9);
  });

  it('keeps its arcs’ triangles in order around the ring, so a draw range is a sweep', () => {
    const { named } = build();
    const g = named('reflection-arc').geometry;
    const p = g.getAttribute('position');
    const index = g.index!;
    let last = -1;
    for (let k = 0; k < index.count; k += 3) {
      // Each triangle's bearing from local +z towards +x grows (or holds) along the index.
      let bearing = 0;
      for (let v = 0; v < 3; v++) {
        const j = index.getX(k + v);
        bearing += Math.atan2(p.getX(j), p.getZ(j)) / 3;
      }
      expect(bearing).toBeGreaterThanOrEqual(last - 1e-9);
      last = bearing;
    }
    expect(last).toBeCloseTo(Math.PI / 2, 2);
    expect(index.count).toBe(6 * 360);
  });

  it('poses by assignment: the same objects, materials and geometries, however often', () => {
    const { rig, root } = build();
    const count = () => {
      const geometries = new Set<unknown>();
      const materials = new Set<unknown>();
      let n = 0;
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          materials.add(o.material);
        }
      });
      return { n, geometries: geometries.size, materials: materials.size };
    };
    const runs = [runTo(20, 0), runTo(60, 15), NONE];
    rig.pose(pose('running', params(20, 0), runs[0]!), 1 / 60);
    const before = count();
    const madeBefore = made.n;
    expect(madeBefore).toBeGreaterThan(0); // the counter sees the board's own `new`s
    for (let k = 0; k < 90; k++)
      rig.pose(pose(k % 2 ? 'running' : 'stopped', params(k % 90, k % 16), runs[k % 3]!), 0);
    rig.pose(pose('running', params(20, 0), runs[0]!), 1 / 60);
    expect(made.n).toBe(madeBefore); // no Vector2/3, Quaternion, Euler, Matrix4 or Color made
    expect(count()).toEqual(before);
  });

  it('keeps its draws modest: five frame meshes with the board, ten in the rig', () => {
    const { frame, rig } = build();
    expect(1 + meshes(frame.parts)).toBe(5);
    expect(meshes(rig.group)).toBe(10);
    // renderOrder is global: never after the other bench models' glass (2).
    rig.group.traverse((o) => expect(o.renderOrder).toBeLessThanOrEqual(2));
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
    for (const sample of [runTo(30, 5), NONE]) {
      rig.pose(pose('running', params(30, 5), sample), 1 / 60);
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
