import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { energyTrackModel, trackPoint } from '../../../simulation/models/energy';
import { energyTrack, TRACK } from './energy-track';
import { SEGMENTS } from './osmosis-rack';

// The energy track against its item (as drafted for content): the frame and the rig stay in the
// item's box before and through a run, the cart waits at the latch at the release height and then
// follows the run's own x, height and track angle, its wheels spin with s, the gates' lamps light
// exactly while a beam is blocked, the timer reads each gate time to the dialled resolution, the
// bars follow m and the sail its area, the cart clears both gates, and posing only assigns.

const item = ItemDefinitionSchema.parse({
  id: 'energy-track',
  displayName: 'Energy track with light gates',
  category: 'equipment',
  physical: { massKg: 6 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'energy-track', top: [0, 0.05, 0] },
  visual: { shape: 'box', size: [1.95, 0.62, 0.3], color: '#9aa3ab', material: 'painted' },
});
const [w, h, d] = item.visual.size;

/** The definition's `initialConditions` (drafts/mechanical-energy/definition.json). */
const CONDITIONS = {
  gravity: 9.81,
  flagWidth: 0.025,
  gateHeight: 0.06,
  rampAngle: 30,
  arcRadius: 0.3,
  flatLength: 0.3,
  rampLength: 0.72,
  rollingResistance: 0.003,
  cartDragArea: 0.005,
  sailDragCoefficient: 1.17,
  airDensity: 1.2,
};
const DIALS = { releaseHeight: 0.2, mass: 0.5, sailArea: 0, timerResolution: 0.001 };
const inputs = (over: Record<string, number> = {}) => ({ ...CONDITIONS, ...DIALS, ...over });

type Sample = Record<string, number>;
const none: Sample = Object.fromEntries(energyTrackModel.variables.map((v) => [v, NaN]));

/** The model's samples every `dt` s from the release to the turn. */
function run(parameters: Record<string, number>, dt = 1 / 60): Sample[] {
  const state = new Float64Array(energyTrackModel.variables.length);
  energyTrackModel.init(parameters, state);
  const snap = () =>
    Object.fromEntries(energyTrackModel.variables.map((v, i) => [v, state[i] ?? NaN]));
  const frames = [snap()];
  for (let i = 0; i < 5000 && !energyTrackModel.isComplete!(state, parameters); i++) {
    energyTrackModel.step(state, dt, parameters);
    frames.push(snap());
  }
  expect(energyTrackModel.isComplete!(state, parameters)).toBe(true);
  return frames;
}

const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Sample = none,
): BenchPose => ({ status, parameters, sample });

const meshCount = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
  return n;
};

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = energyTrack.frame(item, painted);
  const rig = energyTrack.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name)!;
  /** What the timer's two readouts show, e.g. ["0.013", " 0.01"] (blank places as spaces). */
  const reads = () => {
    const mesh = named('timer-digits') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const lit = (slot: number) => (mesh.getMatrixAt(slot, m), m.determinant() !== 0);
    const places: string[] = [];
    for (let place = 0; place < 10; place++) {
      let bits = 0;
      for (let k = 0; k < 7; k++) if (lit(place * 8 + k)) bits |= 1 << k;
      const digit = SEGMENTS.indexOf(bits as (typeof SEGMENTS)[number]);
      places.push(
        (digit >= 0 ? String(digit) : bits === 0x40 ? '-' : bits === 0 ? ' ' : '?') +
          (lit(place * 8 + 7) ? '.' : ''),
      );
    }
    return [places.slice(0, 5).join(''), places.slice(5).join('')];
  };
  return { frame, rig, root, painted, named, reads };
}

