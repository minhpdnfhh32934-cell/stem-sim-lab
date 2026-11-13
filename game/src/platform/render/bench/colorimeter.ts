import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, arc, at, loft, type Outline, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import {
  BATH_THERMOMETER,
  thermometerFraction,
  timerShown,
  violetLinear,
} from '../../labVisuals/chemistry';
import { box, drum, part, rod } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The reaction-rate bench (crystal violet fading in NaOH): a school colorimeter, its cuvette in the
// slot, and beside it a thermostatted water bath with the two stock flasks and a thermometer, a
// lab timer, the stock bottles (crystal violet in glass, NaOH in plastic, as it etches glass) and a
// test-tube rack. Laid out from `bench.top` (frame and rig alike; [0, 0, 0] is the item's base
// centre), +z towards the user, in real sizes (m). The rig: the reaction mixture (in the cuvette and in its beaker) whose
// violet follows the run's `absorbance`, the colorimeter's 590 nm lamp (lit while a run is in
// progress) and its absorbance readout, the timer reading the model's `elapsed` with a mark once
// `halfTime` is set, and the bath's set point and thermometer column (the `temperature` setting).

export type G = THREE.BufferGeometry;
export type V3 = readonly [number, number, number];

/** The colorimeter: centre of its footprint, width, and its side profile (z, y) on 6 mm feet. */
export const CM = { x: 0.02, z: -0.03, width: 0.24, top: 0.096 };
const CM_PROFILE: readonly V3[] = [
  [-0.1, 0.006, 0],
  [0.08, 0.006, 0],
  [0.08, 0.036, 0],
  [0.02, 0.096, 0],
  [-0.1, 0.096, 0],
];
/** Its sloped front panel, 45°: from (z, y) = (0.08, 0.036) up and back, s metres along it. */
export const SLOPE = -Math.PI / 4;
export const onSlope = (x: number, s: number, out: number): V3 => [
  CM.x + x,
  0.036 + s * Math.SQRT1_2 + out * Math.SQRT1_2,
  CM.z + 0.08 - s * Math.SQRT1_2 + out * Math.SQRT1_2,
];
/** The cuvette slot (a 12.5 mm square cuvette, 45 mm tall, 20 mm of it in the slot). */
export const SLOT = { x: CM.x - 0.05, z: CM.z - 0.05, collar: 0.008, bottom: 0.084 };
const SLOT_TOP = CM.top + SLOT.collar;
/** The water bath: outside x, z ranges, its height, and the water's surface. */
const BATH = { x0: -0.455, x1: -0.145, z0: -0.15, z1: 0.11, top: 0.15, floor: 0.036, water: 0.11 };
const BATH_X = (BATH.x0 + BATH.x1) / 2;
const TANK = { x0: BATH.x0 + 0.012, x1: BATH.x1 - 0.012, z0: BATH.z0 + 0.012, z1: 0.06 };
/** The thermometer, its bulb in the water: 10 to 60 °C over 0.16–0.25 m, above the rim's clip. */
const THERMO = {
  x: -0.19,
  z: -0.11,
  bulb: 0.068,
  zero: 0.16,
  full: 0.25,
  from: BATH_THERMOMETER.from,
  to: BATH_THERMOMETER.to,
};
/** The beaker the mixture was made up in, beside the colorimeter. */
const BEAKER = { x: 0.21, z: 0.1, radius: 0.021, fill: 0.036 };
/** The timer, standing tilted back on its kickstand, and its LCD window's colour. */
const TIMER = { x: 0.33, z: 0.13, tilt: -0.35 };
const LCD_WINDOW = '#b9c4a8';

/** Where the layout stands in the item's frame: `bench.top`, from the item's base centre. */
export function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A part's transform as a matrix, for geometry built in place. */
export const placed = (g: G, [x, y, z]: V3, rx = 0, ry = 0, rz = 0) =>
  g.applyMatrix4(at(x, y, z, rx, ry, rz));

/** One colour on every vertex: the finishes draw all their colours with one material. */
export function paint(g: G, hex: string): G {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[3 * i] = c.r;
    colors[3 * i + 1] = c.g;
    colors[3 * i + 2] = c.b;
  }
  return g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** The pieces of one finish merged into one geometry (one draw). */
