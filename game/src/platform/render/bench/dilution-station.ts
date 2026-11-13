import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { Assembly, at, loft, type Outline, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import {
  FLASK_GLASS,
  FLASKS,
  type Flask,
  flaskLevel,
  levelIn as levelIn_,
  violetLinear,
} from '../../labVisuals/chemistry';
import { box, drum, part, rod, sphere } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The dilution bench (model chemistry.dilution): a white tile for the volumetric flask, the crystal
// violet stock bottle, a volumetric pipette on its rests with a pipette filler, a wash bottle whose
// delivery tube reaches over the flask's neck, and a school colorimeter in concentration mode with
// a cuvette in its slot. Laid out from `bench.top` ([0, 0, 0] is the item's base centre), +z
// towards the user, real sizes (m). The frame is what never changes; the rig holds the glassware
// the dials choose — the flask V₂ names (its liquid, mark ring and stopper) and the pipette V₁
// names — the stock in its bottle (tinted by C₁), the water stream, the cuvette's sample and the
// colorimeter's LEDs. The rig reads only `volume`, `concentration` and `absorbance`: the liquid's
// level is where the flask's own inside holds V, so it meets the mark exactly at V₂; its violet is
// the dye's transmittance across the bulb; the cuvette's tint and both readouts (A to 0.001, C₂ in
// µmol/L to the dial's resolution d, as `measurement.ts` reads it) light only once the run has
// completed — a colorimeter reads the mixed solution, not the flask being filled.

type G = THREE.BufferGeometry;
type V3 = readonly [number, number, number];
type Profile = readonly (readonly [r: number, y: number])[];

const TILE = { x: -0.08, z: 0.02, size: 0.15, height: 0.006 };
const WALL = FLASK_GLASS; // the flask's glass
/** The flask's inside floor above the item's base: it stands on the tile. */
const FLOOR = TILE.height + WALL;
const INSET = 0.0003; // the liquid inside the glass
/** The wash bottle, behind the flask, and the tip of its delivery tube over the flask's neck. */
const WASH = { x: TILE.x, z: -0.12, radius: 0.0375, height: 0.17, cap: 0.185, elbow: 0.245 };
const NOZZLE: V3 = [TILE.x, 0.232, TILE.z];
const STREAM_DIP = 0.01; // the stream reaches this far into the neck
const BOTTLE = { x: -0.37, z: 0.05, radius: 0.028, inner: 0.0265 };
const PIPETTE = { tipX: -0.08, y: 0.0145, z: 0.15, rests: [-0.36, -0.13] as const };
const FILLER = { x: -0.25, z: 0.09, radius: 0.022 };
/** The colorimeter: centre of its footprint, width, top; its side outline in (−z, y), CCW. */
const CM = { x: 0.26, z: -0.02, width: 0.24, top: 0.096 };
const CASE: Outline = () =>
  [
    [0.1, 0.096],
    [-0.02, 0.096],
    [-0.08, 0.036],
    [-0.08, 0.006],
    [0.1, 0.006],
  ].map(([u, v]) => new THREE.Vector2(u, v));
/** Its sloped front panel, 45°: from (z, y) = (0.08, 0.036) up and back, s metres along it. */
const SLOPE = -Math.PI / 4;
const onSlope = (x: number, s: number, out: number): V3 => [
  CM.x + x,
  0.036 + s * Math.SQRT1_2 + out * Math.SQRT1_2,
  CM.z + 0.08 - s * Math.SQRT1_2 + out * Math.SQRT1_2,
];
/** The cuvette slot (a 12.5 mm square cuvette, 45 mm tall, 20 mm of it in the slot). */
const SLOT = { x: CM.x - 0.05, z: CM.z - 0.05, collar: 0.008, bottom: 0.084 };
const SLOT_TOP = CM.top + SLOT.collar;
// shortcut: ε defaults to the definition's initial condition (1e7 L/(mol·m)) while no run carries it.
const DEFAULT_ABSORPTIVITY = 1e7;

// ---- the glassware the dials choose ------------------------------------------------------------

export { FLASKS, flaskLevel };
export type { Flask };

/** The level and its radius, written by `levelIn` (no allocation per frame). */
const LEVEL = { y: 0, r: 0 };
const levelIn = (profile: Profile, held: Float64Array, ml: number) =>
  levelIn_(profile, held, ml, LEVEL);

/** The four volumetric pipettes: bulb radius and overall length. */
export const PIPETTES = [
  { ml: 1, bulb: 0.004, length: 0.3 },
  { ml: 2, bulb: 0.005, length: 0.31 },
  { ml: 5, bulb: 0.0065, length: 0.33 },
  { ml: 10, bulb: 0.008, length: 0.35 },
] as const;

/** A list's element that must be there (built from a constant list of the same length). */
function nth<T>(list: readonly T[], i: number): T {
  const v = list[i];
  if (v === undefined) throw new Error(`Dilution station: no part ${i} of ${list.length}`);
  return v;
}

/** The index of the nearest value, `fallback` without a finite one. */
function nearest(values: readonly number[], v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  let best = 0;
  for (let i = 1; i < values.length; i++)
    if (Math.abs((values[i] ?? 0) - v) < Math.abs((values[best] ?? 0) - v)) best = i;
  return best;
}
const FLASK_ML = FLASKS.map((f) => f.ml);
const PIPETTE_ML = PIPETTES.map((p) => p.ml);
const DEFAULT_FLASK = 1; // 50 mL
const DEFAULT_PIPETTE = 2; // 5 mL

// ---- geometry ----------------------------------------------------------------------------------

/** Where the layout stands in the item's frame: `bench.top`, from the item's base centre. */
function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

const placed = (g: G, [x, y, z]: V3, rx = 0, ry = 0, rz = 0) =>
  g.applyMatrix4(at(x, y, z, rx, ry, rz));

/** One colour on every vertex: the finishes draw all their colours with one material. */
function paint(g: G, hex: string): G {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(colors, 3 * i);
  return g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** The pieces of one finish merged into one geometry (one draw). */
const merged = (pieces: G[]) => part('body', false, pieces).geometry;

/** A round solid about the y axis through the profile's (radius, height) points, bottom up. */
function lathe(profile: Profile, segments = 24): THREE.LatheGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  // three's lathe leaves its last ring's normals unnormalised.
  const normal = g.getAttribute('normal');
  const n = new THREE.Vector3();
  for (let k = 0; k < normal.count; k++) {
    n.fromBufferAttribute(normal, k).normalize();
    normal.setXYZ(k, n.x, n.y, n.z);
  }
  return g;
}

/** A flask's glass: up its outside from the tile, over the rim, down its inside to its floor. */
function flaskGlass(f: Flask): G {
  const [r0] = f.profile[0] ?? [0, 0];
  const outside: (readonly [number, number])[] = [
    [0, 0],
    [r0 + WALL, 0],
    ...f.profile.slice(1).map(([r, y]): readonly [number, number] => [r + WALL, y + WALL]),
    [f.neck + WALL + 0.001, f.rim],
  ];
  const within: (readonly [number, number])[] = [
    [f.neck, f.rim],
    ...[...f.profile].reverse().map(([r, y]): readonly [number, number] => [r, y + WALL]),
    [0, WALL],
  ];
  return lathe([...outside, ...within]).translate(TILE.x, TILE.height, TILE.z);
}

/** A flask's liquid when full: closed at the floor and the neck's top; posed by moving its rings. */
function flaskLiquid(f: Flask): THREE.LatheGeometry {
  return lathe([
    [0, 0],
    ...f.profile.map(([r, y]): readonly [number, number] => [r - INSET, y]),
    [0, f.top],
  ]);
}

/** A volumetric pipette lying on its rests, tip towards the flask (+x). */
function pipetteGlass({ bulb, length }: (typeof PIPETTES)[number]): G {
  const a = 0.4 * length;
  const b = 0.6 * length;
  return lathe(
    [
      [0, 0],
      [0.001, 0],
      [0.0035, 0.015],
      [0.0035, a],
      [bulb, a + 0.012],
      [bulb, b - 0.012],
      [0.0035, b],
      [0.0035, length],
      [0, length],
    ],
    16,
  )
    .rotateZ(Math.PI / 2)
    .translate(PIPETTE.tipX, PIPETTE.y, PIPETTE.z);
}

// ---- the frame ---------------------------------------------------------------------------------

/**
 * The fixed parts, by finish: the colorimeter's case (the entity's mesh, in the item's colour);
 * plastics, coloured per vertex (tile, feet, slot, panel, keys, bottle label and cap, wash bottle
 * and its tube, pipette rests, pipette filler); glass (stock bottle, cuvette).
 */
function frame(item: ItemDefinition): BenchFrame {
  const origin = originOf(item);
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(origin);
  const body: G[] = [];
  const plastic: G[] = [];
  const glass: G[] = [];
  const plastics = (g: G, hex: string) => plastic.push(paint(g, hex));
  const dark = (g: G) => plastics(g, '#24282d');

  // 1. The tile the flask stands on.
  plastics(
    slab(TILE.size, TILE.size, TILE.height, 0.006, 0.0015).translate(TILE.x, 0, TILE.z),
    '#f3f4f1',
  );

  // 2. The colorimeter: case, feet, the slot's collar and its opening, the cuvette in the slot,
  //    the display bezel, the lamp's bezel and two keys on the sloped panel.
  body.push(
    loft(CASE, [
      [0, -CM.width / 2],
      [0, CM.width / 2],
    ])
      .rotateY(Math.PI / 2)
      .translate(CM.x, 0, CM.z),
  );
  for (const [x, z] of [
    [-1, -0.085],
    [1, -0.085],
    [-1, 0.065],
    [1, 0.065],
  ] as const)
    dark(drum(0.008, 0.008, 0, 0.006, 12).translate(CM.x + x * 0.1, 0, CM.z + z));
  dark(slab(0.03, 0.03, SLOT.collar, 0.004, 0.0015).translate(SLOT.x, CM.top, SLOT.z));
  plastics(box(0.016, 0.0006, 0.016, SLOT.x, SLOT_TOP + 0.0003, SLOT.z), '#07080a');
  glass.push(
    drum(0.0125 * Math.SQRT1_2, 0.0125 * Math.SQRT1_2, SLOT.bottom, SLOT.bottom + 0.045, 4, true)
      .rotateY(Math.PI / 4)
      .translate(SLOT.x, 0, SLOT.z),
  );
  dark(placed(box(0.2, 0.034, 0.002), onSlope(0, 0.05, 0.0005), SLOPE));
  dark(placed(box(0.01, 0.01, 0.001), onSlope(-0.09, 0.015, 0.0003), SLOPE));
  for (const x of [0.06, 0.088])
    plastics(placed(box(0.018, 0.012, 0.004), onSlope(x, 0.015, 0.001), SLOPE), '#5b636c');

  // 3. The stock bottle: glass, its label with a violet band, a black cap (the dye is the rig's).
  const { x: bx, z: bz, radius: br } = BOTTLE;
  glass.push(
    lathe([
      [0, 0],
      [br - 0.002, 0],
      [br, 0.003],
      [br, 0.088],
      [0.022, 0.1],
      [0.0115, 0.108],
      [0.0115, 0.122],
    ]).translate(bx, 0, bz),
  );
  plastics(drum(br + 0.0005, br + 0.0005, 0.025, 0.07, 24, true).translate(bx, 0, bz), '#f4f1e8');
  plastics(drum(br + 0.0007, br + 0.0007, 0.058, 0.066, 24, true).translate(bx, 0, bz), '#6c2bb0');
  plastics(drum(0.0135, 0.0135, 0.118, 0.138, 16).translate(bx, 0, bz), '#1d2024');

  // 4. The wash bottle (LDPE, red cap) and its delivery tube up to the elbow and over the neck.
  const { x: wx, z: wz, radius: wr } = WASH;
  plastics(
    lathe([
      [0, 0],
      [wr - 0.0035, 0],
      [wr, 0.004],
      [wr, 0.13],
      [0.03, 0.15],
      [0.014, 0.158],
      [0.014, WASH.height],
      [0, WASH.height],
    ]).translate(wx, 0, wz),
    '#eef0ea',
  );
  plastics(drum(0.016, 0.016, WASH.height, WASH.cap, 16).translate(wx, 0, wz), '#c43a35');
  const elbow = new THREE.Vector3(wx, WASH.elbow, wz);
  plastics(rod(0.003, new THREE.Vector3(wx, WASH.cap, wz), elbow, 10), '#dfe3e0');
  plastics(sphere(0.0045, wx, WASH.elbow, wz, 10), '#dfe3e0');
  plastics(rod(0.003, elbow, new THREE.Vector3(...NOZZLE), 10), '#dfe3e0');

  // 5. The pipette's rests and the pipette filler (a three-valve rubber bulb) beside the tile.
  for (const x of PIPETTE.rests) plastics(box(0.02, 0.011, 0.024, x, 0.0055, PIPETTE.z), '#8c959e');
  const { x: fx, z: fz, radius: fr } = FILLER;
  plastics(sphere(fr, fx, fr, fz, 16), '#1f3a7a');
  plastics(drum(0.006, 0.006, 2 * fr - 0.002, 2 * fr + 0.012, 10).translate(fx, 0, fz), '#1f3a7a');
  for (const s of [-1, 1])
    plastics(
      new THREE.CylinderGeometry(0.006, 0.006, 0.016, 10)
        .rotateZ(Math.PI / 2)
        .translate(fx + s * (fr + 0.005), fr, fz),
      '#1f3a7a',
    );

  const bodyGeometry = keep(merged(body));
  bodyGeometry.translate(origin.x, origin.y, origin.z);
  mesh(
    keep(merged(plastic)),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
  ).name = 'plastic';
  const see = mesh(
    keep(merged(glass)),
    own(new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK, depthWrite: false })),
  );
  see.name = 'glass';
  see.renderOrder = 2;
  see.castShadow = false;
  return { body: bodyGeometry, parts: kit.group, dispose: () => kit.dispose() };
}

