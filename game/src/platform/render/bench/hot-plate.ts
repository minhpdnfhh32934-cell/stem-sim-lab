import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { BOILING } from '../../../simulation/models/heating';
import { arc, Assembly, loft, type Outline, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import {
  BEAKER_250,
  ICE_SUBMERGED,
  LAB_THERMOMETER,
  waterLevel,
  WATER_DENSITY,
} from '../../labVisuals/chemistry';
import { box, drum, part, rod, sphere } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The heating curve's bench (model thermal.heating-curve): a hot-plate stirrer with a 250 mL beaker
// of crushed ice on it, a magnetic stir bar in the beaker (the model assumes stirred contents) and
// a thermometer held in it by a clamp on a retort stand. The frame is the plate's housing (the
// entity's mesh), its stir knob, the stand and clamp, the glass and the scale marks; the rig is
// what the run changes: the heating plate's warmth, the power knob, the pilot light, the stir bar
// turning, the ice, the water, the bubbles and steam while it boils, and the thermometer's liquid. All sizes are real
// (m), laid out from `bench.top`: the heating plate's top centre, where the beaker stands.

/** The beaker: 250 mL borosilicate, low form (outer radius, wall, height, base). */
export const BEAKER = BEAKER_250;
const INNER = BEAKER.radius - BEAKER.wall;

/** The hot plate: housing on four feet, its plate on the deck, the control panel sloping in front. */
const PLATE = { radius: 0.075, thick: 0.008 };
const FOOT = 0.006;
const HOUSING = { width: 0.2, back: -0.1, deck: 0.1, front: 0.14, height: 0.066, panel: 0.03 };
/** From the plate's top down to the bench under the feet. */
const FLOOR = PLATE.thick + HOUSING.height + FOOT;
/** The front panel's tilt from vertical up (rad) and its centre (z, y from the plate's top). */
const TILT = Math.atan2(HOUSING.height - HOUSING.panel, HOUSING.front - HOUSING.deck);
const PANEL = {
  z: (HOUSING.deck + HOUSING.front) / 2,
  y: (HOUSING.height + HOUSING.panel) / 2 - HOUSING.height - PLATE.thick,
};
const KNOB_X = 0.045;
const LAMP_X = -0.055;
const STIR_KNOB_X = 0;
/** The knob turns 270° over 0–1000 W: its look only (P is the net power, not the plate's rating). */
const KNOB_TURN_PER_WATT = (1.5 * Math.PI) / 1000;

/** Draw order of see-through parts, as the gas syringe and colorimeter: contents, then glass. */
const LIQUID_ORDER = 1;
const BUBBLE_ORDER = 1.5; // inside the water: after it, so the two never swap as the camera moves
const GLASS_ORDER = 2;

/**
 * The thermometer: −30…110 °C spirit-filled, its bulb near the beaker's bottom (in the water even
 * at the dial's smallest mass of ice, as the test checks) and clear of the stir bar's sweep.
 */
export const THERMOMETER = {
  x: -0.018,
  z: 0,
  bulb: 0.004, // the bulb's bottom above the plate: 1.5 mm over the beaker's inside bottom
  length: 0.3,
  radius: 0.0035,
  /** The scale: −30 °C at `bottom`, 110 °C `span` higher (from the plate's top). */
  low: LAB_THERMOMETER.low,
  high: LAB_THERMOMETER.high,
  bottom: 0.105,
  span: 0.16,
} as const;
/** The column's radius as seen through the stem's lens front (the bore itself is finer). */
const CAPILLARY = 0.0016;
/** Marks' height: about a pixel at the desk, so they do not shimmer away. */
const MARK = 0.002;
/** The bulb's spirit, from the plate's top: its centre and half-height (an ellipsoid). */
export const BULB = { y: THERMOMETER.bulb + 0.0055, half: 0.0045 } as const;
const BULB_TOP = BULB.y + BULB.half - 0.0005; // where the column leaves the bulb
/** The PTFE stir bar on the beaker's floor: 25 × 6 mm, turning while the plate is on (look only). */
export const STIR_BAR = { length: 0.025, radius: 0.003, turnsPerSecond: 2 } as const;
const CLAMP_Y = 0.285;

/** The retort stand beside the plate (−x), its rod in line with the thermometer. */
const STAND = { x: -0.175, z: 0, baseW: 0.11, baseD: 0.16, baseH: 0.014, rod: 0.006, top: 0.45 };
const BASE_Z = 0.05; // the base reaches forward from the rod

/** Crushed ice: 64 chunks are the dial's largest mass, 0.1 kg (a bulk ≈ 0.2 L, as crushed ice). */
const CHUNKS = 64;
const FULL_ICE = 0.1;
const CHUNK = 0.0068;
const BUBBLES = 20;
const PUFFS = 6;

/** The temperature's height on the scale, from the plate's top (clamped to the glass's scale). */
export function readingHeight(celsius: number): number {
  const { low, high, bottom, span } = THERMOMETER;
  const t = Math.min(high, Math.max(low, celsius));
  return bottom + ((t - low) / (high - low)) * span;
}

/** The water's level above the beaker's inside bottom (m): its volume over the inside area. */
export const levelOf = waterLevel;

/** The chunks of ice drawn for this much ice (kg): at least one while any is left. */
export const chunksOf = (iceKg: number) =>
  iceKg > 0 ? Math.min(CHUNKS, Math.max(1, Math.round((CHUNKS * iceKg) / FULL_ICE))) : 0;

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A convex polygon (counter-clockwise) with corners rounded to `corner`, shrunk by the inset. */
const rounded =
  (points: readonly THREE.Vector2[], corner: number): Outline =>
  (inset) => {
    const n = points.length;
    // The outward normal of each edge, from point i to i + 1.
    const normals = points.map((p, i) => {
      const q = points[(i + 1) % n] ?? p;
      return new THREE.Vector2(q.y - p.y, p.x - q.x).normalize();
    });
    const r = Math.max(0.0005, corner - inset);
    return points.flatMap((p, i) => {
      const a = normals[(i + n - 1) % n] ?? new THREE.Vector2();
      const b = normals[i] ?? new THREE.Vector2();
      const centre = p.clone().addScaledVector(a.clone().add(b), -corner / (1 + a.dot(b)));
      const a0 = Math.atan2(a.y, a.x);
      let a1 = Math.atan2(b.y, b.x);
      if (a1 < a0) a1 += 2 * Math.PI;
      // Segments of at most 22.5°, so loft keeps the round smooth (it creases turns over 30°).
      return arc(centre.x, centre.y, r, a0, a1, Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 8))));
    });
  };

