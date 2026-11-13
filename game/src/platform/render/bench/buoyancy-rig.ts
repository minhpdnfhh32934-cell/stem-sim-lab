import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { Assembly } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The buoyancy bench (model mechanics.buoyancy) on a 0.45 × 0.25 m patch of bench, real sizes in
 * metres, from the item's base centre (+z is the front).
 * Fixed (frame): a retort stand (base plate, Ø 12 mm steel rod 0.60 m tall) at the back left; a
 * scissor lab jack carrying a metal overflow (Eureka) can, inner Ø 95 mm, 0.20 m tall, its
 * spout 0.17 m up its wall pointing +x and down; a 100 mL glass measuring cylinder (inner Ø 27 mm,
 * its scale 1 mL to 100 mL) on a drip tray under the spout's tip. The stand's plate and the
 * jack's plates are the entity's mesh, in the item's colour (focus shows on them).
 * Moving (rig, from the run only): the slide — a motorised carriage on the rod, its arm, the
 * force sensor (LCD facing +z) and the rigid Ø 3 mm rod screwed into the cube — goes down with
 * the cube, whose bottom is `depth` under the can's surface (the surface stays at the spout: an
 * overflow can); the liquid in the measuring cylinder, its height `submergedVolume`/(π·r²); a
 * thin stream from the spout while the run lowers the cube through the surface; the sensor's
 * LCD, `reading` to the dialled resolution d as `measurement.ts` reads it, a minus sign when the
 * rod pushes a light cube under. Before a run the cube rests the clearance above the surface,
 * the cylinder is empty and the LCD shows dashes: nothing has been measured.
 * The cube is drawn at its true edge (`edgeLength`); its look and the liquid's tint come from the
 * nearest preset of `objectDensity` and `fluidDensity` (presentation only).
 */

const STAND = { x: -0.16, z: 0, width: 0.12, depth: 0.12, plate: 0.012 };
const ROD = { x: -0.19, z: 0.01, radius: 0.006, top: 0.6 };
const JACK = { x: -0.04, z: 0.01, size: 0.11, plate: 0.006, height: 0.1 };
const CAN = { radius: 0.0485, wall: 0.001, height: 0.2, spout: 0.17 };
/** The liquid's surface: the can's spout, 0.27 m above the base; it never moves. */
export const SURFACE = JACK.height + CAN.spout;
const SPOUT = { radius: 0.005, tipX: 0.1, tipY: 0.235 };
const CYLINDER = { x: 0.1, z: 0.01, inner: 0.0135, outer: 0.015, zero: 0.02, mouth: 0.215 };
/** The measuring cylinder's bore: 100 mL is 0.1746 m of it. */
export const BORE = Math.PI * CYLINDER.inner ** 2;
const TRAY = { x: 0.1, z: 0.01, size: 0.09, height: 0.008, floor: 0.002 };
/** The cube's bottom starts this far above the surface (the definition's `clearance`). */
export const CLEARANCE = 0.02;
/** The slide, from the cube's top centre: the sensor's rod, stud, body, LCD, arm and carriage. */
const SLIDE = {
  rod: 0.1,
  stud: 0.01,
  body: { width: 0.12, height: 0.05, depth: 0.035 },
  arm: 0.012,
  carriage: { width: 0.035, height: 0.06, depth: 0.035 },
};
const BODY_Y = SLIDE.rod + SLIDE.stud + SLIDE.body.height / 2; // the sensor body's centre
const FACE_Z = SLIDE.body.depth / 2; // its front, where the LCD is
const LCD_Y = BODY_Y + 0.004;
const ARM_Y = SLIDE.rod + SLIDE.stud + SLIDE.body.height + SLIDE.arm / 2;

/** Looks by the nearest preset density (presentation only): the cube's materials and the liquids. */
export const CUBE_LOOKS = [
  { density: 905, color: '#efe9dc', roughness: 0.5, metalness: 0 }, // polypropylene
  { density: 1140, color: '#e9dfc3', roughness: 0.4, metalness: 0 }, // nylon 6,6
  { density: 2700, color: '#c9ced3', roughness: 0.3, metalness: 0.5 }, // aluminium
  { density: 8960, color: '#b87333', roughness: 0.3, metalness: 0.5 }, // copper
] as const;
export const FLUID_LOOKS = [
  { density: 789.3, color: '#eef4f6', opacity: 0.22 }, // ethanol
  { density: 998.2, color: '#cfe6f2', opacity: 0.3 }, // water
  { density: 1024.8, color: '#c6e4df', opacity: 0.32 }, // sea water
  { density: 1197.2, color: '#dfe4e6', opacity: 0.4 }, // salt water: a faint haze
] as const;
const OTHER_CUBE = { density: NaN, color: '#8a8f94', roughness: 0.6, metalness: 0 };

