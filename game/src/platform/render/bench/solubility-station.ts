import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { arc, Assembly, loft, type Outline, roundRect, slab, swaps } from '../assembly';
import {
  APPARENT,
  BED_GRAINS,
  bedGrains,
  DENSITY,
  PACKING,
  solutionLevel,
  WATER_MASS,
} from '../../labVisuals/chemistry';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { box, drum, rod, sphere } from '../props/parts';
import { BEAKER, STIR_BAR } from './hot-plate';
import { SEGMENTS } from './osmosis-rack';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The solubility bench (model chemistry.solubility) on a 0.80 × 0.35 m patch of bench, real sizes
 * in metres, from the item's base centre (+z is the front). `bench.top` is the hot plate's top
 * centre, where the beaker stands.
 * Fixed (frame): a hot-plate stirrer (its housing and the balance's case are the entity's mesh, in
 * the item's colour: the largest parts, so focus shows) with a temperature display, a pilot light
 * and its stir knob on the sloping panel; a retort stand and clamp holding a stainless temperature
 * probe into the water; a 250 mL low-form beaker (the heating curve's) with its white stir bar;
 * three glass reagent jars of white solid, a label band each, a spatula; a filter funnel with its
 * paper on a 250 mL conical flask; a top-pan balance (the osmosis bench's) and a digital timer.
 * Moving (rig, from the station only): the plate's warmth and the pilot light (the dialled T, off
 * at 20 °C: room temperature), the temperature display (T, °C), the open jar's cap (the dialled
 * solid: lifted off and set in front of its jar), the weighed solid as a heap in the weighing dish
 * on the balance before a run (its bulk m/(0.6·ρ), ρ the solid's crystal density, 0.6 a packing
 * fraction: look only) and the balance reading m to the dialled d; during a run the dish empty
 * beside the balance, the balance at 0, the bed of crystals on the beaker's floor (`undissolved`,
 * the same bulk, as grains that go one by one), the water's level (the water, the dissolved
 * solid's apparent volume at 0.35 mL/g — look only — and the crystals' own volume) and the timer
 * (`labTime`, m:ss); once completed, the beaker filtered clear, the dried residue (`undissolved`)
 * heaped on a filter paper on the pan and weighed to d. Readings use `measurement.ts`: nearest
 * multiple of d, never anything else.
 */

// The solute densities, packing and apparent volume are shared with the 2D workspace.
export { APPARENT, DENSITY, PACKING, WATER_MASS };
/** Room temperature (°C): the plate holds the water there without heating. */
export const ROOM = 20;

const INNER = BEAKER.radius - BEAKER.wall;
const FOOT = 0.006;
const PLATE = { radius: 0.075, thick: 0.008 };
const HOUSING = { width: 0.2, back: -0.1, deck: 0.1, front: 0.14, height: 0.066, panel: 0.03 };
const TILT = Math.atan2(HOUSING.height - HOUSING.panel, HOUSING.front - HOUSING.deck);
/** The sloping panel's centre, from the base (y) and the plate's centre (z); its outward normal. */
const PANEL = {
  z: (HOUSING.deck + HOUSING.front) / 2,
  y: FOOT + (HOUSING.height + HOUSING.panel) / 2,
};
const PANEL_NORMAL = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
const DISPLAY_X = -0.045;
const STIR_KNOB_X = 0.035;
const LAMP_X = 0.072;
const STAND = { x: -0.365, z: 0.02, baseW: 0.07, baseD: 0.12, baseH: 0.014, rod: 0.006, top: 0.4 };
const ROD_Z = -0.03;
const CLAMP_Y = 0.275;
/** The probe: Ø 3 mm stainless, 0.2 m, its tip 1 cm over the plate, held by its handle. */
const PROBE = { dx: 0.02, radius: 0.0015, tip: 0.01, length: 0.2, handle: 0.005 };
const JARS = { z: -0.11, x: [-0.02, 0.04, 0.1], radius: 0.024, height: 0.075, cap: 0.014 };
const CAPS = ['#2f6fb3', '#b8302a', '#2f8a4a']; // KNO₃ blue, NaCl red, KCl green
const FLASK = { x: 0, z: 0.08, base: 0.0425, neck: 0.017, shoulder: 0.104, height: 0.14 };
const FUNNEL = { stem: 0.004, bottom: 0.1, cone: 0.16, radius: 0.04, top: 0.225 };
const BALANCE = { x: 0.27, z: 0, width: 0.2, depth: 0.25, height: 0.055, feet: 0.004 };
const BALANCE_TOP = BALANCE.feet + BALANCE.height;
const PAN = { z: -0.04, radius: 0.06, post: 0.005, floor: 0.003, rim: 0.006 };
/** The pan's floor: where the dish or the filter paper lies. */
export const PAN_Y = BALANCE_TOP + PAN.post + PAN.floor;
const SLOPE = { front: 0.125, low: 0.025, back: 0.055 };
const TIMER = { x: 0.12, z: 0.14, width: 0.06, depth: 0.022, height: 0.045 };
/** The weighing dish: a square tray, on the pan before a run, beside the balance during one. */
const DISH = { size: 0.1, flare: 0.006, height: 0.018, x: 0.115, z: 0.02 };
const PAPER = { radius: 0.055, thick: 0.0005 };
/** The heap: half an ellipsoid, height 0.4 of its radius: V = (0.8/3)·π·r³. */
const HEAP_ASPECT = 0.4;
const GRAINS = BED_GRAINS;
const GRAIN = 0.0045;
const BED_RADIUS = INNER - GRAIN; // the outer grains just clear the glass

