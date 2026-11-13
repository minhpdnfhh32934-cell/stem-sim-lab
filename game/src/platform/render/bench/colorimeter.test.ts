import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { kineticsModel } from '../../../simulation/models/kinetics';
import { colorimeter, INDICATORS, READOUTS } from './colorimeter';

// The reaction-rate bench against its item (0.95 × 0.26 × 0.4 m, the rig laid out from its base):
// it stays in the box, frees all it made, and is posed from the kinetics model's own samples —
// the readouts show the run's absorbance and time, the mixture fades with the absorbance, the lamp
// follows the run, the timer marks the half-life, the bath shows its set point; posing only assigns.

const item = ItemDefinitionSchema.parse({
  id: 'colorimeter',
  displayName: 'Colorimeter and water bath',
  category: 'equipment',
  physical: { massKg: 12 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'colorimeter', top: [0, 0, 0] },
  visual: { shape: 'box', size: [0.95, 0.26, 0.4], color: '#dfe3e6', material: 'plastic' },
});
const [w, h, d] = item.visual.size;

/** The draft definition's settings and initial conditions. */
const INPUTS = {
  initialConcentration: 1e-5,
  naoh: 0.2,
  temperature: 25,
  timerResolution: 0.1,
  referenceRate: 0.1,
  referenceTemperature: 25,
  activationEnergy: 60000,
  absorptivity: 1e7,
  pathLength: 0.01,
  endFraction: 0.25,
};
const DIALS = { initialConcentration: 1e-5, naoh: 0.2, temperature: 25, timerResolution: 0.1 };
const NO_RUN = Object.fromEntries(kineticsModel.variables.map((v) => [v, NaN]));

/** The model's sample `seconds` after mixing, stepped as a station would (0.05 s). */
function sampleAt(seconds: number): Record<string, number> {
  const state = new Float64Array(kineticsModel.variables.length);
  kineticsModel.init(INPUTS, state);
  for (let t = 0; t < seconds - 1e-9;) {
    const step = kineticsModel.step(state, Math.min(0.05, seconds - t), INPUTS);
    if (step <= 0) break;
    t += step;
  }
  return Object.fromEntries(kineticsModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}

/** Colours equal to float32 (instance colours are stored as such). */
const same = (a: THREE.Color, b: THREE.Color) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-5;

const pose = (
  status: SessionState,
  sample: Record<string, number>,
  parameters: Record<string, number> = DIALS,
): BenchPose => ({ status, parameters, sample });

function build(on = item) {
  const painted = new THREE.MeshStandardMaterial();
  const frame = colorimeter.frame(on, painted);
  const rig = colorimeter.rig!(on);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name);
  const led = named('indicators') as THREE.InstancedMesh;
  const lcd = named('lcd') as THREE.InstancedMesh;
  const mixture = named('mixture') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  /** What a readout shows, decoded from its segments' colours. */
  const read = (id: keyof typeof READOUTS) => {
    const o = READOUTS[id];
    const lamps = o.mesh === 'lcd' ? lcd : led;
    const on = new THREE.Color(o.on);
    const c = new THREE.Color();
    const glyphs = '0123456789';
    const masks = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
    let text = '';
    for (let digit = 0; digit < o.digits; digit++) {
      let mask = 0;
      for (let s = 0; s < 7; s++) {
        lamps.getColorAt(INDICATORS.start[id] + digit * 7 + s, c);
        if (same(c, on)) mask |= 1 << s;
      }
      text += mask === 0 ? ' ' : mask === 0x40 ? '-' : (glyphs[masks.indexOf(mask)] ?? '?');
      if (digit === o.digits - 1 - o.decimals) text += '.';
    }
    return text.trim();
  };
  const lit = (i: number, color: string, lamps = led) => {
    const c = new THREE.Color();
    lamps.getColorAt(i, c);
    return same(c, new THREE.Color(color));
  };
  return { frame, rig, root, painted, led, lcd, mixture, read, lit, named };
}

