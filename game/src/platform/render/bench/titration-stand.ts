import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import {
  baseFraction,
  CONICAL_FLASK_250,
  CONICAL_LIQUID_250,
  conicalFlaskLevel,
  deliveredShown,
  DROP_ML,
  indicatorFor,
  indicatorTint,
  WATER,
} from '../../labVisuals/chemistry';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

const T: [number, number, number] = [1, 1, 1]; // indicatorTransmittance's reused result

// The acid–base titration (model `acid-base.titration`): a retort stand whose burette clamp holds a
// 50 mL burette over a 250 mL conical flask on a white tile; beside it the NaOH bottle, the
// burette funnel resting in a beaker of NaOH, the indicator's dropper bottle and the volumetric
// pipette on its rests. The rig: the NaOH column in the burette, falling with `volume` (0 mL at the
// top mark); the liquid in the flask, rising with the acid sample plus `volume`, its colour the
// indicator's at the model's `pH`; the stopcock's key, open while a run is in progress; and the
// drops falling from the tip while it is open. Real sizes in metres.
//
// Layout: the stand's frame `s` has its origin on the burette's axis at the item's floor (+z: the
// front, towards the player); `bench.top` is the tile's top under the burette, where the flask
// stands. Everything is placed from `bench.top`, so frame and rig always agree.

type G = THREE.BufferGeometry;
type Profile = readonly (readonly [r: number, y: number])[];

const BASE = { width: 0.17, depth: 0.25, height: 0.012, z: -0.01 }; // cast-iron foot, rod at back
const TILE = { size: 0.15, height: 0.006 };
/** The tile's top above the floor: `bench.top`'s height. */
const TILE_TOP = BASE.height + TILE.height;
const ROD = { radius: 0.006, z: -0.1, top: 0.735 };
const BOSS = { y: 0.712, x: 0.03, y1: 0.035, z: 0.032 }; // boss head on the rod, holding the arm
/**
 * The 50 mL burette: tube radius and bore; the tip's end, the stopcock's axis, the tube's foot
 * above the stopcock, the 50 mL and 0 mL marks and the rim (heights above the floor).
 */
const BURETTE = {
  radius: 0.0072,
  bore: Math.sqrt(1e-6 / (Math.PI * 0.009)), // 5.95 mm: 1 mL fills the 9 mm the scale gives it
  tip: 0.15,
  cock: 0.19,
  tube: 0.205,
  full: 0.23,
  zero: 0.68,
  top: 0.745,
  capacity: 50, // mL between the 0 and 50 marks
};
const ML = (BURETTE.zero - BURETTE.full) / BURETTE.capacity; // m of tube per mL (9 mm)
/** The 250 mL conical flask: foot and neck radius (outside), where the cone meets the neck, height. */
const FLASK = CONICAL_FLASK_250;
/** The liquid in the flask: a frustum inside the cone's wall, from just above its bottom. */
const LIQUID = {
  ...CONICAL_LIQUID_250, // radius, inward slope per metre up, and the height it is drawn at, then moved
  bottom: TILE_TOP + FLASK.wall + 0.0002,
};
const DROP = Math.cbrt((3 * DROP_ML * 1e-6) / (4 * Math.PI)); // its radius, 2.3 mm
const MAX_DROPS = 4;
const G_ACC = 9.81;
// Drawing fallbacks while the pose has no setting (the definition's defaults): never a model input.
const DEFAULT = { acidVolume: 25, endpointPH: 8.2, flowRate: 0.25 };

/** Side props, in `s`: bottle, beaker (with the funnel), dropper bottle, pipette (lying along x). */
const BOTTLE = { x: 0.17, z: -0.06, radius: 0.0325 };
const BEAKER = { x: 0.27, z: -0.06, radius: 0.025, height: 0.07 };
const DROPPER = { x: 0.25, z: 0.05 };
const PIPETTE = { x: -0.03, y: 0.0145, z: 0.16, length: 0.44 };

