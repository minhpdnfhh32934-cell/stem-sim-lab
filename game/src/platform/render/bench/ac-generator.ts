import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The AC generator (model `physics.ac-generator`, Phase X): a rectangular coil on a vertical axle
// between the poles of two magnets (N red on the left, S blue on the right, the field from N to S
// drawn as faint lines), turned at the run's `angle`; slip rings and brushes take its emf to a
// centre-zero voltmeter whose needle swings with the run's `emf`, and to a bulb that glows
// brightest twice a turn. At 0° the coil's face is square to the field (flux greatest, emf zero).

const BASE = 0.03;
const AXLE_Y = BASE + 0.2;
const COIL_W = 0.14;
const COIL_H = 0.12;
const WIRE = 0.008;
const POLE_X = 0.13;
const METER_SWING = (50 * Math.PI) / 180;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const red = own(new THREE.MeshStandardMaterial({ color: '#c8382f', ...LOOKS.satin }));
  const blue = own(new THREE.MeshStandardMaterial({ color: '#2f5fc8', ...LOOKS.satin }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#9aa3ad', ...LOOKS.satin }));
  const copper = own(new THREE.MeshStandardMaterial({ color: '#c47a3a', ...LOOKS.satin }));
  const pole = keep(new THREE.BoxGeometry(0.06, 0.16, 0.12));
  const north = mesh(pole, red);
  north.name = 'magnet-north';
  north.position.set(-POLE_X - 0.03, AXLE_Y, 0);
  const south = mesh(pole, blue);
  south.name = 'magnet-south';
  south.position.set(POLE_X + 0.03, AXLE_Y, 0);
  // The field: faint lines from N to S.
  const line = keep(new THREE.CylinderGeometry(0.0012, 0.0012, POLE_X * 2, 6).rotateZ(Math.PI / 2));
  const faint = own(
    new THREE.MeshBasicMaterial({ color: '#8fb3ff', transparent: true, opacity: 0.45 }),
  );
  for (const [y, z] of [
    [-0.05, -0.04],
    [0, -0.04],
    [0.05, -0.04],
    [-0.05, 0.04],
    [0.05, 0.04],
  ] as const) {
    const l = mesh(line, faint);
    l.position.set(0, AXLE_Y + y, z);
    l.castShadow = false;
  }
  // The axle's bearing post, the slip rings below the coil and their brushes.
  mesh(keep(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 20)), painted).position.set(
    0,
    BASE + 0.015,
    0,
  );
  const rings = keep(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 20));
  for (const y of [BASE + 0.07, BASE + 0.095]) {
    const r = mesh(rings, copper);
    r.position.set(0, y, 0);
    r.name = y < BASE + 0.08 ? 'slip-rings' : '';
  }
  for (const y of [BASE + 0.07, BASE + 0.095])
    mesh(keep(new THREE.BoxGeometry(0.03, 0.006, 0.01)), steel).position.set(0.03, y, 0);
  // The voltmeter (centre zero) and the bulb's holder.
  const meter = mesh(
    keep(new THREE.BoxGeometry(0.1, 0.08, 0.02)),
    own(new THREE.MeshStandardMaterial({ color: '#f2efe6', ...LOOKS.satin })),
  );
  meter.name = 'voltmeter';
  meter.position.set(-0.15, BASE + 0.05, 0.11);
  mesh(keep(new THREE.CylinderGeometry(0.014, 0.016, 0.03, 16)), painted).position.set(
    0.17,
    BASE + 0.015,
    0.1,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const copper = own(new THREE.MeshStandardMaterial({ color: '#c47a3a', ...LOOKS.satin }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b8bec6', ...LOOKS.satin }));
  const coil = new THREE.Group();
  coil.name = 'coil';
  coil.position.set(0, AXLE_Y, 0);
  kit.group.add(coil);
  // The loop in the y–z plane at 0° (its face towards the field, ±x).
  const side = keep(new THREE.BoxGeometry(WIRE, COIL_H, WIRE));
  const top = keep(new THREE.BoxGeometry(WIRE, WIRE, COIL_W));
  for (const z of [-COIL_W / 2, COIL_W / 2]) mesh(side, copper, coil).position.set(0, 0, z);
  for (const y of [-COIL_H / 2, COIL_H / 2]) mesh(top, copper, coil).position.set(0, y, 0);
  const axle = mesh(
    keep(new THREE.CylinderGeometry(0.004, 0.004, AXLE_Y - BASE - 0.02, 10)),
    steel,
  );
  axle.position.set(0, BASE + 0.02 + (AXLE_Y - BASE - 0.02) / 2, 0);
  const needle = mesh(
    keep(new THREE.BoxGeometry(0.002, 0.05, 0.002).translate(0, 0.025, 0)),
    own(new THREE.MeshBasicMaterial({ color: '#1b1b1b' })),
  );
  needle.name = 'needle';
  needle.position.set(-0.15, BASE + 0.02, 0.122);
  const glow = new THREE.MeshStandardMaterial({
    color: '#fff4c2',
    emissive: '#ffd25a',
    emissiveIntensity: 0,
    ...LOOKS.glass,
    opacity: 0.85,
  });
  own(glow);
  const bulb = mesh(keep(new THREE.SphereGeometry(0.024, 18, 12)), glow);
  bulb.name = 'bulb';
  bulb.position.set(0.17, BASE + 0.052, 0.1);
  bulb.castShadow = false;

  const pose = ({ parameters, sample }: BenchPose) => {
    const deg = Number.isFinite(sample.angle) ? (sample.angle ?? 0) : 0;
    coil.rotation.y = (deg * Math.PI) / 180;
    const emf = Number.isFinite(sample.emf) ? (sample.emf ?? 0) : 0;
    // The meter's range: the coming peak NBAω, from the desk's settings.
    const peak =
      (parameters.turns ?? 1) *
      (parameters.field ?? 1) *
      (parameters.area ?? 0.01) *
      2 *
      Math.PI *
      (parameters.frequency ?? 1);
    const share = peak > 0 ? Math.max(-1, Math.min(1, emf / peak)) : 0;
    needle.rotation.z = -share * METER_SWING;
    glow.emissiveIntensity = 2.5 * share * share; // power ∝ ε²
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const acGenerator: BenchModel = {
  frame,
  rig,
  reads: ['angle', 'emf'],
  fullScale: { angle: 90, emf: 0 },
};
