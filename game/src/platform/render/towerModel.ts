import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { Assembly, at, slab, swaps } from './assembly';
import { LOOKS } from './looks';

type DropTower = NonNullable<ItemDefinition['dropTower']>;

const FOOT = 0.006; // rubber pads under the base
const BASE = 0.03; // the base's height on its pads (as the old base plate)
const BASE_W = 0.36;
const BASE_D = 0.26;
const BASE_Z = -0.03; // behind the landing mat, as the old plate lay
const FOOT_PLATE = 0.012; // the column's foot plate, bolted to the base
const COLUMN = 0.11; // the square column, inside the item's 0.12 m box
const HEAD = 0.1; // the drive housing on top of the column
const MAT = 0.002; // the rubber landing mat
const GATE = 0.05; // the light gate at the floor: its height above the mat
const GAP = 0.004; // between the ball's top and the release head
const OPEN = 0.45; // how far each jaw swings out (rad) once the ball is released

/**
 * Where the tower's parts are, in the item's frame (origin at the centre of its box; +z is the
 * side the ball falls on). The ball's lowest point is at floor + y, y the height the station
 * gives; the scale on the column's face reads heights from the floor, as it always did.
 * ExperimentView draws the scale there, the frame and the carriage fit around it, the tests read it.
 */
export function towerLayout(item: ItemDefinition, tower: DropTower) {
  const [, h] = item.visual.size;
  const [lx, , lz] = tower.landing;
  const floor = -h / 2;
  const length = Math.floor((h - 0.1) * 10) / 10; // the scale's length, as it always was
  return {
    floor,
    top: h / 2,
    axis: new THREE.Vector2(lx, lz), // x, z of the ball's path
    radius: tower.ballRadius,
    scale: {
      length,
      width: 0.07,
      center: new THREE.Vector3(0, floor + length / 2, COLUMN / 2 + 0.002),
    },
  };
}

/** The tower's fixed parts: base, column, drive housing, the carriage's rail, mat and light gate. */
export interface TowerFrame {
  /** The column: the entity's own mesh takes it (its material shows focus). */
  readonly body: THREE.BufferGeometry;
  readonly parts: THREE.Group;
  dispose(): void;
}

/**
 * The free-fall tower, in the item's frame: a chamfered base on four rubber pads behind the
 * landing point; the column on a foot plate bolted to it, the scale on its face (drawn by
 * ExperimentView), a steel rail on its side the carriage runs on, and the drive housing on top;
 * at the landing point a rubber mat and the light gate that stops the timer — a fork whose
 * sensors face each other across the ball's path. Only the look: the collider is still the item's
 * box; the landing point and the ball's size come from the item.
 */