const LIQUID_ORDER = 1;
const GLASS_ORDER = 2;
const DASH = 0x40;
const SLOTS = 8;

/** The heap's radius (m) for a bulk volume (cm³): its half-ellipsoid at HEAP_ASPECT. */
export const heapRadius = (cm3: number) =>
  Math.cbrt((3 * cm3 * 1e-6) / (2 * HEAP_ASPECT * Math.PI));

export const grainsOf = bedGrains;

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A convex polygon (counter-clockwise), each edge moved in by the inset (a chamfer). */
const polygon =
  (points: readonly (readonly [number, number])[]): Outline =>
  (inset) =>
    points.map(([x, y], i) => {
      const [px, py] = points[(i + points.length - 1) % points.length] ?? [x, y];
      const [nx, ny] = points[(i + 1) % points.length] ?? [x, y];
      const a = new THREE.Vector2(-(y - py), x - px).normalize(); // inward normals
      const b = new THREE.Vector2(-(ny - y), nx - x).normalize();
      const miter = inset / (1 + a.dot(b));
      return new THREE.Vector2(x, y).addScaledVector(a.add(b), miter);
    });

/** A lathe from (radius, height) pairs. */
const lathe = (profile: readonly (readonly [number, number])[], segments = 24) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

type Piece = readonly [geometry: THREE.BufferGeometry, color?: string];

/** Pieces merged into one geometry (one draw), each in its own vertex colour if it has one. */
function merge(pieces: readonly Piece[]): THREE.BufferGeometry {
  const color = new THREE.Color();
  for (const [g, hex] of pieces) {
    g.deleteAttribute('uv');
    if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    if (hex === undefined) continue;
    color.set(hex);
    const count = g.getAttribute('position').count;
    const rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(rgb, 3 * i);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  }
  const merged = mergeGeometries(pieces.map(([g]) => g));
  for (const [g] of pieces) g.dispose();
  return merged;
}

/** A geometry laid on the hot plate's sloping panel, `lift` out along its normal, at `along` x. */
function onPanel(g: THREE.BufferGeometry, A: THREE.Vector3, along: number, lift: number) {
  return g
    .rotateX(TILT - Math.PI / 2) // a face towards +z turned to face out of the slope
    .translate(A.x + along, PANEL.y + PANEL_NORMAL.y * lift, A.z + PANEL.z + PANEL_NORMAL.z * lift);
}

/** The balance's sloped front: its centre, normal, and the turn about x that lays a +z face on it. */
function slopeFace(along: number) {
  const run = SLOPE.front - SLOPE.back;
  const rise = BALANCE.height - SLOPE.low;
  const tilt = Math.atan2(rise, run);
  const normal = new THREE.Vector3(0, run, rise).normalize();
  const centre = new THREE.Vector3(
    BALANCE.x + along,
    BALANCE.feet + (SLOPE.low + BALANCE.height) / 2,
    BALANCE.z + (SLOPE.front + SLOPE.back) / 2,
  );
  return { centre, normal, turn: -(Math.PI / 2 - tilt) };
}

/** The beaker's glass (the heating curve's 250 mL low form): outer and inner wall, rolled rim. */
function beakerGlass(): THREE.BufferGeometry {
  const { radius: R, wall, height: H, base: B } = BEAKER;
  const corner = (cx: number, cy: number, r: number, a0: number, a1: number) =>
    arc(cx, cy, r, a0, a1, 3).map((p) => [p.x, p.y] as const);
  return lathe(
    [
      [0, 0],
      ...corner(R - 0.005, 0.005, 0.005, -Math.PI / 2, 0),
      [R, H - 0.003],
      [R + 0.0009, H - 0.0018],
      [R + 0.0009, H - 0.0006],
      [R + 0.0002, H],
      [R - wall, H],
      ...corner(R - wall - 0.004, B + 0.004, 0.004, 0, -Math.PI / 2),
      [0, B],
    ],
    40,
  );
}

/**
 * The fixed parts: the housing and the balance case (the entity's mesh) and, merged by material,
 * the plastic and dark parts (feet, panel, knob, stand base, clamp, timer, keys, bezel), the
 * steel (rod, arm, probe, pan, spatula), the matte whites (jar labels and contents, filter paper),
 * the glass (beaker, jars, funnel, flask) and the displays' backlit panels.
 */
