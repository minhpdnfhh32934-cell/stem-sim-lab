import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// A bubble potometer (transpiration): on a base board, a clamp stand holding a water-filled glass
// tube sealed with a bung, a leafy shoot standing in it; from the tube's foot a horizontal
// capillary runs right along a white scale 0.3 m long; a desk lamp behind the shoot and a small fan
// in front of it. The rig is what the run changes: the air bubble in the capillary, moving towards
// the shoot by the run's `distance`; the lamp's glow with `parameters.illuminance`; the fan's
// blades turning with `parameters.airSpeed` (still at its lowest, 0.1 m/s: the fan is off).

const BASE = 0.02;
/** The capillary: its height above the base, its scale's zero (x) and length; the tube's x. */
const CAPILLARY = { y: 0.09, zero: 0.36, length: 0.3, radius: 0.004 };
const TUBE = { x: -0.22, radius: 0.018, height: 0.24 };
const SHOOT = { height: 0.32 };
const LAMP = { x: -0.22, z: -0.12, height: 0.7 }; // its head above the shoot's top, behind it
const FAN = { x: -0.02, z: 0.1, y: 0.2, radius: 0.07 };
const STILL_AIR = 0.1;

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base, the stand, the tube and shoot, the capillary and its scale, the lamp's stand, the fan's. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#9fd0e6', ...LOOKS.glass, opacity: 0.5 }),
  );
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#2b2e32', ...LOOKS.rubber }));
  const stem = own(new THREE.MeshStandardMaterial({ color: '#6d8a3a', ...LOOKS.matte }));
  const leafy = own(
    new THREE.MeshStandardMaterial({ color: '#4f8a4b', ...LOOKS.matte, side: THREE.DoubleSide }),
  );
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  // The stand (in the item's colour: focus shows on it) and its clamp round the tube.
  mesh(keep(new THREE.CylinderGeometry(0.007, 0.007, 0.42, 12)), painted).position.set(
    TUBE.x - 0.07,
    y0 + 0.21,
    -0.04,
  );
  mesh(keep(new THREE.BoxGeometry(0.08, 0.015, 0.015)), steel).position.set(
    TUBE.x - 0.035,
    y0 + 0.2,
    -0.02,
  );
  // The tube full of water, its bung, the shoot's stem and leaves.
  const tubeY = y0 + CAPILLARY.y;
  const tube = mesh(
    keep(new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.height, 20, 1, true)),
    glass,
  );
  tube.name = 'glass'; // clear glassware: a sheen pass on High (quality.ts)
  tube.position.set(TUBE.x, tubeY + TUBE.height / 2, 0);
  mesh(
    keep(
      new THREE.CylinderGeometry(TUBE.radius - 0.002, TUBE.radius - 0.002, TUBE.height - 0.01, 16),
    ),
    water,
  ).position.set(TUBE.x, tubeY + TUBE.height / 2, 0);
  mesh(
    keep(new THREE.CylinderGeometry(TUBE.radius + 0.002, TUBE.radius - 0.002, 0.03, 16)),
    rubber,
  ).position.set(TUBE.x, tubeY + TUBE.height + 0.015, 0);
  const stemFrom = tubeY + TUBE.height - 0.05;
  mesh(keep(new THREE.CylinderGeometry(0.004, 0.005, SHOOT.height, 8)), stem).position.set(
    TUBE.x,
    stemFrom + SHOOT.height / 2,
    0,
  );
  const leaf = keep(new THREE.CircleGeometry(0.05, 12).scale(0.45, 1, 1));
  const leaves: THREE.Matrix4[] = [];
  for (let i = 0; i < 9; i++) {
    const y = stemFrom + 0.12 + i * 0.024;
    const turn = i * 2.4;
    const m = at(
      TUBE.x + 0.045 * Math.cos(turn),
      y,
      0.045 * Math.sin(turn),
      -0.9,
      -turn + Math.PI / 2,
      0,
    );
    leaves.push(m);
  }
  copies(leaf, leafy, leaves);
  // The capillary from the tube's foot to the right, on its scale.
  const x0 = TUBE.x;
  const x1 = CAPILLARY.zero + 0.02;
  const capillary = mesh(
    keep(
      new THREE.CylinderGeometry(CAPILLARY.radius, CAPILLARY.radius, x1 - x0, 12).rotateZ(
        Math.PI / 2,
      ),
    ),
    glass,
  );
  capillary.name = 'capillary';
  capillary.position.set((x0 + x1) / 2, tubeY, 0);
  const scaleW = CAPILLARY.length + 0.02;
  mesh(keep(new THREE.BoxGeometry(scaleW, 0.004, 0.04)), white).position.set(
    CAPILLARY.zero - CAPILLARY.length / 2,
    tubeY - CAPILLARY.radius - 0.002,
    0.02,
  );
  const ticks: THREE.Matrix4[] = [];
  for (let cm = 0; cm <= 30; cm++) {
    const long = cm % 5 === 0;
    const m = at(
      CAPILLARY.zero - cm / 100,
      tubeY - CAPILLARY.radius + 0.0005,
      0.02 + (long ? 0.006 : 0.011),
    );
    m.scale(new THREE.Vector3(1, 1, long ? 1 : 0.5));
    ticks.push(m);
  }
  copies(keep(new THREE.BoxGeometry(0.0012, 0.001, 0.024)), ink, ticks).castShadow = false;
  // The lamp's stand and arm (its head is the rig's), the fan's stand and guard ring.
  mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, LAMP.height, 10)), dark).position.set(
    LAMP.x + 0.18,
    y0 + LAMP.height / 2,
    LAMP.z,
  );
  mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20)), dark).position.set(
    LAMP.x + 0.18,
    y0 + 0.006,
    LAMP.z,
  );
  mesh(keep(new THREE.BoxGeometry(0.18, 0.01, 0.01)), dark).position.set(
    LAMP.x + 0.09,
    y0 + LAMP.height,
    LAMP.z,
  );
  mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, FAN.y, 10)), dark).position.set(
    FAN.x,
    y0 + FAN.y / 2,
    FAN.z,
  );
  mesh(
    keep(new THREE.TorusGeometry(FAN.radius, 0.004, 6, 32).rotateY(Math.PI / 2 - 0.6)),
    dark,
  ).position.set(FAN.x, y0 + FAN.y, FAN.z);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The bubble, the lamp's head and the fan's blades, posed from the station. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const air = own(new THREE.MeshStandardMaterial({ color: '#f4f7f9', ...LOOKS.satin }));
  const shade = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const off = own(new THREE.MeshStandardMaterial({ color: '#d8d4c8', ...LOOKS.satin }));
  const on = own(
    new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff1c4', emissiveIntensity: 1 }),
  );
  const blade = own(
    new THREE.MeshStandardMaterial({ color: '#7fa7c9', ...LOOKS.plastic, side: THREE.DoubleSide }),
  );
  const bubble = mesh(
    keep(new THREE.CapsuleGeometry(CAPILLARY.radius * 0.8, 0.008, 4, 10).rotateZ(Math.PI / 2)),
    air,
  );
  bubble.name = 'bubble';
  bubble.castShadow = false;
  const head = mesh(keep(new THREE.ConeGeometry(0.06, 0.08, 20, 1, true).rotateZ(Math.PI)), shade);
  head.position.set(LAMP.x, y0 + LAMP.height - 0.04, LAMP.z);
  const bulb = mesh(keep(new THREE.SphereGeometry(0.03, 16, 10)), off);
  bulb.name = 'bulb';
  swaps(bulb, on);
  bulb.position.set(LAMP.x, y0 + LAMP.height - 0.075, LAMP.z);
  bulb.castShadow = false;
  const fan = new THREE.Group();
  fan.name = 'fan';
  fan.position.set(FAN.x, y0 + FAN.y, FAN.z);
  fan.rotation.y = Math.PI / 2 - 0.6; // facing the shoot
  kit.group.add(fan);
  const blades = new THREE.Group();
  fan.add(blades);
  for (let i = 0; i < 4; i++) {
    const b = mesh(
      keep(new THREE.CircleGeometry(0.03, 10).scale(1, 0.45, 1).translate(0.035, 0, 0)),
      blade,
      blades,
    );
    b.rotation.z = (i * Math.PI) / 2;
    b.castShadow = false;
  }

  let x = NaN;
  let light = NaN;
  const pose = ({ parameters, sample }: BenchPose, dt: number) => {
    const next = Number.isFinite(sample.distance) ? (sample.distance ?? 0) : 0;
    if (next !== x) {
      x = next;
      bubble.position.set(CAPILLARY.zero - Math.min(next, CAPILLARY.length), y0 + CAPILLARY.y, 0);
    }
    const lux = parameters.illuminance ?? 0;
    if (lux !== light) {
      light = lux;
      bulb.material = lux > 0 ? on : off;
      on.emissiveIntensity = Math.min(1, lux / 20000) * 1.5;
    }
    const u = parameters.airSpeed ?? STILL_AIR;
    if (u > STILL_AIR) blades.rotation.z += dt * 6 * u;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const potometer: BenchModel = {
  frame,
  rig,
  reads: ['distance'],
  fullScale: { distance: 0.3 },
};
