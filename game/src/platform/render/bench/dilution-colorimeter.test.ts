import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { quantize } from '../../../simulation/measurement';
import { dilutionModel } from '../../../simulation/models/dilution';
import { cuvetteOf, dilutionColorimeter, INDICATORS, READOUTS } from './dilution-colorimeter';
import { CM, SLOT } from './colorimeter';

// The physical dilution bench: a tile where the item's seat stands on its collider, the school
// colorimeter whose cuvette is the container's, and the two readouts. Posed from the dilution
// model's own samples, as a station would.

const item = ItemDefinitionSchema.parse({
  id: 'dilution-colorimeter',
  displayName: 'Dilution bench and colorimeter',
  category: 'equipment',
  tags: ['apparatus'],
  physical: { massKg: 10, body: 'static' },
  interactions: ['bench', 'inspect'],
  bench: { model: 'dilution-colorimeter', top: [0, 0, 0] },
  visual: { shape: 'box', size: [0.9, 0.26, 0.4], color: '#dfe3e6', material: 'plastic' },
  // The tile (top 6 mm above the bench) beside the colorimeter's footprint.
  colliders: [
    { center: [-0.25, -0.13 + 0.003, 0.0], size: [0.15, 0.006, 0.15] },
    { center: [0.02, -0.13 + 0.048, -0.03], size: [0.24, 0.096, 0.18] },
  ],
  seats: [
    {
      id: 'tile',
      center: [-0.25, -0.13 + 0.006, 0.0],
      radius: 0.05,
      accepts: ['volumetric-flask'],
    },
  ],
});
const bare = ItemDefinitionSchema.parse({
  ...item,
  id: 'dilution-colorimeter-bare',
  physical: { massKg: 10 },
  colliders: undefined,
  seats: undefined,
});
const [w, h, d] = item.visual.size;

/** The draft's defaults: 20 µmol/L, 5 mL into 50 mL. */
const INPUTS = {
  stockConcentration: 2e-5,
  stockVolume: 5,
  finalVolume: 50,
  fillTime: 10,
  absorptivity: 1e7,
  pathLength: 0.01,
};
const DIALS = { ...INPUTS, concentrationResolution: 1e-7 };