export function buildTowerFrame(
  item: ItemDefinition,
  tower: DropTower,
  painted: THREE.MeshStandardMaterial,
): TowerFrame {
  const { floor, top, axis } = towerLayout(item, tower);
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const baseTop = floor + BASE;

  // 1. The base on its pads, the column's foot plate bolted to it.
  const base = mesh(keep(slab(BASE_W, BASE_D, BASE - FOOT, 0.03, 0.006)), painted);
  base.name = 'base';
  base.position.set(0, floor + FOOT, BASE_Z);
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  copies(
    keep(new THREE.CylinderGeometry(0.02, 0.022, FOOT, 12)),
    rubber,
    [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        at(sx * (BASE_W / 2 - 0.035), floor + FOOT / 2, BASE_Z + sz * (BASE_D / 2 - 0.035)),
      ),
    ),
  ).castShadow = false;
  mesh(keep(slab(0.17, 0.17, FOOT_PLATE, 0.012, 0.002)), painted).position.set(0, baseTop, 0);
  const bolts = [-1, 1].flatMap((bx) =>
    [-1, 1].map((bz) => at(bx * 0.068, baseTop + FOOT_PLATE + 0.003, bz * 0.068)),
  );

  // 2. The column (the entity's mesh), the drive housing on top, the rail along its +x side.
  const columnBottom = baseTop + FOOT_PLATE;
  const headBottom = top - HEAD;
  const body = keep(slab(COLUMN, COLUMN, headBottom - columnBottom, 0.008, 0.002));
  body.translate(0, columnBottom, 0);
  const head = mesh(keep(slab(0.15, 0.15, HEAD, 0.012, 0.004)), painted);
  head.name = 'head';
  head.position.set(0, headBottom, 0);
  for (const bx of [-1, 1])
    for (const bz of [-1, 1]) bolts.push(at(bx * 0.055, top + 0.003, bz * 0.055));
  const gland = mesh(keep(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10)), plastic);
  gland.rotation.x = Math.PI / 2;
  gland.position.set(0, headBottom + HEAD / 2, -0.085); // the drive's cable, at the back
  gland.castShadow = false;
  const rail = mesh(keep(new THREE.BoxGeometry(0.012, headBottom - columnBottom, 0.024)), steel);
  rail.name = 'rail';
  rail.position.set(COLUMN / 2 + 0.006, (headBottom + columnBottom) / 2, 0);
  copies(keep(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 6)), steel, bolts).castShadow = false;

  // 3. Where the ball lands: the mat, and the light gate around it — a fork open towards +z, its
  //    prongs either side of the path, their sensors facing each other across it.
  const mat = mesh(keep(new THREE.BoxGeometry(0.2, MAT, 0.2)), rubber);
  mat.name = 'mat';
  mat.position.set(axis.x, floor + MAT / 2, axis.y);
  mat.castShadow = false;
  const gateY = floor + MAT + GATE / 2;
  copies(
    keep(new THREE.BoxGeometry(0.016, GATE, 0.09)),
    painted,
    [-1, 1].map((s) => at(axis.x + s * 0.07, gateY, axis.y - 0.015)),
  ).name = 'prongs';
  const bar = mesh(keep(new THREE.BoxGeometry(0.156, GATE, 0.016)), painted);
  bar.name = 'gate-bar';
  bar.position.set(axis.x, gateY, axis.y - 0.068);
  copies(
    keep(new THREE.BoxGeometry(0.012, 0.02, 0.02)),
    plastic,
    [-1, 1].map((s) => at(axis.x + s * 0.056, floor + MAT + GATE - 0.015, axis.y)),
  ).castShadow = false;

  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** What moves: the carriage with the release clamp, and the ball; `pose` sets them, allocating nothing. */
export interface TowerCarriage {
  readonly group: THREE.Group;
  /**
   * The release height and the ball's height (m above the floor, its lowest point), and whether
   * it has been let go — as the station gives them.
   */
  pose(release: number, height: number, released: boolean): void;
  dispose(): void;
}

/**
 * The carriage riding on the column at the release height: a sleeve round the column (and its
 * rail) with a locking knob; an index hanging from it, whose red line marks the release height on
 * the scale; an arm out over the path to the release head, with a lamp lit while it holds the ball;
 * and the clamp's two jaws, hinged under the head, whose pads hold the ball below its equator —
 * swung open once the run lets it go. And the steel ball. Placed by `pose` from the station: the
 * carriage at the release height, the ball at its height.
 */