describe('energy track bench model', () => {
  it('reads only what the energy-track model outputs', () => {
    for (const v of energyTrack.reads!) expect(energyTrackModel.variables).toContain(v);
  });

  it('draws the track the definition’s initial conditions describe', () => {
    for (const [key, value] of Object.entries(TRACK)) {
      expect(CONDITIONS[key as keyof typeof CONDITIONS], key).toBe(value);
    }
  });

  it('stands on the item’s floor, the flat at bench.top, inside its box before and through a run', () => {
    const { rig, root } = build();
    root.updateMatrixWorld(true);
    expect(rig.group.position.toArray()).toEqual([0, 0.05 - h / 2, 0]);
    const parts = new THREE.Box3().setFromObject(root.children[1]!, true);
    expect(parts.min.y).toBeCloseTo(-h / 2, 6); // the feet and the gates' bases on the bench
    const inside = new THREE.Box3(
      new THREE.Vector3(-w / 2, -h / 2, -d / 2),
      new THREE.Vector3(w / 2, h / 2, d / 2),
    ).expandByScalar(1e-6);
    const check = (label: string) => {
      root.updateMatrixWorld(true);
      expect(inside.containsBox(new THREE.Box3().setFromObject(root, true)), label).toBe(true);
    };
    for (const releaseHeight of [0.1, 0.15, 0.2, 0.25, 0.3]) {
      rig.pose(pose('configured', inputs({ releaseHeight, mass: 1, sailArea: 0.04 })), 1 / 60);
      check(`h = ${releaseHeight}`);
    }
    const settings = inputs({ releaseHeight: 0.3, mass: 1, sailArea: 0.04 });
    const frames = run(settings);
    for (let i = 0; i < frames.length; i += 4) {
      rig.pose(pose('running', settings, frames[i]), 1 / 60);
      check(`frame ${i}`);
    }
  });

  it('sweeps the track with its faces outward: the flat’s top faces up, its underside down', () => {
    const { frame } = build();
    const position = frame.body.getAttribute('position') as THREE.BufferAttribute;
    const normal = frame.body.getAttribute('normal') as THREE.BufferAttribute;
    const top = 0.05 - h / 2;
    let up = 0;
    let down = 0;
    for (let i = 0; i < position.count; i++) {
      // The flat is one quad, its vertices at x = ±0.15; the arcs' next ring is already higher.
      if (Math.abs(position.getX(i)) > 0.16 || Math.abs(position.getZ(i)) > 0.061) continue;
      const ny = normal.getY(i);
      if (Math.abs(position.getY(i) - top) < 1e-6) {
        up += ny > 0.99 ? 1 : 0; // the plate's top (the rails' hidden bottoms face down here)
      } else if (Math.abs(position.getY(i) - (top - 0.012)) < 1e-6) {
        // Only the underside and the side bands (±z) reach this level: nothing faces up.
        expect(ny).toBeLessThan(0.01);
        down += ny < -0.99 ? 1 : 0;
      }
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });

  it('holds the cart at the latch at the release height, then follows the run’s x, height and angle', () => {
    const { rig, named } = build();
    const cart = named('cart');
    const latch = named('latch');
    for (const releaseHeight of [0.1, 0.2, 0.3]) {
      const settings = inputs({ releaseHeight });
      rig.pose(pose('configured', settings), 1 / 60); // no run: NaN
      const { x, y, slope, release } = trackPoint(settings, 0);
      const start = trackPoint(settings, release);
      expect(x).toBe(0); // gate A's beam point is the rig's origin
      expect(y).toBe(0);
      expect(slope).toBe(0);
      expect(cart.position.y).toBeCloseTo(releaseHeight, 12);
      expect(cart.position.x).toBeCloseTo(start.x, 12);
      expect(cart.position.x).toBeLessThan(-0.3); // on the near ramp
      expect(cart.rotation.z).toBeCloseTo(-Math.PI / 6, 12);
      expect(latch.position.toArray()).toEqual([start.x, start.y, 0]);
      expect(latch.rotation.z).toBeCloseTo(-Math.PI / 6, 12);
      expect(named('pointer').position.y).toBe(releaseHeight);
    }
    const settings = inputs();
    const frames = run(settings);
    const first = frames[0]!;
    rig.pose(pose('running', settings, first), 1 / 60);
    expect(cart.position.y).toBeCloseTo(0.2, 9); // the run starts where the latch held it
    for (const f of [frames[10]!, frames[30]!, frames[frames.length - 1]!]) {
      rig.pose(pose('running', settings, f), 1 / 60);
      expect(cart.position.x).toBe(f.x);
      expect(cart.position.y).toBe(f.height);
      expect(cart.rotation.z).toBe(f.trackAngle);
    }
    const last = frames[frames.length - 1]!;
    expect(last.stopped).toBe(1);
    expect(cart.position.x).toBeGreaterThan(0.3); // at rest on the far ramp
    expect(cart.position.y).toBeCloseTo(0.1934, 3); // h′ (the notes' worked value)
    rig.pose(pose('configured', settings), 1 / 60); // RESET
    expect(cart.position.y).toBeCloseTo(0.2, 12);
  });

  it('spins the wheels with s (one draw), by their radius', () => {
    const { rig, named } = build();
    const wheels = named('wheels') as THREE.InstancedMesh;
    expect(wheels.count).toBe(4);
    const settings = inputs();
    const frames = run(settings);
    const angleOf = (i: number) => {
      const m = new THREE.Matrix4();
      wheels.getMatrixAt(i, m);
      return new THREE.Euler().setFromRotationMatrix(m).z;
    };
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    for (const f of [frames[0]!, frames[20]!, frames[40]!]) {
      rig.pose(pose('running', settings, f), 1 / 60);
      for (let i = 0; i < 4; i++) {
        expect(wrap(angleOf(i) + f.position! / 0.012)).toBeCloseTo(0, 6);
      }
    }
  });

  it('lights each gate’s lamp exactly while the model says its beam is blocked', () => {
    const { rig, named } = build();
    const settings = inputs();
    const frames = run(settings, 0.0005);
    const lampA = named('lamp-a') as THREE.Mesh;
    const lampB = named('lamp-b') as THREE.Mesh;
    const lit = (lamp: THREE.Mesh) => lamp.material instanceof THREE.MeshBasicMaterial;
    const inA = frames.filter((f) => f.beamA === 1);
    const inB = frames.filter((f) => f.beamB === 1);
    expect(inA.length).toBeGreaterThan(10); // ~12.7 ms at 0.5 ms steps
    expect(inB.length).toBeGreaterThan(10);
    let seenA = 0;
    let seenB = 0;
    for (const f of frames) {
      rig.pose(pose('running', settings, f), 0.0005);
      expect(lit(lampA)).toBe(f.beamA === 1);
      expect(lit(lampB)).toBe(f.beamB === 1);
      seenA += lit(lampA) ? 1 : 0;
      seenB += lit(lampB) ? 1 : 0;
    }
    expect(seenA).toBe(inA.length);
    expect(seenB).toBe(inB.length);
    rig.pose(pose('configured', settings), 1 / 60);
    expect(lit(lampA) || lit(lampB)).toBe(false);
  });

  it('reads each gate time on the timer at the dialled resolution, as measurement.ts reads it', () => {
    const { rig, reads } = build();
    rig.pose(pose('configured', inputs()), 1 / 60);
    expect(reads()).toEqual(['     ', '     ']); // no run: nothing measured
    for (const [timerResolution, decimals] of [
      [0.001, 3],
      [0.0001, 4],
      [0.01, 2],
    ] as const) {
      const settings = inputs({ timerResolution });
      const frames = run(settings);
      const text = (t: number) => quantize(t, timerResolution).toFixed(decimals).padStart(6);
      rig.pose(pose('running', settings, frames[0]), 1 / 60);
      expect(reads()).toEqual([text(0), text(0)]); // the model's 0 until the flag has passed
      const afterA = frames.find((f) => f.gateTimeA! > 0 && f.gateTimeB === 0)!;
      rig.pose(pose('running', settings, afterA), 1 / 60);
      expect(reads()).toEqual([text(afterA.gateTimeA!), text(0)]);
      const last = frames[frames.length - 1]!;
      rig.pose(pose('completed', settings, last), 1 / 60);
      expect(reads()).toEqual([text(last.gateTimeA!), text(last.gateTimeB!)]);
      expect(last.gateTimeA).toBeCloseTo(0.012726, 5); // the notes' worked value
      // The reading differs from the simulated value: it is the nearest multiple of d, never more.
      expect(Math.abs(Number(reads()[0]) - last.gateTimeA!)).toBeLessThanOrEqual(
        timerResolution / 2 + 1e-12,
      );
    }
  });

  it('stacks the bars by the mass and sizes the sail by its area, none at 0', () => {
    const { rig, named } = build();
    const bars = named('bars') as THREE.InstancedMesh;
    const sail = named('sail') as THREE.Mesh;
    for (const [mass, count] of [
      [0.25, 0],
      [0.5, 1],
      [0.75, 2],
      [1, 3],
    ] as const) {
      rig.pose(pose('configured', inputs({ mass })), 1 / 60);
      expect(bars.count).toBe(count);
    }
    for (const sailArea of [0.01, 0.0225, 0.04]) {
      rig.pose(pose('configured', inputs({ sailArea })), 1 / 60);
      expect(sail.visible).toBe(true);
      expect(sail.scale.y).toBeCloseTo(Math.sqrt(sailArea), 12);
      expect(sail.scale.z).toBeCloseTo(Math.sqrt(sailArea), 12);
    }
    rig.pose(pose('configured', inputs({ sailArea: 0 })), 1 / 60);
    expect(sail.visible).toBe(false);
    // Missing or NaN dials: the idle setup (the definition's defaults).
    for (const parameters of [{}, inputs({ releaseHeight: NaN, mass: NaN, sailArea: NaN })]) {
      rig.pose(pose('configured', inputs({ releaseHeight: 0.3, mass: 1, sailArea: 0.04 })), 1 / 60);
      rig.pose(pose('configured', parameters), 1 / 60);
      expect(named('cart').position.y).toBeCloseTo(0.2, 12);
      expect(bars.count).toBe(1);
      expect(sail.visible).toBe(false);
    }
  });

  it('takes the heaviest cart with the biggest sail through both gates without touching them', () => {
    const { rig, root, named } = build();
    const settings = inputs({ releaseHeight: 0.3, mass: 1, sailArea: 0.04 });
    const frames = run(settings, 1 / 120);
    const dark = named('dark-parts') as THREE.Mesh;
    const position = dark.geometry.getAttribute('position') as THREE.BufferAttribute;
    const index = dark.geometry.index!;
    root.updateMatrixWorld(true);
    const triangles: THREE.Triangle[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const t = new THREE.Triangle(
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i)),
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i + 1)),
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i + 2)),
      );
      t.a.applyMatrix4(dark.matrixWorld);
      t.b.applyMatrix4(dark.matrixWorld);
      t.c.applyMatrix4(dark.matrixWorld);
      triangles.push(t);
    }
    const cart = named('cart');
    const local = new THREE.Triangle();
    const inverse = new THREE.Matrix4();
    const world = new THREE.Matrix4();
    let touched = 0;
    let checked = 0;
    for (const f of frames) {
      rig.pose(pose('running', settings, f), 1 / 120);
      root.updateMatrixWorld(true);
      const near = triangles.filter(
        (t) => Math.min(Math.abs(t.a.x - cart.position.x), Math.abs(t.b.x - cart.position.x)) < 0.3,
      );
      cart.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || !o.visible) return;
        const geometry = o.geometry as THREE.BufferGeometry;
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const instances = o instanceof THREE.InstancedMesh ? o.count : 1;
        for (let i = 0; i < instances; i++) {
          world.copy(o.matrixWorld);
          if (o instanceof THREE.InstancedMesh) {
            const m = new THREE.Matrix4();
            o.getMatrixAt(i, m);
            world.multiply(m);
          }
          inverse.copy(world).invert();
          for (const t of near) {
            local.copy(t);
            local.a.applyMatrix4(inverse);
            local.b.applyMatrix4(inverse);
            local.c.applyMatrix4(inverse);
            checked++;
            if (box.intersectsTriangle(local)) touched++;
          }
        }
      });
    }
    expect(checked).toBeGreaterThan(1000);
    expect(touched).toBe(0);
  });

  it('poses by assignment: the same objects, geometries and materials, however often', () => {
    const { rig, root } = build();
    const count = () => {
      let n = 0;
      const geometries = new Set<unknown>();
      const materials = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          materials.add(o.material);
        }
      });
      return { n, geometries: geometries.size, materials: materials.size };
    };
    const settings = inputs();
    const frames = run(settings);
    rig.pose(pose('configured', settings), 1 / 60);
    const before = count();
    for (let i = 0; i < frames.length; i++) {
      rig.pose(pose('running', settings, frames[i]), 1 / 60);
    }
    rig.pose(pose('configured', inputs({ releaseHeight: 0.3, mass: 1, sailArea: 0.04 })), 1 / 60);
    rig.pose(pose('configured', settings), 1 / 60);
    expect(count()).toEqual(before);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    const collect = () =>
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          made.add(o.geometry as THREE.BufferGeometry);
          made.add(o.material as THREE.Material);
        }
        if (o instanceof THREE.InstancedMesh) made.add(o);
      });
    const settings = inputs();
    const frames = run(settings, 0.0005);
    collect();
    rig.pose(
      pose(
        'running',
        settings,
        frames.find((f) => f.beamA === 1),
      ),
      1 / 60,
    ); // lamps lit
    collect();
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

  it('draws the frame in 6 meshes and the rig in 10', () => {
    const { frame, rig } = build();
    expect(1 + meshCount(frame.parts)).toBe(6);
    expect(meshCount(rig.group)).toBe(10);
  });

  describe('with a canvas (as in a browser)', () => {
    function stubCanvas() {
      const canvas = { width: 0, height: 0 };
      const ctx = new Proxy<Record<string | symbol, unknown>>(
        { canvas },
        {
          get: (target, key) => (key in target ? target[key] : () => undefined),
          set: (target, key, value) => ((target[key] = value), true),
        },
      );
      vi.stubGlobal('document', {
        createElement: () => ({ ...canvas, getContext: () => ctx }),
      });
    }
    afterEach(() => vi.unstubAllGlobals());

    it('paints the rulers and the timer’s panel in their planes’ proportions, and frees them', () => {
      stubCanvas();
      const { frame, rig, root, named } = build();
      expect(1 + meshCount(frame.parts)).toBe(6); // textures add no meshes
      const maps = new Set<THREE.Texture>();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const map = (o.material as THREE.MeshStandardMaterial).map;
          if (map) maps.add(map);
        }
      });
      expect(maps.size).toBe(2); // the rulers' scale, the timer's panel
      for (const name of ['rulers', 'timer-panel']) {
        const mesh = named(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        const image = mesh.material.map!.image as { width: number; height: number };
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
        expect(image.width / image.height / (size.x / size.y), name).toBeCloseTo(1, 1);
      }
      const freed = new Set<THREE.Texture>();
      for (const t of maps) t.addEventListener('dispose', () => freed.add(t));
      frame.dispose();
      rig.dispose();
      expect(freed.size).toBe(2);
    });
  });
});
