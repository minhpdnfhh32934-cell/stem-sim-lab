import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The seed-counting tray of a pea cross (Mendelian genetics): on a base board, a wooden tray of
// the cross's pods on the left and four glass Petri dishes in a row, one per phenotype class —
// yellow round, yellow wrinkled, green round, green wrinkled. The rig is what the run changes: the
// pods left in the tray, fewer as the count goes on (N − n of N), and each dish's heap, its seeds
// the run's class counts. A drawn seed stands for `per` counted ones, per = ⌈N/160⌉ (1 up to
// N = 160), so a dish's heap is its count to within one drawn seed; round seeds are smooth
// spheres, wrinkled ones angular.

const BASE = 0.02;
const TRAY = { x: -0.3, w: 0.24, d: 0.2, h: 0.03, wall: 0.008 };
const DISH = { x0: -0.08, pitch: 0.14, radius: 0.05, h: 0.012, wall: 0.002 };
/** Seeds drawn in a dish at most, and their radius. */
const HEAP = { max: 160, radius: 0.0034 };
const PODS = 40;
/** The four classes in the model's order, each with its colour and shape. */
const CLASSES = [
  { variable: 'yellowRound', color: '#e3c22e', round: true },
  { variable: 'yellowWrinkled', color: '#d9b62c', round: false },
  { variable: 'greenRound', color: '#6f9e3c', round: true },
  { variable: 'greenWrinkled', color: '#628f35', round: false },
] as const;

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** Geometries merged into one and the pieces freed. */
function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return g;
}

/** The base, the tray (in the item's colour: focus shows on it) and the four dishes. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8ecf2', ...GLASSWARE_LOOK }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  const { x, w: tw, d: td, h: th, wall } = TRAY;
  mesh(
    keep(
      merged([
        new THREE.BoxGeometry(tw, wall, td).translate(x, y0 + wall / 2, 0),
        new THREE.BoxGeometry(tw, th, wall).translate(x, y0 + th / 2, -td / 2 + wall / 2),
        new THREE.BoxGeometry(tw, th, wall).translate(x, y0 + th / 2, td / 2 - wall / 2),
        new THREE.BoxGeometry(wall, th, td).translate(x - tw / 2 + wall / 2, y0 + th / 2, 0),
        new THREE.BoxGeometry(wall, th, td).translate(x + tw / 2 - wall / 2, y0 + th / 2, 0),
      ]),
    ),
    painted,
  );
  const dishes = mesh(
    keep(
      merged(
        CLASSES.flatMap((_, i) => {
          const cx = DISH.x0 + i * DISH.pitch;
          return [
            new THREE.CylinderGeometry(DISH.radius, DISH.radius, DISH.wall, 28).translate(
              cx,
              y0 + DISH.wall / 2,
              0,
            ),
            new THREE.CylinderGeometry(DISH.radius, DISH.radius, DISH.h, 28, 1, true).translate(
              cx,
              y0 + DISH.h / 2,
              0,
            ),
          ];
        }),
      ),
    ),
    glass,
  );
  dishes.name = 'glass'; // clear glassware: a sheen pass on High (quality.ts)
  dishes.castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** Where heap seed k lies in a dish centred at (cx, cz): a Vogel spiral, a second layer on top. */
function heapSlot(k: number, cx: number, y: number): THREE.Matrix4 {
  const layer = k < 100 ? 0 : 1;
  const j = layer === 0 ? k : k - 100;
  const span = layer === 0 ? DISH.radius - 0.007 : DISH.radius * 0.6;
  const r = span * Math.sqrt((j + 0.5) / (layer === 0 ? 100 : 60));
  const turn = j * 2.39996; // the golden angle
  return at(
    cx + r * Math.cos(turn),
    y + HEAP.radius + layer * 1.6 * HEAP.radius,
    r * Math.sin(turn),
    turn,
    j * 0.7,
    0,
  );
}

/** The pods in the tray and the four heaps, posed from the station. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, copies } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE + DISH.wall;
  const round = keep(new THREE.SphereGeometry(HEAP.radius, 10, 8));
  const wrinkled = keep(new THREE.IcosahedronGeometry(HEAP.radius * 1.05, 0).scale(1, 0.8, 1));
  const heaps = CLASSES.map((c, i) => {
    const slots: THREE.Matrix4[] = [];
    for (let k = 0; k < HEAP.max; k++) slots.push(heapSlot(k, DISH.x0 + i * DISH.pitch, y0));
    const seed = own(
      new THREE.MeshStandardMaterial({
        color: c.color,
        ...(c.round ? LOOKS.satin : LOOKS.matte),
        flatShading: !c.round,
      }),
    );
    const heap = copies(c.round ? round : wrinkled, seed, slots);
    heap.name = c.variable;
    heap.count = 0;
    heap.frustumCulled = false; // its count changes: bounds taken at 0 would cull it
    heap.castShadow = false;
    return heap;
  });
  const pod = own(new THREE.MeshStandardMaterial({ color: '#7da84a', ...LOOKS.matte }));
  const lying: THREE.Matrix4[] = [];
  for (let k = 0; k < PODS; k++) {
    const col = k % 8;
    const row = Math.floor(k / 8);
    lying.push(
      at(
        TRAY.x - 0.09 + col * 0.026 + (row % 2) * 0.008,
        BASE + 0.016 + (k % 3) * 0.004,
        -0.07 + row * 0.034,
        0,
        0.3 + 0.5 * Math.sin(k * 1.7),
        Math.PI / 2,
      ),
    );
  }
  const pods = copies(keep(new THREE.CapsuleGeometry(0.007, 0.04, 4, 8)), pod, lying);
  pods.name = 'pods';
  pods.frustumCulled = false; // its count changes
  pods.castShadow = false;

  const pose = ({ parameters, sample }: BenchPose) => {
    const n = parameters.offspring ?? 0;
    const per = Math.max(1, Math.ceil(n / HEAP.max));
    for (let i = 0; i < heaps.length; i++) {
      const count = sample[CLASSES[i]?.variable ?? ''];
      const heap = heaps[i];
      if (!heap) continue;
      heap.count = Number.isFinite(count) ? Math.min(HEAP.max, Math.round((count ?? 0) / per)) : 0;
    }
    const counted = sample.counted;
    const left = Number.isFinite(counted) && n > 0 ? (n - (counted ?? 0)) / n : 1;
    pods.count = Math.round(PODS * Math.min(1, Math.max(0, left)));
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const seedTray: BenchModel = {
  frame,
  rig,
  reads: ['counted', 'yellowRound', 'yellowWrinkled', 'greenRound', 'greenWrinkled'],
  fullScale: {
    counted: 0,
    yellowRound: HEAP.max,
    yellowWrinkled: HEAP.max,
    greenRound: HEAP.max,
    greenWrinkled: HEAP.max,
  },
};