describe('colorimeter bench model', () => {
  it('stays inside the item’s box at every pose, its rig laid out from the base', () => {
    const { rig, root } = build();
    expect(rig.group.position.toArray()).toEqual([0, -h / 2, 0]);
    for (const status of ['configured', 'running', 'completed'] as const) {
      // Hottest bath the model takes and the strongest dye it allows: the column and tint at most.
      rig.pose(pose(status, sampleAt(10), { ...DIALS, temperature: 100 }), 1 / 60);
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
      expect(box.min.y).toBeCloseTo(-h / 2, 6); // standing on its feet
    }
  });

  it('draws the frame in six meshes and the rig in four (two instanced)', () => {
    const { frame, rig, lcd } = build();
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((m) => (n += m instanceof THREE.Mesh ? 1 : 0));
      return n;
    };
    expect(1 + meshes(frame.parts)).toBe(6); // the body is the entity's own mesh
    expect(meshes(rig.group)).toBe(4);
    // The LCD is lit like its window and its off segments are the window's own colour (no ghost
    // "8.8.8.8"): that colour is among the plastic mesh's vertex colours.
    expect(lcd.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const window = new THREE.Color(READOUTS.elapsed.off);
    const plastic = (frame.parts.getObjectByName('plastic') as THREE.Mesh).geometry;
    const colors = plastic.getAttribute('color');
    const c = new THREE.Color();
    let found = false;
    for (let i = 0; i < colors.count && !found; i++)
      found = same(c.fromBufferAttribute(colors, i), window);
    expect(found).toBe(true);
    const glass = frame.parts.getObjectByName('glass') as THREE.Mesh;
    const liquids = ['clear-liquids', 'dye-liquids'].map(
      (name) => frame.parts.getObjectByName(name) as THREE.Mesh,
    );
    // Liquids before the glass they stand in; nothing see-through writes depth.
    for (const liquid of liquids) expect(liquid.renderOrder).toBeLessThan(glass.renderOrder);
    for (const m of [glass, ...liquids])
      expect((m.material as THREE.Material).depthWrite).toBe(false);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    rig.pose(pose('running', sampleAt(5)), 1 / 60);
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

  it('shows the idle setup, then the run as the model gives it, then the idle setup again', () => {
    const { rig, mixture, read, lit, lcd } = build();
    const violet = () => 1 - mixture.material.color.g; // the dye takes out green (590 nm)
    // No run: dashes for A, the timer at 0, the dye made up at c₀ (A₀ = 1), the lamp dark.
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    expect(read('absorbance')).toBe('-.---');
    expect(read('elapsed')).toBe('0.0');
    expect(read('temperature')).toBe('25.0');
    expect(lit(INDICATORS.lamp, '#3b2a10')).toBe(true);
    const idle = violet();
    const idleOpacity = mixture.material.opacity;
    expect(idleOpacity).toBeCloseTo(0.3 + 0.6 * (1 - 10 ** -1), 12); // A₀ = ε·l·c₀ = 1
    // Running, 12.5 s in: the run's own absorbance, to 0.001; the lamp lit; no half-life yet.
    const early = sampleAt(12.5);
    rig.pose(pose('running', early), 1 / 60);
    expect(read('absorbance')).toBe(early.absorbance!.toFixed(3));
    expect(read('elapsed')).toBe('12.5');
    expect(lit(INDICATORS.lamp, '#ffa62b')).toBe(true);
    expect(lit(INDICATORS.half, READOUTS.elapsed.off, lcd)).toBe(true);
    expect(violet()).toBeLessThan(idle);
    // Completed (two half-lives, 69.3 s): a quarter of A₀ left, fainter still, the half-life marked.
    const end = sampleAt(80);
    expect(end.halfTime).toBeGreaterThan(0);
    rig.pose(pose('completed', end, INPUTS), 1 / 60);
    expect(read('absorbance')).toBe('0.250');
    expect(read('elapsed')).toBe(end.elapsed!.toFixed(1));
    expect(lit(INDICATORS.lamp, '#3b2a10')).toBe(true);
    expect(lit(INDICATORS.half, READOUTS.elapsed.on, lcd)).toBe(true);
    expect(mixture.material.opacity).toBeCloseTo(0.3 + 0.6 * (1 - 10 ** -0.25), 12);
    // RESET, a weaker dye and a hotter bath: dashes, the timer cleared, a paler violet, 45.0 °C.
    rig.pose(
      pose('configured', NO_RUN, { ...DIALS, initialConcentration: 2e-6, temperature: 45 }),
      1 / 60,
    );
    expect(read('absorbance')).toBe('-.---');
    expect(read('elapsed')).toBe('0.0');
    expect(read('temperature')).toBe('45.0');
    expect(lit(INDICATORS.half, READOUTS.elapsed.off, lcd)).toBe(true);
    expect(mixture.material.opacity).toBeCloseTo(0.3 + 0.6 * (1 - 10 ** -0.2), 12);
  });

  it('counts the timer in whole steps of its resolution d, frozen at the nearest step', () => {
    const { rig, read } = build();
    const at = (
      seconds: number,
      parameters: Record<string, number>,
      status: SessionState = 'running',
    ) => {
      rig.pose(pose(status, sampleAt(seconds), parameters), 1 / 60);
      return read('elapsed');
    };
    // Running: never ahead of the time elapsed.
    expect(at(12.5, { ...DIALS, timerResolution: 5 })).toBe('10.0');
    expect(at(11, { ...DIALS, timerResolution: 5 })).toBe('10.0');
    expect(at(15, { ...DIALS, timerResolution: 5 })).toBe('15.0'); // a step reached, despite float sums
    expect(at(12.5, { ...DIALS, timerResolution: 1 })).toBe('12.0');
    expect(at(12.5, DIALS)).toBe('12.5'); // d = 0.1 s
    // Stopped or completed: the reading, the nearest multiple of d (measurement.ts).
    expect(at(12.5, { ...DIALS, timerResolution: 5 }, 'stopped')).toBe('15.0');
    expect(at(12.5, { ...DIALS, timerResolution: 1 }, 'completed')).toBe('13.0');
    const noDial: Record<string, number> = { ...DIALS };
    delete noDial.timerResolution;
    expect(at(11, noDial)).toBe('11.0'); // no d: the time as it is
  });

  it('without its dials shows dashes, the column at its floor and a clear mixture', () => {
    const { rig, read, mixture, named } = build();
    rig.pose(pose('configured', NO_RUN, { naoh: 0.2 }), 1 / 60);
    expect(read('temperature')).toBe('--.-');
    expect(read('absorbance')).toBe('-.---');
    const column = named('thermometer') as THREE.Mesh;
    expect(column.position.y + column.scale.y).toBeCloseTo(0.16, 12); // 10 °C, its scale's floor
    expect(same(mixture.material.color, new THREE.Color('#dfeaf0'))).toBe(true);
    expect(mixture.material.opacity).toBeCloseTo(0.3, 12);
    rig.pose(pose('configured', NO_RUN, { ...DIALS, temperature: NaN }), 1 / 60);
    expect(read('temperature')).toBe('--.-');
  });

  it('stands frame and rig together at bench.top', () => {
    const top: [number, number, number] = [0.01, 0.02, -0.01];
    const moved = ItemDefinitionSchema.parse({ ...item, bench: { model: 'colorimeter', top } });
    const a = build();
    const b = build(moved);
    expect(b.rig.group.position.toArray()).toEqual(b.frame.parts.position.toArray());
    expect(b.rig.group.position.toArray()).toEqual([top[0], top[1] - h / 2, top[2]]);
    a.frame.body.computeBoundingBox();
    b.frame.body.computeBoundingBox();
    const shift = b.frame.body.boundingBox!.min.clone().sub(a.frame.body.boundingBox!.min);
    expect(shift.x).toBeCloseTo(top[0], 6); // float32 positions
    expect(shift.y).toBeCloseTo(top[1], 6); // float32 positions
    expect(shift.z).toBeCloseTo(top[2], 6); // float32 positions
  });

  it('raises the thermometer column with the bath’s set point', () => {
    const { rig, named } = build();
    const column = named('thermometer') as THREE.Mesh;
    const top = (celsius: number) => {
      rig.pose(pose('configured', NO_RUN, { ...DIALS, temperature: celsius }), 1 / 60);
      return column.position.y + column.scale.y;
    };
    const [t20, t45] = [top(20), top(45)];
    expect(t45).toBeGreaterThan(t20);
    expect((t45 - t20) / 25).toBeCloseTo(0.09 / 50, 9); // 1.8 mm per °C on its 10–60 °C scale
    // The whole dial range (20–45 °C) shows above the bath's rim and the clip on it (top 0.159 m).
    expect(t20).toBeGreaterThan(0.159);
  });

  it('tints the idle mixture with the run’s own ε and l when its inputs carry them', () => {
    const { rig, mixture } = build();
    const opacity = (parameters: Record<string, number>) => {
      rig.pose(pose('configured', NO_RUN, parameters), 1 / 60);
      return mixture.material.opacity;
    };
    // A₀ = ε·l·c₀: 2e7 · 0.01 · 1e-5 = 2; 1e7 · 0.005 · 1e-5 = 0.5 (not the defaults' 1).
    expect(opacity({ ...DIALS, absorptivity: 2e7 })).toBeCloseTo(0.3 + 0.6 * (1 - 10 ** -2), 12);
    expect(opacity({ ...DIALS, pathLength: 0.005 })).toBeCloseTo(0.3 + 0.6 * (1 - 10 ** -0.5), 12);
  });

  it('reads only variables the kinetics model outputs', () => {
    for (const v of colorimeter.reads ?? []) expect(kineticsModel.variables).toContain(v);
  });

  // Identity checks only: a test cannot count three.js allocations, so "no allocation in pose" rests
  // on reading pose() itself; this proves nothing is rebuilt or replaced and nothing re-uploaded.
  it('poses by assignment: the same objects, materials and buffers, however often', () => {
    const { rig, root, led, lcd, mixture } = build();
    const count = () => {
      let n = 0;
      const materials = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) materials.add(o.material);
      });
      return { n, materials: materials.size };
    };
    const before = count();
    const colors = [led, lcd].map((m) => m.instanceColor!.array);
    const tint = mixture.material.color;
    const samples = [0, 5, 20, 40, 60].map(sampleAt);
    for (let i = 0; i <= 100; i++)
      rig.pose(pose(i % 3 ? 'running' : 'stopped', samples[i % samples.length]!), 1 / 60);
    rig.pose(pose('configured', NO_RUN), 1 / 60);
    expect(count()).toEqual(before);
    expect(led.instanceColor!.array).toBe(colors[0]);
    expect(lcd.instanceColor!.array).toBe(colors[1]);
    expect(mixture.material.color).toBe(tint);
    // The same pose again changes nothing: no colour upload.
    const same = pose('running', samples[2]!);
    rig.pose(same, 1 / 60);
    const versions = [led, lcd].map((m) => m.instanceColor!.version);
    for (let i = 0; i < 10; i++) rig.pose(same, 1 / 60);
    expect([led, lcd].map((m) => m.instanceColor!.version)).toEqual(versions);
  });
});
