import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';
import { arc, Assembly, at, loft, type Outline, slab } from './assembly';
import { LOOKS } from './looks';

type Launcher = NonNullable<ItemDefinition['launcher']>;

const FOOT = 0.012; // rubber feet under the base plate
const PLATE = 0.03; // base plate
const FLANGE = 0.015; // the fork's flange, bolted to the pedestal
const CHEEK = 0.016; // fork cheek plates
const CHEEK_R = 0.08; // their rounded tops, centred on the pivot
const CLEARANCE = 0.008; // under the barrel's rear at its lowest, above the flange
const ROD = 0.022; // cocking rod behind the spring housing
const KNOB = 0.01; // its ball knob
const SCALE_IN = 0.045; // angle scale: plate radii around the pivot
const SCALE_OUT = 0.078;

/**
 * The projectile launcher drawn as the apparatus it stands for, in the item's frame (origin at the
 * centre of its box, +x the launch direction): a bevelled base plate on rubber feet, a pedestal, a
 * fork bolted onto it whose two cheeks carry the barrel on stub trunnions at the launch point — a
 * lock knob on the near (+z) side, a hex nut on the far one — and a spring launcher tube: a bored
 * muzzle block around the pivot, the tube, the spring housing and its cocking rod. An angle scale
 * on the near cheek, ticked every 5° (longer every 15°), and a pointer that turns with the barrel
 * show the simulated angle itself: both are laid out from the same rotation. Only the look: the
 * collider, the interaction box and the launch point all come from the item data, unchanged.
 *
 * The pedestal's top is set from how far the barrel's rear reaches below the pivot, so the barrel
 * swings between the cheeks over its whole 0–90° range without passing through anything.
 */
export interface LauncherModel {
  /** The pedestal: the entity's own mesh takes it (its material shows focus). */
  readonly body: THREE.BufferGeometry;
  /** The fixed parts. */
  readonly parts: THREE.Group;
  /** The barrel, turned about z by the launch angle. */
  readonly pivot: THREE.Group;
  /** Frees every geometry and material made here (not `painted`, the entity's own). */
  dispose(): void;
}