export const merged = (pieces: G[]) => part('body', false, pieces).geometry;

/** A round solid about the y axis through the profile's (radius, height) points, bottom up. */
export function lathe(profile: readonly (readonly [number, number])[], segments = 24): G {
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

/** A convex polygon (counter-clockwise) with its corners rounded to `corner`, shrunk by the inset. */
function rounded(points: readonly THREE.Vector2[], corner: number): Outline {
  const n = points.length;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % n] ?? p;
    return new THREE.Vector2(q.y - p.y, p.x - q.x).normalize(); // outward
  });
  const corners = points.map((p, i) => {
    const a = normals[(i + n - 1) % n] ?? new THREE.Vector2();
    const b = normals[i] ?? a;
    // The arc's centre: `corner` inside both edges meeting at p.
    const centre = p.clone().addScaledVector(a.clone().add(b), -corner / (1 + a.dot(b)));
    const from = a.angle();
    const to = b.angle() < from ? b.angle() + 2 * Math.PI : b.angle();
    return { centre, from, to };
  });
  return (inset) =>
    corners.flatMap(({ centre, from, to }) =>
      arc(centre.x, centre.y, Math.max(0.0005, corner - inset), from, to, 4),
    );
}

/** A solid of the side profile (z, y) along x, `width` wide, its edges rounded and chamfered. */
function prism(profile: readonly V3[], width: number, corner: number, bevel: number): G {
  // The loft's outline (u, v) = (−z, y): rotateY(π/2) takes its (u, v, s) to (s, v, −u).
  const points = profile.map(([z, y]) => new THREE.Vector2(-z, y));
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length] ?? p;
    return sum + p.x * q.y - q.x * p.y;
  }, 0);
  if (area < 0) points.reverse();
  const w = width / 2;
  return loft(rounded(points, corner), [
    [bevel, -w],
    [0, -w + bevel],
    [0, w - bevel],
    [bevel, w],
  ]).rotateY(Math.PI / 2);
}

/** A slab (assembly.ts) with its base at (x, y, z). */
export const slabAt = (w: number, d: number, h: number, corner: number, bevel: number, p: V3) =>
  placed(slab(w, d, h, corner, bevel), p);

/** An Erlenmeyer flask's glass, 0.12 m tall, standing at the origin. */
const FLASK: readonly (readonly [number, number])[] = [
  [0.0001, 0],
  [0.031, 0],
  [0.034, 0.004],
  [0.0125, 0.075],
  [0.0115, 0.082],
  [0.0115, 0.117],
  [0.013, 0.12],
];

/** A test tube's glass, 16 mm across with a round bottom, 0.12 m tall. */
const TUBE: readonly (readonly [number, number])[] = [
  ...Array.from({ length: 5 }, (_, i): [number, number] => {
    const a = (i / 4) * (Math.PI / 2);
    return [Math.max(0.0001, 0.0075 * Math.sin(a)), 0.0075 * (1 - Math.cos(a))];
  }),
  [0.0075, 0.118],
  [0.0085, 0.12],
];

/** The pieces of a bench frame, by finish (each merged into one draw by its builder). */
export interface FrameParts {
  readonly body: G[];
  readonly plastic: G[];
  readonly glass: G[];
}

/**
 * The colorimeter itself, laid out from `bench.top`: case, feet, the slot's collar and its open
 * lid, the display window, the lamp's bezel and two keys on the sloped panel, and (`cuvette`) a
 * square cuvette tube standing in the slot. The reaction-rate bench and the dilution bench share
 * it.
 */
