import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Grade 12 magnetism. The current balance: a U-magnet on an electronic balance, a straight wire
// held across its gap from a stand, a power supply with its ammeter; the rig turns the magnet to
// the dialled angle and moves the ammeter's needle with the run's `current`. The induction coil: a
// coil on a track, a bar magnet riding along the coil's axis and a centre-zero galvanometer; the rig
// is the magnet at the run's `magnetPosition` (1:1), turned by the `polarity`, and the needle with
// its `current`.

const BASE = 0.02;
const METER = { radius: 0.045, sweep: (100 * Math.PI) / 180 };

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function base(item: ItemDefinition) {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const body = kit.keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  return { kit, body, y0: -h / 2 + BASE };
}

/** A meter's case and face at (x, y) facing +z, on its back at z. */
function meter(kit: Assembly, x: number, y: number, z: number) {
  const { keep, own, mesh } = kit;
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f5f2', ...LOOKS.matte }));
  mesh(keep(new THREE.BoxGeometry(0.12, 0.12, 0.05)), dark).position.set(x, y, z);
  const face = mesh(keep(new THREE.CircleGeometry(METER.radius, 28)), white);
  face.position.set(x, y, z + 0.026);
  face.castShadow = false;
}

/** A meter's needle (in the rig) at (x, y, z); returns its pose by share of the scale (0–1). */
function needle(kit: Assembly, x: number, y: number, z: number) {
  const red = kit.own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.painted }));
  const n = kit.mesh(
    kit.keep(
      new THREE.BoxGeometry(0.0015, METER.radius * 0.85, 0.001).translate(0, METER.radius * 0.4, 0),
    ),
    red,
  );
  n.name = 'needle';
  n.castShadow = false;
  n.position.set(x, y - METER.radius * 0.45, z);
  return (share: number) => {
    n.rotation.z = METER.sweep / 2 - Math.min(Math.max(share, 0), 1) * METER.sweep;
  };
}

// ---------------------------------------------------------------------------------------------

const PAN = { x: -0.06, top: 0.05 };
const MAGNET = { gap: 0.03, pole: 0.06, height: 0.07 };
const SUPPLY = { x: 0.16, y: 0.1, z: 0 };

function balanceFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body, y0 } = base(item);
  const { keep, own, mesh } = kit;
  const grey = own(new THREE.MeshStandardMaterial({ color: '#d7dbdf', ...LOOKS.plastic }));
  const screen = own(
    new THREE.MeshStandardMaterial({
      color: '#1f3b2c',
      emissive: '#3fae6a',
      emissiveIntensity: 0.6,
    }),
  );
  const copper = own(new THREE.MeshStandardMaterial({ color: '#b87333', ...LOOKS.metal }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  // The balance and its display.
  mesh(keep(new THREE.BoxGeometry(0.2, PAN.top, 0.2)), grey).position.set(
    PAN.x,
    y0 + PAN.top / 2,
    0,
  );
  mesh(keep(new THREE.BoxGeometry(0.08, 0.02, 0.002)), screen).position.set(
    PAN.x,
    y0 + PAN.top * 0.55,
    0.101,
  );
  // The stand (the item's colour) and the wire across the gap at the poles' middle height.
  mesh(keep(new THREE.BoxGeometry(0.02, 0.26, 0.02)), painted).position.set(
    PAN.x,
    y0 + 0.13,
    -0.12,
  );
  mesh(keep(new THREE.BoxGeometry(0.012, 0.012, 0.13)), steel).position.set(
    PAN.x,
    y0 + 0.25,
    -0.06,
  );
  for (const s of [-1, 1]) {
    mesh(keep(new THREE.CylinderGeometry(0.0015, 0.0015, 0.16, 6)), copper).position.set(
      PAN.x + s * 0.025,
      y0 + 0.17,
      0,
    );
  }
  mesh(
    keep(new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 6).rotateZ(Math.PI / 2)),
    copper,
  ).position.set(PAN.x, y0 + PAN.top + 0.012 + MAGNET.height / 2, 0);
  // The supply and its ammeter.
  mesh(keep(new THREE.BoxGeometry(0.16, 0.08, 0.12)), grey).position.set(
    SUPPLY.x,
    y0 + 0.04,
    -0.04,
  );
  meter(kit, SUPPLY.x, y0 + SUPPLY.y + 0.04, -0.06);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function balanceRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const north = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.painted }));
  const south = own(new THREE.MeshStandardMaterial({ color: '#2f5fa0', ...LOOKS.painted }));
  const iron = own(new THREE.MeshStandardMaterial({ color: '#4a4f57', ...LOOKS.metal }));
  // The U-magnet on the pan, turned about the vertical so the field makes the dialled angle α
  // with the wire (the wire runs along x; at α = 90° the field runs along z).
  const magnet = new THREE.Group();
  magnet.name = 'magnet';
  magnet.position.set(PAN.x, BASE + PAN.top, 0);
  kit.group.add(magnet);
  mesh(keep(new THREE.BoxGeometry(0.03, 0.012, MAGNET.gap + 2 * 0.012)), iron, magnet).position.y =
    0.006;
  for (const [s, m] of [
    [-1, south],
    [1, north],
  ] as const) {
    mesh(keep(new THREE.BoxGeometry(0.03, MAGNET.height, 0.012)), m, magnet).position.set(
      0,
      0.012 + MAGNET.height / 2,
      s * (MAGNET.gap / 2 + 0.006),
    );
  }
  const ammeter = needle(kit, SUPPLY.x, BASE + SUPPLY.y + 0.04, -0.06 + 0.027);
  let i = NaN;
  let a = NaN;
  const pose = ({ sample, parameters }: BenchPose) => {
    const ni = Number.isFinite(sample.current) ? (sample.current ?? 0) : 0;
    const na = Number.isFinite(parameters.angle) ? (parameters.angle ?? 90) : 90;
    if (ni !== i) {
      i = ni;
      ammeter(i / 5);
    }
    if (na !== a) {
      a = na;
      magnet.rotation.y = ((90 - a) * Math.PI) / 180;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** The magnetic force station: a current balance. */
export const currentBalance: BenchModel = {
  frame: balanceFrame,
  rig: balanceRig,
  reads: ['current'],
  fullScale: { current: 5 },
};

// ---------------------------------------------------------------------------------------------

const COIL = { radius: 0.03, length: 0.05, y: 0.06 };
const GALVANOMETER = { x: 0.2, y: 0.08, z: -0.09, full: 0.025 };

function coilFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const { kit, body, y0 } = base(item);
  const { keep, own, mesh } = kit;
  const copper = own(new THREE.MeshStandardMaterial({ color: '#b87333', ...LOOKS.metal }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  // The track along x (the item's colour) and the coil on its axis, a former and the winding.
  mesh(keep(new THREE.BoxGeometry(0.58, 0.012, 0.04)), painted).position.set(0, y0 + 0.006, 0);
  const winding = mesh(
    keep(
      new THREE.CylinderGeometry(COIL.radius, COIL.radius, COIL.length, 28, 1, true).rotateZ(
        Math.PI / 2,
      ),
    ),
    copper,
  );
  winding.name = 'coil';
  winding.position.set(0, y0 + COIL.y, 0);
  for (const s of [-1, 1]) {
    mesh(
      keep(
        new THREE.CylinderGeometry(COIL.radius + 0.008, COIL.radius + 0.008, 0.004, 28).rotateZ(
          Math.PI / 2,
        ),
      ),
      plastic,
    ).position.set((s * COIL.length) / 2, y0 + COIL.y, 0);
  }
  mesh(keep(new THREE.BoxGeometry(0.04, COIL.y - COIL.radius, 0.04)), plastic).position.set(
    0,
    y0 + (COIL.y - COIL.radius) / 2,
    0,
  );
  meter(kit, GALVANOMETER.x, y0 + GALVANOMETER.y, GALVANOMETER.z);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function coilRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const north = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.painted }));
  const south = own(new THREE.MeshStandardMaterial({ color: '#2f5fa0', ...LOOKS.painted }));
  // The bar magnet, its north half towards +x: it moves +x, so polarity 1 has it lead.
  const magnet = new THREE.Group();
  magnet.name = 'magnet';
  kit.group.add(magnet);
  for (const [s, m] of [
    [1, north],
    [-1, south],
  ] as const) {
    mesh(keep(new THREE.BoxGeometry(0.04, 0.015, 0.015)), m, magnet).position.x = s * 0.02;
  }
  const galvanometer = needle(kit, GALVANOMETER.x, BASE + GALVANOMETER.y, GALVANOMETER.z + 0.027);
  let z = NaN;
  let i = NaN;
  let pole = NaN;
  const pose = ({ sample, parameters }: BenchPose) => {
    const nz = Number.isFinite(sample.magnetPosition) ? (sample.magnetPosition ?? 0) : -0.25;
    const ni = Number.isFinite(sample.current) ? (sample.current ?? 0) : 0;
    const np = parameters.polarity === -1 ? -1 : 1;
    if (nz !== z) {
      z = nz;
      magnet.position.set(z, BASE + COIL.y, 0);
    }
    if (np !== pole) {
      pole = np;
      magnet.rotation.y = np === 1 ? 0 : Math.PI;
    }
    if (ni !== i) {
      i = ni;
      galvanometer(0.5 + i / (2 * GALVANOMETER.full)); // zero at the centre
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** Electromagnetic induction: a magnet through a coil on a track, a galvanometer. */
export const inductionCoil: BenchModel = {
  frame: coilFrame,
  rig: coilRig,
  reads: ['magnetPosition', 'current'],
  fullScale: { magnetPosition: 0.25, current: 0.025 },
};