/** Lit segments of a 7-segment digit, bit 0 = a (top) … bit 6 = g (middle), for 0–9. */
export const SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f] as const;
const DASH = 0x40;
const SLOTS = 8; // a digit's seven segments and its decimal point

/** The index of the look whose preset density is within 0.5 % of `density`; −1 when none is. */
function nearest(looks: readonly { density: number }[], density: number): number {
  let best = -1;
  let gap = 0.005 * density;
  for (let i = 0; i < looks.length; i++) {
    const g = Math.abs((looks[i]?.density ?? NaN) - density);
    if (g < gap) {
      gap = g;
      best = i;
    }
  }
  return best;
}

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A round bar of radius `r` from a to b. */
function bar(r: number, a: THREE.Vector3, b: THREE.Vector3, segments = 8) {
  const along = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, along.length(), segments);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      along.clone().normalize(),
    ),
  );
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

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

/** The overflow can: a thin-walled open metal cylinder with a flat bottom, standing at y = 0. */
function canGeometry(): THREE.LatheGeometry {
  const { radius: r, wall, height } = CAN;
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r, height),
      new THREE.Vector2(r - wall, height),
      new THREE.Vector2(r - wall, 0.002),
      new THREE.Vector2(0, 0.002),
    ],
    40,
  );
}

/** The 100 mL measuring cylinder: hexagonal-looking foot, stem, bore and pouring lip, one shell. */
function cylinderGeometry(): THREE.LatheGeometry {
  const { inner, outer, zero, mouth } = CYLINDER;
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.03, 0),
      new THREE.Vector2(0.03, 0.005),
      new THREE.Vector2(0.018, 0.009),
      new THREE.Vector2(outer, 0.014),
      new THREE.Vector2(outer, mouth - 0.006),
      new THREE.Vector2(outer + 0.002, mouth),
      new THREE.Vector2(inner, mouth),
      new THREE.Vector2(inner, zero),
      new THREE.Vector2(0, zero),
    ],
    24,
  );
}

/**
 * The fixed parts: the stand's plate with the jack's plates (the entity's mesh) and, merged by
 * material, the metal (stand rod, jack arms and screw, can, spout), the plastic (drip tray), the
 * glass cylinder and its scale's marks.
 */