export function colorimeterParts({ body, plastic, glass }: FrameParts, cuvette = true): void {
  const dark = (g: G) => plastic.push(paint(g, '#24282d'));
  body.push(placed(prism(CM_PROFILE, CM.width, 0.008, 0.002), [CM.x, 0, CM.z]));
  for (const [x, z] of [
    [-1, -0.085],
    [1, -0.085],
    [-1, 0.065],
    [1, 0.065],
  ] as const)
    dark(drum(0.008, 0.008, 0, 0.006, 12).translate(CM.x + x * 0.1, 0, CM.z + z));
  dark(slabAt(0.03, 0.03, SLOT.collar, 0.004, 0.0015, [SLOT.x, CM.top, SLOT.z]));
  plastic.push(paint(box(0.016, 0.0006, 0.016, SLOT.x, SLOT_TOP + 0.0003, SLOT.z), '#07080a'));
  const hinge: V3 = [SLOT.x, SLOT_TOP, SLOT.z - 0.015];
  dark(placed(box(0.032, 0.003, 0.03, 0, 0.0015, 0.015), hinge, (-110 * Math.PI) / 180));
  dark(placed(new THREE.CylinderGeometry(0.0025, 0.0025, 0.034, 8), hinge, 0, 0, Math.PI / 2));
  // A square tube: four sides, turned square to the case.
  if (cuvette)
    glass.push(
      drum(0.0125 * Math.SQRT1_2, 0.0125 * Math.SQRT1_2, SLOT.bottom, SLOT.bottom + 0.045, 4, true)
        .rotateY(Math.PI / 4)
        .translate(SLOT.x, 0, SLOT.z),
    );
  dark(placed(box(0.088, 0.034, 0.002), onSlope(0.005, 0.045, 0.0005), SLOPE));
  dark(placed(box(0.01, 0.01, 0.001), onSlope(-0.07, 0.045, 0.0003), SLOPE));
  for (const x of [0.075, 0.103])
    plastic.push(
      paint(placed(box(0.018, 0.012, 0.004), onSlope(x, 0.045, 0.001), SLOPE), '#5b636c'),
    );
}

/**
 * The fixed parts, by finish: the body (the item's colour, focus shows on it) is the colorimeter's
 * case and the bath's housing; plastics (display windows, keys, feet, caps, the timer, the NaOH
 * bottle, the rack), steel, glass, the coloured stock liquids and the clear ones (bath water, NaOH,
 * a water blank) are one mesh each. Glass is drawn after the liquids in it (renderOrder), neither
 * writes depth.
 */