/** A lathe from (radius, height) pairs, its normals made unit (three leaves its seam's long). */
function lathe(profile: readonly (readonly [number, number])[], segments: number) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
  const normal = g.getAttribute('normal');
  const n = new THREE.Vector3();
  for (let i = 0; i < normal.count; i++) {
    n.fromBufferAttribute(normal, i).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** Pieces of one material merged into one geometry (one draw). */
const merged = (pieces: THREE.BufferGeometry[]) => part('body', true, pieces).geometry;

/** The beaker's glass: a rolled rim, rounded foot, its spout pinched out towards +x. */
function beakerGlass(): THREE.BufferGeometry {
  const { radius: R, wall, height: H, base: B } = BEAKER;
  const corner = (cx: number, cy: number, r: number, a0: number, a1: number) =>
    arc(cx, cy, r, a0, a1, 3).map((p) => [p.x, p.y] as const);
  const g = lathe(
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
  // The spout: the top 14 mm pushed out and up a little around +x.
  const position = g.getAttribute('position');
  const lip = 0.014;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const r = Math.hypot(x, z);
    if (y <= H - lip || r === 0) continue;
    const t = (y - (H - lip)) / lip;
    const w = Math.max(0, x / r) ** 6;
    const out = (r + 0.0045 * t * t * w) / r;
    position.setXYZ(i, x * out, y + 0.002 * t * w, z * out);
  }
  return g;
}

/** The thermometer's glass, from its bulb's bottom: the bulb, a neck, the stem, a rounded top. */
function thermometerGlass(): THREE.BufferGeometry {
  const { length: L, radius: r } = THERMOMETER;
  return lathe(
    [
      [0, 0],
      [0.0022, 0.001],
      [0.0031, 0.0035],
      [0.0031, 0.0075],
      [0.0024, 0.0105],
      [r, 0.0135],
      [r, L - 0.003],
      [r - 0.0009, L - 0.0008],
      [0, L],
    ],
    16,
  );
}

/** A unit box's transform: at (x, y, z), sized (sx, sy, sz). */
const mark = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );

