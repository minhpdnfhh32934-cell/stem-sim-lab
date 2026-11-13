import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { circuitModel } from '../../../simulation/models/circuit';
import { CODE, GLYPHS, SWITCH, VOLTMETER_SCALE, circuitBoard, colourCode } from './circuit-board';

// The Ohm's-law board against its item (the draft in content: 0.6 × 0.16 × 0.4 m, the board's top
// 24 mm up): everything inside the item's box, few meshes, and the rig drawn from the real model's
// samples — switch, voltmeter needle, ammeter digits — and from the dials: supply digits, colour
// bands, link leads per configuration. Posing only assigns, and everything made is freed.

const item = ItemDefinitionSchema.parse({
  id: 'circuit-board',
  displayName: 'DC circuit board',
  category: 'equipment',
  physical: { massKg: 3.5 }, // as the draft items.json
  interactions: ['bench', 'inspect'],
  bench: { model: 'circuit-board', top: [0, 0.024, 0] },
  visual: { shape: 'box', size: [0.6, 0.16, 0.4], color: '#2f5d4a', material: 'painted' },
});
const [w, h, d] = item.visual.size;
const DEFAULTS = { voltage: 6, resistance1: 100, resistance2: 220, configuration: 1 };
const NO_RUN = Object.fromEntries(circuitModel.variables.map((v) => [v, NaN]));