function frame(item: ItemDefinition): BenchFrame {
  const origin = originOf(item);
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(origin); // built from bench.top, as the rig is
  const body: G[] = [];
  const plastic: G[] = [];
  const steel: G[] = [];
  const glass: G[] = [];
  const dye: G[] = [];
  const clear: G[] = []; // the bath's water first: what stands in it is drawn after it
  const dark = (g: G) => plastic.push(paint(g, '#24282d'));

  colorimeterParts({ body, plastic, glass });

  // 2. The beaker the mixture was made up in (its liquid is the rig's).
  glass.push(
    lathe([
      [0.0001, 0],
      [0.019, 0],
      [BEAKER.radius, 0.002],
      [BEAKER.radius, 0.058],
      [BEAKER.radius + 0.0015, 0.06],
    ]).translate(BEAKER.x, 0, BEAKER.z),
  );

  // 3. The water bath: housing (base, walls, the control block in front), steel liner and rim,
  //    the water, the two stock flasks standing in it, the thermometer clipped to the back rim, and
  //    on the control block the set-point window, the knob and the power switch.
  const bw = BATH.x1 - BATH.x0;
  const bd = BATH.z1 - BATH.z0;
  const wall = BATH.top - BATH.floor;
  for (const x of [-1, 1])
    for (const z of [BATH.z0 + 0.03, BATH.z1 - 0.03])
      dark(drum(0.012, 0.012, 0, 0.006, 12).translate(BATH_X + x * (bw / 2 - 0.03), 0, z));
  body.push(
    slabAt(bw, bd, BATH.floor - 0.006, 0.012, 0.003, [BATH_X, 0.006, (BATH.z0 + BATH.z1) / 2]),
    slabAt(bw, 0.012, wall, 0.004, 0.0015, [BATH_X, BATH.floor, BATH.z0 + 0.006]),
    slabAt(bw, BATH.z1 - TANK.z1, wall, 0.006, 0.002, [
      BATH_X,
      BATH.floor,
      (TANK.z1 + BATH.z1) / 2,
    ]),
  );
  for (const x of [BATH.x0 + 0.006, BATH.x1 - 0.006])
    body.push(
      slabAt(0.012, TANK.z1 - BATH.z0, wall, 0.004, 0.0015, [
        x,
        BATH.floor,
        (BATH.z0 + TANK.z1) / 2,
      ]),
    );
  const tw = TANK.x1 - TANK.x0;
  const td = TANK.z1 - TANK.z0;
  const tz = (TANK.z0 + TANK.z1) / 2;
  steel.push(box(tw, 0.002, td, BATH_X, BATH.floor + 0.001, tz));
  const rim = BATH.top + 0.0015;
  steel.push(
    box(bw, 0.003, 0.016, BATH_X, rim, BATH.z0 + 0.008),
    box(bw, 0.003, 0.016, BATH_X, rim, TANK.z1 + 0.004),
    box(0.016, 0.003, td, BATH.x0 + 0.008, rim, tz),
    box(0.016, 0.003, td, BATH.x1 - 0.008, rim, tz),
  );
  const water = BATH.water - BATH.floor - 0.002;
  clear.push(
    paint(
      box(tw - 0.002, water, td - 0.002, BATH_X, BATH.floor + 0.002 + water / 2, tz),
      '#a9d8ea',
    ),
  );
  const standing = BATH.floor + 0.002;
  for (const [x, liquid, into] of [
    [-0.4, '#5a1a8c', dye], // crystal violet stock
    [-0.31, '#eef6f8', clear], // NaOH
  ] as const) {
    glass.push(lathe(FLASK).translate(x, standing, -0.045));
    into.push(paint(drum(0.03, 0.0205, 0.002, 0.045, 24).translate(x, standing, -0.045), liquid));
    plastic.push(
      paint(drum(0.0105, 0.0135, 0.11, 0.132, 16).translate(x, standing, -0.045), '#3a3d42'),
    );
  }
  glass.push(drum(0.0035, 0.0035, THERMO.bulb, THERMO.full, 12).translate(THERMO.x, 0, THERMO.z));
  // The bulb opaque, as the rig's column above it.
  plastic.push(
    paint(
      new THREE.SphereGeometry(0.0042, 12, 8).translate(THERMO.x, THERMO.bulb, THERMO.z),
      '#c8252b',
    ),
  );
  plastic.push(
    paint(
      box(
        0.011,
        THERMO.full - THERMO.zero,
        0.001,
        THERMO.x,
        (THERMO.zero + THERMO.full) / 2,
        THERMO.z - 0.0042,
      ),
      '#f2f2ee',
    ),
  );
  // Its scale's graduations every 10 °C, either side of the tube.
  for (let c = THERMO.from; c <= THERMO.to; c += 10)
    dark(
      box(
        0.011,
        0.0007,
        0.0004,
        THERMO.x,
        THERMO.zero + ((c - THERMO.from) / (THERMO.to - THERMO.from)) * (THERMO.full - THERMO.zero),
        THERMO.z - 0.0035,
      ),
    );
  steel.push(box(0.012, 0.006, 0.036, THERMO.x, BATH.top + 0.006, THERMO.z - 0.014));
  dark(box(0.075, 0.032, 0.002, BATH_X - 0.075, 0.095, BATH.z1 + 0.001));
  dark(
    placed(
      new THREE.CylinderGeometry(0.013, 0.013, 0.014, 20),
      [BATH_X + 0.04, 0.095, BATH.z1 + 0.007],
      Math.PI / 2,
    ),
  );
  plastic.push(
    paint(box(0.002, 0.009, 0.002, BATH_X + 0.04, 0.1, BATH.z1 + 0.0145), '#eef1f3'),
    paint(box(0.014, 0.022, 0.008, BATH_X + 0.105, 0.095, BATH.z1 + 0.004), '#c43a35'),
  );

  // 4. The timer: a yellow case on a wire kickstand, its LCD window and two keys.
  const timer = at(TIMER.x, 0.002, TIMER.z, TIMER.tilt);
  const onTimer = (g: G) => g.applyMatrix4(timer);
  plastic.push(
    paint(
      onTimer(
        slab(0.062, 0.085, 0.016, 0.01, 0.002)
          .rotateX(Math.PI / 2)
          .translate(0, 0.0425, 0),
      ),
      '#e3b63a',
    ),
    paint(onTimer(box(0.05, 0.026, 0.001, 0, 0.058, 0.0165)), LCD_WINDOW),
  );
  for (const [x, color] of [
    [-0.014, '#c43a35'],
    [0.014, '#5b636c'],
  ] as const)
    plastic.push(
      paint(
        onTimer(
          new THREE.CylinderGeometry(0.008, 0.008, 0.003, 16)
            .rotateX(Math.PI / 2)
            .translate(x, 0.022, 0.0175),
        ),
        color,
      ),
    );
  for (const x of [-0.02, 0.02]) {
    const top = new THREE.Vector3(x, 0.06, 0).applyMatrix4(timer);
    steel.push(rod(0.0012, top, new THREE.Vector3(top.x, 0.0012, top.z - 0.035), 6));
  }

  // 5. The stock bottles: crystal violet in glass (label, violet band, black cap) and NaOH in
  //    natural HDPE (label with the corrosive orange band, red cap).
  const cv = { x: 0.235, z: -0.13 };
  glass.push(
    lathe([
      [0.0001, 0],
      [0.026, 0],
      [0.028, 0.003],
      [0.028, 0.088],
      [0.022, 0.1],
      [0.0115, 0.108],
      [0.0115, 0.122],
    ]).translate(cv.x, 0, cv.z),
  );
  dye.push(paint(drum(0.0265, 0.0265, 0.003, 0.08, 24).translate(cv.x, 0, cv.z), '#3f0f63'));
  const naoh = { x: 0.33, z: -0.13 };
  plastic.push(
    paint(drum(0.0285, 0.0285, 0.025, 0.07, 24, true).translate(cv.x, 0, cv.z), '#f4f1e8'),
    paint(drum(0.0287, 0.0287, 0.058, 0.066, 24, true).translate(cv.x, 0, cv.z), '#6c2bb0'),
    paint(drum(0.0135, 0.0135, 0.118, 0.138, 16).translate(cv.x, 0, cv.z), '#1d2024'),
    paint(
      lathe([
        [0.0001, 0],
        [0.028, 0],
        [0.03, 0.004],
        [0.03, 0.095],
        [0.024, 0.108],
        [0.013, 0.115],
        [0.013, 0.126],
      ]).translate(naoh.x, 0, naoh.z),
      '#e6e9ec',
    ),
    paint(drum(0.0303, 0.0303, 0.03, 0.075, 24, true).translate(naoh.x, 0, naoh.z), '#f4f1e8'),
    paint(drum(0.0305, 0.0305, 0.062, 0.07, 24, true).translate(naoh.x, 0, naoh.z), '#e8702a'),
    paint(drum(0.0145, 0.0145, 0.12, 0.14, 16).translate(naoh.x, 0, naoh.z), '#c43a35'),
  );

  // 6. The test-tube rack along the right edge: two plates, end walls, four holes, three tubes
  //    (dilute dye, NaOH, a water blank for zeroing the colorimeter).
  const rack = { x: 0.43, z: -0.06, length: 0.22 };
  const blue = (g: G) => plastic.push(paint(g, '#3d7fc4'));
  blue(slabAt(0.07, rack.length, 0.006, 0.006, 0.0015, [rack.x, 0, rack.z]));
  blue(slabAt(0.07, rack.length, 0.006, 0.006, 0.0015, [rack.x, 0.066, rack.z]));
  for (const s of [-1, 1])
    blue(
      slabAt(0.07, 0.006, 0.06, 0.002, 0.001, [
        rack.x,
        0.006,
        rack.z + s * (rack.length / 2 - 0.003),
      ]),
    );
  const holes = [-0.075, -0.025, 0.025, 0.075].map((z) => rack.z + z);
  for (const z of holes)
    plastic.push(paint(drum(0.0095, 0.0095, 0.072, 0.0728, 16).translate(rack.x, 0, z), '#1b1e22'));
  holes.slice(0, 3).forEach((z, i) => {
    glass.push(lathe(TUBE, 16).translate(rack.x, 0.006, z));
    const liquid = paint(
      drum(0.0065, 0.0065, 0.01, 0.066, 16).translate(rack.x, 0, z),
      i === 0 ? '#7a3fc0' : '#eef6f8',
    );
    (i === 0 ? dye : clear).push(liquid);
  });

  const bodyGeometry = keep(merged(body));
  bodyGeometry.translate(origin.x, origin.y, origin.z);
  mesh(
    keep(merged(plastic)),
    own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic })),
  ).name = 'plastic';
  const metal = mesh(
    keep(merged(steel)),
    own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal })),
  );
  metal.name = 'steel';
  metal.castShadow = false; // rims, rods and clips: thinner than a shadow-map texel
  const see = (
    pieces: G[],
    name: string,
    order: number,
    params: THREE.MeshStandardMaterialParameters,
  ) => {
    const m = mesh(
      keep(merged(pieces)),
      own(new THREE.MeshStandardMaterial({ ...params, depthWrite: false })),
    );
    m.name = name;
    m.renderOrder = order;
    m.castShadow = false;
    return m;
  };
  const liquid = { roughness: 0.1, metalness: 0, transparent: true, vertexColors: true };
  see(clear, 'clear-liquids', 0, { ...liquid, opacity: 0.35 });
  see(dye, 'dye-liquids', 1, { ...liquid, opacity: 0.85 });
  see(glass, 'glass', 2, { color: '#cfe8f0', ...GLASSWARE_LOOK });
  return { body: bodyGeometry, parts: kit.group, dispose: () => kit.dispose() };
}

