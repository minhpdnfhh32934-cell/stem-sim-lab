import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { buoyancyModel } from '../../../simulation/models/buoyancy';
import {
  BORE,
  buoyancyRig,
  CLEARANCE,
  CUBE_LOOKS,
  FLUID_LOOKS,
  SEGMENTS,
  SURFACE,
} from './buoyancy-rig';

// The buoyancy bench against its item (0.45 × 0.62 × 0.25 m, the rig standing at its base centre),
// posed from samples of the real model: the cube the clearance above the surface before a run and
// `depth` under it during one, the slide with it; the measuring cylinder's column from the volume
// displaced; the stream only while the cube crosses the surface; the LCD to the dialled
// resolution with its sign; all inside the item's box; posing only assigns; freeing everything.

// The draft item (not in content until the experiment is integrated).
const item = ItemDefinitionSchema.parse({
  id: 'buoyancy-rig',
  displayName: 'Overflow can and force sensor',
  description: 'test',
  category: 'equipment',
  physical: { massKg: 6 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'buoyancy-rig', top: [0, 0, 0] },
  visual: { shape: 'box', size: [0.45, 0.62, 0.25], color: '#9aa3ab', material: 'painted' },
});
const [W, H, D] = item.visual.size;

/** The draft definition's inputs (initial conditions and dial defaults), with `over` dialled. */
const inputs = (over: Record<string, number> = {}): Record<string, number> => ({
  gravity: 9.81,
  loweringSpeed: 0.01,
  clearance: CLEARANCE,
  objectDensity: 2700,
  fluidDensity: 998.2,
  edgeLength: 0.03,
  forceResolution: 0.01,
  ...over,
});

