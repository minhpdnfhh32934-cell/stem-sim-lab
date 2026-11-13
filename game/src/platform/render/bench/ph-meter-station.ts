import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals } from '../../../simulation/measurement';
import { Assembly, at, loft, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { chartLinear, INDICATOR_CHART } from '../../labVisuals/chemistry';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

const RGB: [number, number, number] = [0, 0, 0]; // chartLinear's reused result: no per-frame allocation

// pH measurement (model `acid-base.ph-measurement`): a bench pH meter with a sloped face and an
// LCD, an electrode stand whose arm carries the glass electrode over a 100 mL beaker holding the
// 50 mL sample on a white tile, a cable boom, the four reagent bottles in a rack labelled by pKa
// range, three calibration buffers (red, yellow, blue caps: the usual code), the waste beaker, the
// wash bottle, a white spotting tile with the universal-indicator dropper and its colour chart.
// The rig: the LCD reading `reading` to the dialled resolution (dashes without a run), the arm
// lowering the electrode into the sample over the first 0.5 s of `immersionTime` (raised when
// NaN), one tile well taking the universal indicator's colour at the model's `pH` (empty without
// a run), and the reagent bottle of the dialled `pKa` standing beside the beaker. Nothing else
// changes: all these samples are colourless. Real sizes in metres.
//
// Layout: the station's frame `s` has its origin at `bench.top` (the base centre on the item's
// floor, +z the front, towards the player); the item's box is 0.70 × 0.45 × 0.35.

type G = THREE.BufferGeometry;
type Profile = readonly (readonly [r: number, y: number])[];

/** The meter: a wedge 0.20 wide, 0.22 deep, 0.045 high at the front and 0.085 at the back. */
const METER = { x: -0.22, z: 0, width: 0.2, depth: 0.22, front: 0.045, back: 0.085 };
const SLOPE = Math.atan2(METER.back - METER.front, METER.depth); // the face's tilt, rad
/** A point on the meter's face: `up` along it from its front edge, lifted `out` off it. */
const onFace = (x: number, up: number, out: number): [number, number, number] => [
  METER.x + x,
  METER.front + up * Math.sin(SLOPE) + out * Math.cos(SLOPE),
  METER.z + METER.depth / 2 - up * Math.cos(SLOPE) + out * Math.sin(SLOPE),
];
/** Turns a part's +z onto the face's normal and its +y up the face. */
const FACE_RX = SLOPE - Math.PI / 2;
const LCD = { up: 0.125, width: 0.09, height: 0.05, digit: 0.016, pitch: 0.013, digits: 5 };
const LCD_WINDOW = '#b7c2ad';
const LCD_INK = '#1c211d';

const STAND = { x: 0.02, z: -0.08, width: 0.15, depth: 0.1, height: 0.012 };
const ROD = { radius: 0.006, z: -0.11, top: 0.4 };
const BOOM_Y = ROD.top - 0.01; // the cable boom over the beaker
/** The 100 mL beaker on its tile: axis, outer radius, height, wall; its 50 mL sample. */
const TILE = { size: 0.08, height: 0.006 };
const BEAKER = { x: 0.02, z: 0.02, radius: 0.025, height: 0.07, wall: 0.0012 };
const SAMPLE_ML = 50;
const SAMPLE_DEPTH = (SAMPLE_ML * 1e-6) / (Math.PI * (BEAKER.radius - BEAKER.wall) ** 2); // 28 mm
const SAMPLE_BOTTOM = TILE.height + BEAKER.wall;
/** The sample's surface above the item's floor: the bulb must end under it. */
export const SURFACE = SAMPLE_BOTTOM + SAMPLE_DEPTH;
/**
 * The electrode on its arm (heights in the arm's frame, origin on the arm's axis): cap, tube,
 * bulb; the arm's height when lowered puts the bulb 6 mm off the beaker's bottom, and it rises
 * `travel` when raised. It lowers over the first `dip` s of a run.
 */
const ELECTRODE = {
  radius: 0.006,
  capRadius: 0.0072,
  capTop: 0.012,
  capBottom: -0.014,
  tubeBottom: -0.14,
  bulb: 0.0075,
};
const ARM = {
  radius: 0.004,
  lowered: SAMPLE_BOTTOM + 0.006 + ELECTRODE.bulb - ELECTRODE.tubeBottom,
  travel: 0.11,
  dip: 0.5,
};
const RAISED = ARM.lowered + ARM.travel;

/** The reagent rack: four slots by pKa range, a labelled lip; the spot beside the beaker. */
const RACK = { x: 0.21, z: -0.12, width: 0.26, depth: 0.08, height: 0.012, lip: 0.03 };
const SLOT_X = [0.105, 0.175, 0.245, 0.315] as const;
const IN_USE = { x: 0.1, z: 0.035 };
const BOTTLE = { radius: 0.025, height: 0.123 };
/** The rack's slots: the pair's strength class by its pKa (the model's own limits, 0 and pKw). */
export const SLOT_LABELS = ['pKa ≤ 0', '0 < pKa < 7', '7 ≤ pKa < 14', 'pKa ≥ 14'] as const;
/** Which slot a pair of acidity `pKa` lives in; −1 when there is no setting. */
export function slotOf(pKa: number): number {
  if (Number.isNaN(pKa)) return -1;
  return pKa <= 0 ? 0 : pKa < 7 ? 1 : pKa < 14 ? 2 : 3;
}

const BUFFERS = { x: -0.095, z: [-0.13, -0.09, -0.05], caps: ['#d0312d', '#f2c418', '#2f6fb3'] };
const WASTE = { x: 0.17, z: 0.07, radius: 0.035, height: 0.095 };
const WASH = { x: 0.3, z: 0.09, radius: 0.035, height: 0.16 };
const SPOT = { x: -0.06, z: 0.12, width: 0.1, depth: 0.07, height: 0.012, well: 0.009 };
const WELLS = [-0.03, 0, 0.03].flatMap((x) => [-0.017, 0.017].map((z) => [x, z] as const));
const DROPPER = { x: 0.03, z: 0.13 };
const CHART = { x: 0.17, z: 0.145, width: 0.12, depth: 0.05, height: 0.002 };

export { INDICATOR_CHART };

/** One canvas per frame built: the rack's slot labels and the colour chart. */
const ATLAS = { width: 512, height: 256 };
const LABEL = { width: 0.06, height: 0.022, px: 128, py: 64 }; // one per slot, in a row
const CARD = { width: CHART.width - 0.006, depth: CHART.depth - 0.006 };

// ---- geometry -------------------------------------------------------------------------------

/** A solid of revolution about +y through (r, y); outward when the profile climbs. */
function lathe(profile: Profile, segments = 24): G {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  const normal = g.getAttribute('normal'); // three leaves the last ring's unnormalised
  const n = new THREE.Vector3();
  for (let i = 0; i < normal.count; i++) {
    n.fromBufferAttribute(normal, i).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** A thin-walled vessel: up its outside, over the rim, down its inside. */
const vessel = (outside: Profile, inside: Profile, segments = 24): G =>
  lathe([...outside, ...inside], segments);

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

/** A box lying on the meter's face, centred `up` along it and `x` across, `out` off it. */
const onMeter = (w: number, h: number, t: number, x: number, up: number, out = 0) =>
  new THREE.BoxGeometry(w, h, t).applyMatrix4(at(...onFace(x, up, out + t / 2), FACE_RX));

const linear = new THREE.Color();
/** Gives every vertex `hex`'s colour (one material draws several colours). */
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

/** The station's origin (`s`) in the item's frame: `bench.top`, from the base centre. */
function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A reagent bottle, white HDPE with a blue cap, standing at the origin: one geometry, instanced. */
function bottleGeometry(): G {
  const r = BOTTLE.radius;
  return merged([
    tint(
      lathe([
        [0, 0],
        [r - 0.002, 0],
        [r, 0.003],
        [r, 0.092],
        [0.014, 0.104],
        [0.014, 0.11],
        [0, 0.11],
      ]),
      '#eef0ee',
    ),
    tint(cylinder(0.0155, 0.015, 0, BOTTLE.height - 0.0075, 0, 20), '#2f6fb3'),
  ]);
}

/** Painted parts (the entity's mesh: focus shows on them): the meter's case, the stand's base, the rack. */
function bodyPieces(): G[] {
  const half = METER.depth / 2;
  const wedge = loft(
    () => [
      new THREE.Vector2(half, 0),
      new THREE.Vector2(half, METER.front),
      new THREE.Vector2(-half, METER.back),
      new THREE.Vector2(-half, 0),
    ],
    [
      [0, -METER.width / 2],
      [0, METER.width / 2],
    ],
  )
    .rotateY(-Math.PI / 2)
    .translate(METER.x, 0, METER.z);
  return [
    wedge,
    slab(STAND.width, STAND.depth, STAND.height, 0.01, 0.002).translate(STAND.x, 0, STAND.z),
    slab(RACK.width, RACK.depth, RACK.height, 0.006, 0.0015).translate(RACK.x, 0, RACK.z),
    box(RACK.width, RACK.lip, 0.005, RACK.x, RACK.height + RACK.lip / 2, RACK.z + RACK.depth / 2),
  ];
}

/** Bright steel: the rod, its nut, the cable boom and its clip. */
function steelPieces(): G[] {
  return [
    cylinder(ROD.radius, ROD.top - STAND.height, STAND.x, (ROD.top + STAND.height) / 2, ROD.z, 16),
    cylinder(0.011, 0.007, STAND.x, STAND.height + 0.0035, ROD.z, 6),
    cylinder(0.0035, BEAKER.z - ROD.z + 0.01, STAND.x, BOOM_Y, (BEAKER.z + ROD.z) / 2, 8, 'z'),
    box(0.016, 0.016, 0.016, STAND.x, ROD.top - 0.008, ROD.z), // the boom's boss
    cylinder(0.005, 0.006, STAND.x, BOOM_Y, BEAKER.z, 8, 'z'), // the cable clip
  ];
}

/** Plastics, rubber, glaze: coloured per vertex, one draw. */
function plasticPieces(): G[] {
  const pieces: G[] = [];
  const add = (g: G, hex: string) => pieces.push(tint(g, hex));
  // The meter's face: LCD window, four keys, the socket on its back and the cable to it.
  add(onMeter(LCD.width, LCD.height, 0.0015, 0, LCD.up), LCD_WINDOW);
  add(onMeter(LCD.width + 0.008, LCD.height + 0.008, 0.0008, 0, LCD.up), '#2b2f33');
  for (const [i, x] of [-0.054, -0.018, 0.018, 0.054].entries())
    add(onMeter(0.024, 0.012, 0.003, x, 0.04), i === 3 ? '#2f8f4e' : '#50575e');
  add(box(0.04, 0.012, 0.003, METER.x - 0.07, 0.02, METER.z + METER.depth / 2 + 0.0015), '#1f2328');
  add(
    cylinder(0.006, 0.014, METER.x + 0.06, 0.03, METER.z - METER.depth / 2 - 0.006, 10, 'z'),
    '#1f2328',
  );
  // The cable's fixed run: down the rod's back, along the bench (through the base), up into the
  // meter's socket.
  const cable = '#15171a';
  const run = { x: METER.x + 0.06, z: ROD.z - 0.012 };
  add(cylinder(0.0025, ROD.top - 0.0075, STAND.x + 0.008, (ROD.top - 0.005) / 2, run.z, 8), cable);
  add(
    cylinder(0.0025, STAND.x + 0.008 - run.x, (STAND.x + 0.008 + run.x) / 2, 0.0025, run.z, 8, 'x'),
    cable,
  );
  add(cylinder(0.0025, 0.03, run.x, 0.015, run.z, 8), cable);
  // Tiles: the beaker's and the spotting tile with its six wells.
  add(
    slab(TILE.size, TILE.size, TILE.height, 0.005, 0.0015).translate(BEAKER.x, 0, BEAKER.z),
    '#f3f4f1',
  );
  add(
    slab(SPOT.width, SPOT.depth, SPOT.height, 0.006, 0.002).translate(SPOT.x, 0, SPOT.z),
    '#f6f6f2',
  );
  for (const [x, z] of WELLS)
    add(cylinder(SPOT.well, 0.001, SPOT.x + x, SPOT.height - 0.0004, SPOT.z + z, 16), '#d9dbd6');
  // The wash bottle (LDPE) with its cap and jet.
  add(
    lathe([
      [0, 0],
      [WASH.radius - 0.003, 0],
      [WASH.radius, 0.004],
      [WASH.radius, WASH.height - 0.03],
      [0.016, WASH.height - 0.008],
      [0.016, WASH.height],
      [0, WASH.height],
    ]).translate(WASH.x, 0, WASH.z),
    '#e9ecec',
  );
  add(cylinder(0.018, 0.018, WASH.x, WASH.height + 0.005, WASH.z, 16), '#d0312d');
  add(cylinder(0.003, 0.05, WASH.x, WASH.height + 0.035, WASH.z, 8), '#d0312d');
  add(
    cylinder(0.003, 0.045, 0, 0, 0, 8)
      .rotateX(1.1)
      .translate(WASH.x, WASH.height + 0.068, WASH.z + 0.015),
    '#d0312d',
  );
  // Three calibration buffers, their caps the usual colour code (4 red, 7 yellow, 10 blue).
  BUFFERS.z.forEach((z, i) => {
    add(
      lathe(
        [
          [0, 0],
          [0.013, 0],
          [0.015, 0.002],
          [0.015, 0.05],
          [0.009, 0.058],
          [0.009, 0.062],
          [0, 0.062],
        ],
        16,
      ).translate(BUFFERS.x, 0, z),
      '#eef0ee',
    );
    add(cylinder(0.0105, 0.012, BUFFERS.x, 0.066, z, 16), BUFFERS.caps[i] ?? '#888');
  });
  // The indicator's dropper bottle (amber) with its teat.
  const { x: dx, z: dz } = DROPPER;
  add(
    lathe(
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
    ).translate(dx, 0, dz),
    '#7a4a1c',
  );
  add(cylinder(0.0105, 0.012, dx, 0.07, dz, 16), '#1f2328');
  add(
    lathe(
      [
        [0, 0.076],
        [0.006, 0.076],
        [0.006, 0.09],
        [0.0065, 0.094],
        [0.0045, 0.1],
        [0, 0.101],
      ],
      12,
    ).translate(dx, 0, dz),
    '#2b2e32',
  );
  // The colour chart's card.
  add(
    slab(CHART.width, CHART.depth, CHART.height, 0.003, 0.0005).translate(CHART.x, 0, CHART.z),
    '#f7f6ee',
  );
  return pieces;
}

/** Clear glass: the sample beaker and the waste beaker. */
function glassPieces(): G[] {
  const beaker = (r: number, h: number, wall: number, x: number, z: number) =>
    vessel(
      [
        [0, 0],
        [r - 0.002, 0],
        [r, 0.002],
        [r, h - 0.002],
        [r + 0.0015, h],
      ],
      [
        [r - wall, h],
        [r - wall, 0.002 + wall],
        [r - 0.003, wall],
        [0, wall],
      ],
    ).translate(x, 0, z);
  return [
    beaker(BEAKER.radius, BEAKER.height, BEAKER.wall, BEAKER.x, BEAKER.z).translate(
      0,
      TILE.height,
      0,
    ),
    beaker(WASTE.radius, WASTE.height, 0.0015, WASTE.x, WASTE.z),
  ];
}

/** Still liquids: the colourless 50 mL sample, and rinsings in the waste beaker. */
function liquidPieces(): G[] {
  const r = BEAKER.radius - BEAKER.wall - 0.0002;
  return [
    cylinder(r, SAMPLE_DEPTH, BEAKER.x, SAMPLE_BOTTOM + SAMPLE_DEPTH / 2, BEAKER.z, 24),
    cylinder(WASTE.radius - 0.0017, 0.02, WASTE.x, 0.0015 + 0.01, WASTE.z, 24),
  ];
}

/** The print: four slot labels on the rack's lip and the chart on its card, mapped into the atlas. */
function printPieces(): G[] {
  const pieces = SLOT_X.map((x, i) => {
    const g = new THREE.PlaneGeometry(LABEL.width, LABEL.height).translate(
      x,
      RACK.height + RACK.lip / 2,
      RACK.z + RACK.depth / 2 + 0.0028,
    );
    remapUV(g, (i * LABEL.px) / ATLAS.width, LABEL.px / ATLAS.width, 0, LABEL.py / ATLAS.height);
    return g;
  });
  const card = new THREE.PlaneGeometry(CARD.width, CARD.depth)
    .rotateX(-Math.PI / 2)
    .translate(CHART.x, CHART.height + 0.0003, CHART.z);
  remapUV(card, 0, 1, 0.5, 0.5);
  return [...pieces, card];
}

/** Maps a piece's 0–1 texture coordinates onto u0 + u·du, v0 + v·dv of the atlas. */
function remapUV(g: G, u0: number, du: number, v0: number, dv: number): void {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
}

/**
 * The atlas: the slot labels in a row along the bottom, the colour chart (pH 1–14 chips with
 * their numbers) across the top half. Null without a 2D canvas (Node tests): no print is drawn.
 */
function printAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS.width;
  canvas.height = ATLAS.height;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#f7f6ee';
  c.fillRect(0, 0, ATLAS.width, ATLAS.height);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  // Canvas y runs down, texture v up: the labels' row is the canvas's bottom.
  const top = ATLAS.height - LABEL.py;
  const squeeze = LABEL.px / LABEL.width / (LABEL.py / LABEL.height); // keep text upright in metres
  SLOT_LABELS.forEach((text, i) => {
    c.fillStyle = '#e8e6dc';
    c.fillRect(i * LABEL.px + 4, top + 4, LABEL.px - 8, LABEL.py - 8);
    c.fillStyle = '#15191d';
    c.save();
    c.translate(i * LABEL.px + LABEL.px / 2, top + LABEL.py / 2);
    c.scale(squeeze, 1);
    c.font = 'bold 22px sans-serif';
    c.fillText(text, 0, 0);
    c.restore();
  });
  // The chart: 14 chips, numbered, with its heading.
  const chip = ATLAS.width / 14;
  const chartH = ATLAS.height / 2;
  c.fillStyle = '#15191d';
  c.font = 'bold 20px sans-serif';
  c.fillText('pH', ATLAS.width / 2, 14);
  for (let ph = 1; ph <= 14; ph++) {
    c.fillStyle = INDICATOR_CHART[ph] ?? '#000';
    c.fillRect((ph - 1) * chip + 2, 28, chip - 4, chartH - 60);
    c.fillStyle = '#15191d';
    c.fillText(String(ph), (ph - 0.5) * chip, chartH - 16);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ---- materials ------------------------------------------------------------------------------

// Draw order among see-through parts, as the other bench models: glass, liquids in it, print.
const GLASS_ORDER = 1;
const LIQUID_ORDER = 1.5;
const PRINT_ORDER = 2;

const glassMaterial = () =>
  new THREE.MeshStandardMaterial({ color: '#d7ecf3', ...GLASSWARE_LOOK, depthWrite: false });

/** Clear water-like liquid. */
const clearLiquid = () =>
  new THREE.MeshStandardMaterial({
    color: '#edf4f6',
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });

/** A see-through part: no shadow, drawn in its place among the see-through parts. */
function seeThrough(mesh: THREE.Mesh, order: number): THREE.Mesh {
  mesh.castShadow = false;
  mesh.renderOrder = order;
  return mesh;
}

// ---- the LCD --------------------------------------------------------------------------------

/** Segments a–g of a digit `height` tall: centre x, y and size w, h. */
function segments(height: number): [number, number, number, number][] {
  const w = height * 0.5;
  const t = height * 0.12;
  const across = w - 1.2 * t;
  const down = height / 2 - 1.2 * t;
  const [x, y] = [w / 2 - t / 2, height / 2 - t / 2];
  return [
    [0, y, across, t],
    [x, height / 4, t, down],
    [x, -height / 4, t, down],
    [0, -y, across, t],
    [-x, -height / 4, t, down],
    [-x, height / 4, t, down],
    [0, 0, across, t],
  ];
}
/** Lit segments of 0–9 (bit 0 = a … bit 6 = g); a dash is g alone. */
const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const DASH = 0x40;
const POW10 = [1, 10, 100, 1000, 10000, 100000];
/** Instance index of the decimal point, after the five digits' segments. */
export const POINT = LCD.digits * 7;
/** Decimal places the LCD shows without a resolution setting (a digit count, never a model input). */
const DEFAULT_DECIMALS = 2;

// ---- the model ------------------------------------------------------------------------------

/**
 * The fixed parts: the painted case, base and rack (the entity's mesh), then one mesh per
 * material — steel, plastic (coloured per vertex), glass, the still liquids, the print.
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
  seeThrough(mesh(keep(merged(liquidPieces())), own(clearLiquid())), LIQUID_ORDER).name = 'liquids';
  const atlas = printAtlas();
  if (atlas) {
    const ink = own(new THREE.MeshStandardMaterial({ map: atlas, ...LOOKS.satin }));
    const print = mesh(keep(merged(printPieces(), true)), ink);
    print.name = 'print';
    print.castShadow = false;
    print.renderOrder = PRINT_ORDER;
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
 * What the run changes, in `s`: the LCD's segments, the arm with the electrode and its cable,
 * the indicator drop in the tile's first well and the four reagent bottles. `pose` assigns,
 * skipping what has not changed: no geometry, colour or matrix is made after this.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(originOf(item));

  // The LCD: seven segments per digit and the point, coloured per instance; lit like its window,
  // its off segments the window's colour so they vanish into it.
  const cell = keep(new THREE.BoxGeometry(1, 1, 1));
  const lcd = copies(
    cell,
    own(new THREE.MeshStandardMaterial(LOOKS.plastic)),
    Array.from({ length: POINT + 1 }, () => new THREE.Matrix4()),
  );
  lcd.name = 'lcd';
  lcd.castShadow = false;
  lcd.receiveShadow = false;
  const on = new THREE.Color(LCD_INK);
  const off = new THREE.Color(LCD_WINDOW);
  const base = at(...onFace(0, LCD.up, 0.0019), FACE_RX);
  const place = (i: number, [lx, ly, w, h]: readonly [number, number, number, number]) =>
    lcd.setMatrixAt(i, base.clone().multiply(at(lx, ly, 0).scale(new THREE.Vector3(w, h, 0.0006))));
  const left = (-(LCD.digits - 1) / 2) * LCD.pitch;
  for (let d = 0; d < LCD.digits; d++) {
    segments(LCD.digit).forEach(([sx, sy, w, h], s) => {
      place(d * 7 + s, [left + d * LCD.pitch + sx, sy, w, h]);
      lcd.setColorAt(d * 7 + s, off);
    });
  }
  const t = LCD.digit * 0.12;
  place(POINT, [left + LCD.pitch + LCD.digit * 0.25 + t, -LCD.digit / 2 + t / 2, t, t]);
  lcd.setColorAt(POINT, on);
  const colors = lcd.instanceColor as THREE.InstancedBufferAttribute; // made by setColorAt

  // The arm: a group at the rod, raised or lowered; the arm rod, its boss, the clamp, the
  // electrode (cap, glass tube and bulb with its inner element) and the cable up to the boom.
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.set(0, RAISED, 0);
  kit.group.add(arm);
  const e = ELECTRODE;
  mesh(
    keep(
      merged([
        cylinder(ARM.radius, BEAKER.z - ROD.z, STAND.x, 0, (BEAKER.z + ROD.z) / 2, 10, 'z'),
        cylinder(0.0025, 0.014, STAND.x, 0.012, ROD.z - 0.014, 8, 'z'), // the boss's thumbscrew
      ]),
    ),
    own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal })),
    arm,
  ).name = 'arm-steel';
  mesh(
    keep(
      merged([
        tint(box(0.024, 0.03, 0.024, STAND.x, 0, ROD.z), '#1f2328'), // the boss on the rod
        tint(box(0.022, 0.02, 0.018, BEAKER.x, 0, BEAKER.z - 0.004), '#1f2328'), // the clamp
        tint(
          cylinder(
            e.capRadius,
            e.capTop - e.capBottom,
            BEAKER.x,
            (e.capTop + e.capBottom) / 2,
            BEAKER.z,
            16,
          ),
          '#26292d',
        ),
        tint(
          cylinder(
            0.0015,
            e.capBottom - e.tubeBottom - 0.02,
            BEAKER.x,
            (e.capBottom + e.tubeBottom) / 2,
            BEAKER.z,
            6,
          ),
          '#d8d8d2',
        ), // the inner element
      ]),
    ),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
    arm,
  ).name = 'holder';
  seeThrough(
    mesh(
      keep(
        merged([
          cylinder(
            e.radius,
            e.capBottom - e.tubeBottom,
            BEAKER.x,
            (e.capBottom + e.tubeBottom) / 2,
            BEAKER.z,
            16,
          ),
          new THREE.SphereGeometry(e.bulb, 16, 12).translate(BEAKER.x, e.tubeBottom, BEAKER.z),
        ]),
      ),
      own(glassMaterial()),
      arm,
    ),
    GLASS_ORDER,
  ).name = 'electrode';
  // The cable: a unit cylinder up from the cap, scaled to reach the boom's clip.
  const cable = mesh(
    keep(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 8).translate(0, 0.5, 0)),
    own(new THREE.MeshStandardMaterial({ color: '#15171a', ...LOOKS.rubber })),
    arm,
  );
  cable.name = 'cable';
  cable.castShadow = false;
  cable.position.set(BEAKER.x, e.capTop, BEAKER.z);

  // The indicator drop in the tile's first well.
  const [wx = 0, wz = 0] = WELLS[0] ?? [];
  const drop = mesh(
    keep(new THREE.CylinderGeometry(SPOT.well - 0.0015, SPOT.well - 0.0015, 0.0008, 16)),
    own(new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0 })),
  );
  drop.name = 'drop';
  drop.castShadow = false;
  drop.position.set(SPOT.x + wx, SPOT.height + 0.0004, SPOT.z + wz);
  const dye = (drop.material as THREE.MeshStandardMaterial).color;

  // The four reagent bottles: in their slots, the dialled pair's beside the beaker.
  const rackAt = SLOT_X.map((x) => at(x, RACK.height, RACK.z));
  const inUseAt = at(IN_USE.x, 0, IN_USE.z);
  const bottles = copies(
    keep(bottleGeometry()),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
    rackAt,
  );
  bottles.name = 'bottles';
  bottles.frustumCulled = false; // one leaves the rack: its bounds would go stale

  let shown = NaN; // the LCD's number, in units of its last place; −1 dashes
  let shownDecimals = -1;
  let resolution: number | undefined;
  let places = DEFAULT_DECIMALS;
  let lowered = NaN; // 0 raised … 1 in the sample
  let coloured: number | undefined; // the drop's pH (NaN: no drop)
  let slot = -2;

  const pose = ({ parameters, sample }: BenchPose) => {
    // The reading, to the dialled resolution: the nearest multiple of d, as `quantize` reads it
    // (which allocates, so its integer arithmetic is repeated here); dashes without a run.
    // shortcut: d is taken as a power of ten (the presets), so a d off that grid shows rounded to its places.
    const d = parameters.meterResolution ?? NaN;
    if (d !== resolution) {
      resolution = d;
      places = d > 0 && Number.isFinite(d) ? Math.min(decimals(d), 3) : DEFAULT_DECIMALS;
    }
    const reading = sample.reading ?? NaN;
    const scale = POW10[places] ?? 1;
    const n = Math.floor(reading * scale + 0.5 + 1e-9);
    const key = Number.isFinite(n) && n >= 0 && n < (POW10[2 + places] ?? 0) ? n : -1;
    if (key !== shown || places !== shownDecimals) {
      shown = key;
      shownDecimals = places;
      const m = key * (POW10[3 - places] ?? 1); // in thousandths, the lowest digit's unit
      for (let dgt = 0; dgt < LCD.digits; dgt++) {
        const k = LCD.digits - 1 - dgt; // its power of ten, in thousandths
        const p = POW10[k] ?? 1;
        const used = dgt <= 1 + places;
        const mask = !used
          ? 0
          : key < 0
            ? DASH
            : k > 3 && m < p
              ? 0
              : (DIGITS[Math.floor(m / p) % 10] ?? 0);
        for (let s = 0; s < 7; s++) lcd.setColorAt(dgt * 7 + s, mask & (1 << s) ? on : off);
      }
      colors.needsUpdate = true;
    }

    // The arm: lowered over the first `dip` s of immersion; raised without a run.
    const time = sample.immersionTime ?? NaN;
    const f = Number.isFinite(time) ? Math.min(Math.max(time / ARM.dip, 0), 1) : 0;
    if (f !== lowered) {
      lowered = f;
      arm.position.y = RAISED - f * ARM.travel;
      cable.scale.y = BOOM_Y - 0.004 - arm.position.y - e.capTop;
    }

    // The drop: the universal indicator's colour at the model's pH; none without a run.
    const ph = sample.pH ?? NaN;
    if (!Object.is(ph, coloured)) {
      coloured = ph;
      drop.visible = Number.isFinite(ph);
      if (drop.visible) {
        chartLinear(ph, RGB); // clamped to the chart's range: a drawing clamp only
        dye.setRGB(RGB[0], RGB[1], RGB[2]);
      }
    }

    // The bottle in use beside the beaker, the others in their slots.
    const used = slotOf(parameters.pKa ?? NaN);
    if (used !== slot) {
      slot = used;
      rackAt.forEach((m, i) => bottles.setMatrixAt(i, i === used ? inUseAt : m));
      bottles.instanceMatrix.needsUpdate = true;
    }
  };
  pose({ status: 'idle', parameters: {}, sample: {} }); // until its session exists
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const phMeterStation: BenchModel = {
  frame,
  rig,
  reads: ['reading', 'pH', 'immersionTime'],
};