/** One canvas, drawn once per frame built: the burette's graduations and the bottle's label. */
const ATLAS = { width: 256, height: 2048 };
const STRIP = {
  radius: BURETTE.radius + 0.0003,
  arc: 2, // rad of the tube's front the marks wrap
  bottom: BURETTE.full - 0.012,
  top: BURETTE.zero + 0.012,
  px: 96, // its width in the atlas
};
const LABEL = { x: 100, width: 156, height: 300, radius: BOTTLE.radius + 0.0004, arc: 1.7 };
const LABEL_Y = { center: 0.058, height: 0.05 };

export { baseFraction, indicatorFor };

/** Liquid height (m) of `ml` in the flask's cone: frustum volume π/(3k)·(R³ − r³), r = R − k·h. */
export function flaskLevel(ml: number): number {
  return conicalFlaskLevel(ml);
}

/** The burette's meniscus (m above the floor) after `ml` delivered, read down from the 0 mark. */
export function buretteLevel(ml: number): number {
  // Drawing only: past the tube's foot there is nothing left to show (the model stops < 50 mL).
  return Math.max(BURETTE.zero - deliveredShown(ml) * ML, BURETTE.tube);
}

/** The stand's origin (`s`) in the item's frame (origin at the centre of its box). */
function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, TILE_TOP, 0];
  return new THREE.Vector3(x, y - TILE_TOP - item.visual.size[1] / 2, z);
}

// ---- geometry -------------------------------------------------------------------------------