/** The model's sample `seconds` into the run (it stops at the end by itself). */
function sampleAt(parameters: Record<string, number>, seconds: number) {
  const state = new Float64Array(buoyancyModel.variables.length);
  buoyancyModel.init(parameters, state);
  for (let i = Math.round(seconds / 0.02); i > 0; i--) buoyancyModel.step(state, 0.02, parameters);
  return Object.fromEntries(buoyancyModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const none = Object.fromEntries(buoyancyModel.variables.map((v) => [v, NaN]));
const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Record<string, number> = none,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = buoyancyRig.frame(item, painted);
  const rig = buoyancyRig.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  /** What the LCD shows, e.g. " 0.45" (blank places as spaces, the sign a dash). */
  const reads = () => {
    const mesh = named('lcd-digits') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const lit = (slot: number) => (mesh.getMatrixAt(slot, m), m.determinant() !== 0);
    let text = '';
    for (let place = 0; place < Math.floor(mesh.count / 8); place++) {
      let bits = 0;
      for (let k = 0; k < 7; k++) if (lit(place * 8 + k)) bits |= 1 << k;
      const digit = SEGMENTS.indexOf(bits as (typeof SEGMENTS)[number]);
      text += digit >= 0 ? String(digit) : bits === 0x40 ? '-' : bits === 0 ? ' ' : '?';
      if (lit(place * 8 + 7)) text += '.';
    }
    return text;
  };
  /** The cube's bottom, m above the base (the rig's parts are laid out from it). */
  const cubeBottom = () => {
    root.updateMatrixWorld(true);
    const cube = named('cube');
    return new THREE.Vector3(0, -0.5, 0).applyMatrix4(cube.matrixWorld).y + H / 2;
  };
  return { frame, rig, root, painted, named, reads, cubeBottom };
}

describe('buoyancy rig bench model', () => {
  it('draws the stand and jack plates as the entity’s mesh, its parts in a few meshes, in its box', () => {
    const { frame, rig, root, painted, named } = build();
    expect((root.children[0] as THREE.Mesh).geometry).toBe(frame.body);
    const meshes: THREE.Mesh[] = [];
    frame.parts.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.map((m) => m.name).sort()).toEqual(['glass', 'marks', 'metal', 'tray']);
    expect(meshes.some((m) => m.material === painted)).toBe(false);
    const rigMeshes: string[] = [];
    rig.group.traverse((o) => {
      if (o instanceof THREE.Mesh) rigMeshes.push(o.name);
    });
    expect(rigMeshes.sort()).toEqual([
      'bath',
      'collected',
      'cube',
      'fittings',
      'lcd',
      'lcd-digits',
      'stream',
    ]);
    const glass = named('glass').material as THREE.MeshStandardMaterial;
    expect(glass.transparent && !glass.depthWrite).toBe(true);
    // The liquids are drawn before the glass around them.
    for (const liquid of ['bath', 'collected', 'stream']) {
      expect((named(liquid).material as THREE.Material).transparent).toBe(true);
      expect(named(liquid).renderOrder).toBeLessThan(named('glass').renderOrder);
    }
    expect(rig.group.position.toArray()).toEqual([0, -H / 2, 0]);
    for (const [a, status, seconds] of [
      [0.04, 'configured', 0],
      [0.04, 'running', 3],
      [0.04, 'completed', 9],
      [0.02, 'configured', 0],
      [0.02, 'completed', 9],
    ] as const) {
      const p = inputs({ edgeLength: a, objectDensity: 8960 });
      rig.pose(pose(status, p, seconds ? sampleAt(p, seconds) : none), 1 / 60);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root, true);
      expect(box.min.x).toBeGreaterThanOrEqual(-W / 2);
      expect(box.max.x).toBeLessThanOrEqual(W / 2);
      expect(box.min.y).toBeGreaterThanOrEqual(-H / 2 - 1e-6); // float32 positions
      expect(box.max.y).toBeLessThanOrEqual(H / 2);
      expect(box.min.z).toBeGreaterThanOrEqual(-D / 2);
      expect(box.max.z).toBeLessThanOrEqual(D / 2);
    }
  });

  it('before a run: the cube at its true size the clearance above the surface, nothing measured', () => {
    const { rig, named, reads, cubeBottom } = build();
    for (const status of ['idle', 'configured'] as const) {
      rig.pose(pose(status, inputs({ edgeLength: 0.04 })), 1 / 60);
      expect(named('cube').visible).toBe(true);
      expect(named('cube').scale.toArray()).toEqual([0.04, 0.04, 0.04]);
      expect(cubeBottom()).toBeCloseTo(SURFACE + CLEARANCE, 12);
      expect(named('collected').visible).toBe(false);
      expect(named('stream').visible).toBe(false);
      expect(reads()).toBe('-----');
    }
    // The can is full to its spout whatever the state.
    const bath = named('bath');
    expect(bath.position.y + bath.scale.y).toBeCloseTo(SURFACE, 12);
    // A different clearance in the inputs moves the rest position with it.
    rig.pose(pose('configured', inputs({ clearance: 0.05 })), 1 / 60);
    expect(cubeBottom()).toBeCloseTo(SURFACE + 0.05, 12);
  });

  it('during a run: the cube `depth` under, the column from the volume displaced, the stream', () => {
    const { rig, named, reads, cubeBottom } = build();
    const p = inputs({ edgeLength: 0.04, objectDensity: 8960, fluidDensity: 1024.8 });
    // 1 cm/s from 2 cm above: in the air, crossing the surface, fully under, at the end.
    for (const [seconds, crossing] of [
      [1, false],
      [3, true],
      [5, true],
      [7, false],
      [9, false],
    ] as const) {
      const s = sampleAt(p, seconds);
      rig.pose(pose('running', p, s), 1 / 60);
      expect(cubeBottom()).toBeCloseTo(SURFACE - s.depth!, 12);
      const column = named('collected');
      expect(column.visible).toBe(s.submergedVolume! > 0);
      if (column.visible) expect(column.scale.y).toBeCloseTo(s.submergedVolume! / BORE, 12);
      expect(s.depth! > 0 && s.depth! < 0.04).toBe(crossing);
      expect(named('stream').visible).toBe(crossing);
      if (crossing) {
        // From the spout's tip down to the column's top.
        const stream = named('stream');
        expect(stream.position.y - stream.scale.y).toBeCloseTo(
          column.position.y + column.scale.y,
          12,
        );
      }
      expect(reads().trim()).toBe(quantize(s.reading!, 0.01).toFixed(2));
    }
    // 64 mL of copper: 0.112 m of the cylinder's bore.
    expect(named('collected').scale.y).toBeCloseTo(64e-6 / BORE, 12);
    // Stopped: frozen where the sample is, the stream gone.
    const mid = sampleAt(p, 3);
    rig.pose(pose('stopped', p, mid), 1 / 60);
    expect(named('stream').visible).toBe(false);
    expect(cubeBottom()).toBeCloseTo(SURFACE - mid.depth!, 12);
  });

  it('shows the reading to the dialled resolution, a minus sign when the rod pushes a floater', () => {
    const { rig, reads } = build();
    // Aluminium 3 cm in water: W′ = 0.450755766 N.
    const al = inputs();
    rig.pose(pose('completed', al, sampleAt(al, 9)), 1 / 60);
    expect(reads()).toBe('  0.45');
    rig.pose(pose('completed', inputs({ forceResolution: 0.1 }), sampleAt(al, 9)), 1 / 60);
    expect(reads()).toBe('   0.5');
    rig.pose(pose('completed', inputs({ forceResolution: 0.05 }), sampleAt(al, 9)), 1 / 60);
    expect(reads()).toBe('  0.45');
    // Polypropylene 4 cm in salt water: lighter than the liquid, the sensor reads a push.
    const pp = inputs({ objectDensity: 905, fluidDensity: 1197.2, edgeLength: 0.04 });
    const s = sampleAt(pp, 9);
    expect(s.reading).toBeLessThan(0);
    rig.pose(pose('completed', pp, s), 1 / 60);
    // The sign sits just left of the first digit.
    expect(reads()).toBe(` -${Math.abs(quantize(s.reading!, 0.01)).toFixed(2)}`);
    rig.pose(pose('running', pp, { ...s, reading: -12.345 }), 1 / 60);
    expect(reads()).toBe('-12.35');
    // Copper 4 cm in air: 5.63 N fits; a value too large for four digits shows dashes.
    const cu = inputs({ objectDensity: 8960, edgeLength: 0.04 });
    rig.pose(pose('running', cu, sampleAt(cu, 1)), 1 / 60);
    expect(reads()).toBe('  5.63');
    rig.pose(pose('running', cu, { ...sampleAt(cu, 1), reading: 123.4 }), 1 / 60);
    expect(reads()).toBe('-----');
  });

  it('takes the cube’s look and the liquid’s tint from the nearest preset densities', () => {
    const { rig, named } = build();
    const cube = () => named('cube').material as THREE.MeshStandardMaterial;
    const bath = () => named('bath').material as THREE.MeshStandardMaterial;
    for (const look of CUBE_LOOKS) {
      rig.pose(pose('configured', inputs({ objectDensity: look.density })), 1 / 60);
      expect(cube().color.getHexString()).toBe(look.color.slice(1));
      expect(cube().metalness).toBe(look.metalness);
    }
    for (const look of FLUID_LOOKS) {
      rig.pose(pose('configured', inputs({ fluidDensity: look.density })), 1 / 60);
      expect(bath().color.getHexString()).toBe(look.color.slice(1));
      expect(bath().opacity).toBe(look.opacity);
    }
    expect(named('collected').material).toBe(named('bath').material);
    expect(named('stream').material).toBe(named('bath').material);
    // An unknown density: a neutral grey, no metal sheen.
    rig.pose(pose('configured', inputs({ objectDensity: 5000 })), 1 / 60);
    expect(cube().metalness).toBe(0);
  });

  it('reads only variables the buoyancy model outputs, and shows nothing it lacks', () => {
    for (const v of buoyancyRig.reads ?? []) expect(buoyancyModel.variables).toContain(v);
    const { rig, named, reads } = build();
    rig.pose(pose('running', {}, { v: 0.5, i: 0.5, level: 0.5 }), 1 / 60);
    expect(named('cube').visible).toBe(false);
    expect(named('collected').visible).toBe(false);
    expect(named('stream').visible).toBe(false);
    expect(reads()).toBe('-----');
  });

  it('poses by assignment: the same objects, and the LCD is rewritten only when it changes', () => {
    const { rig, root, named } = build();
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
    for (let i = 0; i <= 10; i++) {
      rig.pose(pose(i % 3 ? 'running' : 'completed', p, sampleAt(p, i)), 1 / 60);
    }
    rig.pose(pose('configured', p), 1 / 60);
    expect(count()).toEqual(before);
    const lcd = named('lcd-digits') as THREE.InstancedMesh;
    const s = sampleAt(p, 4);
    rig.pose(pose('running', p, s), 1 / 60);
    const once = lcd.instanceMatrix.version;
    rig.pose(pose('running', p, s), 1 / 60);
    expect(lcd.instanceMatrix.version).toBe(once);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const p = inputs();
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, p, status === 'running' ? sampleAt(p, 3) : none), 1 / 60);
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