export function buildLauncher(
  item: ItemDefinition,
  launcher: Launcher,
  painted: THREE.MeshStandardMaterial,
): LauncherModel {
  const [w, h, d] = item.visual.size;
  const r = launcher.barrelDiameter / 2;
  const length = launcher.barrelLength;
  const pivotAt = new THREE.Vector3(
    launcher.muzzle[0],
    launcher.muzzle[1] - h / 2,
    launcher.muzzle[2],
  );
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));
  const scalePlate = own(new THREE.MeshStandardMaterial({ color: '#e6e1d0', ...LOOKS.plastic }));
  const ink = own(new THREE.MeshBasicMaterial({ color: '#1b1f24' }));
  const red = own(new THREE.MeshBasicMaterial({ color: '#d0312d' }));

  const parts = kit.group;

  // How far below the pivot the barrel's rear can reach (rod and knob straight down at 90°, the
  // spring housing's rim on the way there): the flange stays a clearance under it.
  const housing = r + 0.005;
  const reach = Math.hypot(length + ROD + KNOB * 1.6, housing);
  const flangeTop = pivotAt.y - reach - CLEARANCE;
  const floor = -h / 2;
  const plateTop = floor + FOOT + PLATE;
  const pedestalTop = Math.max(plateTop + 0.03, flangeTop - FLANGE);

  // 1. Base: a bevelled plate on four rubber feet, and the pedestal standing on it.
  const plate = keep(slab(w - 0.004, d - 0.004, PLATE, 0.022, 0.004));
  mesh(plate, painted).position.y = floor + FOOT;
  const foot = keep(new THREE.CylinderGeometry(0.02, 0.022, FOOT, 16));
  const fx = w / 2 - 0.045;
  const fz = d / 2 - 0.045;
  copies(
    foot,
    rubber,
    [-1, 1].flatMap((sx) => [-1, 1].map((sz) => at(sx * fx, floor + FOOT / 2, sz * fz))),
  );
  const body = keep(slab(w - 0.06, d - 0.06, pedestalTop - plateTop, 0.03, 0.006));
  body.translate(0, plateTop, 0);

  // 2. The fork: a flange bolted to the pedestal, two cheeks either side of the barrel's slot,
  //    a gusset on the outside of each cheek, front and back.
  const slot = r + 0.0175; // half-width, the muzzle block's radius and a gap
  const cheekOut = slot + CHEEK; // cheek outer face, |z|
  const flangeHalfZ = cheekOut + 0.035;
  const flangeX0 = pivotAt.x - 0.12;
  const flangeX1 = pivotAt.x + 0.1;
  const flange = keep(slab(flangeX1 - flangeX0, 2 * flangeHalfZ, FLANGE, 0.01, 0.002));
  const flangeMesh = mesh(flange, painted);
  flangeMesh.name = 'flange';
  flangeMesh.position.set((flangeX0 + flangeX1) / 2, pedestalTop, pivotAt.z);
  const bolt = keep(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6));
  const boltX = [flangeX0 + 0.018, flangeX1 - 0.018];
  const boltZ = flangeHalfZ - 0.016;
  copies(
    bolt,
    steel,
    boltX.flatMap((x) =>
      [-1, 1].map((s) => at(x, pedestalTop + FLANGE + 0.003, pivotAt.z + s * boltZ)),
    ),
  );
  const cheekBottom = pedestalTop + FLANGE - pivotAt.y;
  const cheek = keep(cheekGeometry(cheekBottom, CHEEK));
  for (const side of [-1, 1]) {
    const m = mesh(cheek, painted);
    m.name = side > 0 ? 'cheek-near' : 'cheek-far';
    m.position.set(pivotAt.x, pivotAt.y, pivotAt.z + side * (slot + CHEEK / 2));
  }
  const gusset = keep(gussetGeometry(0.03, 0.085, 0.008));
  copies(
    gusset,
    painted,
    [pivotAt.x - 0.07, pivotAt.x + 0.055].flatMap((x) =>
      [-1, 1].map((s) =>
        at(x, pedestalTop + FLANGE, pivotAt.z + s * cheekOut, 0, s > 0 ? 0 : Math.PI),
      ),
    ),
  );

  // 3. The pivot's bearings on the cheeks' outer faces; a hex nut on the far trunnion, the lock
  //    knob on the near one, over the angle scale.
  const bossLength = 0.012;
  const boss = keep(new THREE.CylinderGeometry(0.024, 0.024, bossLength, 24));
  copies(
    boss,
    steel,
    [-1, 1].map((s) =>
      at(pivotAt.x, pivotAt.y, pivotAt.z + s * (cheekOut + bossLength / 2), Math.PI / 2),
    ),
  );
  const nut = keep(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 6));
  const nutMesh = mesh(nut, steel);
  nutMesh.rotation.x = Math.PI / 2;
  nutMesh.position.set(pivotAt.x, pivotAt.y, pivotAt.z - (cheekOut + bossLength + 0.004));
  const knob = keep(new THREE.CylinderGeometry(0.02, 0.022, 0.02, 12));
  const knobMesh = mesh(knob, rubber);
  knobMesh.rotation.x = Math.PI / 2;
  knobMesh.position.set(pivotAt.x, pivotAt.y, pivotAt.z + cheekOut + bossLength + 0.01);
  const scaleZ = pivotAt.z + cheekOut;
  const plateGeometry = keep(
    new THREE.RingGeometry(SCALE_IN, SCALE_OUT, 32, 1, Math.PI, Math.PI / 2),
  );
  const scaleMesh = mesh(plateGeometry, scalePlate);
  scaleMesh.position.set(pivotAt.x, pivotAt.y, scaleZ + 0.0005);
  scaleMesh.castShadow = false;
  const ticks = keep(tickGeometry());
  const tickMesh = mesh(ticks, ink);
  tickMesh.name = 'ticks';
  tickMesh.position.set(pivotAt.x, pivotAt.y, scaleZ + 0.0012);
  tickMesh.castShadow = false;

  // 4. The barrel, about the pivot: the bored muzzle block (stub trunnions on its sides, never
  //    across the bore), the tube, the spring housing, the cocking rod; the plunger in the bore;
  //    the angle pointer along the barrel's axis, behind the pivot.
  const pivot = new THREE.Group();
  pivot.position.copy(pivotAt);
  const block = slot - 0.0035; // muzzle block radius
  const front = 0.022; // the block straddles the pivot, its face 22 mm ahead
  const bore = r * 0.8;
  const tube = keep(
    new THREE.LatheGeometry(
      [
        [0.0001, -length],
        [0.012, -length],
        [housing, -length],
        [housing, -length + 0.026],
        [r, -length + 0.03],
        [r, front - 0.05],
        [block, front - 0.044],
        [block, front],
        [bore, front],
        [bore, front - 0.05],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      40,
    ),
  );
  tube.rotateZ(-Math.PI / 2); // the lathe's axis (y) along the barrel (x)
  mesh(tube, steel, pivot).name = 'barrel';
  const plunger = keep(new THREE.CircleGeometry(bore, 24));
  plunger.rotateY(Math.PI / 2); // facing out of the muzzle
  mesh(plunger, rubber, pivot).position.x = front - 0.05;
  const stub = keep(new THREE.CylinderGeometry(0.011, 0.011, cheekOut - block + 0.002, 16));
  copies(
    stub,
    steel,
    [-1, 1].map((s) => at(0, 0, (s * (block + cheekOut)) / 2, Math.PI / 2)),
    pivot,
  );
  const rod = keep(new THREE.CylinderGeometry(0.0055, 0.0055, ROD, 12));
  rod.rotateZ(Math.PI / 2);
  const rodMesh = mesh(rod, steel, pivot);
  rodMesh.name = 'rod';
  rodMesh.position.x = -length - ROD / 2;
  const ball = keep(new THREE.SphereGeometry(KNOB, 16, 12));
  const knobBall = mesh(ball, rubber, pivot);
  knobBall.name = 'rod-knob';
  knobBall.position.x = -length - ROD - KNOB * 0.6;
  const needle = keep(new THREE.PlaneGeometry(SCALE_OUT - 0.026, 0.0028));
  needle.translate(-(0.026 + (SCALE_OUT - 0.026) / 2), 0, 0); // backwards from the pivot
  const needleMesh = mesh(needle, red, pivot);
  needleMesh.name = 'pointer';
  needleMesh.position.z = cheekOut + 0.0022;
  needleMesh.castShadow = false;

  return {
    body,
    parts,
    pivot,
    dispose: () => kit.dispose(),
  };
}

