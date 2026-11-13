import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Mark and recapture with beans (a population estimate): on a base board, a glass jar full of
// beans — the population, its size never drawn — and a white sorting tray of 100 places. The rig
// is what the run changes: the catch laid out on the tray as it is drawn, the marked (red) beans
// from the front left, the unmarked (white) from the back right, R and n − R of them.

const BASE = 0.02;
const JAR = { x: -0.26, radius: 0.1, h: 0.24, fill: 0.2 };
const TRAY = { x: 0.16, w: 0.4, d: 0.24, h: 0.02, wall: 0.006 };
/** The tray's places: 10 across, 10 deep. */
const GRID = { cols: 10, rows: 10, dx: 0.036, dz: 0.021 };
const PLACES = GRID.cols * GRID.rows;

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

/** The base, the jar and its beans, the tray (in the item's colour: focus shows on it). */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8ecf2', ...GLASSWARE_LOOK }));
  const beans = own(new THREE.MeshStandardMaterial({ color: '#efe6d2', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  const jar = mesh(
    keep(
      merged([
        new THREE.CylinderGeometry(JAR.radius, JAR.radius, JAR.h, 28, 1, true).translate(
          JAR.x,
          y0 + JAR.h / 2,
          0,
        ),
        new THREE.CylinderGeometry(JAR.radius, JAR.radius, 0.004, 28).translate(
          JAR.x,
          y0 + 0.002,
          0,
        ),
      ]),
    ),
    glass,
  );
  jar.name = 'glass'; // clear glassware: a sheen pass on High (quality.ts)
  mesh(
    keep(new THREE.CylinderGeometry(JAR.radius - 0.004, JAR.radius - 0.004, JAR.fill, 24)),
    beans,
  ).position.set(JAR.x, y0 + 0.004 + JAR.fill / 2, 0);
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
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** Place k of the tray (0 front left … 99 back right). */
function place(k: number, y: number): THREE.Matrix4 {
  const col = k % GRID.cols;
  const row = Math.floor(k / GRID.cols);
  return at(
    TRAY.x + (col - (GRID.cols - 1) / 2) * GRID.dx,
    y,
    ((GRID.rows - 1) / 2 - row) * GRID.dz,
    0,
    0.2 * Math.sin(k * 2.3),
    0,
  );
}

/** The catch on the tray, posed from the station. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, copies } = kit;
  kit.group.position.copy(topOf(item));
  const y = BASE + TRAY.wall + 0.004;
  const bean = keep(new THREE.SphereGeometry(0.008, 10, 8).scale(1, 0.55, 0.65));
  const forward: THREE.Matrix4[] = [];
  const backward: THREE.Matrix4[] = [];
  for (let k = 0; k < PLACES; k++) {
    forward.push(place(k, y));
    backward.push(place(PLACES - 1 - k, y));
  }
  const marked = copies(
    bean,
    own(new THREE.MeshStandardMaterial({ color: '#c0392b', ...LOOKS.satin })),
    forward,
  );
  marked.name = 'marked';
  marked.count = 0;
  marked.frustumCulled = false; // its count changes: bounds taken at 0 would cull it
  marked.castShadow = false;
  const unmarked = copies(
    bean,
    own(new THREE.MeshStandardMaterial({ color: '#f1ead8', ...LOOKS.satin })),
    backward,
  );
  unmarked.name = 'unmarked';
  unmarked.count = 0;
  unmarked.frustumCulled = false;
  unmarked.castShadow = false;

  const pose = ({ sample }: BenchPose) => {
    const n = Number.isFinite(sample.caught) ? (sample.caught ?? 0) : 0;
    const r = Number.isFinite(sample.recaptured) ? (sample.recaptured ?? 0) : 0;
    marked.count = Math.min(PLACES, Math.max(0, r));
    unmarked.count = Math.min(PLACES - marked.count, Math.max(0, n - r));
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const beanJar: BenchModel = {
  frame,
  rig,
  reads: ['caught', 'recaptured'],
  fullScale: { caught: PLACES, recaptured: PLACES / 2 },
};