function frame(item: ItemDefinition): BenchFrame {
  const [, h] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.y = -h / 2; // the parts are laid out from the base
  const metal = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.metal }),
  );
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const matte = own(new THREE.MeshBasicMaterial({ color: '#1d2731' })); // the scale's ink
  // See-through: no depth write, so the liquid inside shows (palette.ts).
  const glass = own(
    new THREE.MeshStandardMaterial({
      color: '#e4f1f6',
      ...GLASSWARE_LOOK,
      opacity: 0.25,
      depthWrite: false,
    }),
  );

  const body = keep(
    merge([
      [
        new THREE.BoxGeometry(STAND.width, STAND.plate, STAND.depth).translate(
          STAND.x,
          STAND.plate / 2,
          STAND.z,
        ),
      ],
      [
        new THREE.BoxGeometry(JACK.size, JACK.plate, JACK.size).translate(
          JACK.x,
          JACK.plate / 2,
          JACK.z,
        ),
      ],
      [
        new THREE.BoxGeometry(JACK.size, JACK.plate, JACK.size).translate(
          JACK.x,
          JACK.height - JACK.plate / 2,
          JACK.z,
        ),
      ],
    ]),
  );
  body.translate(0, -h / 2, 0);

  const steel: Piece[] = [];
  // The stand's rod, its collar on the plate.
  steel.push([
    new THREE.CylinderGeometry(ROD.radius, ROD.radius, ROD.top - STAND.plate, 16).translate(
      ROD.x,
      (ROD.top + STAND.plate) / 2,
      ROD.z,
    ),
    '#b9bfc5',
  ]);
  steel.push([
    new THREE.CylinderGeometry(0.012, 0.014, 0.01, 16).translate(ROD.x, STAND.plate + 0.005, ROD.z),
    '#6b7076',
  ]);
  // The jack: two crossed pairs of arms between its plates, a lead screw with its knob.
  const armZ = JACK.size / 2 - 0.012;
  const reach = JACK.size / 2 - 0.01;
  const y0 = JACK.plate;
  const y1 = JACK.height - JACK.plate;
  for (const s of [-1, 1]) {
    const z = JACK.z + s * armZ;
    steel.push([bar(0.003, v3(JACK.x - reach, y0, z), v3(JACK.x + reach, y1, z)), '#3a3f46']);
    steel.push([bar(0.003, v3(JACK.x + reach, y0, z), v3(JACK.x - reach, y1, z)), '#3a3f46']);
  }
  const screwY = JACK.height / 2;
  steel.push([
    bar(0.0025, v3(JACK.x - reach, screwY, JACK.z), v3(JACK.x + reach + 0.012, screwY, JACK.z)),
    '#9aa2aa',
  ]);
  steel.push([
    new THREE.CylinderGeometry(0.008, 0.008, 0.008, 12)
      .rotateZ(Math.PI / 2)
      .translate(JACK.x + reach + 0.012, screwY, JACK.z),
    '#2b2f36',
  ]);
  // The can on the jack, its spout from the wall at the surface to the tip over the cylinder.
  steel.push([canGeometry().translate(JACK.x, JACK.height, JACK.z), '#cdd2d7']);
  steel.push([
    bar(
      SPOUT.radius,
      v3(JACK.x + CAN.radius - 0.004, SURFACE - 0.002, JACK.z),
      v3(SPOUT.tipX, SPOUT.tipY, CYLINDER.z),
      12,
    ),
    '#cdd2d7',
  ]);

  // The drip tray under the measuring cylinder: a shallow dish.
  const tray = merge([
    [
      new THREE.BoxGeometry(TRAY.size, TRAY.floor, TRAY.size).translate(
        TRAY.x,
        TRAY.floor / 2,
        TRAY.z,
      ),
    ],
    ...[-1, 1].flatMap((s): Piece[] => [
      [
        new THREE.BoxGeometry(TRAY.size, TRAY.height, 0.004).translate(
          TRAY.x,
          TRAY.height / 2,
          TRAY.z + s * (TRAY.size / 2 - 0.002),
        ),
      ],
      [
        new THREE.BoxGeometry(0.004, TRAY.height, TRAY.size).translate(
          TRAY.x + s * (TRAY.size / 2 - 0.002),
          TRAY.height / 2,
          TRAY.z,
        ),
      ],
    ]),
  ]);

  // The scale: a mark every mL, longer every 5 and 10 mL, on the front of the cylinder's wall.
  const marks: Piece[] = [];
  for (let ml = 0; ml <= 100; ml++) {
    const long = ml % 10 === 0 ? 0.008 : ml % 5 === 0 ? 0.006 : 0.004;
    marks.push([
      new THREE.BoxGeometry(long, 0.0004, 0.0003).translate(
        CYLINDER.x + 0.001,
        TRAY.floor + CYLINDER.zero + (ml * 1e-6) / BORE,
        CYLINDER.z + CYLINDER.outer + 0.0002,
      ),
    ]);
  }

  const part = (name: string, g: THREE.BufferGeometry, material: THREE.Material, casts = true) => {
    const m = mesh(keep(g), material);
    m.name = name;
    m.castShadow = casts;
    return m;
  };
  part('metal', merge(steel), metal);
  part('tray', tray, plastic);
  part('marks', merge(marks), matte, false);
  part(
    'glass',
    cylinderGeometry().translate(CYLINDER.x, TRAY.floor, CYLINDER.z),
    glass,
    false,
  ).renderOrder = 2; // after the liquid inside it
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** A 7-segment readout: `places`, each a transform for a digit `size` drawn on its face. */
interface Readout {
  readonly mesh: THREE.InstancedMesh;
  readonly on: readonly THREE.Matrix4[];
  /** The same, unlit: shrunk to nothing where it stands (so the readout keeps its bounds). */
  readonly off: readonly THREE.Matrix4[];
  /** Each place's lit segments (bit 7: its decimal point) as now drawn; −1 before the first. */
  readonly shown: Int16Array;
}