/**
 * The fixed parts, laid out from `bench.top` (A, the heating plate's top centre):
 * the housing (the entity's mesh: a deck, the control panel sloping down in front, chamfered);
 * in one dark mesh its rubber feet, the panel's face, the stand's cast base, the boss head and
 * the clamp's jaws; in one steel mesh the stand's rod and foot nut, the clamp arm and the thumb
 * screws; in one glass mesh the beaker and the thermometer; and one instanced mesh of marks: the
 * beaker's white graduations (every 25 mL to 200 mL), the thermometer's white back strip and its
 * black marks every 10 °C from −30 to 110 °C (longer every 50).
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const A = topOf(item);
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2c333b', ...LOOKS.painted }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const glass = own(
    new THREE.MeshStandardMaterial({ color: '#d8eef5', ...GLASSWARE_LOOK, opacity: 0.28 }),
  );
  glass.depthWrite = false; // see-through: what is inside (ice, water, the column) shows
  const marks = own(new THREE.MeshStandardMaterial({ color: '#ffffff', ...LOOKS.matte }));
  const floor = A.y - FLOOR;

  // 1. The housing: its side profile (z, y) lofted across x, chamfered all round.
  const v = (z: number, y: number) => new THREE.Vector2(z, y);
  const { width, back, deck, front, height, panel } = HOUSING;
  const half = width / 2;
  const body = keep(
    loft(
      rounded([v(back, 0), v(front, 0), v(front, panel), v(deck, height), v(back, height)], 0.006),
      [
        [0.003, -half],
        [0, 0.003 - half],
        [0, half - 0.003],
        [0.003, half],
      ],
    ),
  );
  body.rotateY(-Math.PI / 2); // the profile's x along +z, the loft along x
  body.translate(A.x, floor + FOOT, A.z);

  // 2. Dark: the feet, the panel's face on the slope and the stir knob on it, the stand's base,
  // boss head and jaws.
  const face = box(0.17, 0.002, 0.042).rotateX(TILT);
  const normal = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
  face.translate(A.x, A.y + PANEL.y + normal.y * 0.001, A.z + PANEL.z + normal.z * 0.001);
  const stirKnob = lathe(
    [
      [0, 0],
      [0.011, 0],
      [0.011, 0.004],
      [0.0085, 0.006],
      [0.008, 0.012],
      [0.0068, 0.014],
      [0, 0.014],
    ],
    20,
  )
    .rotateX(TILT)
    .translate(A.x + STIR_KNOB_X, A.y + PANEL.y, A.z + PANEL.z);
  const sx = A.x + STAND.x;
  const sz = A.z + STAND.z;
  const clampY = A.y + CLAMP_Y;
  const tx = A.x + THERMOMETER.x;
  const tz = A.z + THERMOMETER.z;
  const jaw = THERMOMETER.radius + 0.0025;
  const darkMesh = mesh(
    keep(
      merged([
        ...[-1, 1].flatMap((fx) =>
          [back + 0.025, front - 0.03].map((fz) =>
            drum(0.011, 0.012, floor, floor + FOOT, 12).translate(
              A.x + fx * (half - 0.025),
              0,
              A.z + fz,
            ),
          ),
        ),
        face,
        stirKnob,
        slab(STAND.baseW, STAND.baseD, STAND.baseH, 0.012, 0.003).translate(
          sx,
          floor,
          A.z + BASE_Z,
        ),
        slab(0.026, 0.026, 0.032, 0.003, 0.0015).translate(sx, clampY - 0.016, sz),
        box(0.012, 0.016, 0.004, tx - 0.004, clampY, tz - jaw),
        box(0.012, 0.016, 0.004, tx - 0.004, clampY, tz + jaw),
        box(0.006, 0.016, 2 * jaw + 0.004, tx - 0.013, clampY, tz),
      ]),
    ),
    dark,
  );
  darkMesh.name = 'stand';

  // 3. Steel: the rod and its foot nut, the clamp arm, the thumb screws (T handles).
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const baseTop = floor + STAND.baseH;
  mesh(
    keep(
      merged([
        drum(STAND.rod, STAND.rod, baseTop, floor + STAND.top, 12).translate(sx, 0, sz),
        drum(0.011, 0.011, baseTop, baseTop + 0.01, 6).translate(sx, 0, sz),
        rod(0.004, p(sx + 0.013, clampY, sz), p(tx - 0.016, clampY, tz)),
        rod(0.0022, p(sx, clampY + 0.006, sz + 0.013), p(sx, clampY + 0.006, sz + 0.03)),
        rod(
          0.002,
          p(sx - 0.01, clampY + 0.006, sz + 0.03),
          p(sx + 0.01, clampY + 0.006, sz + 0.03),
        ),
        rod(0.0022, p(sx - 0.013, clampY - 0.006, sz), p(sx - 0.03, clampY - 0.006, sz)),
        rod(
          0.002,
          p(sx - 0.03, clampY - 0.006, sz - 0.01),
          p(sx - 0.03, clampY - 0.006, sz + 0.01),
        ),
        rod(
          0.0018,
          p(tx - 0.004, clampY, tz + jaw + 0.002),
          p(tx - 0.004, clampY, tz + jaw + 0.012),
        ),
      ]),
    ),
    steel,
  ).castShadow = false; // thinner than a shadow-map texel

  // 4. Glass: the beaker on the plate, the thermometer in it. Drawn after its contents.
  const glassMesh = mesh(
    keep(
      merged([
        beakerGlass().translate(A.x, A.y, A.z),
        thermometerGlass().translate(tx, A.y + THERMOMETER.bulb, tz),
      ]),
    ),
    glass,
  );
  glassMesh.name = 'glass';
  glassMesh.castShadow = false;
  glassMesh.renderOrder = GLASS_ORDER;

  // 5. Marks: graduations on the beaker's front (+z), the thermometer's strip and scale.
  const graduations = [25, 50, 75, 100, 125, 150, 175, 200].map((ml) =>
    mark(
      A.x,
      A.y + BEAKER.base + levelOf((ml / 1e6) * WATER_DENSITY),
      A.z + BEAKER.radius + 0.0002,
      ml % 50 ? 0.006 : 0.012,
      MARK,
      0.0004,
    ),
  );
  const { low, high, bottom, span, radius } = THERMOMETER;
  const strip = mark(tx, A.y + bottom + span / 2, tz - 0.0022, 0.004, span + 0.02, 0.0005);
  const ticks = Array.from({ length: (high - low) / 10 + 1 }, (_, i) => {
    const t = low + 10 * i;
    // On the stem's front, from the capillary rightwards (longer every 50 °C).
    const long = t % 50 === 0 ? 0.0026 : 0.0016;
    return mark(
      tx + long / 2 - 0.0002,
      A.y + readingHeight(t),
      tz + radius - 0.0001,
      long,
      MARK,
      0.0006,
    );
  });
  const scale = copies(keep(new THREE.BoxGeometry(1, 1, 1)), marks, [
    ...graduations,
    strip,
    ...ticks,
  ]);
  scale.name = 'marks';
  scale.castShadow = false;
  const black = new THREE.Color('#15181c');
  ticks.forEach((_, i) => scale.setColorAt(graduations.length + 1 + i, black));
  const white = new THREE.Color('#ffffff');
  for (let i = 0; i <= graduations.length; i++) scale.setColorAt(i, white);

  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** A deterministic scatter in [0, 1) (the same pile every time). */
