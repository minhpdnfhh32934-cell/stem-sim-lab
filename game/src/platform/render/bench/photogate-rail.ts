import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Measuring speed (KNTT Vật lí 10, bài 6): a base board with a stand at its left end; an aluminium
// rail tilted from the stand down to the right at the angle set at the desk, an electromagnet
// holding the steel ball at its top, two photogates astride it at their distances down the rail,
// and the digital timer on the base whose two lamps light while a beam is blocked. The rail, the
// gates and the ball are the rig, posed from the station: the rail at `parameters.angle`, gate B at
// `parameters.gateB`, the ball at the run's `distance`.

/** The rail (m): its length, its channel's width and height; the ball's radius. */
const RAIL = { length: 1.0, width: 0.03, height: 0.012, wall: 0.003 };
const BALL = 0.01;
/** Gate A's distance down the rail (the experiment's own; gate B's is the desk's). */
const GATE_A = 0.3;
const GATE = { width: 0.11, height: 0.12, post: 0.016, depth: 0.03 };
const BASE = { height: 0.02 };
const TIMER = { width: 0.2, height: 0.08, depth: 0.12, x: 0.28, z: 0.09 };

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base board (the entity's mesh), the stand at its left end and the timer at its front. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const screen = own(new THREE.MeshStandardMaterial({ color: '#1f3a2c', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE.height, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  // The stand: a rod up from the left end, carrying the rail's top end.
  const left = -RAIL.length / 2;
  mesh(
    keep(new THREE.CylinderGeometry(0.008, 0.008, h - BASE.height - 0.01, 12)),
    steel,
  ).position.set(left - 0.03, -h / 2 + BASE.height + (h - BASE.height - 0.01) / 2, 0);
  // The timer: a dark case with its green display on the front.
  const timer = mesh(keep(slab(TIMER.width, TIMER.depth, TIMER.height, 0.008, 0.002)), painted); // the item's colour: focus shows on it
  timer.name = 'timer';
  timer.position.set(TIMER.x, -h / 2 + BASE.height, TIMER.z);
  const face = mesh(
    keep(new THREE.BoxGeometry(TIMER.width * 0.7, TIMER.height * 0.4, 0.002)),
    screen,
  );
  face.position.set(
    TIMER.x - 0.02,
    -h / 2 + BASE.height + TIMER.height * 0.6,
    TIMER.z + TIMER.depth / 2 + 0.001,
  );
  face.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The tilted rail with the magnet and both gates, the ball on it, the timer's two lamps. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const aluminium = own(new THREE.MeshStandardMaterial({ color: '#c6ccd2', ...LOOKS.satin }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#d6dade', ...LOOKS.metal }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#b23a32', ...LOOKS.painted }));
  const off = own(new THREE.MeshStandardMaterial({ color: '#3a2a2a', ...LOOKS.plastic }));
  const lit = own(new THREE.MeshBasicMaterial({ color: '#ff5a4a' })); // reads at any light

  // The rail turns about its low (right) end; in its frame it runs along −x from there.
  const tilt = new THREE.Group();
  tilt.name = 'rail';
  tilt.position.set(RAIL.length / 2, BASE.height, 0);
  kit.group.add(tilt);
  const L = RAIL.length;
  const channel = [
    new THREE.BoxGeometry(L, RAIL.wall, RAIL.width).translate(-L / 2, RAIL.wall / 2, 0),
    ...[-1, 1].map((s) =>
      new THREE.BoxGeometry(L, RAIL.height, RAIL.wall).translate(
        -L / 2,
        RAIL.height / 2,
        s * (RAIL.width / 2 - RAIL.wall / 2),
      ),
    ),
  ];
  for (const g of channel) mesh(keep(g), aluminium, tilt);
  // The electromagnet at the top end, holding the ball before RUN.
  const magnet = mesh(
    keep(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16).rotateZ(Math.PI / 2)),
    red,
    tilt,
  );
  magnet.name = 'magnet'; // named: the Explain view labels it
  magnet.position.set(-L + 0.005, RAIL.wall + BALL, 0);
  // The gates: a U astride the rail, its beam across at the ball's centre line.
  const gate = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    tilt.add(g);
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
  const gateA = gate('gate-a');
  gateA.position.x = -L + GATE_A;
  const gateB = gate('gate-b');
  const ball = mesh(keep(new THREE.SphereGeometry(BALL, 20, 14)), steel, tilt);
  ball.name = 'ball';
  ball.castShadow = false; // smaller than a shadow-map texel
  // The timer's two lamps, A and B, lit while their beam is blocked.
  const lamps = [-1, 1].map((s) => {
    const lamp = mesh(keep(new THREE.SphereGeometry(0.006, 10, 8)), off);
    swaps(lamp, lit);
    lamp.castShadow = false;
    lamp.position.set(
      TIMER.x + 0.07,
      BASE.height + TIMER.height * (0.5 + 0.2 * s),
      TIMER.z + TIMER.depth / 2 + 0.003,
    );
    return lamp;
  });

  let angle = NaN;
  let gb = NaN;
  let s = NaN;
  const blocked = [false, false];
  const pose = ({ parameters, sample }: BenchPose) => {
    const a = parameters.angle ?? 10;
    if (a !== angle) {
      angle = a;
      tilt.rotation.z = -(a * Math.PI) / 180;
    }
    const b = parameters.gateB ?? 0.8;
    if (b !== gb) {
      gb = b;
      gateB.position.x = -L + b;
    }
    const next = Number.isFinite(sample.distance) ? (sample.distance ?? 0) : 0;
    if (next !== s) {
      s = next;
      ball.position.set(-L + Math.min(next, L - BALL), RAIL.wall + BALL, 0);
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

export const photogateRail: BenchModel = {
  frame,
  rig,
  reads: ['distance', 'gateABlocked', 'gateBBlocked'],
  fullScale: { distance: 0.9 },
};