/** The model's sample `t` s into a run of these settings (switch closes at 0.5 s, ends at 3 s). */
function sampleAt(parameters: Record<string, number>, t: number): Record<string, number> {
  const inputs = { ...parameters, switchTime: 0.5, duration: 3 };
  const state = new Float64Array(circuitModel.variables.length);
  circuitModel.init(inputs, state);
  let clock = 0;
  while (clock < t - 1e-9) clock += circuitModel.step(state, Math.min(0.001, t - clock), inputs);
  return Object.fromEntries(circuitModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const pose = (
  status: SessionState,
  parameters: Record<string, number>,
  sample: Record<string, number>,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = circuitBoard.frame(item, painted);
  const rig = circuitBoard.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const instanced = (name: string) => root.getObjectByName(name) as THREE.InstancedMesh;
  return { frame, rig, root, painted, named, instanced };
}

/** What a seven-segment readout shows: digits, blanks (space), dashes and decimal points. */
function shown(readout: THREE.InstancedMesh): string {
  const m = new THREE.Matrix4();
  const lit = (i: number) => (readout.getMatrixAt(i, m), m.elements[0] !== 0);
  let text = '';
  for (let k = 0; k < readout.count / 8; k++) {
    let mask = 0;
    for (let s = 0; s < 7; s++) if (lit(k * 8 + s)) mask |= 1 << s;
    text += mask === 0 ? ' ' : mask === 64 ? '-' : String(GLYPHS.indexOf(mask as never));
    if (lit(k * 8 + 7)) text += '.';
  }
  return text;
}

/** The colour of band `i` (R1: 0–3, R2: 4–7) as a CODE index, or -1 for the plain body. */
function bandCode(bands: THREE.InstancedMesh, i: number): number {
  const c = new THREE.Color();
  bands.getColorAt(i, c);
  return CODE.findIndex((hex) => {
    const k = new THREE.Color(hex);
    return Math.abs(k.r - c.r) + Math.abs(k.g - c.g) + Math.abs(k.b - c.b) < 1e-6; // stored as float32
  });
}

describe('circuit board bench model', () => {
  it('draws the board as the item’s footprint, everything inside the item’s box, few meshes', () => {
    const { frame, rig, root } = build();
    frame.body.computeBoundingBox();
    const board = frame.body.boundingBox!;
    expect(board.min.x).toBeCloseTo(-w / 2, 6);
    expect(board.max.x).toBeCloseTo(w / 2, 6);
    expect(board.min.z).toBeCloseTo(-d / 2, 6);
    expect(board.max.z).toBeCloseTo(d / 2, 6);
    expect(board.max.y).toBeCloseTo(0.024 - h / 2, 6); // bench.top: the rig stands on it
    expect(rig.group.position.toArray()).toEqual([0, 0.024 - h / 2, 0]);
    // Switch open and closed, the needle at both stops, every configuration's leads.
    const extent = new THREE.Box3();
    for (const configuration of [0, 1, 2])
      for (const voltage of [0, 15]) {
        const parameters = { ...DEFAULTS, voltage, configuration };
        rig.pose(pose('running', parameters, { switch: voltage ? 1 : 0, voltage }), 1 / 60);
        root.updateMatrixWorld(true);
        extent.union(new THREE.Box3().setFromObject(root));
      }
    const eps = 1e-6;
    expect(extent.min.toArray().every((v, i) => v >= -item.visual.size[i]! / 2 - eps)).toBe(true);
    expect(extent.max.toArray().every((v, i) => v <= item.visual.size[i]! / 2 + eps)).toBe(true);
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((c) => {
        if (c instanceof THREE.Mesh) n++;
      });
      return n;
    };
    expect(meshes(frame.parts) + 1).toBe(5); // the board, plastic, metal, print, glass
    expect(meshes(rig.group)).toBe(9); // blade, handle, needle, 2 readouts, bands, 3 link sets
  });

  it('shows the idle setup from the dials without a run: open switch, meters at 0', () => {
    const { rig, named, instanced } = build();
    rig.pose(pose('configured', DEFAULTS, NO_RUN), 1 / 60);
    expect(named('switch').rotation.x).toBeCloseTo(-SWITCH.open, 12);
    expect(named('needle').rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep / 2, 12);
    expect(shown(instanced('ammeter-readout'))).toBe('0.000');
    expect(shown(instanced('supply-readout'))).toBe(' 6.0');
    expect([0, 1, 2].map((c) => named(`links-${c}`).visible)).toEqual([false, true, false]);
    const bands = instanced('bands');
    // 100 Ω brown black brown gold; 220 Ω red red brown gold.
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => bandCode(bands, i))).toEqual([
      1, 0, 1, 10, 2, 2, 1, 10,
    ]);
  });

  it('closes the switch with the run and follows the model’s voltage and current', () => {
    const { rig, named, instanced } = build();
    const lever = named('switch');
    const needle = named('needle');
    const ammeter = instanced('ammeter-readout');
    // Series 100 + 220 Ω at 6 V: before the switch closes, then after.
    rig.pose(pose('running', DEFAULTS, sampleAt(DEFAULTS, 0.3)), 1 / 60);
    expect(lever.rotation.x).toBeCloseTo(-SWITCH.open, 12);
    expect(needle.rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep / 2, 12);
    expect(shown(ammeter)).toBe('0.000');
    const closed = sampleAt(DEFAULTS, 1);
    expect(closed.current).toBeCloseTo(6 / 320, 12);
    rig.pose(pose('running', DEFAULTS, closed), 1 / 60);
    expect(lever.rotation.x).toBe(0);
    expect(needle.rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep * (0.5 - 6 / 15), 12);
    expect(shown(ammeter)).toBe('18.75'); // mA

    // Completed, parallel 100 ∥ 100 Ω at 12 V: 240 mA, the parallel links.
    const parallel = { voltage: 12, resistance1: 100, resistance2: 100, configuration: 2 };
    rig.pose(pose('completed', parallel, sampleAt(parallel, 3)), 1 / 60);
    expect(shown(ammeter)).toBe('240.0');
    expect(shown(instanced('supply-readout'))).toBe('12.0');
    // The tens digit, blank at ' 6.0', lies inside the culling bounds three.js keeps for good.
    const supply = instanced('supply-readout');
    const tens = new THREE.Matrix4();
    supply.getMatrixAt(1, tens); // segment b of the '1'
    const at = new THREE.Vector3().setFromMatrixPosition(tens);
    expect(supply.boundingSphere?.containsPoint(at)).toBe(true);
    expect(needle.rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep * (0.5 - 12 / 15), 12);
    expect([0, 1, 2].map((c) => named(`links-${c}`).visible)).toEqual([false, false, true]);
    // The smallest current the dials give: 1.5 V over 1000 + 1000 Ω.
    const smallest = { voltage: 1.5, resistance1: 1000, resistance2: 1000, configuration: 1 };
    rig.pose(pose('completed', smallest, sampleAt(smallest, 3)), 1 / 60);
    expect(shown(ammeter)).toBe('0.750');
    expect(shown(instanced('supply-readout'))).toBe(' 1.5');
    const bands = instanced('bands');
    expect(bandCode(bands, 2)).toBe(2); // 1000 Ω: brown black red
    // R1 alone: one link, b to B.
    rig.pose(pose('configured', { ...smallest, configuration: 0 }, NO_RUN), 1 / 60);
    expect([0, 1, 2].map((c) => named(`links-${c}`).visible)).toEqual([true, false, false]);
    expect(lever.rotation.x).toBeCloseTo(-SWITCH.open, 12); // RESET: open again
  });

  it('gives every vertex-coloured mesh its colours: WebGL draws a missing attribute black', () => {
    const { root } = build();
    const missing: string[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = o.material as THREE.Material;
      if (material.vertexColors && !(o.geometry as THREE.BufferGeometry).hasAttribute('color'))
        missing.push(o.name || o.type);
    });
    expect(missing).toEqual([]);
  });

  it('reads only variables the circuit model outputs', () => {
    expect(circuitBoard.reads!.filter((v) => !circuitModel.variables.includes(v))).toEqual([]);
  });

  it('gives the colour code of the dials’ resistors, and none for values it cannot show', () => {
    const out = [0, 0, 0];
    const code = (r: number) => (colourCode(r, out) ? [...out] : null);
    expect(code(100)).toEqual([1, 0, 1]);
    expect(code(220)).toEqual([2, 2, 1]);
    expect(code(470)).toEqual([4, 7, 1]);
    expect(code(1000)).toEqual([1, 0, 2]);
    expect(code(10)).toEqual([1, 0, 0]);
    expect(code(4.7)).toBeNull();
    expect(code(NaN)).toBeNull();
  });

  it('poses by assignment: the same objects and buffers, unchanged input changes nothing', () => {
    const { rig, root, instanced } = build();
    const bands = instanced('bands');
    const lcd = instanced('ammeter-readout');
    const count = () => {
      let n = 0;
      const things = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) things.add(o.material).add(o.geometry);
        if (o instanceof THREE.InstancedMesh) things.add(o.instanceMatrix).add(o.instanceColor);
      });
      return { n, things: [...things] };
    };
    const before = count();
    const run = sampleAt(DEFAULTS, 1);
    for (let i = 0; i <= 100; i++) {
      const parameters = { ...DEFAULTS, configuration: i % 3, voltage: [1.5, 3, 6, 12][i % 4]! };
      rig.pose(pose(i % 2 ? 'running' : 'stopped', parameters, i % 5 ? run : NO_RUN), 1 / 60);
    }
    rig.pose(pose('running', DEFAULTS, run), 1 / 60);
    expect(count()).toEqual(before);
    const versions = () => [bands.instanceColor!.version, lcd.instanceMatrix.version];
    const settled = versions();
    rig.pose(pose('running', { ...DEFAULTS }, { ...run }), 1 / 60); // equal values, new objects
    expect(versions()).toEqual(settled);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const)
      rig.pose(pose(status, DEFAULTS, sampleAt(DEFAULTS, 1)), 1 / 60);
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
    for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });
});