// ---- the readouts ------------------------------------------------------------------------------

interface Readout {
  readonly at: V3;
  readonly digits: number;
  /** The decimal places each of its decimal-point LEDs stands for. */
  readonly points: readonly number[];
  readonly on: string;
  readonly off: string;
}
/** The two readouts on the sloped panel: A (red, 0.000–9.999) and C₂ in µmol/L (green, to d). */
export const READOUTS = {
  absorbance: {
    at: onSlope(-0.055, 0.05, 0.0016),
    digits: 4,
    points: [3],
    on: '#ff3b2f',
    off: '#3a0d0b',
  },
  concentration: {
    at: onSlope(0.055, 0.05, 0.0016),
    digits: 4,
    points: [1, 2, 3],
    on: '#43e07a',
    off: '#0d2a17',
  },
} as const satisfies Record<string, Readout>;
type ReadoutId = keyof typeof READOUTS;
const IDS = Object.keys(READOUTS) as ReadoutId[];
const DIGIT = { height: 0.018, pitch: 0.016 };

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
const POW10 = [1, 10, 100, 1000, 10000];

/** Instance indices in the LED mesh: each readout's segments from `start`, then its points; the lamp last. */
export const INDICATORS = (() => {
  let count = 0;
  const start = {} as Record<ReadoutId, number>;
  const point = {} as Record<ReadoutId, number>;
  for (const id of IDS) {
    start[id] = count;
    point[id] = count + READOUTS[id].digits * 7;
    count = point[id] + READOUTS[id].points.length;
  }
  const lamp = count++;
  return { start, point, lamp, count };
})();