function frame(item: ItemDefinition): BenchFrame {
  const [, h] = item.visual.size;
  const A = new THREE.Vector3().fromArray(item.bench?.top ?? [0, 0, 0]);
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.y = -h / 2; // the parts are laid out from the base
  const plastic = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.plastic }),
  );
  const metal = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.metal }),
  );
  const matte = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.matte }),
  );
  const glass = own(
    new THREE.MeshStandardMaterial({
      color: '#e4f1f6',
      ...GLASSWARE_LOOK,
      opacity: 0.25,
      depthWrite: false, // see-through: the water, the crystals and the probe inside show
    }),
  );
  const backlit = own(new THREE.MeshBasicMaterial({ color: '#b7c6a2' })); // reads at any light

  // The entity's mesh: the hot plate's housing (its side profile lofted across x) and the balance.
  const v = (z: number, y: number): readonly [number, number] => [z, y];
  const { width, back, deck, front, height, panel } = HOUSING;
  const bevel = 0.003;
  const housing = loft(
    polygon([v(back, 0), v(front, 0), v(front, panel), v(deck, height), v(back, height)]),
    [
      [bevel, -width / 2],
      [0, -width / 2 + bevel],
      [0, width / 2 - bevel],
      [bevel, width / 2],
    ],
  )
    .rotateY(-Math.PI / 2) // the profile's x along +z, the loft along x
    .translate(A.x, FOOT, A.z);
  const balanceCase = loft(
    polygon([
      [-BALANCE.depth / 2, 0],
      [SLOPE.front, 0],
      [SLOPE.front, SLOPE.low],
      [SLOPE.back, BALANCE.height],
      [-BALANCE.depth / 2, BALANCE.height],
    ]),
    [
      [bevel, -BALANCE.width / 2],
      [0, -BALANCE.width / 2 + bevel],
      [0, BALANCE.width / 2 - bevel],
      [bevel, BALANCE.width / 2],
    ],
  )
    .rotateY(-Math.PI / 2)
    .translate(BALANCE.x, BALANCE.feet, BALANCE.z);
  const body = keep(merge([[housing], [balanceCase]]));
  body.translate(0, -h / 2, 0);

  const dark = '#2b2f36';
  const shell: Piece[] = [];
  const steel: Piece[] = [];
  const soft: Piece[] = [];
  const glassPieces: Piece[] = [];
  const panels: Piece[] = [];
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // The hot plate: four feet, the panel's face, the display bezel and panel, the stir knob.
  for (const fx of [-1, 1]) {
    for (const fz of [back + 0.025, front - 0.03]) {
      shell.push([
        drum(0.011, 0.012, 0, FOOT, 12).translate(A.x + fx * (width / 2 - 0.025), 0, A.z + fz),
        '#202428',
      ]);
    }
  }
  shell.push([onPanel(new THREE.PlaneGeometry(0.17, 0.042), A, 0, 0.001), dark]);
  shell.push([onPanel(box(0.052, 0.024, 0.002), A, DISPLAY_X, 0.001), '#15181c']);
  panels.push([onPanel(new THREE.PlaneGeometry(0.046, 0.018), A, DISPLAY_X, 0.0021)]);
  shell.push([
    onPanel(
      lathe([
        [0, 0],
        [0.011, 0],
        [0.011, 0.004],
        [0.0085, 0.006],
        [0.008, 0.012],
        [0.0068, 0.014],
        [0, 0.014],
      ]).rotateX(Math.PI / 2), // its axis along +z, then out of the slope
      A,
      STIR_KNOB_X,
      0.001,
    ),
    '#202428',
  ]);
  shell.push([
    onPanel(box(0.0014, 0.007, 0.0008, 0, 0.004, 0.0152), A, STIR_KNOB_X, 0.001),
    '#f2f2f2',
  ]);

  // The stand: cast base, rod, boss head, arm to the probe's handle, jaws.
  const sx = STAND.x;
  const rodZ = A.z + ROD_Z;
  shell.push([
    slab(STAND.baseW, STAND.baseD, STAND.baseH, 0.01, 0.003).translate(STAND.x, 0, A.z + STAND.z),
    dark,
  ]);
  const baseTop = STAND.baseH;
  steel.push([
    drum(STAND.rod, STAND.rod, baseTop, STAND.top, 12).translate(sx, 0, rodZ),
    '#b4bcc4',
  ]);
  steel.push([drum(0.011, 0.011, baseTop, baseTop + 0.01, 6).translate(sx, 0, rodZ), '#9aa2aa']);
  shell.push([slab(0.026, 0.026, 0.032, 0.003, 0.0015).translate(sx, CLAMP_Y - 0.016, rodZ), dark]);
  const px = A.x + PROBE.dx;
  const jaw = PROBE.handle + 0.0025;
  steel.push([rod(0.004, p(sx + 0.013, CLAMP_Y, rodZ), p(px - 0.016, CLAMP_Y, A.z)), '#b4bcc4']);
  steel.push([
    rod(0.002, p(sx - 0.013, CLAMP_Y - 0.006, rodZ), p(sx - 0.03, CLAMP_Y - 0.006, rodZ)),
    '#b4bcc4',
  ]);
  shell.push([box(0.012, 0.016, 0.004, px - 0.004, CLAMP_Y, A.z - jaw), dark]);
  shell.push([box(0.012, 0.016, 0.004, px - 0.004, CLAMP_Y, A.z + jaw), dark]);
  shell.push([box(0.006, 0.016, 2 * jaw + 0.004, px - 0.013, CLAMP_Y, A.z), dark]);
  // The probe: its stainless sheath into the water, a black handle in the jaws.
  const tip = A.y + PROBE.tip;
  steel.push([
    drum(PROBE.radius, PROBE.radius, tip, tip + PROBE.length, 8).translate(px, 0, A.z),
    '#d7dde2',
  ]);
  shell.push([
    drum(
      PROBE.handle,
      PROBE.handle,
      tip + PROBE.length - 0.03,
      tip + PROBE.length + 0.015,
      10,
    ).translate(px, 0, A.z),
    '#15181c',
  ]);

  // The beaker on the plate; the reagent jars with white solid and a label band; the spatula.
  glassPieces.push([beakerGlass().translate(A.x, A.y, A.z)]);
  for (const jx of JARS.x) {
    const r = JARS.radius;
    glassPieces.push([
      lathe(
        [
          [0, 0],
          [r - 0.004, 0],
          [r, 0.004],
          [r, JARS.height - 0.012],
          [r - 0.005, JARS.height - 0.004],
          [r - 0.005, JARS.height],
          [r - 0.0065, JARS.height],
          [r - 0.0065, JARS.height - 0.004],
          [r - 0.0015, JARS.height - 0.012],
          [r - 0.0015, 0.003],
          [0, 0.003],
        ],
        24,
      ).translate(jx, 0, JARS.z),
    ]);
    soft.push([drum(r - 0.002, r - 0.002, 0.003, 0.05, 20).translate(jx, 0, JARS.z), '#f4f3ee']);
    soft.push([
      new THREE.CylinderGeometry(r + 0.0003, r + 0.0003, 0.03, 16, 1, true, -0.9, 1.8).translate(
        jx,
        0.038,
        JARS.z,
      ),
      '#fbfaf5',
    ]);
  }
  const spatula = { x: 0.04, z: -0.06 };
  steel.push([box(0.12, 0.0015, 0.007, spatula.x, 0.00075, spatula.z), '#c4cad0']);
  steel.push([box(0.04, 0.0008, 0.014, spatula.x + 0.078, 0.0004, spatula.z), '#d7dde2']);

  // The conical flask, the funnel in its neck, the filter paper folded in the funnel.
  glassPieces.push([
    lathe(
      [
        [0, 0],
        [FLASK.base - 0.004, 0],
        [FLASK.base, 0.006],
        [FLASK.neck, FLASK.shoulder],
        [FLASK.neck, FLASK.height - 0.004],
        [FLASK.neck + 0.0015, FLASK.height],
        [FLASK.neck - 0.001, FLASK.height],
        [FLASK.neck - 0.001, FLASK.shoulder - 0.002],
        [FLASK.base - 0.0015, 0.005],
        [0, 0.0015],
      ],
      32,
    ).translate(FLASK.x, 0, FLASK.z),
  ]);
  glassPieces.push([
    lathe(
      [
        [FUNNEL.stem, FUNNEL.bottom],
        [FUNNEL.stem, FUNNEL.cone],
        [FUNNEL.radius, FUNNEL.top],
        [FUNNEL.radius + 0.0012, FUNNEL.top + 0.001],
        [FUNNEL.radius - 0.001, FUNNEL.top],
        [FUNNEL.stem - 0.001, FUNNEL.cone],
        [FUNNEL.stem - 0.001, FUNNEL.bottom],
      ],
      32,
    ).translate(FLASK.x, 0, FLASK.z),
  ]);
  soft.push([
    new THREE.CylinderGeometry(
      FUNNEL.radius - 0.004,
      0.003,
      FUNNEL.top - FUNNEL.cone - 0.006,
      24,
      1,
      true,
    ).translate(FLASK.x, (FUNNEL.top + FUNNEL.cone) / 2 - 0.003, FLASK.z),
    '#f7f5ee',
  ]);

  // The balance: feet, the pan on its post, the display's bezel and panel, two keys.
  for (const bx of [-1, 1]) {
    for (const bz of [-1, 1]) {
      shell.push([
        new THREE.CylinderGeometry(0.008, 0.008, BALANCE.feet, 10).translate(
          BALANCE.x + bx * (BALANCE.width / 2 - 0.02),
          BALANCE.feet / 2,
          BALANCE.z + bz * (BALANCE.depth / 2 - 0.025),
        ),
        '#202428',
      ]);
    }
  }
  const panZ = BALANCE.z + PAN.z;
  steel.push([
    drum(0.018, 0.015, BALANCE_TOP, BALANCE_TOP + PAN.post, 16).translate(BALANCE.x, 0, panZ),
    '#9aa2aa',
  ]);
  const { radius: pr, floor, rim } = PAN;
  steel.push([
    lathe(
      [
        [0, 0],
        [pr - 0.003, 0],
        [pr, rim / 2],
        [pr, rim],
        [pr - 0.0015, rim],
        [pr - 0.004, floor],
        [0, floor],
      ],
      40,
    ).translate(BALANCE.x, BALANCE_TOP + PAN.post, panZ),
    '#cdd2d7',
  ]);
  const face = slopeFace(-0.015);
  const onSlope = (g: THREE.BufferGeometry, lift: number, along = 0) =>
    g
      .rotateX(face.turn)
      .translate(
        face.centre.x + along,
        face.centre.y + face.normal.y * lift,
        face.centre.z + face.normal.z * lift,
      );
  shell.push([onSlope(box(0.088, 0.03, 0.002), 0), dark]);
  panels.push([onSlope(new THREE.PlaneGeometry(0.08, 0.024), 0.0011)]);
  for (const k of [0, 1])
    shell.push([onSlope(box(0.012, 0.009, 0.003), 0, 0.063 + k * 0.018), dark]);

  // The timer: a white case, two keys on top, its display facing +z.
  shell.push([
    slab(TIMER.width, TIMER.depth, TIMER.height, 0.004, 0.0015).translate(TIMER.x, 0, TIMER.z),
    '#f2f2ef',
  ]);
  for (const s of [-1, 1]) {
    shell.push([
      box(0.012, 0.003, 0.01, TIMER.x + s * 0.014, TIMER.height + 0.0015, TIMER.z),
      dark,
    ]);
  }
  panels.push([
    new THREE.PlaneGeometry(0.048, 0.02).translate(
      TIMER.x,
      TIMER.height * 0.55,
      TIMER.z + TIMER.depth / 2 + 0.0004,
    ),
  ]);

  const part = (name: string, pieces: Piece[], material: THREE.Material, casts = true) => {
    const m = mesh(keep(merge(pieces)), material);
    m.name = name;
    m.castShadow = casts;
    return m;
  };
  part('shell', shell, plastic);
  part('metal', steel, metal);
  part('soft', soft, matte);
  part('glass', glassPieces, glass, false).renderOrder = GLASS_ORDER; // after the water inside
  part('backlit', panels, backlit, false);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** A 7-segment readout, as the osmosis bench's: `places` transforms for a digit `size` each. */