/** A solid of revolution about +y through (r, y); outward when the profile climbs. */
function lathe(profile: Profile, segments = 24): G {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  // three's lathe leaves its last ring's normals unnormalised.
  const normal = g.getAttribute('normal');
  const n = new THREE.Vector3();
  for (let i = 0; i < normal.count; i++) {
    n.fromBufferAttribute(normal, i).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** A cylinder r × h centred at (x, y, z), along `axis`. */
function cylinder(
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  sides = 12,
  axis: 'x' | 'y' | 'z' = 'y',
) {
  const g = new THREE.CylinderGeometry(r, r, h, sides);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

const linear = new THREE.Color();
/** Gives every vertex `hex`'s colour (one plastic material draws several colours). */
function tint(geometry: G, hex: string): G {
  linear.set(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([linear.r, linear.g, linear.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** The pieces as one geometry (one draw), texture coordinates kept only if asked; pieces freed. */
function merged(pieces: G[], uv = false): G {
  for (const piece of pieces) {
    if (!uv) piece.deleteAttribute('uv');
    if (!piece.index) piece.setIndex([...Array(piece.getAttribute('position').count).keys()]);
  }
  const geometry = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return geometry;
}

/** Painted cast parts (the entity's mesh: focus shows on them): foot, boss head, burette clamp. */
function bodyPieces(): G[] {
  const foot = slab(BASE.width, BASE.depth, BASE.height, 0.014, 0.003).translate(0, 0, BASE.z);
  const boss = slab(BOSS.x, BOSS.z, BOSS.y1, 0.004, 0.0015).translate(
    0,
    BOSS.y - BOSS.y1 / 2,
    ROD.z,
  );
  const jawX = BURETTE.radius + 0.0045;
  return [
    foot,
    boss,
    box(0.034, 0.024, 0.006, 0, BOSS.y, -BURETTE.radius - 0.009), // the clamp's yoke
    ...[-1, 1].map((s) => box(0.004, 0.024, 0.0282, s * jawX, BOSS.y, -0.002)), // its jaws
  ];
}

/** Bright steel: rod and its nut, the clamp's arm, thumb-screw shafts, the jaws' wing screw. */
function steelPieces(): G[] {
  const arm = { from: ROD.z + BOSS.z / 2, to: -BURETTE.radius - 0.012 };
  return [
    cylinder(ROD.radius, ROD.top - BASE.height, 0, (ROD.top + BASE.height) / 2, ROD.z, 16),
    cylinder(0.011, 0.007, 0, BASE.height + 0.0035, ROD.z, 6),
    cylinder(0.0045, arm.to - arm.from, 0, BOSS.y, (arm.from + arm.to) / 2, 10, 'z'),
    cylinder(0.0025, 0.012, -BOSS.x / 2 - 0.006, BOSS.y + 0.008, ROD.z, 8, 'x'),
    cylinder(0.0025, 0.012, BOSS.x / 2 + 0.006, BOSS.y - 0.008, ROD.z, 8, 'x'),
    cylinder(0.0022, 0.032, 0, BOSS.y, 0.0095, 8, 'x'), // the jaws' wing screw, and its wing
    box(0.003, 0.018, 0.004, 0.0175, BOSS.y, 0.0095),
  ];
}

/** Plastic, rubber, glaze and amber glass, coloured per vertex: one draw. */
function plasticPieces(): G[] {
  const knob = (x: number, y: number) =>
    tint(cylinder(0.008, 0.007, x, y, ROD.z, 12, 'x'), '#1f2328');
  const pad = (s: number) => tint(box(0.0024, 0.02, 0.012, s * 0.0086, BOSS.y, -0.004), '#26292d');
  const { x: bx, z: bz } = BOTTLE;
  const bottle = lathe([
    [0, 0],
    [0.0315, 0],
    [BOTTLE.radius, 0.003],
    [BOTTLE.radius, 0.105],
    [0.028, 0.118],
    [0.016, 0.126],
    [0.016, 0.136],
    [0, 0.136],
  ]).translate(bx, 0, bz);
  const { x: dx, z: dz } = DROPPER;
  const dropper = lathe(
    [
      [0, 0],
      [0.015, 0],
      [0.016, 0.002],
      [0.016, 0.05],
      [0.009, 0.058],
      [0.009, 0.064],
      [0, 0.064],
    ],
    16,
  ).translate(dx, 0, dz);
  const teat = lathe(
    [
      [0, 0.076],
      [0.006, 0.076],
      [0.006, 0.09],
      [0.0065, 0.094],
      [0.0045, 0.1],
      [0, 0.101],
    ],
    12,
  ).translate(dx, 0, dz);
  const rest = (x: number) =>
    tint(box(0.02, 0.011, 0.024, PIPETTE.x + x, 0.0055, PIPETTE.z), '#8c959e');
  return [
    knob(-BOSS.x / 2 - 0.0155, BOSS.y + 0.008),
    knob(BOSS.x / 2 + 0.0155, BOSS.y - 0.008),
    pad(-1),
    pad(1),
    tint(
      slab(TILE.size, TILE.size, TILE.height, 0.006, 0.0015).translate(0, BASE.height, 0),
      '#f3f4f1',
    ),
    tint(bottle, '#e7eaec'), // polyethylene: NaOH etches glass
    tint(cylinder(0.0175, 0.02, bx, 0.146, bz, 20), '#2f6fb3'),
    tint(dropper, '#7a4a1c'),
    tint(cylinder(0.0105, 0.012, dx, 0.07, dz, 16), '#1f2328'),
    tint(teat, '#2b2e32'),
    rest(0.04),
    rest(PIPETTE.length - 0.05),
    tint(cylinder(0.0038, 0.0009, 0, 0.36, 0, 12), '#1f2328') // the pipette's mark, laid below
      .rotateZ(-Math.PI / 2)
      .translate(PIPETTE.x, PIPETTE.y, PIPETTE.z),
  ];
}

/** A thin-walled vessel: up its outside, over the rim, down its inside (seen through the glass). */
function vessel(outside: Profile, inside: Profile, segments = 24): G {
  return lathe([...outside, ...inside], segments);
}

/** Clear glass: burette, its stopcock barrel and tip, the flask, the beaker, funnel and pipette. */
function glassPieces(): G[] {
  const { radius: r, bore } = BURETTE;
  const tube = vessel(
    // Tube and tip run into the stopcock's barrel (r 6.5 mm), fused like a glass stopcock.
    [
      [0.0035, 0.195],
      [r, BURETTE.tube],
      [r, BURETTE.top - 0.01],
      [r + 0.0013, BURETTE.top],
    ],
    [
      [bore + 0.0012, BURETTE.top],
      [bore, BURETTE.top - 0.01],
      [bore, BURETTE.tube + 0.001],
      [0.0025, 0.196],
    ],
    16,
  );
  const tip = lathe(
    [
      [0.0016, BURETTE.tip],
      [0.0035, BURETTE.cock - 0.005],
    ],
    12,
  );
  const { base, neck, shoulder, height, wall } = FLASK;
  const flask = vessel(
    [
      [0, 0],
      [base - 0.003, 0],
      [base, wall + 0.0015],
      [neck, shoulder],
      [neck, height - 0.004],
      [neck + 0.0018, height - 0.003],
      [neck + 0.0018, height],
    ],
    [
      [neck - wall, height],
      [neck - wall, shoulder],
      [base - wall, wall + 0.0015],
      [base - wall - 0.003, wall],
      [0, wall],
    ],
    32,
  ).translate(0, TILE_TOP, 0);
  const { radius: br, height: bh } = BEAKER;
  const beaker = vessel(
    [
      [0, 0],
      [br - 0.002, 0],
      [br, 0.002],
      [br, bh - 0.002],
      [br + 0.0015, bh],
    ],
    [
      [br - 0.0012, bh],
      [br - 0.0012, 0.0024],
      [br - 0.003, 0.0012],
      [0, 0.0012],
    ],
  ).translate(BEAKER.x, 0, BEAKER.z);
  // The funnel rests in the beaker: its cone meets the beaker's rim.
  const funnel = vessel(
    [
      [0.0035, 0],
      [0.0035, 0.03],
      [0.0325, 0.075],
      [0.0332, 0.0757],
    ],
    [
      [0.0318, 0.0757],
      [0.0025, 0.0312],
      [0.0025, 0],
    ],
  ).translate(BEAKER.x, 0.009, BEAKER.z);
  // The volumetric pipette, drawn upright from its tip, then laid along +x on its rests.
  const pipette = vessel(
    [
      [0.001, 0],
      [0.0035, 0.015],
      [0.0035, 0.135],
      [0.011, 0.152],
      [0.011, 0.245],
      [0.0035, 0.262],
      [0.0035, PIPETTE.length],
    ],
    [
      [0.0026, PIPETTE.length],
      [0.0026, 0.262],
      [0.0102, 0.245],
      [0.0102, 0.152],
      [0.0026, 0.135],
      [0.0026, 0.015],
      [0.0004, 0.001],
    ],
    16,
  )
    .rotateZ(-Math.PI / 2)
    .translate(PIPETTE.x, PIPETTE.y, PIPETTE.z);
  return [
    tube,
    cylinder(0.0065, 0.028, 0, BURETTE.cock, 0, 16, 'x'), // the stopcock's barrel
    tip,
    flask,
    beaker,
    funnel,
    pipette,
  ];
}

/** NaOH where it does not move: in the burette's tip and in the beaker. */
function liquidPieces(): G[] {
  return [
    lathe(
      [
        [0, BURETTE.tip + 0.002],
        [0.001, BURETTE.tip + 0.002],
        [0.0025, BURETTE.cock - 0.008],
        [0.0025, 0.198],
        [BURETTE.bore - 0.0002, BURETTE.tube + 0.001],
        [0, BURETTE.tube + 0.001],
      ],
      12,
    ),
    cylinder(BEAKER.radius - 0.0014, 0.023, BEAKER.x, 0.0012 + 0.0115, BEAKER.z, 24),
  ];
}

/** The graduations wrapped on the burette's front and the bottle's label, mapped into the atlas. */
function printPieces(): G[] {
  const strip = new THREE.CylinderGeometry(
    STRIP.radius,
    STRIP.radius,
    STRIP.top - STRIP.bottom,
    16,
    1,
    true,
    -STRIP.arc / 2,
    STRIP.arc,
  ).translate(0, (STRIP.top + STRIP.bottom) / 2, 0);
  remapUV(strip, 0, STRIP.px / ATLAS.width, 0, 1);
  const label = new THREE.CylinderGeometry(
    LABEL.radius,
    LABEL.radius,
    LABEL_Y.height,
    12,
    1,
    true,
    -LABEL.arc / 2,
    LABEL.arc,
  ).translate(BOTTLE.x, LABEL_Y.center, BOTTLE.z);
  const v0 = 1 - LABEL.height / ATLAS.height;
  remapUV(label, LABEL.x / ATLAS.width, LABEL.width / ATLAS.width, v0, 1 - v0);
  return [strip, label];
}

/** Maps a piece's 0–1 texture coordinates onto u0 + u·du, v0 + v·dv of the atlas. */
function remapUV(g: G, u0: number, du: number, v0: number, dv: number): void {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
}

/**
 * The atlas: graduations every 0.1 mL (longer every 0.5, longest and numbered every 1 mL, 0 at
 * the top) on a transparent strip, and the NaOH label with a corrosive-hazard frame. Null without
 * a 2D canvas (Node tests): the marks are then not drawn.
 */
function printAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS.width;
  canvas.height = ATLAS.height;
  const c = canvas.getContext('2d');
  if (!c) return null;
  // Pixels per metre down the strip and round it: text is widened to stay upright in metres.
  const down = ATLAS.height / (STRIP.top - STRIP.bottom);
  const across = STRIP.px / (STRIP.radius * STRIP.arc);
  c.clearRect(0, 0, ATLAS.width, ATLAS.height);
  c.fillStyle = '#15191d';
  c.font = 'bold 15px sans-serif';
  c.textBaseline = 'middle';
  for (let tenth = 0; tenth <= BURETTE.capacity * 10; tenth++) {
    const y = (STRIP.top - (BURETTE.zero - (tenth / 10) * ML)) * down;
    const length = tenth % 10 === 0 ? 52 : tenth % 5 === 0 ? 34 : 20;
    c.fillRect(4, y - 1, length, 2);
    if (tenth % 10 !== 0) continue;
    c.save();
    c.translate(60, y);
    c.scale(across / down, 1);
    c.fillText(String(tenth / 10), 0, 0);
    c.restore();
  }
  // The label: its height is LABEL_Y.height, its width LABEL.arc round the bottle.
  const squeeze = LABEL.width / (LABEL.radius * LABEL.arc) / (LABEL.height / LABEL_Y.height);
  const cx = LABEL.x + LABEL.width / 2;
  c.fillStyle = '#f5f5ef';
  c.fillRect(LABEL.x, 0, LABEL.width, LABEL.height);
  c.fillStyle = '#2f6fb3';
  c.fillRect(LABEL.x, 0, LABEL.width, 46);
  c.fillStyle = '#15191d';
  c.textAlign = 'center';
  const text = (s: string, px: number, y: number) => {
    c.save();
    c.translate(cx, y);
    c.scale(squeeze, 1);
    c.font = `bold ${px}px sans-serif`;
    c.fillText(s, 0, 0);
    c.restore();
  };
  text('NaOH', 64, 105);
  text('(aq)', 40, 162);
  const [dy, dx] = [44, 44 * squeeze];
  c.beginPath();
  c.moveTo(cx, 248 - dy);
  c.lineTo(cx + dx, 248);
  c.lineTo(cx, 248 + dy);
  c.lineTo(cx - dx, 248);
  c.closePath();
  c.strokeStyle = '#d0312d';
  c.lineWidth = 6;
  c.stroke();
  c.fillRect(cx - 9 * squeeze, 240, 18 * squeeze, 22); // the pictogram, abstracted
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ---- materials ------------------------------------------------------------------------------

// Draw order among see-through parts: the glass, then the liquids in it, then print on the glass.
// Liquid first would let the vessel's far wall (behind it, writing no depth) wash it out; this
// way only the near wall lands under the liquid, the smaller error. Within 1–2, as the other
// bench models, so the print never draws after other stations' glass.
const GLASS_ORDER = 1;
const LIQUID_ORDER = 1.5;
const PRINT_ORDER = 2;

const glassMaterial = () =>
  new THREE.MeshStandardMaterial({ color: '#d7ecf3', ...GLASSWARE_LOOK, depthWrite: false });

/** Clear NaOH(aq): nearly water. */
const clearLiquid = (opacity = 0.3) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(WATER[0], WATER[1], WATER[2]),
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
  });

/**
 * The flask's solution as a true filter: whatever is behind it times its transmittance (its
 * colour), so it is see-through against any background, not paint (premultiplied multiply).
 */
const filterLiquid = () =>
  new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.MultiplyBlending,
    premultipliedAlpha: true,
    toneMapped: false,
    depthWrite: false,
  });

/** The solution's surface reflection alone (black: adds no colour, only highlights). */
const sheenLiquid = () =>
  new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

/** A see-through part: no shadow, drawn in its place among the see-through parts. */
function seeThrough(mesh: THREE.Mesh, order: number): THREE.Mesh {
  mesh.castShadow = false;
  mesh.renderOrder = order;
  return mesh;
}

// ---- the model ------------------------------------------------------------------------------

/**
 * The fixed parts: the painted foot, boss and clamp (the entity's mesh), then one mesh per
 * material — steel, plastic (coloured per vertex), glass, the still NaOH, the print.
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const origin = originOf(item);
  kit.group.position.copy(origin);
  const body = keep(merged(bodyPieces()));
  body.translate(origin.x, origin.y, origin.z);
  mesh(
    keep(merged(steelPieces())),
    own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal })),
  ).name = 'steel';
  mesh(
    keep(merged(plasticPieces())),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
  ).name = 'plastic';
  seeThrough(mesh(keep(merged(glassPieces())), own(glassMaterial())), GLASS_ORDER).name = 'glass';
  seeThrough(mesh(keep(merged(liquidPieces())), own(clearLiquid())), LIQUID_ORDER).name = 'naoh';
  const atlas = printAtlas();
  if (atlas) {
    const ink = own(
      new THREE.MeshStandardMaterial({
        map: atlas,
        transparent: true,
        depthWrite: false,
        ...LOOKS.satin,
      }),
    );
    seeThrough(mesh(keep(merged(printPieces(), true)), ink), PRINT_ORDER).name = 'print';
  }
  return {
    body,
    parts: kit.group,
    dispose: () => {
      kit.dispose();
      atlas?.dispose(); // a material never frees its map
    },
  };
}

/**
 * What the run moves, at `bench.top`: the NaOH column in the burette, the flask's liquid, the
 * stopcock's key and the falling drops. `pose` assigns, skipping what has not changed: no geometry,
 * colour or matrix is made after this.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const origin = originOf(item);
  kit.group.position.set(origin.x, origin.y + TILE_TOP, origin.z); // bench.top
  const s = new THREE.Group(); // the stand's frame
  s.position.y = -TILE_TOP;
  kit.group.add(s);
  const naoh = own(clearLiquid());
  const solution = own(filterLiquid()); // the flask's: its colour follows the indicator

  // The column: a unit-high cylinder standing on the tube's foot, scaled to the meniscus.
  const column = seeThrough(
    mesh(
      keep(
        new THREE.CylinderGeometry(BURETTE.bore - 0.0002, BURETTE.bore - 0.0002, 1, 16).translate(
          0,
          0.5,
          0,
        ),
      ),
      naoh,
      s,
    ),
    LIQUID_ORDER,
  );
  column.name = 'column';
  column.position.y = BURETTE.tube;

  // The flask's liquid: a frustum along the cone's slope; only its top ring and cap move.
  const { radius: R, slope: k, ref } = LIQUID;
  const frustum = keep(
    new THREE.CylinderGeometry(R - k * ref, R, ref, 32, 1).translate(0, ref / 2, 0),
  );
  frustum.computeBoundingSphere(); // at its fullest: it only ever shrinks inside this
  const position = frustum.getAttribute('position') as THREE.BufferAttribute;
  const rest = Float32Array.from(position.array as Float32Array);
  const tops = Uint32Array.from(
    [...Array(position.count).keys()].filter((i) => position.getY(i) > ref / 2),
  );
  const flask = seeThrough(mesh(frustum, solution, s), LIQUID_ORDER);
  flask.name = 'solution';
  flask.position.y = LIQUID.bottom;
  // Its surface's highlights, over the filter (same geometry; made after it, so drawn after it).
  const sheen = seeThrough(mesh(frustum, own(sheenLiquid()), s), LIQUID_ORDER);
  sheen.name = 'sheen';
  sheen.position.y = LIQUID.bottom;

  // The stopcock's PTFE key across the barrel: its handle along the burette is open.
  const key = mesh(
    keep(
      merged([
        cylinder(0.0045, 0.04, 0, 0, 0, 12, 'x'),
        box(0.004, 0.026, 0.009, 0.022, 0, 0),
        cylinder(0.0055, 0.004, -0.022, 0, 0, 6, 'x'),
      ]),
    ),
    own(new THREE.MeshStandardMaterial({ color: '#f1f1ec', ...LOOKS.plastic })),
    s,
  );
  key.name = 'stopcock';
  key.position.y = BURETTE.cock;
  key.castShadow = false;

  const drops = copies(
    keep(new THREE.SphereGeometry(DROP, 8, 6)),
    own(clearLiquid(0.65)), // denser than the column's: a 2 mm drop must show over the tile
    Array.from({ length: MAX_DROPS }, () => new THREE.Matrix4()),
    s,
  );
  drops.name = 'drops';
  drops.castShadow = false;
  drops.renderOrder = LIQUID_ORDER;
  drops.frustumCulled = false; // they move: their bounds would go stale
  drops.count = 0;
  const place = new THREE.Matrix4();

  let open: boolean | null = null;
  let delivered = NaN;
  let sample = NaN; // the acid sample (mL) drawn
  let pH = NaN;
  let endpoint = NaN;
  let indicator = indicatorFor(DEFAULT.endpointPH);
  let surface = LIQUID.bottom;
  let clock = 0;

  const pose = ({ status, parameters, sample: values }: BenchPose, dt: number) => {
    const running = status === 'running';
    if (running !== open) {
      open = running;
      key.rotation.x = running ? 0 : Math.PI / 2;
    }

    // NaN: no run, the burette full to its 0 mark.
    const v = values.volume ?? NaN;
    const ml = v > 0 ? v : 0;
    const va = parameters.acidVolume ?? DEFAULT.acidVolume;
    if (ml !== delivered || va !== sample) {
      delivered = ml;
      sample = va;
      const meniscus = buretteLevel(ml);
      column.visible = meniscus > BURETTE.tube;
      column.scale.y = Math.max(meniscus - BURETTE.tube, 1e-6);
      const h = flaskLevel(va + ml);
      const scale = (R - k * h) / (R - k * ref);
      for (let t = 0; t < tops.length; t++) {
        const i = tops[t] ?? 0;
        position.setXYZ(i, (rest[3 * i] ?? 0) * scale, h, (rest[3 * i + 2] ?? 0) * scale);
      }
      position.needsUpdate = true;
      surface = LIQUID.bottom + h;
    }

    const ph = values.pH ?? NaN;
    const end = parameters.endpointPH ?? DEFAULT.endpointPH;
    const swapped = end !== endpoint;
    if (swapped) {
      endpoint = end;
      indicator = indicatorFor(end); // only on a new setting: it allocates
    }
    if (swapped || !Object.is(ph, pH)) {
      pH = ph;
      // Transmittance per channel, mixed as absorbance: T_acid^(1−f)·T_base^f, through the water;
      // the filter multiplies what is behind by it.
      indicatorTint(indicator, ph, T);
      solution.color.setRGB(T[0], T[1], T[2]);
    }

    if (!running) {
      clock = 0;
      drops.count = 0;
      return;
    }
    // Drops leave the tip every DROP_ML / Q s and fall freely to the liquid's surface.
    clock += dt;
    const flow = parameters.flowRate ?? DEFAULT.flowRate;
    const every = DROP_ML / flow;
    const fall = flow > 0 ? Math.sqrt((2 * (BURETTE.tip - DROP - surface)) / G_ACC) : 0;
    let n = 0;
    for (let age = clock % every; n < MAX_DROPS && age < fall; age += every, n++) {
      place.makeTranslation(0, BURETTE.tip - DROP - (G_ACC * age * age) / 2, 0);
      drops.setMatrixAt(n, place);
    }
    drops.count = n;
    drops.instanceMatrix.needsUpdate = true;
  };
  pose({ status: 'idle', parameters: {}, sample: {} }, 0); // until its session exists
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const titrationStand: BenchModel = { frame, rig, reads: ['volume', 'pH'] };

/** The white tile on the stand's foot. */
function standTilePieces(): G[] {
  return [
    tint(
      slab(TILE.size, TILE.size, TILE.height, 0.006, 0.0015).translate(0, BASE.height, 0),
      '#f3f4f1',
    ),
  ];
}

/** The clamp's knobs and jaw pads (plastic, rubber), at the raised height as the rig poses it. */
function clampPlasticPieces(): G[] {
  const knob = (x: number, y: number) =>
    tint(cylinder(0.008, 0.007, x, y, ROD.z, 12, 'x'), '#1f2328');
  const pad = (s: number) => tint(box(0.0024, 0.02, 0.012, s * 0.0086, BOSS.y, -0.004), '#26292d');
  return [
    knob(-BOSS.x / 2 - 0.0155, BOSS.y + 0.008),
    knob(BOSS.x / 2 + 0.0155, BOSS.y - 0.008),
    pad(-1),
    pad(1),
  ];
}

/** The clamp's painted boss, yoke and jaws. */
function clampBodyPieces(): G[] {
  const pieces = bodyPieces();
  pieces.shift()?.dispose(); // the foot stays with the frame
  return pieces;
}

/** The clamp's bright steel: the arm and the thumb-screw shafts (the rod stays with the frame). */
function clampSteelPieces(): G[] {
  const pieces = steelPieces();
  for (const g of pieces.splice(0, 2)) g.dispose(); // the rod and its nut
  return pieces;
}

/**
 * The physical lab's retort stand (Phase B): the same foot, rod, boss and burette clamp as the
 * titration rig, and the white tile, but no glassware — the burette, the flask and the bottles are
 * entities of their own, drawn from their container state (ContainerView). Nothing moves here.
 */
function standFrame(item: ItemDefinition): BenchFrame {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const origin = originOf(item);
  kit.group.position.copy(origin);
  const pieces = bodyPieces();
  const body = keep(merged(pieces.slice(0, 1))); // the foot
  for (const g of pieces.slice(1)) g.dispose();
  body.translate(origin.x, origin.y, origin.z);
  const steel = steelPieces();
  mesh(
    keep(merged(steel.slice(0, 2))), // the rod and its nut
    own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal })),
  ).name = 'steel';
  for (const g of steel.slice(2)) g.dispose();
  mesh(
    keep(merged(standTilePieces())),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
  ).name = 'plastic';
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/**
 * The clamp, sliding on the rod: drawn at its raised height and moved down by the item's own
 * clamp's `center` − `lowered` while the stand's `clampRaised` state is not set (StationSystem).
 */
function clampRig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const clamp = item.clamps?.find((c) => c.lowered);
  const drop = clamp?.lowered ? clamp.center[1] - clamp.lowered[1] : 0;
  const slider = new THREE.Group();
  kit.group.add(slider);
  const painted = own(new THREE.MeshStandardMaterial({ color: '#34465c', ...LOOKS.painted }));
  const parts = [
    mesh(keep(merged(clampBodyPieces())), painted),
    mesh(
      keep(merged(clampSteelPieces())),
      own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal })),
    ),
    mesh(
      keep(merged(clampPlasticPieces())),
      own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
    ),
  ];
  for (const part of parts) {
    part.removeFromParent();
    slider.add(part);
  }
  slider.name = 'clamp';
  let raised: boolean | null = null;
  return {
    group: kit.group,
    pose(p) {
      const now = p.state?.('clampRaised') === true;
      if (now === raised) return;
      raised = now;
      slider.position.y = now ? 0 : -drop;
    },
    dispose: () => kit.dispose(),
  };
}

export const retortStand: BenchModel = { frame: standFrame, rig: clampRig };