/** The model's sample once it has reached the mark (completed). */
function finished(): Record<string, number> {
  const state = new Float64Array(dilutionModel.variables.length);
  dilutionModel.init(INPUTS, state);
  for (let i = 0; i < 100; i++) if (dilutionModel.step(state, 0.5, INPUTS) <= 0) break;
  return Object.fromEntries(dilutionModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const NO_RUN = Object.fromEntries(dilutionModel.variables.map((v) => [v, NaN]));

const same = (a: THREE.Color, b: THREE.Color) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-5;
const pose = (
  status: SessionState,
  sample: Record<string, number>,
  parameters: Record<string, number> = DIALS,
): BenchPose => ({ status, parameters, sample });

function build(on = item) {
  const painted = new THREE.MeshStandardMaterial();
  const frame = dilutionColorimeter.frame(on, painted);
  const rig = dilutionColorimeter.rig!(on);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const led = root.getObjectByName('reading') as THREE.InstancedMesh;
  const masks = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
  /** What a row shows, decoded from its segments' colours (the point from its place). */
  const read = (row: keyof typeof READOUTS) => {
    const o = READOUTS[row];
    const lit = new THREE.Color(o.on);
    const c = new THREE.Color();
    let text = '';
    for (let digit = 0; digit < o.digits; digit++) {
      let mask = 0;
      for (let s = 0; s < 7; s++) {
        led.getColorAt(INDICATORS.start[row] + digit * 7 + s, c);
        if (same(c, lit)) mask |= 1 << s;
      }
      text += mask === 0 ? ' ' : mask === 0x40 ? '-' : String(masks.indexOf(mask));
    }
    const m = new THREE.Matrix4();
    led.getMatrixAt(INDICATORS.start[row] + o.digits * 7, m);
    return { text: text.trim(), pointWidth: new THREE.Vector3().setFromMatrixScale(m).x };
  };
  const lamp = (color: string) => {
    const c = new THREE.Color();
    led.getColorAt(INDICATORS.lamp, c);
    return same(c, new THREE.Color(color));
  };
  return { frame, rig, root, painted, led, read, lamp };
}

describe('dilution bench model', () => {
  it('stays inside the item’s box at every pose, standing on its feet', () => {
    const { rig, root } = build();
    for (const status of ['configured', 'running', 'completed'] as const) {
      rig.pose(pose(status, finished()), 1 / 60);
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
      expect(box.min.y).toBeCloseTo(-h / 2, 6);
    }
  });

  it('draws the tile exactly where the seat stands on its collider, and nothing without a seat', () => {
    const { frame } = build();
    const plastic = frame.parts.getObjectByName('plastic') as THREE.Mesh;
    const tile = new THREE.Color('#f3f4f2');
    const colors = plastic.geometry.getAttribute('color');
    const position = plastic.geometry.getAttribute('position');
    const box = new THREE.Box3();
    const c = new THREE.Color();
    for (let i = 0; i < colors.count; i++) {
      if (same(c.fromBufferAttribute(colors, i), tile)) {
        box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, i));
      }
    }
    // In the frame's coordinates (from bench.top): the collider's box less the origin.
    const o = new THREE.Vector3(0, -h / 2, 0);
    const low = box.min.toArray().map((v, i) => v + (o.toArray()[i] ?? 0));
    [-0.25 - 0.075, -0.13, -0.075].forEach((v, i) => expect(low[i]).toBeCloseTo(v, 6));
    expect(box.max.y + o.y).toBeCloseTo(-0.13 + 0.006, 6); // the seat's height
    // The colorimeter's case collider has no seat: no second tile.
    expect(box.max.x + o.x).toBeCloseTo(-0.25 + 0.075, 6);
    const none = build(bare).frame.parts.getObjectByName('plastic') as THREE.Mesh;
    const noneColors = none.geometry.getAttribute('color');
    let found = false;
    for (let i = 0; i < noneColors.count && !found; i++) {
      found = same(c.fromBufferAttribute(noneColors, i), tile);
    }
    expect(found).toBe(false);
  });

  it('draws no cuvette of its own: the container is the receiver', () => {
    const { frame } = build();
    expect(frame.parts.getObjectByName('glass')).toBeUndefined();
    const cuvette = cuvetteOf(item);
    // In the colorimeter's slot, its rim above the case's top.
    expect(cuvette.axis[0]).toBeCloseTo(SLOT.x, 12);
    expect(cuvette.axis[1]).toBeCloseTo(SLOT.z, 12);
    expect(cuvette.floor).toBeCloseTo(-h / 2 + SLOT.bottom + 0.002, 12);
    expect(cuvette.rim).toBeGreaterThan(-h / 2 + CM.top);
    expect(cuvette.rim - cuvette.floor).toBeCloseTo(0.043, 12);
  });

  it('shows dashes until the run has completed, then the model’s A and C₂ at the dial’s resolution', () => {
    const { rig, read, lamp } = build();
    rig.pose(pose('idle', NO_RUN), 1 / 60);
    expect(read('absorbance').text).toBe('----');
    expect(read('concentration').text).toBe('----');
    expect(lamp('#3b2a10')).toBe(true);
    // Stopped part-way: an incomplete run measured nothing.
    rig.pose(pose('stopped', { ...finished(), absorbance: 0.1 }), 1 / 60);
    expect(read('absorbance').text).toBe('----');

    const end = finished();
    rig.pose(pose('completed', end), 1 / 60);
    // A = ε·l·C₂ = 1e7 × 0.01 × 2e-6 = 0.2; C₂ read to d = 0.1 µmol/L: 2.0 µmol/L.
    expect(end.absorbance).toBeCloseTo(0.2, 12);
    expect(read('absorbance').text).toBe(end.absorbance!.toFixed(3).replace('.', ''));
    const micro = quantize(end.concentration!, 1e-7) * 1e6;
    expect(micro).toBeCloseTo(2, 9);
    expect(read('concentration').text).toBe(micro.toFixed(1).replace('.', ''));
    expect(read('concentration').pointWidth).toBeGreaterThan(1e-3);
    expect(lamp('#ffa62b')).toBe(true);

    // A coarser dial: whole µmol/L, no decimal point; a finer one: two places.
    rig.pose(pose('completed', end, { ...DIALS, concentrationResolution: 1e-6 }), 1 / 60);
    expect(read('concentration').text).toBe('2');
    expect(read('concentration').pointWidth).toBeLessThan(1e-3);
    rig.pose(pose('completed', end, { ...DIALS, concentrationResolution: 1e-8 }), 1 / 60);
    expect(read('concentration').text).toBe('200');
    // Back to no run.
    rig.pose(pose('idle', NO_RUN), 1 / 60);
    expect(read('absorbance').text).toBe('----');
  });

  it('is one instanced mesh named “reading” for the cuvette’s container to show, and a single plastic frame', () => {
    const { frame, rig, led } = build();
    expect(led).toBeInstanceOf(THREE.InstancedMesh);
    expect(led.count).toBe(INDICATORS.count);
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((m) => (n += m instanceof THREE.Mesh ? 1 : 0));
      return n;
    };
    expect(meshes(frame.parts)).toBe(1);
    expect(meshes(rig.group)).toBe(1);
    expect(dilutionColorimeter.reads).toEqual(['absorbance', 'concentration']);
    for (const v of dilutionColorimeter.reads ?? []) expect(dilutionModel.variables).toContain(v);
  });

  it('poses without allocating a mesh or changing what is drawn, and frees everything it made', () => {
    const { frame, rig, root, painted } = build();
    rig.pose(pose('completed', finished()), 1 / 60);
    const count = () => {
      let n = 0;
      root.traverse(() => n++);
      return n;
    };
    const before = count();
    for (let i = 0; i < 20; i++)
      rig.pose(pose(i % 2 ? 'running' : 'completed', finished()), 1 / 60);
    expect(count()).toBe(before);
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