interface Readout {
  readonly mesh: THREE.InstancedMesh;
  readonly on: readonly THREE.Matrix4[];
  readonly off: readonly THREE.Matrix4[];
  /** Each place's lit segments (bit 7: its decimal point) as now drawn; −1 before the first. */
  readonly shown: Int16Array;
}

function readout(
  kit: Assembly,
  unit: THREE.BufferGeometry,
  parent: THREE.Object3D,
  material: THREE.Material,
  name: string,
  places: readonly THREE.Matrix4[],
  size: { width: number; height: number; stroke: number },
  extra: readonly THREE.Matrix4[] = [],
): Readout {
  const { width: w, height: h, stroke: s } = size;
  const t = 0.0002;
  const layout: readonly (readonly [number, number, boolean | null])[] = [
    [0, h / 2, true],
    [w / 2, h / 4, false],
    [w / 2, -h / 4, false],
    [0, -h / 2, true],
    [-w / 2, -h / 4, false],
    [-w / 2, h / 4, false],
    [0, 0, true],
    [w / 2 + 1.5 * s, -h / 2, null],
  ];
  const on = places.flatMap((place) =>
    layout.map(([u, v, flat]) => {
      const [sx, sy] = flat === null ? [s, s] : flat ? [w - s, s] : [s, h / 2 - s];
      return place
        .clone()
        .multiply(new THREE.Matrix4().makeScale(sx, sy, t).setPosition(u, v, t / 2));
    }),
  );
  const off = on.map((m) => new THREE.Matrix4().makeScale(0, 0, 0).copyPosition(m));
  const mesh = kit.copies(unit, material, [...on, ...extra], parent);
  mesh.computeBoundingSphere(); // once, every segment lit: culling stays right whatever it shows
  off.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return { mesh, on, off, shown: new Int16Array(places.length).fill(-1) };
}