const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The crushed ice: chunks in rings, layer on layer from the beaker's bottom (the first fill the
 * bottom layer, so fewer chunks are a lower pile), each turned and squashed its own way. Returns
 * their transforms and, for each count, the pile's top.
 */
function icePile() {
  const transforms: THREE.Matrix4[] = [];
  const tops = new Float32Array(CHUNKS + 1);
  const rings = [
    [0, 1],
    [0.012, 6],
    [0.0225, 10], // the outer ring's chunks just clear the glass
  ] as const;
  for (let layer = 0; transforms.length < CHUNKS; layer++) {
    const y = BEAKER.base + CHUNK * 0.8 + layer * 0.0115;
    for (const [r, n] of rings) {
      for (let k = 0; k < n && transforms.length < CHUNKS; k++) {
        const i = transforms.length;
        const a = ((k + (layer % 2) * 0.5) / n) * 2 * Math.PI + hash(i) * 0.4;
        const jitter = (hash(i + 101) - 0.5) * 0.003;
        transforms.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3((r + jitter) * Math.cos(a), y + jitter, (r + jitter) * Math.sin(a)),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(hash(i + 7) * 6.3, hash(i + 13) * 6.3, hash(i + 29) * 6.3),
            ),
            new THREE.Vector3(
              0.85 + hash(i + 3) * 0.3,
              0.7 + hash(i + 5) * 0.3,
              0.85 + hash(i + 11) * 0.3,
            ),
          ),
        );
        tops[i + 1] = Math.max(tops[i] ?? 0, y + jitter + CHUNK);
      }
    }
  }
  return { transforms, tops };
}