/**
 * A seven-segment readout: where it is (base frame, turned rx about x), its digits and colours, and
 * its mesh: lit LEDs (`indicators`, unlit material) or the timer's reflective LCD (`lcd`, lit like
 * the plastic around it, its off segments the window's colour so they vanish into it).
 */
interface Readout {
  readonly mesh: 'indicators' | 'lcd';
  readonly at: V3;
  readonly rx: number;
  readonly height: number;
  readonly pitch: number;
  readonly digits: number;
  readonly decimals: number;
  readonly on: string;
  readonly off: string;
}

/** The readouts, in the order their segments are instanced. */
export const READOUTS = {
  /** The colorimeter's absorbance, red LEDs, 0.000–9.999. */
  absorbance: {
    mesh: 'indicators',
    at: onSlope(0.005, 0.045, 0.0016),
    rx: SLOPE,
    height: 0.018,
    pitch: 0.016,
    digits: 4,
    decimals: 3,
    on: '#ff3b2f',
    off: '#3a0d0b',
  },
  /** The timer's LCD, seconds to 0.1 s, counting in steps of its resolution d. */
  elapsed: {
    mesh: 'lcd',
    at: [0, 0.058, 0.0172],
    rx: 0,
    height: 0.014,
    pitch: 0.0105,
    digits: 4,
    decimals: 1,
    on: '#1c211d',
    off: LCD_WINDOW,
  },
  /** The bath's set point, green LEDs, °C. */
  temperature: {
    mesh: 'indicators',
    at: [BATH_X - 0.075, 0.095, BATH.z1 + 0.0026],
    rx: 0,
    height: 0.016,
    pitch: 0.0135,
    digits: 3,
    decimals: 1,
    on: '#43e07a',
    off: '#0d2a17',
  },
} as const satisfies Record<string, Readout>;
type ReadoutId = keyof typeof READOUTS;
const IDS = Object.keys(READOUTS) as ReadoutId[];

