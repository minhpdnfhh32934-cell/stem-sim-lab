import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Two circuit boards with moving-coil meters: the RC board (a battery pack, a two-way switch, a
// resistor and an electrolytic capacitor) and the cell board (a cell in its holder, a switch, a
// rheostat). Each has a voltmeter and an ammeter whose needles turn with the run's `voltage` and
// `current` (zero-centre ammeter on the RC board: its current reverses), and its switch's lever.

const BASE = 0.02;
const METER = { radius: 0.05, y: 0.11, sweep: (100 * Math.PI) / 180 };

interface Board {
  /** Full scale of the voltmeter (V) and the ammeter (A); a zero-centre ammeter reads ±full scale. */
  readonly volts: number;
  readonly amps: number;
  readonly centreZero: boolean;
  /** The model variable that turns the switch's lever (−1 … 1 or 0 … 1). */
  readonly lever: string;
  /** Builds the board's own components, in the frame. */
  readonly parts: (kit: Assembly, y0: number, painted: THREE.MeshStandardMaterial) => void;
}

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A meter's face on its case, at x, on the board's back half. */
function meterFace(kit: Assembly, x: number, y0: number, letter: 'V' | 'A') {
  const { keep, own, mesh } = kit;
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const white = own(
    new THREE.MeshStandardMaterial({
      color: letter === 'V' ? '#f4f5f2' : '#f6f1e0',
      ...LOOKS.matte,
    }),
  );
  mesh(keep(new THREE.BoxGeometry(0.13, 0.13, 0.05)), dark).position.set(x, y0 + METER.y, -0.08);
  const face = mesh(keep(new THREE.CircleGeometry(METER.radius, 32)), white);
  face.position.set(x, y0 + METER.y, -0.054);
  face.castShadow = false;
}

function makeFrame(board: Board) {
  return (item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame => {
    const [w, h, d] = item.visual.size;
    const kit = new Assembly();
    const body = kit.keep(slab(w, d, BASE, 0.01, 0.002));
    body.translate(0, -h / 2, 0);
    const y0 = -h / 2 + BASE;
    meterFace(kit, -0.16, y0, 'V');
    meterFace(kit, 0.0, y0, 'A');
    board.parts(kit, y0, painted);
    return { body, parts: kit.group, dispose: () => kit.dispose() };
  };
}

function makeRig(board: Board) {
  return (item: ItemDefinition): BenchRig => {
    const kit = new Assembly();
    const { keep, own, mesh } = kit;
    kit.group.position.copy(topOf(item));
    const y0 = BASE;
    const red = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.painted }));
    const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
    const needle = (x: number, name: string) => {
      const n = mesh(
        keep(
          new THREE.BoxGeometry(0.0015, METER.radius * 0.85, 0.001).translate(
            0,
            METER.radius * 0.4,
            0,
          ),
        ),
        red,
      );
      n.name = name;
      n.position.set(x, y0 + METER.y - METER.radius * 0.45, -0.052);
      n.castShadow = false;
      return n;
    };
    const volt = needle(-0.16, 'voltmeter');
    const amp = needle(0, 'ammeter');
    const lever = mesh(
      keep(new THREE.BoxGeometry(0.006, 0.05, 0.006).translate(0, 0.025, 0)),
      steel,
    );
    lever.name = 'lever';
    lever.position.set(0.16, y0 + 0.02, 0.06);

    let u = NaN;
    let i = NaN;
    let s = NaN;
    const pose = ({ sample }: BenchPose) => {
      const nu = Number.isFinite(sample.voltage) ? (sample.voltage ?? 0) : 0;
      const ni = Number.isFinite(sample.current) ? (sample.current ?? 0) : 0;
      const ns = Number.isFinite(sample[board.lever]) ? (sample[board.lever] ?? 0) : 0;
      if (nu !== u) {
        u = nu;
        const share = Math.min(Math.max(u / board.volts, 0), 1);
        volt.rotation.z = METER.sweep / 2 - share * METER.sweep; // 0 at the left end of the scale
      }
      if (ni !== i) {
        i = ni;
        const share = board.centreZero
          ? Math.min(Math.max(i / board.amps, -1), 1) / 2 + 0.5
          : Math.min(Math.max(i / board.amps, 0), 1);
        amp.rotation.z = METER.sweep / 2 - share * METER.sweep;
      }
      if (ns !== s) {
        s = ns;
        lever.rotation.z = -0.5 * s; // thrown towards the position it is in
      }
    };
    return { group: kit.group, pose, dispose: () => kit.dispose() };
  };
}

/** The RC board: battery pack, two-way switch, resistor, capacitor. */
const RC: Board = {
  volts: 10,
  amps: 0.01,
  centreZero: true,
  lever: 'switchPosition',
  parts: (kit, y0, painted) => {
    const { keep, own, mesh } = kit;
    const brown = own(new THREE.MeshStandardMaterial({ color: '#c9a36a', ...LOOKS.matte }));
    const blue = own(new THREE.MeshStandardMaterial({ color: '#2f5fa0', ...LOOKS.satin }));
    mesh(keep(new THREE.BoxGeometry(0.1, 0.03, 0.06)), painted).position.set(
      -0.17,
      y0 + 0.015,
      0.08,
    );
    mesh(
      keep(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 12).rotateZ(Math.PI / 2)),
      brown,
    ).position.set(-0.04, y0 + 0.012, 0.08);
    const can = mesh(keep(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 20)), blue);
    can.name = 'capacitor';
    can.position.set(0.06, y0 + 0.025, 0.08);
    mesh(keep(new THREE.BoxGeometry(0.05, 0.012, 0.03)), painted).position.set(
      0.16,
      y0 + 0.006,
      0.06,
    );
  },
};

/** The cell board: a cell in its holder, a switch, a rheostat. */
const CELL: Board = {
  volts: 3,
  amps: 1,
  centreZero: false,
  lever: 'switch',
  parts: (kit, y0, painted) => {
    const { keep, own, mesh } = kit;
    const cell = own(new THREE.MeshStandardMaterial({ color: '#1d3a5c', ...LOOKS.satin }));
    const copper = own(new THREE.MeshStandardMaterial({ color: '#b87333', ...LOOKS.metal }));
    mesh(keep(new THREE.BoxGeometry(0.08, 0.02, 0.03)), painted).position.set(
      -0.17,
      y0 + 0.01,
      0.08,
    );
    mesh(
      keep(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 14).rotateZ(Math.PI / 2)),
      cell,
    ).position.set(-0.17, y0 + 0.027, 0.08);
    // The rheostat: a coil on a ceramic tube between two end blocks.
    mesh(
      keep(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 20).rotateZ(Math.PI / 2)),
      copper,
    ).position.set(-0.01, y0 + 0.03, 0.08);
    for (const s of [-1, 1]) {
      mesh(keep(new THREE.BoxGeometry(0.015, 0.05, 0.04)), painted).position.set(
        -0.01 + s * 0.077,
        y0 + 0.025,
        0.08,
      );
    }
    mesh(keep(new THREE.BoxGeometry(0.05, 0.012, 0.03)), painted).position.set(
      0.16,
      y0 + 0.006,
      0.06,
    );
  },
};

export const rcBoard: BenchModel = {
  frame: makeFrame(RC),
  rig: makeRig(RC),
  reads: ['voltage', 'current', 'switchPosition'],
  fullScale: { voltage: 10, current: 0.01 },
};

export const cellBoard: BenchModel = {
  frame: makeFrame(CELL),
  rig: makeRig(CELL),
  reads: ['voltage', 'current', 'switch'],
  fullScale: { voltage: 3, current: 1 },
};
