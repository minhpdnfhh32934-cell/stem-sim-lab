import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { powerModel } from '../../../simulation/models/power';
import { GLYPHS, VOLTMETER_SCALE } from './circuit-board';
import { SWITCH, powerBoard } from './power-board';

// The electrical-power board against its item (the draft: 0.72 × 0.22 × 0.42 m, the board's top
// 24 mm up): everything inside the item's box, few meshes, and the rig drawn from the real model's
// samples — switch, voltmeter needle, ammeter digits to their dialled resolution — and from the
// dials: supply digits, link leads per configuration. Posing only assigns, and everything made is
// freed.

const item = ItemDefinitionSchema.parse({
  id: 'power-board',
  displayName: 'Electrical power board',
  category: 'equipment',
  physical: { massKg: 4.5 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'power-board', top: [0, 0.024, 0] },
  visual: { shape: 'box', size: [0.72, 0.22, 0.42], color: '#2f5d4a', material: 'painted' },
});
const [w, h, d] = item.visual.size;
/** The experiment's initial conditions (the draft definition). */
const FIXED = { resistance1: 10, resistance2: 20, switchTime: 0.5, duration: 3 };
const DEFAULTS = {
  ...FIXED,
  voltage: 12,
  configuration: 1,
  ammeterResolution: 0.01,
};
const NO_RUN = Object.fromEntries(powerModel.variables.map((v) => [v, NaN]));

/** The model's sample `t` s into a run of these settings (K closes at 0.5 s, the end at 3 s). */
function sampleAt(parameters: Record<string, number>, t: number): Record<string, number> {
  const state = new Float64Array(powerModel.variables.length);
  powerModel.init(parameters, state);
  let clock = 0;
  while (clock < t - 1e-9) clock += powerModel.step(state, Math.min(0.01, t - clock), parameters);
  return Object.fromEntries(powerModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const pose = (
  status: SessionState,
  parameters: Record<string, number>,
  sample: Record<string, number>,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = powerBoard.frame(item, painted);
  const rig = powerBoard.rig!(item);
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
  for (let k = 0; k < Math.floor(readout.count / 8); k++) {
    let mask = 0;
    for (let s = 0; s < 7; s++) if (lit(k * 8 + s)) mask |= 1 << s;
    text += mask === 0 ? ' ' : mask === 64 ? '-' : String(GLYPHS.indexOf(mask as never));
    if (lit(k * 8 + 7)) text += '.';
  }
  return text;
}

describe('power board bench model', () => {
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
    expect(meshes(rig.group)).toBe(8); // blade, handle, needle, 2 readouts, 3 link sets
  });

  it('shows the idle setup from the dials without a run: open switch, meters at 0', () => {
    const { rig, named, instanced } = build();
    rig.pose(pose('configured', DEFAULTS, NO_RUN), 1 / 60);
    expect(named('switch').rotation.x).toBeCloseTo(-SWITCH.open, 12);
    expect(named('needle').rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep / 2, 12);
    expect(shown(instanced('ammeter-readout'))).toBe(' 0.00');
    expect(shown(instanced('supply-readout'))).toBe('12.0');
    expect([0, 1, 2].map((c) => named(`links-${c}`).visible)).toEqual([false, true, false]);
  });

  it('closes the switch with the run and follows the model’s U and I', () => {
    const { rig, named, instanced } = build();
    const lever = named('switch');
    const needle = named('needle');
    const ammeter = instanced('ammeter-readout');
    // Before K closes (0.3 s): open, both meters at 0.
    rig.pose(pose('running', DEFAULTS, sampleAt(DEFAULTS, 0.3)), 1 / 60);
    expect(lever.rotation.x).toBeCloseTo(-SWITCH.open, 12);
    expect(needle.rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep / 2, 12);
    expect(shown(ammeter)).toBe(' 0.00');
    // Series 10 + 20 Ω at 12 V, K closed: 0.4 A.
    const closed = sampleAt(DEFAULTS, 2);
    expect(closed.current).toBeCloseTo(0.4, 12);
    rig.pose(pose('running', DEFAULTS, closed), 1 / 60);
    expect(lever.rotation.x).toBe(0);
    expect(needle.rotation.z).toBeCloseTo(VOLTMETER_SCALE.sweep * (0.5 - 12 / 15), 12);
    expect(shown(ammeter)).toBe(' 0.40');
    // Parallel at 12 V: 1.8 A.
    const parallel = { ...DEFAULTS, configuration: 2 };
    const full = sampleAt(parallel, 3);
    rig.pose(pose('completed', parallel, full), 1 / 60);
    expect([0, 1, 2].map((c) => named(`links-${c}`).visible)).toEqual([false, false, true]);
    // The ammeter's: 1.8 A read to 0.001, 0.01 and 0.1 A.
    for (const [dI, text] of [
      [0.001, '1.800'],
      [0.01, ' 1.80'],
      [0.1, '  1.8'],
    ] as const) {
      rig.pose(pose('completed', { ...parallel, ammeterResolution: dI }, full), 1 / 60);
      expect(shown(ammeter)).toBe(text);
    }
    // R1 alone at 3 V: 0.3 A, one link (b to B).
    const single = { ...DEFAULTS, voltage: 3, configuration: 0 };
    rig.pose(pose('completed', single, sampleAt(single, 3)), 1 / 60);
    expect(shown(ammeter)).toBe(' 0.30');
    expect(shown(instanced('supply-readout'))).toBe(' 3.0');
    expect([0, 1, 2].map((c) => named(`links-${c}`).visible)).toEqual([true, false, false]);
    // RESET: the switch opens, the meters go to 0.
    rig.pose(pose('configured', single, NO_RUN), 1 / 60);
    expect(lever.rotation.x).toBeCloseTo(-SWITCH.open, 12);
    expect(shown(ammeter)).toBe(' 0.00');
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

  it('reads only variables the power model outputs', () => {
    expect(powerBoard.reads!.filter((v) => !powerModel.variables.includes(v))).toEqual([]);
  });

  it('poses by assignment: the same objects and buffers, unchanged input changes nothing', () => {
    const { rig, root, instanced } = build();
    const lcd = instanced('ammeter-readout');
    const led = instanced('supply-readout');
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
    const run = sampleAt(DEFAULTS, 2);
    for (let i = 0; i <= 100; i++) {
      const parameters = { ...DEFAULTS, configuration: i % 3, voltage: [3, 6, 9, 12][i % 4]! };
      rig.pose(pose(i % 2 ? 'running' : 'stopped', parameters, i % 5 ? run : NO_RUN), 1 / 60);
    }
    rig.pose(pose('running', DEFAULTS, run), 1 / 60);
    expect(count()).toEqual(before);
    const versions = () => [lcd.instanceMatrix.version, led.instanceMatrix.version];
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