/** Lights place `i` of a readout: `bits` its segments, bit 7 its point. Returns whether it changed. */
function light(r: Readout, i: number, bits: number): boolean {
  if (r.shown[i] === bits) return false;
  r.shown[i] = bits;
  for (let k = 0; k < SLOTS; k++) {
    const lit = bits & (1 << k) ? r.on : r.off;
    const m = lit[i * SLOTS + k];
    if (m) r.mesh.setMatrixAt(i * SLOTS + k, m);
  }
  return true;
}

/** Shows `n` (an integer, ≥ 0) with `point` decimals right-aligned; dashes when it does not fit. */
function number(r: Readout, n: number, point: number): void {
  const places = r.shown.length;
  const fits = n >= 0 && n < 10 ** places && point < places;
  let changed = false;
  for (let i = 0; i < places; i++) {
    const power = 10 ** (places - 1 - i);
    const units = i === places - 1 - point;
    const digit = Math.floor(n / power) % 10;
    const lead = i < places - 1 - point && Math.floor(n / power) === 0;
    const bits = !fits
      ? DASH
      : (lead ? 0 : (SEGMENTS[digit] ?? 0)) | (units && point > 0 ? 0x80 : 0);
    changed = light(r, i, bits) || changed;
  }
  if (changed) r.mesh.instanceMatrix.needsUpdate = true;
}