function readout(
  kit: Assembly,
  parent: THREE.Object3D,
  material: THREE.Material,
  places: readonly THREE.Matrix4[],
  size: { width: number; height: number; stroke: number },
): Readout {
  const { width: w, height: h, stroke: s } = size;
  const t = 0.0002;
  // a, b, c, d, e, f, g, then the point: [u, v, horizontal?]
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
  const mesh = kit.copies(kit.keep(new THREE.BoxGeometry(1, 1, 1)), material, on, parent);
  mesh.computeBoundingSphere(); // once, every segment lit: culling stays right whatever it shows
  off.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = 'lcd-digits';
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

/**
 * Shows the integer `n` with `point` decimals right-aligned in the digit places, its sign in the
 * first place (a dash when negative); dashes everywhere when it does not fit or is not a number.
 */
function number(r: Readout, n: number, point: number): void {
  const places = r.shown.length;
  const digits = places - 1;
  const size = Math.abs(n);
  const fits = Number.isFinite(n) && size < 10 ** digits && point < digits;
  // The first digit shown (the units at the latest); the sign sits just left of it.
  let first = digits - 1 - point;
  for (let i = 0; i < first; i++) {
    if (Math.floor(size / 10 ** (digits - 1 - i)) % 10 !== 0) {
      first = i;
      break;
    }
  }
  let changed = false;
  for (let place = 0; place < places; place++) {
    const i = place - 1; // the digit at this place
    let bits: number;
    if (!fits) bits = DASH;
    else if (i < first) bits = i === first - 1 && n < 0 ? DASH : 0;
    else {
      const digit = Math.floor(size / 10 ** (digits - 1 - i)) % 10;
      bits = (SEGMENTS[digit] ?? 0) | (i === digits - 1 - point && point > 0 ? 0x80 : 0);
    }
    changed = light(r, place, bits) || changed;
  }
  if (changed) r.mesh.instanceMatrix.needsUpdate = true;
}

/**
 * The slide with the cube, the liquids and the LCD; `pose` places and lights them from the
 * station (status, the dials, `depth`, `submergedVolume` and `reading`), allocating nothing and
 * rewriting the LCD only when what it shows changes.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  // Its parts are laid out from the base centre, as the frame's.
  const base = new THREE.Group();
  const [tx, ty, tz] = item.bench?.top ?? [0, 0, 0];
  base.position.set(-tx, -ty, -tz);
  kit.group.add(base);
  const plastic = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.plastic }),
  );
  const solid = own(new THREE.MeshStandardMaterial({ color: OTHER_CUBE.color, ...LOOKS.matte }));
  const liquid = own(
    new THREE.MeshStandardMaterial({
      color: '#cfe6f2',
      ...LOOKS.glass,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const backlit = own(new THREE.MeshBasicMaterial({ color: '#b7c6a2' })); // reads at any light
  const ink = own(new THREE.MeshBasicMaterial({ color: '#1d2731' }));

  // The slide, from the cube's top centre: everything on it moves together.
  const slide = new THREE.Group();
  slide.name = 'slide';
  slide.position.set(JACK.x, SURFACE + CLEARANCE, JACK.z);
  base.add(slide);
  const cube = mesh(keep(new THREE.BoxGeometry(1, 1, 1)), solid, slide);
  cube.name = 'cube';
  const dark = '#2b2f36';
  const { body: sb, carriage: cb } = SLIDE;
  const carriageX = ROD.x - JACK.x;
  const pieces: Piece[] = [
    [
      new THREE.CylinderGeometry(0.0015, 0.0015, SLIDE.rod, 8).translate(0, SLIDE.rod / 2, 0),
      '#c4cad0',
    ],
    [
      new THREE.CylinderGeometry(0.004, 0.004, SLIDE.stud, 10).translate(
        0,
        SLIDE.rod + SLIDE.stud / 2,
        0,
      ),
      '#9aa2aa',
    ],
    [new THREE.BoxGeometry(sb.width, sb.height, sb.depth).translate(0, BODY_Y, 0), dark],
    [new THREE.BoxGeometry(0.076, 0.029, 0.002).translate(0, LCD_Y, FACE_Z + 0.001), '#15181c'],
    ...[-1, 1].map((s): Piece => [
      new THREE.BoxGeometry(0.012, 0.006, 0.002).translate(
        0.04 + s * 0.009,
        BODY_Y - 0.017,
        FACE_Z + 0.001,
      ),
      '#5a6068',
    ]),
    [
      new THREE.BoxGeometry(0.02 - carriageX, SLIDE.arm, 0.02).translate(
        (0.02 + carriageX) / 2,
        ARM_Y,
        0,
      ),
      '#9aa2aa',
    ],
    [
      new THREE.BoxGeometry(cb.width, cb.height, cb.depth).translate(carriageX, ARM_Y, 0),
      '#3a3f46',
    ],
    [
      new THREE.CylinderGeometry(0.012, 0.012, 0.03, 14).translate(
        carriageX,
        ARM_Y + cb.height / 2 + 0.015,
        0,
      ),
      '#4b5058',
    ],
  ];
  const fittings = mesh(keep(merge(pieces)), plastic, slide);
  fittings.name = 'fittings';
  const panel = mesh(keep(new THREE.PlaneGeometry(0.07, 0.024)), backlit, slide);
  panel.name = 'lcd';
  panel.position.set(0, LCD_Y, FACE_Z + 0.0021);
  panel.castShadow = false;
  const lcd = readout(
    kit,
    slide,
    ink,
    [0, 1, 2, 3, 4].map((i) =>
      new THREE.Matrix4().makeTranslation((i - 2) * 0.0125 - 0.004, LCD_Y, FACE_Z + 0.0027),
    ),
    { width: 0.0065, height: 0.013, stroke: 0.0013 },
  );

  // The can's liquid, full to the spout; the column in the cylinder; the stream from the spout.
  const column = (r: number, name: string, order: number) => {
    const g = keep(new THREE.CylinderGeometry(r, r, 1, 24).translate(0, 0.5, 0));
    const m = mesh(g, liquid, base);
    m.name = name;
    m.castShadow = false;
    m.renderOrder = order;
    return m;
  };
  const bath = column(CAN.radius - CAN.wall - 0.0002, 'bath', 1);
  bath.position.set(JACK.x, JACK.height + 0.002, JACK.z);
  bath.scale.y = SURFACE - bath.position.y;
  const collected = column(CYLINDER.inner - 0.0002, 'collected', 1);
  collected.position.set(CYLINDER.x, TRAY.floor + CYLINDER.zero, CYLINDER.z);
  const stream = column(0.0015, 'stream', 1);
  stream.position.set(SPOUT.tipX, SPOUT.tipY, CYLINDER.z);
  stream.rotation.x = Math.PI; // hangs down from the tip
  stream.scale.y = 1e-6;

  // What is drawn now: pose skips what has not changed.
  let cubeLook = -2;
  let fluidLook = -2;
  let shownReading = NaN;
  let shownResolution = -1; // never a resolution: the first pose always writes the LCD
  const pose = ({ status, parameters, sample }: BenchPose) => {
    const a = parameters.edgeLength ?? NaN;
    const clearance = parameters.clearance ?? CLEARANCE;
    const d = parameters.forceResolution ?? NaN;
    const run = status === 'running' || status === 'stopped' || status === 'completed';
    const depth = (run ? sample.depth : NaN) ?? NaN;
    const edge = a > 0 && Number.isFinite(a) ? a : 0;
    const h = Number.isFinite(depth)
      ? depth
      : -(Number.isFinite(clearance) ? clearance : CLEARANCE);
    cube.visible = edge > 0;
    cube.scale.setScalar(edge);
    cube.position.y = -edge / 2;
    slide.position.y = SURFACE - h + edge;

    const volume = (run ? sample.submergedVolume : NaN) ?? NaN;
    const height = volume > 0 ? volume / BORE : 0;
    collected.visible = height > 0;
    collected.scale.y = Math.max(height, 1e-6);
    const flowing = status === 'running' && h > 0 && h < edge;
    stream.visible = flowing;
    // Shrunk when hidden, so a hidden stream never widens the rig's bounds.
    stream.scale.y = flowing ? SPOUT.tipY - (collected.position.y + height) : 1e-6;

    const look = nearest(CUBE_LOOKS, parameters.objectDensity ?? NaN);
    if (look !== cubeLook) {
      cubeLook = look;
      const l = CUBE_LOOKS[look] ?? OTHER_CUBE;
      solid.color.set(l.color);
      solid.roughness = l.roughness;
      solid.metalness = l.metalness;
    }
    const tint = nearest(FLUID_LOOKS, parameters.fluidDensity ?? NaN);
    if (tint !== fluidLook) {
      fluidLook = tint;
      const l = FLUID_LOOKS[tint] ?? FLUID_LOOKS[1];
      liquid.color.set(l.color);
      liquid.opacity = l.opacity;
    }

    const reading = (run ? sample.reading : NaN) ?? NaN;
    if (!Object.is(reading, shownReading) || !Object.is(d, shownResolution)) {
      shownReading = reading;
      shownResolution = d;
      if (Number.isFinite(reading) && d > 0 && Number.isFinite(d)) {
        const point = decimals(d);
        number(lcd, Math.round(quantize(reading, d) * 10 ** point), point);
      } else number(lcd, NaN, 0);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const buoyancyRig: BenchModel = {
  frame,
  rig,
  reads: ['depth', 'submergedVolume', 'reading'],
  // The dials' largest: a 0.04 m copper cube (8960 kg/m³) lowered a + 0.02 m (the clearance).
  fullScale: { depth: 0.06, submergedVolume: 0.04 ** 3, reading: 8960 * 0.04 ** 3 * 9.81 },
};