// ---- the rig -----------------------------------------------------------------------------------

/**
 * The parts drawn from the dials and the run; `pose` assigns (geometries swapped among those built
 * here, vertex positions, colours, scales, visibility), skipping what has not changed, and
 * allocates nothing after this.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const see = (m: THREE.Mesh, order: number, name: string) => {
    m.castShadow = false;
    m.renderOrder = order;
    m.name = name;
    return m;
  };
  const liquidLook = (color: string) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    });

  // The flasks and pipettes, built once each; one mesh shows the one chosen.
  const glassLook = own(
    new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK, depthWrite: false }),
  );
  const flaskGlasses = FLASKS.map((f) => keep(flaskGlass(f)));
  const liquids = FLASKS.map((f) => {
    const g = keep(flaskLiquid(f));
    g.computeBoundingSphere(); // full: it only ever shrinks inside this
    const position = g.getAttribute('position') as THREE.BufferAttribute;
    const rest = Float32Array.from(position.array as Float32Array);
    const radii = Float32Array.from([0, ...f.profile.map(([r]) => r - INSET), 0]);
    const heights = Float32Array.from([0, ...f.profile.map(([, y]) => y), f.top]);
    return { g, position, rest, radii, heights };
  });
  const pipetteGlasses = PIPETTES.map((p) => keep(pipetteGlass(p)));
  // What is shown now: the flask and its liquid are swapped together, never indexed per frame.
  let spec = FLASKS[DEFAULT_FLASK];
  let shownLiquid = nth(liquids, DEFAULT_FLASK);
  const flask = see(mesh(nth(flaskGlasses, DEFAULT_FLASK), glassLook), 2, 'flask');
  const pipette = see(mesh(nth(pipetteGlasses, DEFAULT_PIPETTE), glassLook), 2, 'pipette');
  const solutionLook = own(liquidLook('#dfeaf0'));
  const liquid = see(mesh(shownLiquid.g, solutionLook), 1, 'solution');
  liquid.position.set(TILE.x, FLOOR, TILE.z);
  liquid.frustumCulled = false; // its rings move below the full shape's bounds
  const mark = see(
    mesh(
      keep(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true)),
      own(new THREE.MeshStandardMaterial({ color: '#f6f6f2', ...LOOKS.plastic })),
    ),
    0,
    'mark',
  );
  const stopper = see(
    mesh(
      keep(
        lathe(
          [
            [0, -0.022],
            [0.0042, -0.022],
            [0.0049, -0.001],
            [0.0085, 0],
            [0.0095, 0.004],
            [0.0095, 0.011],
            [0.008, 0.013],
            [0, 0.013],
          ],
          16,
        ),
      ),
      own(
        new THREE.MeshStandardMaterial({
          color: '#e8f0f3',
          ...LOOKS.glass,
          opacity: 0.7,
          depthWrite: false,
        }),
      ),
    ),
    2,
    'stopper',
  );
  const water = own(liquidLook('#cfe6f0'));
  water.opacity = 0.5;
  const stream = see(
    mesh(keep(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 8).translate(0, 0.5, 0)), water),
    1,
    'stream',
  );
  stream.position.set(TILE.x, 0, TILE.z);

  // The stock in its bottle and the sample in the cuvette.
  const stockLook = own(liquidLook('#dfeaf0'));
  see(
    mesh(
      keep(drum(BOTTLE.inner, BOTTLE.inner, 0.003, 0.08, 24).translate(BOTTLE.x, 0, BOTTLE.z)),
      stockLook,
    ),
    1,
    'stock',
  );
  const sampleLook = own(liquidLook('#dfeaf0'));
  const cuvette = see(
    mesh(keep(box(0.0105, 0.035, 0.0105, SLOT.x, SLOT.bottom + 0.0195, SLOT.z)), sampleLook),
    1,
    'cuvette',
  );

  // The LEDs: segments, decimal points and the 590 nm lamp, coloured per instance, one draw.
  const led = kit.copies(
    keep(new THREE.BoxGeometry(1, 1, 1)),
    own(new THREE.MeshBasicMaterial()),
    Array.from({ length: INDICATORS.count }, () => new THREE.Matrix4()),
  );
  led.name = 'indicators';
  led.castShadow = false;
  led.receiveShadow = false;
  const on = {} as Record<ReadoutId, THREE.Color>;
  const off = {} as Record<ReadoutId, THREE.Color>;
  const place = (i: number, base: THREE.Matrix4, [lx, ly, w, h]: readonly number[]) =>
    led.setMatrixAt(
      i,
      base.clone().multiply(at(lx ?? 0, ly ?? 0, 0).scale(new THREE.Vector3(w, h, 0.0006))),
    );
  for (const id of IDS) {
    const o: Readout = READOUTS[id];
    on[id] = new THREE.Color(o.on);
    off[id] = new THREE.Color(o.off);
    const base = at(...o.at, SLOPE);
    const left = (-(o.digits - 1) / 2) * DIGIT.pitch;
    for (let d = 0; d < o.digits; d++)
      segments(DIGIT.height).forEach(([sx, sy, w, h], s) => {
        place(INDICATORS.start[id] + d * 7 + s, base, [left + d * DIGIT.pitch + sx, sy, w, h]);
        led.setColorAt(INDICATORS.start[id] + d * 7 + s, off[id]);
      });
    const t = DIGIT.height * 0.12;
    o.points.forEach((k, i) => {
      const units = o.digits - 1 - k;
      place(INDICATORS.point[id] + i, base, [
        left + units * DIGIT.pitch + DIGIT.height * 0.25 + t,
        -DIGIT.height / 2 + t / 2,
        t,
        t,
      ]);
      led.setColorAt(INDICATORS.point[id] + i, off[id]);
    });
  }
  const lampOn = new THREE.Color('#ffa62b'); // 590 nm: orange
  const lampOff = new THREE.Color('#3b2a10');
  place(INDICATORS.lamp, at(...onSlope(-0.09, 0.015, 0.0012), SLOPE), [0, 0, 0.005, 0.005]);
  led.setColorAt(INDICATORS.lamp, lampOff);
  const colors = led.instanceColor as THREE.InstancedBufferAttribute; // made by setColorAt

  /**
   * Writes a number to `places` into a readout, leading zeros blank; dashes if unreadable. The
   * decimal point of `places` stays lit either way: the resolution shows before the reading does.
   */
  const shown = { absorbance: { key: NaN, places: -1 }, concentration: { key: NaN, places: -1 } };
  const show = (id: ReadoutId, value: number, places: number) => {
    const o: Readout = READOUTS[id];
    const n = Math.round(value * (POW10[places] ?? NaN));
    const key = Number.isFinite(n) && n >= 0 && n < (POW10[o.digits] ?? 0) ? n : -1;
    const s = shown[id];
    if (key === s.key && places === s.places) return;
    s.key = key;
    s.places = places;
    for (let d = 0; d < o.digits; d++) {
      const k = o.digits - 1 - d; // its power of ten
      const p = POW10[k] ?? 1;
      const m =
        key < 0 ? DASH : k > places && key < p ? 0 : (DIGITS[Math.floor(key / p) % 10] ?? 0);
      for (let g = 0; g < 7; g++)
        led.setColorAt(INDICATORS.start[id] + d * 7 + g, m & (1 << g) ? on[id] : off[id]);
    }
    o.points.forEach((k, i) =>
      led.setColorAt(INDICATORS.point[id] + i, k === places ? on[id] : off[id]),
    );
    colors.needsUpdate = true;
  };
  show('absorbance', NaN, 3);
  show('concentration', NaN, 1);

  const RGB: [number, number, number] = [1, 1, 1]; // violetLinear's reused result
  /** The dye's depth seen across `width` m of solution at C mol/L: 1 − T, T = 10^(−ε·C·w). */
  const tint = (look: THREE.MeshStandardMaterial, c: number, eps: number, width: number) => {
    look.opacity = violetLinear(eps * c * width, RGB);
    look.color.setRGB(RGB[0], RGB[1], RGB[2]);
  };

  // What is drawn now: pose skips what has not changed.
  let chosen = -1; // flask
  let held = -1; // pipette
  let shownMl = -1; // never a volume: the first pose draws
  let shownC = NaN;
  let shownEps = NaN;
  let stockC = NaN;
  let stockEps = NaN;
  let sampleA: number | undefined;
  let running: boolean | null = null;
  let done: boolean | null = null;
  let readC = NaN; // the C₂ reading's inputs and result
  let readD = NaN;
  let readMicro = NaN;
  let readPlaces = 1;

  const pose = ({ status, parameters, sample }: BenchPose) => {
    const run = status === 'running';
    const complete = status === 'completed';
    const f = nearest(FLASK_ML, parameters.finalVolume ?? NaN, DEFAULT_FLASK);
    const p = nearest(PIPETTE_ML, parameters.stockVolume ?? NaN, DEFAULT_PIPETTE);
    if (f !== chosen) {
      chosen = f;
      spec = FLASKS[f] ?? FLASKS[DEFAULT_FLASK];
      shownLiquid = liquids[f] ?? shownLiquid;
      flask.geometry = flaskGlasses[f] ?? flask.geometry;
      liquid.geometry = shownLiquid.g;
      shownMl = -1;
      mark.position.set(TILE.x, FLOOR + spec.mark, TILE.z);
      mark.scale.set(spec.neck + WALL + 0.0004, 0.0012, spec.neck + WALL + 0.0004);
      const rim = TILE.height + spec.rim;
      stopper.position.set(TILE.x, rim, TILE.z);
      stopper.scale.set(spec.neck / 0.005, 1, spec.neck / 0.005);
      stream.position.y = rim - STREAM_DIP;
      stream.scale.y = NOZZLE[1] - stream.position.y;
      shownC = -1; // the bulb's width changed
    }
    if (p !== held) {
      held = p;
      pipette.geometry = pipetteGlasses[p] ?? pipette.geometry;
    }
    if (run !== running) {
      running = run;
      stream.visible = run;
      led.setColorAt(INDICATORS.lamp, run ? lampOn : lampOff);
      colors.needsUpdate = true;
    }
    if (complete !== done) {
      done = complete;
      stopper.visible = complete;
    }

    // The flask holds the run's volume at its concentration; without a run, the pipetted stock.
    const v = sample.volume ?? NaN;
    const ml = Number.isFinite(v) ? v : (parameters.stockVolume ?? NaN);
    if (!Object.is(ml, shownMl)) {
      shownMl = ml;
      const l = shownLiquid;
      liquid.visible = ml > 0;
      levelIn(spec.profile, spec.held, ml > 0 ? ml : 0);
      const { y, r } = LEVEL;
      const rings = l.radii.length;
      const count = l.position.count;
      for (let i = 0; i < count; i++) {
        const j = i % rings;
        if ((l.heights[j] ?? 0) <= y) {
          l.position.setXYZ(i, l.rest[3 * i] ?? 0, l.rest[3 * i + 1] ?? 0, l.rest[3 * i + 2] ?? 0);
          continue;
        }
        const rj = l.radii[j] ?? 0;
        const scale = j === rings - 1 || rj <= 0 ? 0 : Math.max(r - INSET, 0) / rj;
        l.position.setXYZ(i, (l.rest[3 * i] ?? 0) * scale, y, (l.rest[3 * i + 2] ?? 0) * scale);
      }
      l.position.needsUpdate = true;
    }
    const c0 = sample.concentration ?? NaN;
    const c = Number.isFinite(c0) ? c0 : (parameters.stockConcentration ?? NaN);
    const eps = parameters.absorptivity ?? DEFAULT_ABSORPTIVITY;
    if (!Object.is(c, shownC) || eps !== shownEps) {
      shownC = c;
      shownEps = eps;
      tint(solutionLook, c, eps, 2 * spec.radius);
    }
    const c1 = parameters.stockConcentration ?? NaN;
    if (!Object.is(c1, stockC) || eps !== stockEps) {
      stockC = c1;
      stockEps = eps;
      tint(stockLook, c1, eps, 2 * BOTTLE.inner);
    }

    // The colorimeter reads the mixed solution once the run has completed: until then the cuvette
    // is empty and both readouts show dashes. A over its 1 cm path is the model's `absorbance`.
    const a = complete ? (sample.absorbance ?? NaN) : NaN;
    if (!Object.is(a, sampleA)) {
      sampleA = a;
      cuvette.visible = Number.isFinite(a);
      sampleLook.opacity = violetLinear(a, RGB);
      sampleLook.color.setRGB(RGB[0], RGB[1], RGB[2]);
    }
    show('absorbance', a, 3);
    const d = parameters.concentrationResolution ?? NaN;
    const cRead = complete ? c0 : NaN;
    if (!Object.is(cRead, readC) || !Object.is(d, readD)) {
      readC = cRead;
      readD = d;
      // The reading as `measurement.ts` gives it (quantize allocates: only on a change), in µmol/L.
      // shortcut: d finer than 1e-9 mol/L shows to 3 places; the presets stop at 1e-8.
      const valid = Number.isFinite(d) && d > 0;
      readPlaces = valid ? Math.min(Math.max(decimals(d) - 6, 0), 3) : 1;
      readMicro = valid && Number.isFinite(cRead) ? quantize(cRead, d) * 1e6 : NaN;
    }
    show('concentration', readMicro, readPlaces);
  };
  pose({ status: 'idle', parameters: {}, sample: {} }); // until its session exists
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const dilutionStation: BenchModel = {
  frame,
  rig,
  reads: ['volume', 'concentration', 'absorbance'],
};