/**
 * A fork cheek in the x–y plane about the pivot (origin), `thickness` thick and centred in z: from
 * the flange (`bottom`, below the pivot) up to a round top about the pivot; wider at the back,
 * where the angle scale sits. Its faces are chamfered all round.
 */
function cheekGeometry(bottom: number, thickness: number) {
  const bevel = 0.0015;
  const outline: Outline = (inset) => [
    new THREE.Vector2(-CHEEK_R - 0.02 + inset, bottom + inset),
    new THREE.Vector2(CHEEK_R - 0.005 - inset, bottom + inset),
    ...arc(0, 0, CHEEK_R - inset, 0, Math.PI, 24),
    new THREE.Vector2(-CHEEK_R - 0.02 + inset, bottom + 0.06),
  ];
  const half = thickness / 2;
  return loft(outline, [
    [bevel, -half],
    [0, -half + bevel],
    [0, half - bevel],
    [bevel, half],
  ]);
}

/**
 * A triangular gusset standing on the flange against a cheek's outer face: `out` from the face
 * along +z, `up` it, `thickness` thick in x, its corner at the origin.
 */
function gussetGeometry(out: number, up: number, thickness: number) {
  const outline: Outline = () => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(out, 0),
    new THREE.Vector2(0, up),
  ];
  const geometry = loft(outline, [
    [0, -thickness / 2],
    [0, thickness / 2],
  ]);
  geometry.rotateY(-Math.PI / 2); // the outline's x (out) along +z, its thickness along x
  return geometry;
}

/**
 * The angle scale's ticks as thin quads facing +z: one every 5° from 0° to 90°, longer every 15°,
 * where the pointer — the barrel's axis behind the pivot — lies at that angle: (−cos θ, −sin θ).
 */
function tickGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let deg = 0; deg <= 90; deg += 5) {
    const t = (deg * Math.PI) / 180;
    const dx = -Math.cos(t);
    const dy = -Math.sin(t);
    const inner = deg % 15 === 0 ? 0.052 : 0.062;
    const outer = SCALE_OUT - 0.003;
    const half = deg % 15 === 0 ? 0.0011 : 0.0007;
    const nx = -dy * half;
    const ny = dx * half;
    const base = positions.length / 3;
    positions.push(
      dx * inner - nx,
      dy * inner - ny,
      0,
      dx * outer - nx,
      dy * outer - ny,
      0,
      dx * outer + nx,
      dy * outer + ny,
      0,
      dx * inner + nx,
      dy * inner + ny,
      0,
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