function blank(r: Readout): void {
  let changed = false;
  for (let i = 0; i < r.shown.length; i++) changed = light(r, i, 0) || changed;
  if (changed) r.mesh.instanceMatrix.needsUpdate = true;
}

/** A deterministic scatter in [0, 1) (the same bed every time). */
const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** The bed's grains in rings, layer on layer from the beaker's floor, each turned its own way. */
function bedTransforms(): THREE.Matrix4[] {
  const transforms: THREE.Matrix4[] = [];
  const rings = [
    [0, 1],
    [BED_RADIUS * 0.37, 6],
    [BED_RADIUS * 0.72, 12],
  ] as const;
  for (let layer = 0; transforms.length < GRAINS; layer++) {
    const y = BEAKER.base + GRAIN * 0.75 + layer * 0.0085;
    for (const [r, n] of rings) {
      for (let k = 0; k < n && transforms.length < GRAINS; k++) {
        const i = transforms.length;
        const a = ((k + (layer % 2) * 0.5) / n) * 2 * Math.PI + hash(i) * 0.4;
        const jitter = (hash(i + 101) - 0.5) * 0.002;
        transforms.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3((r + jitter) * Math.cos(a), y + jitter, (r + jitter) * Math.sin(a)),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(hash(i + 7) * 6.3, hash(i + 13) * 6.3, hash(i + 29) * 6.3),
            ),
            new THREE.Vector3(
              0.8 + hash(i + 3) * 0.4,
              0.8 + hash(i + 5) * 0.4,
              0.8 + hash(i + 11) * 0.4,
            ),
          ),
        );
      }
    }
  }
  return transforms;
}

