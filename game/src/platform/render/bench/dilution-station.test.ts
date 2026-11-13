import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { dilutionModel } from '../../../simulation/models/dilution';
import {
  dilutionStation,
  FLASKS,
  flaskLevel,
  INDICATORS,
  PIPETTES,
  READOUTS,
} from './dilution-station';

// The dilution bench against its drafted item (0.9 × 0.26 × 0.4 m, laid out from its base): it
// stays in the box with every flask and pipette, frees all it made, and is posed from the dilution
// model's own samples — the dials pick the flask and pipette, the liquid holds exactly the flask's
// volume and meets the mark at V₂, its violet follows the concentration, the cuvette and both
// readouts light only once the run has completed, with C₂ read to d; posing only assigns.

const item = ItemDefinitionSchema.parse({
  id: 'dilution-station',
  displayName: 'Dilution bench and colorimeter',
  category: 'equipment',
  physical: { massKg: 10 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'dilution-station', top: [0, 0, 0] },
  visual: { shape: 'box', size: [0.9, 0.26, 0.4], color: '#dfe3e6', material: 'plastic' },
});
const [w, h, d] = item.visual.size;

/** The draft definition's defaults: dials, and the run's inputs with its initial conditions. */
const DIALS = {
  stockConcentration: 2e-5,
  stockVolume: 5,
  finalVolume: 50,
  concentrationResolution: 1e-7,
};
const INPUTS = { ...DIALS, fillTime: 10, absorptivity: 1e7, pathLength: 0.01 };
const NO_RUN = Object.fromEntries(dilutionModel.variables.map((v) => [v, NaN]));

/** The model's sample `seconds` into a run, stepped as a station would (0.05 s). */
function sampleAt(inputs: Record<string, number>, seconds: number): Record<string, number> {
  const state = new Float64Array(dilutionModel.variables.length);
  dilutionModel.init(inputs, state);
  for (let t = 0; t < seconds - 1e-9;) {
    const step = dilutionModel.step(state, Math.min(0.05, seconds - t), inputs);
    if (step <= 0) break;
    t += step;
  }
  return Object.fromEntries(dilutionModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const pose = (
  status: BenchPose['status'],
  sample: Record<string, number>,
  parameters: Record<string, number> = DIALS,
): BenchPose => ({ status, parameters, sample });

/** Colours equal to float32 (instance colours are stored as such). */
const same = (a: THREE.Color, b: THREE.Color) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-5;

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = dilutionStation.frame(item, painted);
  const rig = dilutionStation.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const led = root.getObjectByName('indicators') as THREE.InstancedMesh;
  const c = new THREE.Color();
  /** What a readout shows, decoded from its segments' and points' colours. */
  const read = (id: keyof typeof READOUTS) => {
    const o = READOUTS[id];
    const on = new THREE.Color(o.on);
    const masks = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
    let places = -1;
    o.points.forEach((k, i) => {
      led.getColorAt(INDICATORS.point[id] + i, c);
      if (same(c, on)) places = k;
    });
    let text = '';
    for (let digit = 0; digit < o.digits; digit++) {
      let mask = 0;
      for (let s = 0; s < 7; s++) {
        led.getColorAt(INDICATORS.start[id] + digit * 7 + s, c);
        if (same(c, on)) mask |= 1 << s;
      }
      text += mask === 0 ? ' ' : mask === 0x40 ? '-' : ('0123456789'[masks.indexOf(mask)] ?? '?');
      if (digit === o.digits - 1 - places) text += '.';
    }
    return text.trim();
  };
  const lamp = () => (led.getColorAt(INDICATORS.lamp, c), c.getHexString());
  /**
   * The liquid as drawn: mL from its first meridian's (r, y) rings (the 0.3 mm it sits inside the
   * glass put back, so it is the flask's inside volume), and its top.
   */
  const drawn = () => {
    const liquid = named('solution');
    const p = liquid.geometry.getAttribute('position');
    const rings = p.count / 25; // 24 segments + 1
    const r = (j: number) => (p.getZ(j) > 0 ? p.getZ(j) + 0.0003 : 0);
    let ml = 0;
    let top = -Infinity;
    for (let j = 1; j < rings; j++) {
      const [r0, y0, r1, y1] = [r(j - 1), p.getY(j - 1), r(j), p.getY(j)];
      ml += ((Math.PI * (y1 - y0)) / 3) * (r0 * r0 + r0 * r1 + r1 * r1) * 1e6;
      top = Math.max(top, y1);
    }
    return { ml, top: liquid.position.y + top };
  };
  const bounds = () => {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root, true);
  };
  return { frame, rig, root, painted, named, led, read, lamp, drawn, bounds };
}

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((m) => (n += m instanceof THREE.Mesh ? 1 : 0));
  return n;
};