export function buildTowerCarriage(item: ItemDefinition, tower: DropTower): TowerCarriage {
  const { floor, axis, radius: r } = towerLayout(item, tower);
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const paint = own(new THREE.MeshStandardMaterial({ color: '#59636e', ...LOOKS.painted }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const red = own(new THREE.MeshBasicMaterial({ color: '#d0312d' })); // reads at any light
  const lit = own(new THREE.MeshBasicMaterial({ color: '#ffb547' }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#3a3227', ...LOOKS.plastic }));

  // The carriage's origin: the column's axis, at the height of the held ball's lowest point.
  const carriage = new THREE.Group();
  carriage.name = 'carriage';
  kit.group.add(carriage);
  const sleeve = mesh(keep(slab(0.16, 0.15, 0.08, 0.01, 0.003)), paint, carriage);
  sleeve.name = 'sleeve';
  sleeve.position.y = 0.04;
  const screw = mesh(keep(new THREE.CylinderGeometry(0.005, 0.005, 0.016, 8)), steel, carriage);
  screw.rotation.z = Math.PI / 2;
  screw.position.set(-0.088, 0.08, 0);
  screw.castShadow = false;
  const knob = mesh(keep(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12)), plastic, carriage);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(-0.102, 0.08, 0);
  // The index: a tab down from the sleeve's front, its red line across the scale at y = 0.
  const tab = mesh(keep(new THREE.BoxGeometry(0.01, 0.041, 0.008)), paint, carriage);
  tab.position.set(-0.05, 0.0195, COLUMN / 2 + 0.016);
  tab.castShadow = false;
  const index = mesh(keep(new THREE.BoxGeometry(0.052, 0.002, 0.004)), red, carriage);
  index.name = 'index';
  index.position.set(-0.029, 0, COLUMN / 2 + 0.006);
  index.castShadow = false;

  // The arm and the release head over the path, the head's underside GAP above the ball's top.
  const headBottom = 2 * r + GAP;
  const headSize = new THREE.Vector3(0.05, 0.035, 0.045);
  const armFrom = 0.075; // the sleeve's front face
  const armTo = axis.y - headSize.z / 2;
  const arm = mesh(keep(slab(0.03, armTo - armFrom, 0.03, 0.004, 0.002)), paint, carriage);
  arm.name = 'arm';
  arm.position.set(axis.x, headBottom + headSize.y / 2 - 0.015, (armFrom + armTo) / 2);
  const head = mesh(
    keep(slab(headSize.x, headSize.z, headSize.y, 0.006, 0.002)),
    plastic,
    carriage,
  );
  head.name = 'release-head';
  head.position.set(axis.x, headBottom, axis.y);
  const lamp = mesh(keep(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 12)), lit, carriage);
  swaps(lamp, dark);
  lamp.name = 'lamp';
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(axis.x, headBottom + headSize.y / 2, axis.y + headSize.z / 2 + 0.002);
  lamp.castShadow = false;

  // The jaws: hinged at the head's underside either side of the ball, straight down to rubber
  // pads whose top inner edges touch the ball a little below its equator.
  const padRubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));
  const hingeX = r + 0.006;
  const padTop = 0.48 * r;
  const padInner = Math.sqrt(r * r - (r - padTop) ** 2);
  const jawLength = headBottom - (padTop - 0.004);
  const jawGeometry = keep(new THREE.BoxGeometry(0.004, jawLength, 0.012));
  const padGeometry = keep(new THREE.BoxGeometry(hingeX - 0.002 - padInner, 0.004, 0.012));
  const jaws = [-1, 1].map((s) => {
    const jaw = new THREE.Group();
    jaw.name = s > 0 ? 'jaw+x' : 'jaw-x';
    jaw.position.set(axis.x + s * hingeX, headBottom, axis.y);
    carriage.add(jaw);
    const blade = mesh(jawGeometry, steel, jaw);
    blade.position.y = -jawLength / 2;
    blade.castShadow = false;
    const pad = mesh(padGeometry, padRubber, jaw);
    pad.name = 'pad';
    pad.position.set(
      s * ((padInner + hingeX - 0.002) / 2 - hingeX),
      padTop - 0.002 - headBottom,
      0,
    );
    pad.castShadow = false;
    return { jaw, s };
  });

  const ball = mesh(
    keep(new THREE.SphereGeometry(r, 24, 16)),
    own(new THREE.MeshStandardMaterial({ color: '#cfd5da', ...LOOKS.metal })), // a steel ball
  );
  ball.name = 'ball';
  ball.position.set(axis.x, floor + r, axis.y); // until its session exists

  let open: boolean | null = null;
  const pose = (release: number, height: number, released: boolean) => {
    carriage.position.y = floor + release;
    ball.position.y = floor + r + height;
    if (released === open) return;
    open = released;
    for (const { jaw, s } of jaws) jaw.rotation.z = released ? s * OPEN : 0;
    lamp.material = released ? dark : lit;
  };
  pose(0, 0, false);
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}