/** Segments a–g of a digit `height` tall: centre x, y and size w, h. */
export function segments(height: number): [number, number, number, number][] {
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
export const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
export const DASH = 0x40;
export const POW10 = [1, 10, 100, 1000, 10000];

/**
 * Instance indices within each readout's mesh: its segments from `start`, then its decimal point;
 * the 590 nm lamp is the last LED, the half-life mark the last LCD instance.
 */
export const INDICATORS = (() => {
  const count: Record<Readout['mesh'], number> = { indicators: 0, lcd: 0 };
  const start = {} as Record<ReadoutId, number>;
  const point = {} as Record<ReadoutId, number>;
  for (const id of IDS) {
    const m = READOUTS[id].mesh;
    start[id] = count[m];
    point[id] = start[id] + READOUTS[id].digits * 7;
    count[m] = point[id] + 1;
  }
  const lamp = count.indicators++;
  const half = count.lcd++;
  return { start, point, lamp, half, count };
})();

/** The timer's tilt applied to a point on its face (its readout is laid out on the face). */
const timerFrame = () => at(TIMER.x, 0.002, TIMER.z, TIMER.tilt);

/** Absorbance drawn without a run: the dye at c₀, A₀ = ε·l·c₀ (Beer–Lambert). */
// shortcut: ε and l default to the definition's initial conditions (1e7 L/(mol·m), 0.01 m), which
// the dials do not carry; read them from the definition if a station ever changes them.
const idleAbsorbance = (p: Readonly<Record<string, number>>) =>
  (p.absorptivity ?? 1e7) * (p.pathLength ?? 0.01) * (p.initialConcentration ?? NaN);

/**
 * The parts drawn from the run; `pose` assigns colours, opacity and one scale, skipping what has
 * not changed, and allocates nothing.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));

  // The reaction mixture: in the cuvette (as far as it fills it) and in its beaker.
  const mix = own(
    new THREE.MeshStandardMaterial({
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    }),
  );
  const mixture = mesh(
    keep(
      merged([
        box(0.0105, 0.035, 0.0105, SLOT.x, SLOT.bottom + 0.002 + 0.0175, SLOT.z),
        drum(BEAKER.radius - 0.0012, BEAKER.radius - 0.0012, 0.0015, BEAKER.fill, 24).translate(
          BEAKER.x,
          0,
          BEAKER.z,
        ),
      ]),
    ),
    mix,
  );
  mixture.name = 'mixture';
  mixture.renderOrder = 1; // before the glass around it
  mixture.castShadow = false;

  // The thermometer's spirit column: unit high, scaled to the reading.
  const column = mesh(
    keep(new THREE.CylinderGeometry(0.0011, 0.0011, 1, 8).translate(0, 0.5, 0)),
    own(new THREE.MeshStandardMaterial({ color: '#c8252b', ...LOOKS.plastic })),
  );
  column.name = 'thermometer';
  column.position.set(THERMO.x, THERMO.bulb + 0.004, THERMO.z);
  column.castShadow = false;

  // Segments, decimal points, the lamp and the timer's mark, coloured per instance: the LEDs in one
  // draw (unlit: they read at any light), the timer's LCD in another (lit like its window).
  const cell = keep(new THREE.BoxGeometry(1, 1, 1));
  const copies = (name: Readout['mesh'], material: THREE.Material) => {
    const m = kit.copies(
      cell,
      own(material),
      Array.from({ length: INDICATORS.count[name] }, () => new THREE.Matrix4()),
    );
    m.name = name;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  };
  const lamps = {
    indicators: copies('indicators', new THREE.MeshBasicMaterial()),
    lcd: copies('lcd', new THREE.MeshStandardMaterial(LOOKS.plastic)),
  };
  const { indicators: led, lcd } = lamps;
  const on = {} as Record<ReadoutId, THREE.Color>;
  const off = {} as Record<ReadoutId, THREE.Color>;
  const place = (
    m: THREE.InstancedMesh,
    i: number,
    base: THREE.Matrix4,
    [lx, ly, w, h]: readonly [number, number, number, number],
  ) =>
    m.setMatrixAt(i, base.clone().multiply(at(lx, ly, 0).scale(new THREE.Vector3(w, h, 0.0006))));
  for (const id of IDS) {
    const o: Readout = READOUTS[id];
    const m = lamps[o.mesh];
    on[id] = new THREE.Color(o.on);
    off[id] = new THREE.Color(o.off);
    const base = at(...o.at, o.rx);
    if (id === 'elapsed') base.premultiply(timerFrame());
    const left = (-(o.digits - 1) / 2) * o.pitch;
    for (let d = 0; d < o.digits; d++) {
      segments(o.height).forEach(([sx, sy, w, h], s) => {
        place(m, INDICATORS.start[id] + d * 7 + s, base, [left + d * o.pitch + sx, sy, w, h]);
        m.setColorAt(INDICATORS.start[id] + d * 7 + s, off[id]);
      });
    }
    // The decimal point after the units digit.
    const t = o.height * 0.12;
    const units = o.digits - 1 - o.decimals;
    place(m, INDICATORS.point[id], base, [
      left + units * o.pitch + o.height * 0.25 + t,
      -o.height / 2 + t / 2,
      t,
      t,
    ]);
    m.setColorAt(INDICATORS.point[id], on[id]);
  }
  const lampOn = new THREE.Color('#ffa62b'); // 590 nm: orange
  const lampOff = new THREE.Color('#3b2a10');
  place(led, INDICATORS.lamp, at(...onSlope(-0.07, 0.045, 0.0012), SLOPE), [0, 0, 0.005, 0.005]);
  led.setColorAt(INDICATORS.lamp, lampOff);
  const face = timerFrame().multiply(at(0, 0, READOUTS.elapsed.at[2]));
  place(lcd, INDICATORS.half, face, [-0.0225, 0.068, 0.003, 0.003]);
  lcd.setColorAt(INDICATORS.half, off.elapsed);
  // Made by setColorAt.
  const colors = {
    indicators: led.instanceColor as THREE.InstancedBufferAttribute,
    lcd: lcd.instanceColor as THREE.InstancedBufferAttribute,
  };

  /** Writes a number into a readout: to its decimals, leading zeros blank; dashes if unreadable. */
  const shown: Record<ReadoutId, number> = { absorbance: NaN, elapsed: NaN, temperature: NaN };
  const show = (id: ReadoutId, value: number) => {
    const o = READOUTS[id];
    const m = lamps[o.mesh];
    const n = Math.round(value * (POW10[o.decimals] ?? 1));
    const key = Number.isFinite(n) && n >= 0 && n < (POW10[o.digits] ?? 0) ? n : -1;
    if (key === shown[id]) return;
    shown[id] = key;
    for (let d = 0; d < o.digits; d++) {
      const k = o.digits - 1 - d; // its power of ten
      const p = POW10[k] ?? 1;
      const mask =
        key < 0 ? DASH : k > o.decimals && key < p ? 0 : (DIGITS[Math.floor(key / p) % 10] ?? 0);
      for (let s = 0; s < 7; s++)
        m.setColorAt(INDICATORS.start[id] + d * 7 + s, mask & (1 << s) ? on[id] : off[id]);
    }
    colors[o.mesh].needsUpdate = true;
  };
  show('absorbance', NaN);
  show('elapsed', 0);
  show('temperature', NaN);

  const rgb: [number, number, number] = [1, 1, 1]; // violetLinear's reused result
  let running: boolean | null = null;
  let half: boolean | null = null;
  let tinted: number | undefined; // undefined: nothing drawn yet (NaN is a pose: no reading)
  let level: number | undefined;
  const pose = (p: BenchPose) => {
    const { status, parameters, sample } = p;
    const run = status === 'running';
    if (run !== running) {
      running = run;
      led.setColorAt(INDICATORS.lamp, run ? lampOn : lampOff);
      colors.indicators.needsUpdate = true;
    }
    const a = sample.absorbance ?? NaN;
    show('absorbance', a);
    // Without a run, the dye as made up (A₀ from the dials); with one, the run's absorbance. The
    // violet's depth is 1 − T, T = 10^−A the light the cuvette lets through at 590 nm: a drawing of
    // the reading, never a colour measurement.
    const drawn = Number.isFinite(a) ? a : idleAbsorbance(parameters);
    if (!Object.is(drawn, tinted)) {
      tinted = drawn;
      mix.opacity = violetLinear(drawn, rgb);
      mix.color.setRGB(rgb[0], rgb[1], rgb[2]);
    }
    const t = sample.elapsed ?? NaN;
    const d = parameters.timerResolution ?? NaN;
    // A timer of resolution d counts in whole steps of d while running (a stopwatch never runs
    // ahead); stopped, it shows the nearest multiple of d, as `measurement.ts` reads it (its
    // quantize allocates, so not called per frame).
    // shortcut: shown to 0.1 s, so a d off the 0.1 s grid shows rounded; fine while the presets are on it.
    show('elapsed', timerShown(t, d, run));
    const marked = (sample.halfTime ?? NaN) > 0;
    if (marked !== half) {
      half = marked;
      lcd.setColorAt(INDICATORS.half, marked ? on.elapsed : off.elapsed);
      colors.lcd.needsUpdate = true;
    }
    const celsius = parameters.temperature ?? NaN;
    show('temperature', celsius);
    if (!Object.is(celsius, level)) {
      level = celsius;
      const f = thermometerFraction(celsius, THERMO.from, THERMO.to);
      const top = THERMO.zero + f * (THERMO.full - THERMO.zero);
      column.scale.y = top - column.position.y;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const colorimeter: BenchModel = {
  frame,
  rig,
  reads: ['absorbance', 'elapsed', 'halfTime'],
};
