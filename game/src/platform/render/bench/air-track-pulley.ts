import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Uniform motion and Newton's second law: a level air track on two feet, the launcher at its near
// (−x) end, a pulley past its far end — past the bench's edge, so the hanging mass drops beside the
// bench — the glider with its 0.1 m card and its slotted masses, two light gates astride the track,
// the string from the glider over the pulley down to the hanger, the digital timer with a lamp per
// gate on the base, a ruler along the track. The glider, gate B, the masses, the string and the
// pulley are the rig, posed from the station: gate B at `parameters.gateB`, the masses at
// `gliderMass` and `hangingMass`, the glider (and the hanger, and the pulley's turn) by the run's
// `distance`.

/** The track's top surface above the base (m), its ends (x) and its width. */
const TRACK = { top: 0.09, from: -0.66, to: 0.98, width: 0.07 };
/** The card's centre at the start (x), the glider's size, the card's. */
const START = -0.45;
const GLIDER = { length: 0.2, height: 0.035, width: 0.09 };
const CARD = { length: 0.1, height: 0.04, thickness: 0.003 };
/** Gate A's distance along the track from the card's start (the experiment's own). */
const GATE_A = 0.2;
const GATE = { width: 0.16, height: 0.17, post: 0.016, depth: 0.03 };
/** The pulley: past the bench's edge (the bench is 2 m long, its end at x 1), its radius. */
const PULLEY = { x: 1.03, radius: 0.025 };
/** The string's height above the base (the glider's hook, the pulley's top). */
const STRING_Y = TRACK.top + 0.02;
/** How far the hanger hangs below the pulley's axle at the start (m). */
const HANG = 0.12;
const TIMER = { width: 0.2, height: 0.08, depth: 0.1, x: -0.1, z: 0.12 };

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The track on its feet, the launcher, the pulley's bracket, the ruler, the timer. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const h = item.visual.size[1];
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const base = -h / 2;
  const aluminium = own(new THREE.MeshStandardMaterial({ color: '#c6ccd2', ...LOOKS.satin }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const ruler = own(new THREE.MeshStandardMaterial({ color: '#efe9d2', ...LOOKS.matte }));
  const screen = own(new THREE.MeshStandardMaterial({ color: '#1f3a2c', ...LOOKS.satin }));
  // The body (the entity's mesh: focus shows on it): the track's beam, under its top.
  const length = TRACK.to - TRACK.from;
  const middle = (TRACK.to + TRACK.from) / 2;
  const body = keep(new THREE.BoxGeometry(length, 0.05, TRACK.width * 0.8));
  body.translate(middle, base + TRACK.top - 0.03, 0);
  // The track's top: a polished aluminium face the glider floats on.
  mesh(keep(new THREE.BoxGeometry(length, 0.006, TRACK.width)), aluminium).position.set(
    middle,
    base + TRACK.top - 0.003,
    0,
  );
  // Two feet on the bench.
  copies(
    keep(new THREE.BoxGeometry(0.06, TRACK.top - 0.055, 0.14)),
    dark,
    [TRACK.from + 0.12, TRACK.to - 0.12].map((x) => at(x, base + (TRACK.top - 0.055) / 2, 0)),
  );
  // The launcher at the near end: a block with an elastic band across its face.
  mesh(keep(new THREE.BoxGeometry(0.05, 0.07, 0.12)), painted).position.set(
    TRACK.from - 0.02,
    base + TRACK.top + 0.02,
    0,
  );
  // The pulley's bracket out past the far end.
  mesh(keep(new THREE.BoxGeometry(PULLEY.x - TRACK.to + 0.03, 0.012, 0.03)), dark).position.set(
    (PULLEY.x + TRACK.to) / 2,
    base + STRING_Y - PULLEY.radius,
    0.025,
  );
  // The ruler along the near side.
  const strip = mesh(keep(new THREE.BoxGeometry(length - 0.1, 0.002, 0.025)), ruler);
  strip.position.set(middle, base + TRACK.top - 0.012, TRACK.width / 2 + 0.014);
  strip.castShadow = false;
  // The timer on the base, in front.
  mesh(keep(slab(TIMER.width, TIMER.depth, TIMER.height, 0.008, 0.002)), painted).position.set(
    TIMER.x,
    base,
    TIMER.z,
  );
  const face = mesh(
    keep(new THREE.BoxGeometry(TIMER.width * 0.6, TIMER.height * 0.4, 0.002)),
    screen,
  );
  face.position.set(TIMER.x - 0.03, base + TIMER.height * 0.6, TIMER.z + TIMER.depth / 2 + 0.001);
  face.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The glider and its masses, both gates, the pulley, the string, the hanger, the timer's lamps. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const blue = own(new THREE.MeshStandardMaterial({ color: '#3d6fb0', ...LOOKS.painted }));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#b8923f', ...LOOKS.metal }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced4', ...LOOKS.metal }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const card = own(new THREE.MeshStandardMaterial({ color: '#1d1f23', ...LOOKS.matte }));
  const thread = own(new THREE.MeshStandardMaterial({ color: '#f2efe6', ...LOOKS.matte }));
  const off = own(new THREE.MeshStandardMaterial({ color: '#3a2a2a', ...LOOKS.plastic }));
  const lit = own(new THREE.MeshBasicMaterial({ color: '#ff5a4a' })); // reads at any light

  // The glider: a sleeve over the track, the card on top, slotted 0.1 kg masses either side.
  const glider = new THREE.Group();
  glider.name = 'glider';
  kit.group.add(glider);
  mesh(
    keep(new THREE.BoxGeometry(GLIDER.length, GLIDER.height, GLIDER.width)),
    blue,
    glider,
  ).position.set(0, TRACK.top + GLIDER.height / 2 + 0.002, 0);
  const plate = mesh(
    keep(new THREE.BoxGeometry(CARD.length, CARD.height, CARD.thickness)),
    card,
    glider,
  );
  plate.position.set(0, TRACK.top + GLIDER.height + CARD.height / 2, 0);
  plate.castShadow = false;
  const slots = [0, 1].flatMap((k) =>
    [-1, 1].map((side) => {
      const slot = mesh(
        keep(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 18).rotateX(Math.PI / 2)),
        brass,
        glider,
      );
      slot.position.set(-0.05 + 0.1 * k, TRACK.top + 0.018, side * (GLIDER.width / 2 + 0.008));
      slot.name = `glider-mass-${k}`;
      return slot;
    }),
  );

  // The gates: a U astride the track, its beam across at the card's height.
  const gate = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    kit.group.add(g);
    const posts = [-1, 1].map((s) =>
      new THREE.BoxGeometry(GATE.depth, GATE.height, GATE.post).translate(
        0,
        GATE.height / 2,
        s * (GATE.width / 2),
      ),
    );
    const top = new THREE.BoxGeometry(GATE.depth, GATE.post, GATE.width + GATE.post).translate(
      0,
      GATE.height,
      0,
    );
    for (const p of [...posts, top]) mesh(keep(p), plastic, g);
    return g;
  };
  gate('gate-a').position.x = START + GATE_A;
  const gateB = gate('gate-b');

  // The pulley: a wheel on its axle past the track's end, turning as the string runs over it.
  const pulley = mesh(
    keep(new THREE.CylinderGeometry(PULLEY.radius, PULLEY.radius, 0.008, 24).rotateX(Math.PI / 2)),
    steel,
  );
  pulley.name = 'pulley';
  const axle = STRING_Y - PULLEY.radius;
  pulley.position.set(PULLEY.x, axle, 0);
  // The string: along the track from the glider's hook to the pulley, then down to the hanger.
  const along = mesh(
    keep(new THREE.CylinderGeometry(0.0008, 0.0008, 1, 6).rotateZ(Math.PI / 2)),
    thread,
  );
  along.name = 'string-along';
  along.castShadow = false;
  const down = mesh(
    keep(new THREE.CylinderGeometry(0.0008, 0.0008, 1, 6).translate(0, -0.5, 0)),
    thread,
  );
  down.name = 'string-down';
  down.castShadow = false;
  down.position.set(PULLEY.x + PULLEY.radius, axle, 0);
  // The hanger: a hook and a base, with a 5 g slotted disc for every 5 g hung.
  const hanger = new THREE.Group();
  hanger.name = 'hanger';
  kit.group.add(hanger);
  mesh(
    keep(new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 8).translate(0, -0.025, 0)),
    steel,
    hanger,
  );
  mesh(
    keep(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 18).translate(0, -0.05, 0)),
    steel,
    hanger,
  );
  const discs = [0, 1, 2, 3].map((k) => {
    const disc = mesh(keep(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 18)), brass, hanger);
    disc.position.y = -0.045 + 0.0065 * k;
    disc.name = `hanging-mass-${k}`;
    return disc;
  });

  // The timer's two lamps, A and B, lit while their beam is blocked.
  const lamps = [-1, 1].map((s) => {
    const lamp = mesh(keep(new THREE.SphereGeometry(0.006, 10, 8)), off);
    swaps(lamp, lit);
    lamp.castShadow = false;
    lamp.position.set(
      TIMER.x + 0.07,
      TIMER.height * (0.5 + 0.2 * s),
      TIMER.z + TIMER.depth / 2 + 0.003,
    );
    return lamp;
  });

  let gb = NaN;
  let glide = NaN;
  let hung = NaN;
  let carried = NaN;
  const blocked = [false, false];
  const pose = ({ parameters, sample }: BenchPose) => {
    const b = parameters.gateB ?? 0.6;
    if (b !== gb) {
      gb = b;
      gateB.position.x = START + b;
    }
    const M = parameters.gliderMass ?? 0.2;
    if (M !== carried) {
      carried = M;
      const pairs = Math.round((M - 0.2) / 0.1);
      slots.forEach((slot, i) => (slot.visible = Math.floor(i / 2) < pairs));
    }
    const m = parameters.hangingMass ?? 0;
    if (m !== hung) {
      hung = m;
      const count = Math.round(m / 0.005);
      discs.forEach((disc, i) => (disc.visible = i < count));
      // With nothing hanging, the string lies slack on the glider: no string or hanger shown.
      hanger.visible = count > 0;
      along.visible = count > 0;
      down.visible = count > 0;
      glide = NaN; // re-pose what hangs on it
    }
    const s = Number.isFinite(sample.distance) ? (sample.distance ?? 0) : 0;
    if (s !== glide) {
      glide = s;
      const x = START + s;
      glider.position.x = x;
      const hook = x + GLIDER.length / 2;
      along.scale.y = 1;
      along.scale.x = Math.max(0.001, PULLEY.x - hook);
      along.position.set((hook + PULLEY.x) / 2, STRING_Y, 0);
      const drop = HANG + s;
      down.scale.y = drop;
      hanger.position.set(PULLEY.x + PULLEY.radius, axle - drop, 0);
      pulley.rotation.z = -s / PULLEY.radius;
    }
    for (const [i, key] of (['gateABlocked', 'gateBBlocked'] as const).entries()) {
      const on = sample[key] === 1;
      if (on === blocked[i]) continue;
      blocked[i] = on;
      const lamp = lamps[i];
      if (lamp) lamp.material = on ? lit : off;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const airTrackPulley: BenchModel = {
  frame,
  rig,
  reads: ['distance', 'gateABlocked', 'gateBBlocked'],
  fullScale: { distance: 0.8 },
};