describe('dilution station bench model', () => {
  it('reads only variables the dilution model outputs', () => {
    for (const v of dilutionStation.reads ?? []) expect(dilutionModel.variables).toContain(v);
  });

  it('makes four flasks whose mark lies in the neck and holds the nominal volume', () => {
    expect(FLASKS.map((f) => f.ml)).toEqual([25, 50, 100, 250]);
    for (const f of FLASKS) {
      const shoulder = 2.25 * f.radius;
      expect(f.mark).toBeGreaterThan(shoulder + 0.01);
      expect(f.top - f.mark).toBeCloseTo(0.03, 12);
      expect(flaskLevel(f, f.ml)).toBeCloseTo(f.mark, 12);
      // The neck holds 5 % of the nominal volume below the mark: a cylinder of its own radius.
      expect(f.mark - shoulder).toBeCloseTo((0.05 * f.ml * 1e-6) / (Math.PI * f.neck ** 2), 9);
      expect(flaskLevel(f, 0)).toBe(0);
      expect(flaskLevel(f, 1e9)).toBe(f.top); // never past the neck
    }
    // Real sizes, near a catalogue's: bulb diameters 36–78 mm, heights 90–210 mm, growing with V₂.
    for (let i = 1; i < FLASKS.length; i++) {
      expect(FLASKS[i]!.radius).toBeGreaterThan(FLASKS[i - 1]!.radius);
      expect(FLASKS[i]!.top).toBeGreaterThan(FLASKS[i - 1]!.top);
    }
    expect(2 * FLASKS[0].radius).toBeGreaterThan(0.03);
    expect(2 * FLASKS[3].radius).toBeLessThan(0.085);
    expect(FLASKS[3].rim).toBeLessThan(0.215);
  });

  it('stays inside the item’s box with every flask and pipette, standing on the base', () => {
    const { rig, bounds } = build();
    for (const f of FLASKS)
      for (const p of PIPETTES)
        for (const status of ['configured', 'running', 'completed'] as const) {
          const inputs = { ...INPUTS, finalVolume: f.ml, stockVolume: p.ml };
          rig.pose(pose(status, sampleAt(inputs, status === 'running' ? 5 : 10), inputs), 1 / 60);
          const box = bounds();
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
    expect(rig.group.position.toArray()).toEqual([0, -h / 2, 0]);
  });

  it('draws the frame in three meshes and the rig in nine (one instanced), see-through parts in order', () => {
    const { frame, rig, named, root } = build();
    expect(1 + meshes(frame.parts)).toBe(3); // body (the entity's mesh), plastic, glass
    expect(meshes(rig.group)).toBe(9);
    let instanced = 0;
    rig.group.traverse((o) => (instanced += o instanceof THREE.InstancedMesh ? 1 : 0));
    expect(instanced).toBe(1);
    const glass = named('glass');
    for (const name of ['solution', 'stock', 'cuvette', 'stream']) {
      const m = named(name);
      expect(m.renderOrder).toBeLessThan(glass.renderOrder); // liquids before the glass around them
      expect((m.material as THREE.Material).depthWrite).toBe(false);
      expect(m.castShadow).toBe(false);
    }
    for (const name of ['flask', 'pipette', 'glass', 'stopper'])
      expect((named(name).material as THREE.Material).depthWrite).toBe(false);
    expect(named('flask').material).toBe(named('pipette').material); // one glass material
    root.traverse((o) => expect(o.renderOrder).toBeLessThanOrEqual(2));
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
    // Every flask and pipette once on its mesh, so each built geometry is counted.
    for (const f of FLASKS)
      for (const p of PIPETTES) {
        rig.pose(pose('running', NO_RUN, { ...DIALS, finalVolume: f.ml, stockVolume: p.ml }), 0);
        collect();
      }
    made.delete(painted);
    expect(made.size).toBeGreaterThanOrEqual(3 + 9 + 2 * (FLASKS.length + PIPETTES.length) - 2);
    const freed = new Set<unknown>();
    for (const r of made) r.addEventListener('dispose', () => freed.add(r));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('shows the flask and pipette the dials name, the liquid holding exactly V', () => {
    const { rig, named, drawn } = build();
    const flask = named('flask');
    const pipette = named('pipette');
    const height = (m: THREE.Mesh) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox!.max.y;
    };
    const length = (m: THREE.Mesh) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox!.max.x - m.geometry.boundingBox!.min.x;
    };
    // Idle: the 50 mL flask holds the 5 mL the pipette delivered; nothing measured.
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    expect(height(flask)).toBeCloseTo(0.006 + FLASKS[1].rim, 6);
    expect(length(pipette)).toBeCloseTo(0.33, 6);
    expect(drawn().ml).toBeCloseTo(5, 4);
    expect(named('stopper').visible).toBe(false);
    expect(named('cuvette').visible).toBe(false);
    // Other dials: the 250 mL flask and the 1 mL pipette, 1 mL in the flask.
    rig.pose(pose('configured', NO_RUN, { ...DIALS, finalVolume: 250, stockVolume: 1 }), 1 / 60);
    expect(height(flask)).toBeCloseTo(0.006 + FLASKS[3].rim, 6);
    expect(length(pipette)).toBeCloseTo(0.3, 6);
    expect(drawn().ml).toBeCloseTo(1, 4);
    // The mark ring sits on the neck at the mark.
    const mark = named('mark');
    expect(mark.position.y).toBeCloseTo(0.0075 + FLASKS[3].mark, 12);
    expect(mark.scale.x).toBeGreaterThan(FLASKS[3].neck);
    // A run: the liquid holds the sample's volume at every step and lands on the mark at V₂.
    const inputs = { ...INPUTS, finalVolume: 250, stockVolume: 1 };
    for (const t of [1, 4.2, 7.7]) {
      const s = sampleAt(inputs, t);
      rig.pose(pose('running', s, inputs), 1 / 60);
      expect(drawn().ml).toBeCloseTo(s.volume!, 4);
      expect(named('stream').visible).toBe(true);
    }
    const end = sampleAt(inputs, 10);
    expect(end.volume).toBe(250);
    rig.pose(pose('completed', end, inputs), 1 / 60);
    const { ml, top } = drawn();
    expect(ml).toBeCloseTo(250, 4);
    expect(top).toBeCloseTo(mark.position.y, 7); // at the mark (float32 positions)
    expect(named('stopper').visible).toBe(true);
    expect(named('stream').visible).toBe(false);
    // No dials at all: the default flask and pipette, empty.
    rig.pose(pose('idle', {}, {}), 1 / 60);
    expect(height(flask)).toBeCloseTo(0.006 + FLASKS[1].rim, 6);
    expect(named('solution').visible).toBe(false);
  });

  it('tints the flask by the concentration across its bulb and the stock by C₁', () => {
    const { rig, named } = build();
    const solution = named('solution').material as THREE.MeshStandardMaterial;
    const stock = named('stock').material as THREE.MeshStandardMaterial;
    const depth = (c: number, width: number) => 1 - 10 ** -(1e7 * c * width);
    // Idle: the stock as pipetted, C₁ across the 50 mL flask's bulb; the bottle across its own.
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    const bulb = 2 * FLASKS[1].radius;
    expect(solution.opacity).toBeCloseTo(0.3 + 0.6 * depth(2e-5, bulb), 12);
    expect(stock.opacity).toBeCloseTo(0.3 + 0.6 * depth(2e-5, 0.053), 12);
    expect(solution.color.g).toBeLessThan(0.5); // violet takes out green
    // Running: the run's own concentration, paler as the volume grows.
    const early = sampleAt(INPUTS, 2);
    rig.pose(pose('running', early, INPUTS), 1 / 60);
    const paler = solution.opacity;
    expect(paler).toBeCloseTo(0.3 + 0.6 * depth(early.concentration!, bulb), 12);
    rig.pose(pose('running', sampleAt(INPUTS, 8), INPUTS), 1 / 60);
    expect(solution.opacity).toBeLessThan(paler);
    // The run's own ε when its inputs carry it.
    rig.pose(pose('running', early, { ...INPUTS, absorptivity: 2e7 }), 1 / 60);
    expect(solution.opacity).toBeCloseTo(
      0.3 + 0.6 * (1 - 10 ** -(2e7 * early.concentration! * bulb)),
      12,
    );
    // Without a concentration: clear.
    rig.pose(pose('configured', NO_RUN, { finalVolume: 50 }), 1 / 60);
    expect(same(solution.color, new THREE.Color('#dfeaf0'))).toBe(true);
    expect(solution.opacity).toBeCloseTo(0.3, 12);
    expect(stock.opacity).toBeCloseTo(0.3, 12);
  });

  it('lights the cuvette and both readouts only once the run has completed, C₂ read to d', () => {
    const { rig, named, read, lamp } = build();
    const cuvette = named('cuvette');
    const sample = cuvette.material as THREE.MeshStandardMaterial;
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    expect(read('absorbance')).toBe('-.---');
    expect(read('concentration')).toBe('---.-');
    expect(cuvette.visible).toBe(false);
    expect(lamp()).toBe('3b2a10');
    const mid = sampleAt(INPUTS, 5);
    rig.pose(pose('running', mid, INPUTS), 1 / 60);
    expect(read('absorbance')).toBe('-.---'); // the colorimeter reads the mixed solution only
    expect(read('concentration')).toBe('---.-');
    expect(cuvette.visible).toBe(false);
    expect(lamp()).toBe('ffa62b'); // 590 nm lamp lit while running
    rig.pose(pose('stopped', mid, INPUTS), 1 / 60); // an incomplete run measured nothing
    expect(read('absorbance')).toBe('-.---');
    expect(cuvette.visible).toBe(false);
    expect(lamp()).toBe('3b2a10');
    // Completed, the defaults: 20 µmol/L, 5 mL into 50 mL → C₂ = 2.0 µmol/L, A = 0.200.
    const end = sampleAt(INPUTS, 10);
    rig.pose(pose('completed', end, INPUTS), 1 / 60);
    expect(read('absorbance')).toBe('0.200');
    expect(read('concentration')).toBe('2.0');
    expect(cuvette.visible).toBe(true);
    expect(sample.opacity).toBeCloseTo(0.3 + 0.6 * (1 - 10 ** -0.2), 12);
    // The reading is `measurement.ts`'s: quantize(C₂, d), to d's places, in µmol/L.
    const at = (inputs: Record<string, number>) => {
      const s = sampleAt(inputs, 10);
      rig.pose(pose('completed', s, inputs), 1 / 60);
      return { c: s.concentration!, a: read('absorbance'), text: read('concentration') };
    };
    const fine = at({ ...INPUTS, concentrationResolution: 1e-8 });
    expect(fine.text).toBe((quantize(fine.c, 1e-8) * 1e6).toFixed(2));
    expect(fine.text).toBe('2.00');
    const coarse = at({ ...INPUTS, concentrationResolution: 1e-6 });
    expect(coarse.text).toBe('2');
    // 40 µmol/L, 10 mL into 25 mL: C₂ = 16 µmol/L, A = 1.6 (too dark, but read).
    const dark = at({ ...INPUTS, stockConcentration: 4e-5, stockVolume: 10, finalVolume: 25 });
    expect(dark.a).toBe('1.600');
    expect(dark.text).toBe('16.0');
    // 5 µmol/L, 1 mL into 250 mL at d = 1 µmol/L: 0.02 µmol/L reads 0 — the resolution shown.
    const faint = at({
      ...INPUTS,
      stockConcentration: 5e-6,
      stockVolume: 1,
      finalVolume: 250,
      concentrationResolution: 1e-6,
    });
    expect(faint.a).toBe('0.002');
    expect(faint.text).toBe('0');
    // No resolution dialled: nothing to read in concentration mode.
    const noDial: Record<string, number> = { ...INPUTS };
    delete noDial.concentrationResolution;
    expect(at(noDial).text).toBe('---.-');
    // RESET: dashes again, the cuvette emptied.
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    expect(read('absorbance')).toBe('-.---');
    expect(read('concentration')).toBe('---.-');
    expect(cuvette.visible).toBe(false);
  });

  // Identity checks only: a test cannot count three.js allocations, so "no allocation in pose" rests
  // on reading pose() itself; this proves nothing is rebuilt or replaced and nothing re-uploaded.
  it('poses by assignment: the same objects, materials and buffers, however often', () => {
    const { rig, root, led, named } = build();
    const snapshot = () => {
      const objects: unknown[] = [];
      root.traverse((o) => {
        objects.push(o);
        if (o instanceof THREE.Mesh) objects.push(o.material);
      });
      return objects;
    };
    const before = snapshot();
    const colors = led.instanceColor!.array;
    const samples = [0, 2, 5, 8, 10].map((t) => sampleAt(INPUTS, t));
    for (let i = 0; i <= 100; i++) {
      const status = i % 3 ? 'running' : i % 2 ? 'stopped' : 'completed';
      rig.pose(pose(status, samples[i % samples.length]!, INPUTS), 1 / 60);
    }
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    const after = snapshot();
    expect(after.length).toBe(before.length);
    after.forEach((o, i) => expect(o).toBe(before[i]));
    expect(led.instanceColor!.array).toBe(colors);
    // Every flask's liquid keeps its own position buffer; the shown one is only rewritten.
    const liquid = named('solution');
    const array = liquid.geometry.getAttribute('position').array;
    rig.pose(pose('running', samples[2]!, INPUTS), 1 / 60);
    expect(liquid.geometry.getAttribute('position').array).toBe(array);
    // The same pose again changes nothing: no colour or vertex upload.
    const again = pose('completed', samples[4]!, INPUTS);
    rig.pose(again, 1 / 60);
    const position = liquid.geometry.getAttribute('position') as THREE.BufferAttribute;
    const versions = [led.instanceColor!.version, position.version];
    for (let i = 0; i < 10; i++) rig.pose(again, 1 / 60);
    expect([led.instanceColor!.version, position.version]).toEqual(versions);
  });

  it('stands frame and rig together at bench.top', () => {
    const top: [number, number, number] = [0.01, 0.02, -0.01];
    const moved = ItemDefinitionSchema.parse({
      ...item,
      bench: { model: 'dilution-station', top },
    });
    const a = build();
    const painted = new THREE.MeshStandardMaterial();
    const frame = dilutionStation.frame(moved, painted);
    const rig = dilutionStation.rig!(moved);
    expect(rig.group.position.toArray()).toEqual(frame.parts.position.toArray());
    expect(rig.group.position.toArray()).toEqual([top[0], top[1] - h / 2, top[2]]);
    a.frame.body.computeBoundingBox();
    frame.body.computeBoundingBox();
    const shift = frame.body.boundingBox!.min.clone().sub(a.frame.body.boundingBox!.min);
    expect(shift.x).toBeCloseTo(top[0], 6); // float32 positions
    expect(shift.y).toBeCloseTo(top[1], 6);
    expect(shift.z).toBeCloseTo(top[2], 6);
  });
});