/**
 * What the station changes, at `bench.top`. `pose` reads the dials (or the run's inputs) `solute`,
 * `temperature`, `soluteMass`, `balanceResolution` and `waterMass`, and the run's `undissolved`,
 * `dissolved` and `labTime`; it only assigns, and skips what has not changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  // Its parts are laid out from the base centre, as the frame's; the beaker's from the plate's top.
  const base = new THREE.Group();
  const [tx, ty, tz] = item.bench?.top ?? [0, 0, 0];
  base.position.set(-tx, -ty, -tz);
  kit.group.add(base);
  const A = new THREE.Vector3(tx, ty, tz);

  // The heating plate (a dull warmth while heating), the pilot light.
  const hot = own(
    new THREE.MeshStandardMaterial({
      color: '#4a4f55',
      ...LOOKS.satin,
      emissive: '#6e1406',
      emissiveIntensity: 0,
    }),
  );
  const plate = mesh(
    keep(
      lathe(
        [
          [0, -PLATE.thick],
          [PLATE.radius, -PLATE.thick],
          [PLATE.radius, -0.0015],
          [PLATE.radius - 0.0015, 0],
          [0, 0],
        ],
        48,
      ),
    ),
    hot,
  );
  plate.name = 'plate';
  const lampOff = own(new THREE.MeshStandardMaterial({ color: '#5b1d14', ...LOOKS.plastic }));
  const lampOn = own(new THREE.MeshBasicMaterial({ color: '#ff7a2e' }));
  const lamp = mesh(keep(sphere(0.0045, 0, 0, 0, 12)), lampOff, base);
  swaps(lamp, lampOn);
  lamp.name = 'lamp';
  lamp.castShadow = false;
  lamp.position.set(
    A.x + LAMP_X,
    PANEL.y + PANEL_NORMAL.y * 0.001,
    A.z + PANEL.z + PANEL_NORMAL.z * 0.001,
  );

  // In the beaker: the stir bar, the water, the bed of crystals.
  const ptfe = own(new THREE.MeshStandardMaterial({ color: '#f3f3ef', ...LOOKS.satin }));
  const stirBar = mesh(
    keep(
      new THREE.CapsuleGeometry(
        STIR_BAR.radius,
        STIR_BAR.length - 2 * STIR_BAR.radius,
        4,
        10,
      ).rotateZ(Math.PI / 2),
    ),
    ptfe,
  );
  stirBar.name = 'stir-bar';
  stirBar.castShadow = false;
  stirBar.position.y = BEAKER.base + STIR_BAR.radius;
  const waterLook = own(
    new THREE.MeshStandardMaterial({
      color: '#d4e9f2', // the solutions are colourless
      ...LOOKS.glass,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  const water = mesh(keep(drum(INNER - 0.0003, INNER - 0.0003, 0, 1, 40)), waterLook);
  water.name = 'water';
  water.castShadow = false;
  water.position.y = BEAKER.base;
  water.renderOrder = LIQUID_ORDER;
  const crystal = own(
    new THREE.MeshStandardMaterial({ color: '#f6f6f2', ...LOOKS.satin, flatShading: true }),
  );
  const bed = copies(keep(new THREE.OctahedronGeometry(GRAIN, 0)), crystal, bedTransforms());
  bed.name = 'bed';
  bed.castShadow = false;
  bed.frustumCulled = false; // its count changes; the bounds would be stale
  bed.count = 0;
  bed.visible = false;

  // The weighing dish, the filter paper on the pan, and the heap of solid (in the dish before a
  // run, the dried residue on the paper after).
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f4f0', ...LOOKS.plastic }));
  const dish = mesh(
    keep(
      loft(roundRect(DISH.size, DISH.size, 0.01), [
        [0, 0],
        [-DISH.flare, DISH.height],
      ]).rotateX(-Math.PI / 2),
    ),
    white,
    base,
  );
  dish.name = 'dish';
  const paperLook = own(new THREE.MeshStandardMaterial({ color: '#fbfaf5', ...LOOKS.matte }));
  const paper = mesh(keep(drum(PAPER.radius, PAPER.radius, 0, PAPER.thick, 40)), paperLook, base);
  paper.name = 'paper';
  paper.castShadow = false;
  paper.position.set(BALANCE.x, PAN_Y, BALANCE.z + PAN.z);
  paper.visible = false;
  const heap = mesh(
    keep(
      new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, HEAP_ASPECT, 1),
    ),
    crystal,
    base,
  );
  heap.name = 'heap';
  heap.castShadow = false;

  // The jars' caps: three copies, the dialled solid's set down in front of its jar.
  const capLook = own(new THREE.MeshStandardMaterial({ vertexColors: false, ...LOOKS.plastic }));
  const capOn = JARS.x.map((jx) =>
    new THREE.Matrix4().makeTranslation(jx, JARS.height + JARS.cap / 2, JARS.z),
  );
  const capOff = JARS.x.map((jx) =>
    new THREE.Matrix4().makeTranslation(jx, JARS.cap / 2, JARS.z + JARS.radius + 0.022),
  );
  const caps = copies(
    keep(new THREE.CylinderGeometry(JARS.radius - 0.0035, JARS.radius - 0.0035, JARS.cap, 20)),
    capLook,
    capOn,
    base,
  );
  caps.name = 'caps';
  caps.frustumCulled = false; // a cap moves
  CAPS.forEach((hex, i) => caps.setColorAt(i, new THREE.Color(hex)));

  // The readouts: T on the plate's panel, the balance (six places), the timer (m:ss, its colon lit).
  const ink = own(new THREE.MeshBasicMaterial({ color: '#1d2731' }));
  const unit = keep(new THREE.BoxGeometry(1, 1, 1));
  const lcd = { width: 0.0065, height: 0.012, stroke: 0.0012 };
  const panelAt = [-1, 0, 1].map((i) =>
    new THREE.Matrix4()
      .makeTranslation(
        A.x + DISPLAY_X + i * 0.0115,
        PANEL.y + PANEL_NORMAL.y * 0.0023,
        A.z + PANEL.z + PANEL_NORMAL.z * 0.0023,
      )
      .multiply(new THREE.Matrix4().makeRotationX(TILT - Math.PI / 2)),
  );
  const thermo = readout(kit, unit, base, ink, 'temperature-digits', panelAt, lcd);
  const face = slopeFace(-0.015);
  const balanceAt = [0, 1, 2, 3, 4, 5].map((i) =>
    new THREE.Matrix4()
      .makeTranslation(
        face.centre.x + (i - 2.5) * 0.011,
        face.centre.y + face.normal.y * 0.0012,
        face.centre.z + face.normal.z * 0.0012,
      )
      .multiply(new THREE.Matrix4().makeRotationX(face.turn)),
  );
  const scale = readout(kit, unit, base, ink, 'balance-digits', balanceAt, lcd);
  const front = TIMER.z + TIMER.depth / 2 + 0.0005;
  const timerY = TIMER.height * 0.55;
  const timerAt = [-0.018, -0.008, 0.008, 0.018].map((u) =>
    new THREE.Matrix4().makeTranslation(TIMER.x + u, timerY, front),
  );
  const dot = (v: number) =>
    new THREE.Matrix4().makeScale(0.0012, 0.0012, 0.0002).setPosition(TIMER.x, timerY + v, front);
  const clock = readout(kit, unit, base, ink, 'timer-digits', timerAt, lcd, [
    dot(0.003),
    dot(-0.003),
  ]);

  // What is drawn now: pose skips what has not changed.
  let drawnT = NaN;
  let drawnSolute = NaN;
  let drawnGrains = -1;
  let drawnLevel = NaN;
  let weighed = NaN; // what the balance shows (g), NaN for blank
  let resolution = NaN;
  let seconds = NaN;
  let heapAt = 'none'; // 'dish', 'paper' or '' (nowhere), once posed
  let heapVolume = NaN;

  const pose = (p: BenchPose, dt: number) => {
    const sample = p.sample; // one read: each refills it from the session
    const {
      solute = NaN,
      temperature = NaN,
      soluteMass = NaN,
      balanceResolution = NaN,
    } = p.parameters;
    const waterMass = p.parameters.waterMass ?? WATER_MASS;
    const undissolved = sample.undissolved ?? NaN;
    const dissolved = sample.dissolved ?? NaN;
    const time = sample.labTime ?? NaN;
    const run = Number.isFinite(undissolved) && Number.isFinite(dissolved);
    const running = p.status === 'running';
    const after = p.status === 'completed';
    const rho = DENSITY[solute] ?? NaN;

    // The plate holds T: warm and lit above room temperature; the bar turns while it stirs.
    if (!Object.is(temperature, drawnT)) {
      drawnT = temperature;
      const heating = temperature > ROOM;
      lamp.material = heating ? lampOn : lampOff;
      hot.emissiveIntensity = heating ? 0.05 + (0.15 * (temperature - ROOM)) / (100 - ROOM) : 0;
      if (Number.isFinite(temperature)) number(thermo, Math.round(temperature), 0);
      else blank(thermo);
    }
    if (running || temperature > ROOM)
      stirBar.rotation.y =
        (stirBar.rotation.y + 2 * Math.PI * STIR_BAR.turnsPerSecond * dt) % (2 * Math.PI);

    if (!Object.is(solute, drawnSolute)) {
      drawnSolute = solute;
      for (let i = 0; i < JARS.x.length; i++) {
        const m = (i === solute ? capOff : capOn)[i];
        if (m) caps.setMatrixAt(i, m);
      }
      caps.instanceMatrix.needsUpdate = true;
    }

    // In the beaker: the crystals until they dissolve or are filtered off; the water's level.
    const inWater = run && !after ? undissolved : 0;
    const bulk = inWater / (PACKING * rho); // cm³, NaN without a solid
    const grains = grainsOf(bulk);
    // mL as g of water: the water, the dissolved solid's apparent volume, the crystals' own.
    const level = solutionLevel(waterMass, run ? dissolved : Number.NaN, inWater, solute);
    if (grains !== drawnGrains) {
      drawnGrains = grains;
      bed.count = grains;
      bed.visible = grains > 0;
    }
    if (!Object.is(level, drawnLevel)) {
      drawnLevel = level;
      water.visible = level > 0;
      if (water.visible) water.scale.y = level;
    }

    // The solid weighed: in the dish before a run; the residue on the paper after one.
    const where = after ? 'paper' : run ? '' : 'dish';
    const onPan = after ? undissolved : run ? NaN : soluteMass;
    const volume = where === '' ? NaN : onPan / (PACKING * rho);
    if (where !== heapAt || !Object.is(volume, heapVolume)) {
      heapAt = where;
      heapVolume = volume;
      paper.visible = where === 'paper';
      dish.position.set(
        where === 'dish' ? BALANCE.x : DISH.x,
        where === 'dish' ? PAN_Y : 0,
        where === 'dish' ? BALANCE.z + PAN.z : DISH.z,
      );
      heap.visible = volume > 0;
      if (heap.visible) {
        const r = heapRadius(volume);
        heap.scale.setScalar(r);
        heap.position.set(
          BALANCE.x,
          where === 'dish' ? PAN_Y + DISH.height : PAN_Y + PAPER.thick,
          BALANCE.z + PAN.z,
        );
      }
    }
    const reading = after ? undissolved : run ? 0 : soluteMass;
    if (!Object.is(reading, weighed) || !Object.is(balanceResolution, resolution)) {
      weighed = reading;
      resolution = balanceResolution;
      const d = balanceResolution;
      if (d > 0 && Number.isFinite(d) && reading >= 0) {
        const point = decimals(d);
        number(scale, Math.round(quantize(reading, d) * 10 ** point), point);
      } else blank(scale);
    }

    // The timer: the stirring time, m:ss (0:00 without a run).
    const s = time >= 0 ? Math.floor(time) : 0;
    if (s !== seconds) {
      seconds = s;
      const min = Math.floor(s / 60);
      const tens = Math.floor(min / 10);
      let changed = light(clock, 0, tens > 0 ? (SEGMENTS[tens % 10] ?? 0) : 0);
      changed = light(clock, 1, SEGMENTS[min % 10] ?? 0) || changed;
      changed = light(clock, 2, SEGMENTS[Math.floor((s % 60) / 10)] ?? 0) || changed;
      changed = light(clock, 3, SEGMENTS[s % 10] ?? 0) || changed;
      if (changed) clock.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const solubilityStation: BenchModel = {
  frame,
  rig,
  reads: ['undissolved', 'dissolved', 'labTime'],
};