/**
 * What the run changes, at `bench.top`. `pose` reads the run's `temperature`, `iceFraction`,
 * `waterMass` and `state`, and the run's (else the dials') `power`, `mass` and
 * `startTemperature`; without a run it shows the set-up the model starts from: all the mass as
 * ice at T₀, no water. It only assigns, and skips what has not changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const group = kit.group;
  group.position.copy(topOf(item));

  // The heating plate: dark ceramic, a faint dull-red warmth while on (below ~500 °C a real plate
  // does not glow; the pilot light is the clear "on" cue).
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

  // The power knob on the sloping panel (a white index line on it) and the pilot light.
  const knobLook = own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic }));
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex);
    const n = g.getAttribute('position').count;
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3),
    );
    return g;
  };
  const knob = mesh(
    keep(
      merged([
        paint(
          lathe(
            [
              [0, 0],
              [0.012, 0],
              [0.012, 0.004],
              [0.0095, 0.006],
              [0.0088, 0.013],
              [0.0075, 0.015],
              [0, 0.015],
            ],
            24,
          ),
          '#202428',
        ),
        paint(box(0.0014, 0.0008, 0.007, 0, 0.0152, 0.004), '#f2f2f2'),
      ]),
    ),
    knobLook,
  );
  knob.name = 'knob';
  knob.castShadow = false;
  knob.position.set(KNOB_X, PANEL.y, PANEL.z);
  knob.rotation.set(TILT, 0, 0); // its axis along the panel's normal; it turns about it (y)
  const lampOff = own(new THREE.MeshStandardMaterial({ color: '#5b1d14', ...LOOKS.plastic }));
  const lampOn = own(new THREE.MeshBasicMaterial({ color: '#ff7a2e' })); // reads at any light
  const lamp = mesh(keep(sphere(0.0045, 0, 0, 0, 12)), lampOff);
  swaps(lamp, lampOn);
  lamp.name = 'lamp';
  lamp.castShadow = false;
  lamp.position.set(LAMP_X, PANEL.y, PANEL.z);

  // The stir bar on the beaker's floor, under the ice: white PTFE, a capsule along x.
  const ptfe = own(new THREE.MeshStandardMaterial({ color: '#f3f3ef', ...LOOKS.satin }));
  const { length: barLength, radius: barRadius } = STIR_BAR;
  const stirBar = mesh(
    keep(
      new THREE.CapsuleGeometry(barRadius, barLength - 2 * barRadius, 4, 10).rotateZ(Math.PI / 2),
    ),
    ptfe,
  );
  stirBar.name = 'stir-bar';
  stirBar.castShadow = false;
  stirBar.position.y = BEAKER.base + barRadius;

  // The contents: ice chunks, the water (a unit column scaled to its level), bubbles, steam.
  const ice = own(
    new THREE.MeshStandardMaterial({ color: '#e6f4fb', ...LOOKS.satin, flatShading: true }),
  );
  const pile = icePile();
  const chunks = copies(keep(new THREE.IcosahedronGeometry(CHUNK, 0)), ice, pile.transforms);
  chunks.name = 'ice';
  chunks.castShadow = false;
  chunks.frustumCulled = false; // its count changes; the bounds would be stale
  const waterLook = own(
    new THREE.MeshStandardMaterial({
      color: '#d4e9f2', // meltwater: nearly colourless, not a tinted solution
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
  water.visible = false;
  const foam = own(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      ...LOOKS.glass,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const ball = keep(new THREE.SphereGeometry(1, 8, 6));
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const bubbles = copies(
    ball,
    foam,
    Array.from({ length: BUBBLES }, () => hidden),
  );
  bubbles.name = 'bubbles';
  bubbles.castShadow = false;
  bubbles.frustumCulled = false; // they move every frame
  bubbles.renderOrder = BUBBLE_ORDER;
  bubbles.visible = false;
  // Steam is haze, not a solid: unlit, and rounder than the small bubbles' sphere.
  const vapour = own(
    new THREE.MeshBasicMaterial({
      color: '#f4f7f9',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  const steam = copies(
    keep(new THREE.SphereGeometry(1, 16, 12)),
    vapour,
    Array.from({ length: PUFFS }, () => hidden),
  );
  steam.name = 'steam';
  steam.castShadow = false;
  steam.frustumCulled = false;
  steam.renderOrder = LIQUID_ORDER;
  steam.visible = false;
  // Each bubble's and puff's own place and phase, chosen once.
  const seeds = Float32Array.from({ length: 3 * (BUBBLES + PUFFS) }, (_, i) => hash(i + 500));

  // The thermometer's liquid: its bulb, and the column up the capillary to the reading.
  // Coloured spirit, lit by the room like the glass round it (it does not glow in the dark).
  const spirit = own(
    new THREE.MeshStandardMaterial({ color: '#d0262b', ...LOOKS.glass, transparent: false }),
  );
  const { x: tx, z: tz } = THERMOMETER;
  const bulb = mesh(keep(sphere(1, 0, 0, 0, 12)), spirit);
  bulb.name = 'bulb';
  bulb.castShadow = false;
  bulb.position.set(tx, BULB.y, tz);
  bulb.scale.set(0.0024, BULB.half, 0.0024);
  const column = mesh(keep(drum(CAPILLARY, CAPILLARY, 0, 1, 8)), spirit);
  column.name = 'column';
  column.castShadow = false;
  column.position.set(tx, BULB_TOP, tz);

  // Reused by pose: nothing is made per frame.
  const m = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const still = new THREE.Quaternion();
  let on: boolean | null = null;
  let drawnPower = NaN;
  let drawnT = NaN;
  let drawnChunks = -1;
  let drawnLevel = NaN;
  let boiling = false;
  let clock = 0;

  const pose = (p: BenchPose, dt: number) => {
    const sample = p.sample; // one read: each refills it from the session
    const { power = NaN, mass = NaN, startTemperature = NaN } = p.parameters;
    const t = sample.temperature ?? NaN;
    const run = !Number.isNaN(t);
    const temperature = run ? t : startTemperature;
    const iceKg = run ? (sample.iceFraction ?? NaN) * mass : mass;
    const level = run ? levelOf(sample.waterMass ?? NaN) : 0;
    const running = p.status === 'running';
    // The bar turns while the plate is on (stirring is the model's assumption, not a variable).
    if (running)
      stirBar.rotation.y =
        (stirBar.rotation.y + 2 * Math.PI * STIR_BAR.turnsPerSecond * dt) % (2 * Math.PI);

    if (running !== on || !Object.is(power, drawnPower)) {
      on = running;
      lamp.material = running ? lampOn : lampOff;
      hot.emissiveIntensity = running ? 0.05 + 0.15 * Math.min(1, (power || 0) / 800) : 0;
    }
    if (!Object.is(power, drawnPower)) {
      drawnPower = power;
      knob.rotation.y = -(power || 0) * KNOB_TURN_PER_WATT;
    }
    if (!Object.is(temperature, drawnT)) {
      drawnT = temperature;
      column.visible = Number.isFinite(temperature);
      if (column.visible) column.scale.y = readingHeight(temperature) - BULB_TOP;
    }
    const n = chunksOf(iceKg);
    if (n !== drawnChunks || !Object.is(level, drawnLevel)) {
      drawnChunks = n;
      drawnLevel = level;
      chunks.count = n;
      chunks.visible = n > 0;
      water.visible = level > 0;
      if (water.visible) water.scale.y = level;
      // The pile rests on the bottom until the melt water floats it, ~8 % of it showing.
      const top = pile.tops[n] ?? 0;
      chunks.position.y = level > 0 ? Math.max(0, BEAKER.base + level - ICE_SUBMERGED * top) : 0;
    }

    const boil = running && (run ? (sample.state ?? NaN) : NaN) >= BOILING && level > 0;
    if (boil !== boiling) {
      boiling = boil;
      bubbles.visible = boil;
      steam.visible = boil;
    }
    if (!boil) return;
    // Bubbles rise from the bottom through the water, faster at more power; puffs rise above.
    clock += dt;
    const rise = (0.04 + 0.08 * Math.min(1, (power || 0) / 800)) / Math.max(level, 0.005);
    for (let i = 0; i < BUBBLES; i++) {
      const u = ((((seeds[3 * i] ?? 0) + clock * rise) % 1) + 1) % 1;
      const r = 0.026 * Math.sqrt(seeds[3 * i + 1] ?? 0);
      const a = (seeds[3 * i + 2] ?? 0) * 2 * Math.PI;
      at.set(r * Math.cos(a), BEAKER.base + u * level, r * Math.sin(a));
      size.setScalar(0.0008 + 0.0016 * u);
      bubbles.setMatrixAt(i, m.compose(at, still, size));
    }
    bubbles.instanceMatrix.needsUpdate = true;
    for (let k = 0; k < PUFFS; k++) {
      const j = 3 * (BUBBLES + k);
      const u = ((((seeds[j] ?? 0) + clock * 0.3) % 1) + 1) % 1;
      const drift = 0.02 * u * Math.sin((seeds[j + 2] ?? 0) * 6.3);
      at.set(
        ((seeds[j + 1] ?? 0) - 0.5) * 0.03 + drift,
        BEAKER.height + 0.005 + 0.12 * u,
        ((seeds[j + 2] ?? 0) - 0.5) * 0.03,
      );
      size.setScalar((0.008 + 0.022 * u) * Math.sin(Math.PI * u));
      steam.setMatrixAt(k, m.compose(at, still, size));
    }
    steam.instanceMatrix.needsUpdate = true;
  };
  return { group, pose, dispose: () => kit.dispose() };
}

export const hotPlate: BenchModel = {
  frame,
  rig,
  reads: ['temperature', 'iceFraction', 'waterMass', 'state'],
};
