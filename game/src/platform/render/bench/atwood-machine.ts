import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The Atwood machine: a heavy base on the bench, a steel pole up its back, an arm out over the base
// carrying a light pulley at the top; over it a string with a mass either side, the extra mass on
// the right; under the right mass a soft pad and, 5 cm above it, a light gate; an electromagnet on a
// slide holding the right mass at the height set at the desk; a scale up the pole; the digital
// timer on the base. The masses, the string, the pulley's turn, the magnet's height and the gate's
// lamp are the rig, posed from the station: the masses at `parameters.mass` and `extraMass`, the
// start at `dropHeight`, the fall by the run's `fall`.

const BASE = { width: 0.4, depth: 0.3, height: 0.025 };
/** The pulley's axle above the base (m), its radius: the two strings 2r apart. */
const PULLEY = { y: 1.95, radius: 0.06 };
const POLE = { z: -0.11, radius: 0.012 };
/** The pad under the right mass, its top above the base; the gate above it. */
const PAD = { height: 0.02, radius: 0.04 };
/** The gate's beam above the pad: the card's centre (1 cm above its foot) crosses it 5 cm before landing. */
const GATE_ABOVE_PAD = 0.06;
const GATE = { width: 0.11, height: 0.05, depth: 0.03 };
/** A mass: a brass cylinder's radius; its height for 100 g (it grows with the mass). */
const MASS = { radius: 0.022, per100g: 0.03 };
const TIMER = { width: 0.16, height: 0.06, depth: 0.08, x: -0.1, z: 0.09 };

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the pole and its arm, the pad, the gate, the scale, the timer. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const h = item.visual.size[1];
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const base = -h / 2;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#3c3f44', ...LOOKS.rubber }));
  const scale = own(new THREE.MeshStandardMaterial({ color: '#efe9d2', ...LOOKS.matte }));
  const screen = own(new THREE.MeshStandardMaterial({ color: '#1f3a2c', ...LOOKS.satin }));
  const body = keep(slab(BASE.width, BASE.depth, BASE.height, 0.01, 0.002));
  body.translate(0, base, 0);
  // The pole up the back and the arm out to the pulley's axle.
  const pole = PULLEY.y + 0.04 - BASE.height;
  mesh(keep(new THREE.CylinderGeometry(POLE.radius, POLE.radius, pole, 14)), steel).position.set(
    0,
    base + BASE.height + pole / 2,
    POLE.z,
  );
  mesh(keep(new THREE.BoxGeometry(0.02, 0.02, -POLE.z + 0.01)), steel).position.set(
    0,
    base + PULLEY.y + 0.035,
    POLE.z / 2,
  );
  // The pad under the right mass, and the gate astride its string 5 cm above it.
  mesh(
    keep(new THREE.CylinderGeometry(PAD.radius, PAD.radius, PAD.height, 20)),
    rubber,
  ).position.set(PULLEY.radius, base + BASE.height + PAD.height / 2, 0);
  const gateY = base + BASE.height + PAD.height + GATE_ABOVE_PAD;
  for (const s of [-1, 1]) {
    mesh(keep(new THREE.BoxGeometry(GATE.depth, GATE.height, 0.014)), dark).position.set(
      PULLEY.radius,
      gateY,
      s * (GATE.width / 2),
    );
  }
  mesh(keep(new THREE.BoxGeometry(0.014, 0.014, -POLE.z - GATE.width / 2)), dark).position.set(
    PULLEY.radius,
    gateY,
    POLE.z / 2 - GATE.width / 4,
  );
  // The scale up the pole's face.
  const strip = mesh(keep(new THREE.BoxGeometry(0.03, 1.0, 0.002)), scale);
  strip.position.set(0, base + BASE.height + PAD.height + 0.5, POLE.z + POLE.radius + 0.002);
  strip.castShadow = false;
  // The timer on the base, in front.
  mesh(keep(slab(TIMER.width, TIMER.depth, TIMER.height, 0.008, 0.002)), painted).position.set(
    TIMER.x,
    base + BASE.height,
    TIMER.z,
  );
  const face = mesh(
    keep(new THREE.BoxGeometry(TIMER.width * 0.6, TIMER.height * 0.4, 0.002)),
    screen,
  );
  face.position.set(
    TIMER.x - 0.02,
    base + BASE.height + TIMER.height * 0.6,
    TIMER.z + TIMER.depth / 2 + 0.001,
  );
  face.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The pulley, the two masses and their strings, the extra mass, the magnet, the gate's lamp. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#b8923f', ...LOOKS.metal }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#d0d5da', ...LOOKS.metal }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#b23a32', ...LOOKS.painted }));
  const card = own(new THREE.MeshStandardMaterial({ color: '#1d1f23', ...LOOKS.matte }));
  const thread = own(new THREE.MeshStandardMaterial({ color: '#f2efe6', ...LOOKS.matte }));
  const off = own(new THREE.MeshStandardMaterial({ color: '#3a2a2a', ...LOOKS.plastic }));
  const lit = own(new THREE.MeshBasicMaterial({ color: '#ff5a4a' })); // reads at any light

  const pulley = mesh(
    keep(new THREE.CylinderGeometry(PULLEY.radius, PULLEY.radius, 0.012, 32).rotateX(Math.PI / 2)),
    steel,
  );
  pulley.name = 'pulley';
  pulley.position.set(0, PULLEY.y, 0);
  // A spoke, so the pulley is seen to turn.
  mesh(keep(new THREE.BoxGeometry(PULLEY.radius * 1.8, 0.008, 0.014)), red, pulley);

  /** One side: its string down from the pulley's rim, its mass (a group whose y is its top). */
  const side = (name: string, x: number) => {
    const string = mesh(
      keep(new THREE.CylinderGeometry(0.0009, 0.0009, 1, 6).translate(0, -0.5, 0)),
      thread,
    );
    string.name = `${name}-string`;
    string.castShadow = false;
    string.position.set(x, PULLEY.y, 0);
    const body = new THREE.Group();
    body.name = name;
    kit.group.add(body);
    const cylinder = mesh(
      keep(new THREE.CylinderGeometry(MASS.radius, MASS.radius, 1, 20).translate(0, -0.5, 0)),
      brass,
      body,
    );
    body.position.x = x;
    return { string, body, cylinder };
  };
  const left = side('mass-left', -PULLEY.radius);
  const right = side('mass-right', PULLEY.radius);
  // The extra mass: a slotted disc under the right mass, and the gate's card beneath it.
  const extra = mesh(
    keep(new THREE.CylinderGeometry(MASS.radius, MASS.radius, 1, 20).translate(0, -0.5, 0)),
    red,
    right.body,
  );
  extra.name = 'extra-mass';
  const flag = mesh(
    keep(new THREE.BoxGeometry(0.003, 0.02, 0.03).translate(0, -0.01, 0)),
    card,
    right.body,
  );
  flag.castShadow = false;
  // The electromagnet on its slide, holding the right mass's top at the start.
  const magnet = mesh(keep(new THREE.BoxGeometry(0.03, 0.02, 0.03)), red);
  magnet.name = 'magnet';
  // The timer's lamp, lit while the gate's beam is blocked.
  const lamp = mesh(keep(new THREE.SphereGeometry(0.006, 10, 8)), off);
  swaps(lamp, lit);
  lamp.castShadow = false;
  lamp.position.set(
    TIMER.x + 0.055,
    BASE.height + TIMER.height * 0.5,
    TIMER.z + TIMER.depth / 2 + 0.003,
  );

  const pad = BASE.height + PAD.height;
  let sizes = '';
  let start = NaN;
  let fallen = NaN;
  let blocked = false;
  let tall = 0;
  let extraTall = 0;
  const pose = ({ parameters, sample }: BenchPose) => {
    const M = parameters.mass ?? 0.2;
    const dm = parameters.extraMass ?? 0.02;
    const key = `${M}|${dm}`;
    if (key !== sizes) {
      sizes = key;
      tall = (MASS.per100g * M) / 0.1;
      extraTall = Math.max(0.004, (MASS.per100g * dm) / 0.1);
      left.cylinder.scale.y = tall;
      right.cylinder.scale.y = tall;
      extra.scale.y = extraTall;
      extra.position.y = -tall;
      flag.position.y = -tall - extraTall;
      fallen = NaN;
    }
    const h = parameters.dropHeight ?? 0.6;
    if (h !== start) {
      start = h;
      fallen = NaN;
    }
    // Never past the pad (a pose with a larger fall than the start allows draws it landed).
    const fall = Math.min(start, Number.isFinite(sample.fall) ? (sample.fall ?? 0) : 0);
    if (fall !== fallen) {
      fallen = fall;
      // The right side's bottom (its card's foot) starts h above the pad; the left level with it.
      const rightBottom = pad + start - fall;
      const leftBottom = pad + start + fall;
      right.body.position.y = rightBottom + tall + extraTall + 0.02;
      left.body.position.y = leftBottom + tall + extraTall + 0.02;
      right.string.scale.y = PULLEY.y - right.body.position.y;
      left.string.scale.y = PULLEY.y - left.body.position.y;
      magnet.position.set(
        PULLEY.radius,
        pad + start + tall + extraTall + 0.02 + 0.012,
        POLE.z + 0.07,
      );
      pulley.rotation.z = -fall / PULLEY.radius;
    }
    const on = sample.gateBlocked === 1;
    if (on !== blocked) {
      blocked = on;
      lamp.material = on ? lit : off;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const atwoodMachine: BenchModel = {
  frame,
  rig,
  reads: ['fall', 'gateBlocked'],
  fullScale: { fall: 0.8 },
};
