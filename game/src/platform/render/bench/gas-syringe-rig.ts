import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, arc, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { box, drum, rod, sphere } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The enzyme (catalase) bench: a boiling tube of peroxide in a clear-tank water bath, a two-hole
 * bung with the 5 mL extract syringe and the delivery tube to a 100 mL gas syringe held level in a
 * clamp stand, the buffer and peroxide bottles, a thermometer in the bath and a stopwatch. Laid
 * out from the floor centre of the item's box (+z faces the player); `bench.top` is [0, 0, 0].
 *
 * Driven by the pose only: the gas syringe's plunger by `oxygen` (its seal on the mL scale), the
 * bubbles and froth by `rate`, the stopwatch by `clock`; the bath's display and the thermometer by
 * the temperature, the bottle labels by pH and S₀, the extract syringe and the tube's level by E
 * (drawn up before a run, pushed in once one exists: the 5 mL mixture of the model).
 */

const BATH = { x: -0.25, w: 0.3, d: 0.22, base: 0.05, foot: 0.004 }; // the heater/base unit
const TANK = { w: 0.27, d: 0.19, h: 0.11, wall: 0.004, water: 0.085 }; // clear polycarbonate
const FLOOR = BATH.foot + BATH.base; // the tank's floor
export const TUBE = { x: -0.16, r: 0.0125, inner: 0.0113, bottom: FLOOR + 0.003, length: 0.15 };
const TUBE_TOP = TUBE.bottom + TUBE.length;
/** The tube's inside bottom above the floor: its round bottom's centre is `TUBE.inner` above. */
export const INNER_BOTTOM = TUBE.bottom + 0.0012;
const BUNG = { bottom: TUBE_TOP - 0.015, top: TUBE_TOP + 0.01 };
const AXIS = 0.25; // the gas syringe's axis above the floor (z = 0)
const TIP = -0.1; // its nozzle's tip (x); the barrel runs towards +x
/** The seal's front face at 0 mL, and the scale: 100 mL over 0.14 m of a 30 mm bore. */
export const GAS_SYRINGE = { zero: TIP + 0.024, length: 0.14, capacity: 100, bore: 0.015 };
const STAND = { x: 0, z: -0.105, top: 0.34 };
const EXTRACT = { x: TUBE.x - 0.007, tip: 0.23, bore: 0.006 };
const EXTRACT_ZERO = EXTRACT.tip + 0.01; // its barrel's inside bottom: the seal at 0 mL
/** Metres of the 5 mL syringe's barrel per mL. */
export const EXTRACT_PER_ML = 1e-6 / (Math.PI * EXTRACT.bore ** 2);
const THERMO = { x: -0.36, z: -0.085, bulb: FLOOR + 0.01, low: -10, high: 110 };
const THERMO_SCALE = { bottom: 0.1, length: 0.2 }; // −10 °C at 0.10 m, 110 °C at 0.30 m
const BUFFER = { x: 0.3, z: -0.05 };
const PEROXIDE = { x: 0.355, z: 0.045 };
const BOTTLE = { r: 0.028, label: 0.0284 };
const WATCH = { x: 0.17, z: 0.06, tilt: (50 * Math.PI) / 180 };
/** The model's mixture (mL): the definition's `mixtureVolume`; the buffer makes up 5 − E. */
const MIXTURE = 5;
/** V_max at both optima with the most extract (a·E = 0.01 × 2): bubbles and froth at full. */
const RATE_FULL = 0.02;
const BUBBLES = 18;
/** A bubble's radius (m). */
export const BUBBLE = 0.0013;

const ROD_LIGHT = '#eef1f3';
const SEAL = '#2b2e32';
const INK = '#1d2328';

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** A piece in one colour (as a vertex colour, so pieces of many colours merge into one draw). */
function tint(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geometry.getAttribute('position').count;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) rgb.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return geometry;
}

/** Pieces merged into one geometry (texture coordinates dropped: nothing here is textured). */
function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const piece of pieces) {
    piece.deleteAttribute('uv');
    if (!piece.index) piece.setIndex([...Array(piece.getAttribute('position').count).keys()]);
  }
  const geometry = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return geometry;
}

/** A turned solid about y from a profile of [radius, y] (ascending outside: faces outward). */
const lathe = (profile: readonly (readonly [number, number])[], segments = 24) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

/** A reagent bottle (125 mL) standing at the origin. */
const bottle = () =>
  lathe(
    [
      [0, 0],
      [BOTTLE.r - 0.002, 0],
      [BOTTLE.r, 0.003],
      [BOTTLE.r, 0.085],
      [0.022, 0.097],
      [0.013, 0.103],
      [0.012, 0.112],
      [0, 0.112],
    ],
    28,
  );

/** The 100 mL barrel along its own y (0 at the nozzle's tip), glass-thick: rim, bore, nozzle. */
const gasBarrel = () =>
  lathe(
    [
      [0.004, 0],
      [0.004, 0.015],
      [0.017, 0.022],
      [0.017, 0.191],
      [0.023, 0.191],
      [0.023, 0.195],
      [GAS_SYRINGE.bore, 0.195],
      [GAS_SYRINGE.bore, 0.024],
      [0.0016, 0.017],
      [0.0016, 0],
      [0.004, 0],
    ],
    32,
  );

/** The 5 mL barrel along its own y (0 at the luer tip), finger flange at the top. */
const extractBarrel = () =>
  lathe([
    [0.0018, 0],
    [0.0018, 0.006],
    [0.0068, 0.009],
    [0.0068, 0.058],
    [0.011, 0.058],
    [0.011, 0.0605],
    [EXTRACT.bore, 0.0605],
    [EXTRACT.bore, 0.01],
    [0.0008, 0.007],
    [0.0008, 0],
    [0.0018, 0],
  ]);

/** The boiling tube, round-bottomed, its wall and rolled lip. */
function boilingTube() {
  const c = TUBE.bottom + TUBE.r; // the bottom's centre of curvature
  const outer = arc(0, c, TUBE.r, -Math.PI / 2, 0, 8).map((p) => [p.x, p.y] as const);
  const inner = arc(0, c, TUBE.inner, 0, -Math.PI / 2, 8).map((p) => [p.x, p.y] as const);
  return lathe(
    [
      ...outer,
      [TUBE.r, TUBE_TOP - 0.002],
      [TUBE.r + 0.0013, TUBE_TOP - 0.0015],
      [TUBE.r + 0.0013, TUBE_TOP],
      [TUBE.inner, TUBE_TOP],
      ...inner,
    ],
    28,
  );
}

/** Ticks on a syringe's front, at `x` along its axis; every 10th long, every 5th mid. */
const tick = (k: number, short: number) => (k % 10 === 0 ? 2.4 : k % 5 === 0 ? 1.6 : 1) * short;

/**
 * A printed mark on a cylinder about y of radius `r`: `width` tall, an arc `length` long from
 * `from` (arc length from the front, +z; positive towards +x), so it lies on the curve.
 */
const band = (r: number, width: number, length: number, from = -length / 2) =>
  new THREE.CylinderGeometry(r, r, width, 3, 1, true, from / r, length / r);

/** Seen by a viewer in front: a plunger along its own +y from its seal's front face (y = 0). */
function plunger(seal: number, sealLength: number, rodLength: number, web: number, thumb: number) {
  const end = sealLength + rodLength;
  return [
    tint(drum(seal, seal, 0, sealLength, 24), SEAL),
    tint(box(web, rodLength, web / 7, 0, sealLength + rodLength / 2, 0), ROD_LIGHT),
    tint(box(web / 7, rodLength, web, 0, sealLength + rodLength / 2, 0), ROD_LIGHT),
    tint(drum(thumb, thumb, end, end + web / 6, 24), ROD_LIGHT),
  ];
}

/** The stopwatch's pose: leant back on its stand, its face up towards the player. */
const watchAt = () =>
  at(WATCH.x, 0.0318, WATCH.z).multiply(new THREE.Matrix4().makeRotationX(WATCH.tilt));

/**
 * The fixed parts in six draws: the bath's base unit (the entity's mesh), then by material —
 * steel (stand, boss, clamp, needle, thermometer clip), moulded plastic and rubber in their
 * colours (feet, panel, rim, rack, bung, bottles and labels, stopwatch, scales, cork lining),
 * glass in two draws around the bath water (the tank's back wall and the boiling tube before it;
 * the tank's other walls, both syringe barrels, delivery tube and thermometer after it).
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const floor = -item.visual.size[1] / 2;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const plastic = own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic }));
  // See-through: no depth write, so the liquids and parts inside show (palette.ts does alike).
  const glass = own(
    new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK, depthWrite: false }),
  );
  const water = own(
    new THREE.MeshStandardMaterial({
      color: '#9ccbe0',
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  kit.group.position.y = floor;

  // The base unit: the entity's mesh (focus shows on it), on four rubber feet.
  const body = keep(slab(BATH.w, BATH.d, BATH.base, 0.02, 0.004));
  body.translate(BATH.x, floor + BATH.foot, 0);

  const front = BATH.d / 2;
  const panelY = BATH.foot + BATH.base / 2;
  const tankY = FLOOR + TANK.h;
  const [tw, td] = [TANK.w / 2, TANK.d / 2];
  const plasticPieces = [
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        tint(
          drum(0.012, 0.012, 0, BATH.foot, 12).translate(
            BATH.x + sx * (BATH.w / 2 - 0.03),
            0,
            sz * (BATH.d / 2 - 0.03),
          ),
          SEAL,
        ),
      ),
    ),
    // The control panel: its LED window (the rig's digits), the set knob and the power switch.
    tint(box(0.17, 0.034, 0.002, BATH.x, panelY, front + 0.001), '#2b3138'),
    tint(box(0.056, 0.02, 0.001, BATH.x - 0.035, panelY, front + 0.0025), '#1a0a09'),
    tint(
      drum(0.008, 0.007, 0, 0.009, 20)
        .rotateX(Math.PI / 2)
        .translate(BATH.x + 0.035, panelY, front + 0.002),
      '#15181c',
    ),
    tint(box(0.008, 0.012, 0.004, BATH.x + 0.066, panelY, front + 0.003), '#c43a35'),
    // The tank's rim, and the rack across it that holds the tube (a ring between two bars).
    tint(box(TANK.w + 0.004, 0.006, 0.008, BATH.x, tankY + 0.003, -td), '#e9ecef'),
    tint(box(TANK.w + 0.004, 0.006, 0.008, BATH.x, tankY + 0.003, td), '#e9ecef'),
    tint(box(0.008, 0.006, TANK.d - 0.008, BATH.x - tw, tankY + 0.003, 0), '#e9ecef'),
    tint(box(0.008, 0.006, TANK.d - 0.008, BATH.x + tw, tankY + 0.003, 0), '#e9ecef'),
    ...[-1, 1].map((s) =>
      tint(box(0.006, 0.006, TANK.d, TUBE.x + s * 0.0165, tankY + 0.009, 0), '#f4f5f6'),
    ),
    tint(
      new THREE.TorusGeometry(0.0155, 0.0022, 6, 24)
        .rotateX(Math.PI / 2)
        .translate(TUBE.x, tankY + 0.009, 0),
      '#f4f5f6',
    ),
    // The two-hole bung, red rubber; the rubber sleeve joining the delivery tube to the nozzle.
    tint(
      lathe([
        [0, BUNG.bottom],
        [0.0108, BUNG.bottom],
        [0.0136, BUNG.top],
        [0, BUNG.top],
      ]).translate(TUBE.x, 0, 0),
      '#9a3426',
    ),
    tint(
      drum(0.0048, 0.0048, 0, 0.016, 16)
        .rotateZ(-Math.PI / 2)
        .translate(TIP - 0.004, AXIS, 0),
      SEAL,
    ),
    // The extract syringe's needle hub.
    tint(
      drum(0.0026, 0.0018, EXTRACT.tip - 0.006, EXTRACT.tip + 0.001, 12).translate(EXTRACT.x, 0, 0),
      '#3e9b52',
    ),
    // The clamp's cork lining, inside both jaws.
    ...[-1, 1].map((s) =>
      tint(
        new THREE.TorusGeometry(0.0178, 0.0013, 6, 24, 2 * Math.PI - 0.7)
          .rotateZ(Math.PI + 0.35)
          .rotateY(Math.PI / 2)
          .translate(STAND.x + s * 0.007, AXIS, 0),
        '#a0784a',
      ),
    ),
    // The stand's base, the boss's and the clamp's thumb screws.
    tint(slab(0.14, 0.18, 0.014, 0.012, 0.003).translate(STAND.x, 0, STAND.z + 0.065), '#3a424b'),
    ...[-1, 1].map((s) =>
      tint(
        drum(0.007, 0.007, 0, 0.006, 16)
          .rotateZ(-Math.PI / 2)
          .translate(STAND.x + 0.029, AXIS + s * 0.008, STAND.z),
        '#15181c',
      ),
    ),
    tint(drum(0.007, 0.007, AXIS + 0.017, AXIS + 0.023, 16).translate(0, 0, -0.05), '#15181c'),
    // The thermometer's red spirit bulb (inside the glass bulb).
    tint(sphere(0.0031, THERMO.x, THERMO.bulb, THERMO.z, 10), '#c8302b'),
  ];

  // The bottles: buffer (natural HDPE, blue cap) and hydrogen peroxide (brown, black cap), each
  // with a paper label (the rig prints pH and S₀ on them). No hazard pictogram: peroxide at 1 mol/L
  // (3.4 %) or less carries none.
  for (const [spot, shade, cap] of [
    [BUFFER, '#e2e4dc', '#2f6fb3'],
    [PEROXIDE, '#5a3418', '#202428'],
  ] as const) {
    plasticPieces.push(
      tint(bottle().translate(spot.x, 0, spot.z), shade),
      tint(drum(0.0135, 0.0135, 0.108, 0.124, 24).translate(spot.x, 0, spot.z), cap),
      tint(
        new THREE.CylinderGeometry(BOTTLE.label, BOTTLE.label, 0.048, 28, 1, true).translate(
          spot.x,
          0.05,
          spot.z,
        ),
        '#f6f4ec',
      ),
    );
  }

  // The stopwatch: its body, LCD window (the rig's digits) and two buttons, leant on a wire stand.
  const watch = watchAt();
  plasticPieces.push(
    tint(slab(0.058, 0.068, 0.016, 0.012, 0.003).translate(0, -0.008, 0), '#2a2f36').applyMatrix4(
      watch,
    ),
    tint(box(0.042, 0.0012, 0.022, 0, 0.0084, -0.006), '#9fae94').applyMatrix4(watch),
    ...[-1, 1].map((s) =>
      tint(
        drum(0.004, 0.004, 0, 0.005, 12)
          .rotateX(Math.PI / 2)
          .translate(s * 0.015, 0, -0.039),
        '#c9ccd0',
      ).applyMatrix4(watch),
    ),
  );

  // Scales: the gas syringe's every mL, the extract syringe's every 0.5 mL, the thermometer's
  // every 10 °C — printed on the glass's front, following its curve.
  for (let k = 0; k <= GAS_SYRINGE.capacity; k++) {
    const x = GAS_SYRINGE.zero + (k / GAS_SYRINGE.capacity) * GAS_SYRINGE.length;
    // Down from 7 mm above the axis (the band about y turned to lie along x, +x turned to −y).
    const mark = band(0.0172, 0.0004, tick(k, 0.004), -0.007);
    plasticPieces.push(tint(mark.rotateZ(-Math.PI / 2).translate(x, AXIS, 0), INK));
  }
  for (let k = 0; k <= 10; k++) {
    const len = (k % 2 === 0 ? 2 : 1) * 0.002;
    const y = EXTRACT_ZERO + (k / 2) * EXTRACT_PER_ML;
    plasticPieces.push(tint(band(0.007, 0.0004, len, -len).translate(EXTRACT.x, y, 0), INK));
  }
  for (let t = THERMO.low; t <= THERMO.high; t += 10) {
    const len = t % 50 === 0 ? 0.003 : 0.002;
    plasticPieces.push(
      tint(band(0.0032, 0.0005, len).translate(THERMO.x, thermoY(t), THERMO.z), INK),
    );
  }
  mesh(keep(merged(plasticPieces)), plastic).name = 'plastic';

  // Steel: the stand's rod, the boss, the arm out to the clamp, both jaws, the screws, the needle
  // and the thermometer's clip on the tank's back wall.
  const steelPieces = [
    drum(0.006, 0.006, 0.014, STAND.top, 16).translate(STAND.x, 0, STAND.z),
    sphere(0.006, STAND.x, STAND.top, STAND.z, 12),
    box(0.03, 0.032, 0.03, STAND.x, AXIS, STAND.z),
    rod(0.005, new THREE.Vector3(0, AXIS, STAND.z + 0.015), new THREE.Vector3(0, AXIS, -0.022), 12),
    ...[-1, 1].map((s) =>
      new THREE.TorusGeometry(0.0195, 0.0024, 8, 28, 2 * Math.PI - 0.7)
        .rotateZ(Math.PI + 0.35)
        .rotateY(Math.PI / 2)
        .translate(STAND.x + s * 0.007, AXIS, 0),
    ),
    box(0.02, 0.008, 0.012, STAND.x, AXIS, -0.025),
    ...[-1, 1].map((s) =>
      drum(0.002, 0.002, 0, 0.014, 8)
        .rotateZ(-Math.PI / 2)
        .translate(STAND.x + 0.015, AXIS + s * 0.008, STAND.z),
    ),
    drum(0.002, 0.002, AXIS + 0.004, AXIS + 0.018, 8).translate(0, 0, -0.05),
    drum(0.0004, 0.0004, BUNG.bottom + 0.004, EXTRACT.tip - 0.005, 6).translate(EXTRACT.x, 0, 0),
    box(0.01, 0.03, 0.012, THERMO.x, tankY - 0.008, -td),
    // The stopwatch's wire stand, from its back to the bench.
    rod(
      0.0012,
      new THREE.Vector3(0, -0.006, -0.02).applyMatrix4(watch),
      new THREE.Vector3(WATCH.x, 0.0012, WATCH.z - 0.045),
      6,
    ),
  ];
  const steelMesh = mesh(keep(merged(steelPieces)), steel);
  steelMesh.name = 'steel';

  // Glass behind or in the water, drawn before it: the tank's back wall and the boiling tube.
  const wall = TANK.wall;
  const innerGlassMesh = mesh(
    keep(
      merged([
        box(TANK.w, TANK.h, wall, BATH.x, FLOOR + TANK.h / 2, -td + wall / 2),
        boilingTube().translate(TUBE.x, 0, 0),
      ]),
    ),
    glass,
  );
  innerGlassMesh.name = 'inner-glass';
  innerGlassMesh.castShadow = false;
  innerGlassMesh.renderOrder = 1.25; // after the tube's mixture (1), before the water (1.5)

  // The rest of the glass, in front of or above the water: the tank's other walls, both barrels,
  // the delivery tube up from the bung and over to the nozzle, and the thermometer.
  const glassPieces = [
    box(TANK.w, TANK.h, wall, BATH.x, FLOOR + TANK.h / 2, td - wall / 2),
    box(wall, TANK.h, TANK.d - 2 * wall, BATH.x - tw + wall / 2, FLOOR + TANK.h / 2, 0),
    box(wall, TANK.h, TANK.d - 2 * wall, BATH.x + tw - wall / 2, FLOOR + TANK.h / 2, 0),
    gasBarrel()
      .rotateZ(-Math.PI / 2)
      .translate(TIP, AXIS, 0),
    extractBarrel().translate(EXTRACT.x, EXTRACT.tip, 0),
    rod(
      0.003,
      new THREE.Vector3(TUBE.x + 0.006, BUNG.bottom + 0.008, 0),
      new THREE.Vector3(TUBE.x + 0.006, AXIS - 0.01, 0),
      10,
    ),
    new THREE.TorusGeometry(0.01, 0.003, 8, 8, Math.PI / 2)
      .rotateZ(Math.PI / 2)
      .translate(TUBE.x + 0.016, AXIS - 0.01, 0),
    rod(
      0.003,
      new THREE.Vector3(TUBE.x + 0.016, AXIS, 0),
      new THREE.Vector3(TIP + 0.004, AXIS, 0),
      10,
    ),
    sphere(0.004, THERMO.x, THERMO.bulb, THERMO.z, 12),
    drum(
      0.003,
      0.003,
      THERMO.bulb + 0.003,
      THERMO_SCALE.bottom + THERMO_SCALE.length + 0.03,
      10,
    ).translate(THERMO.x, 0, THERMO.z),
    sphere(0.003, THERMO.x, THERMO_SCALE.bottom + THERMO_SCALE.length + 0.03, THERMO.z, 10),
  ];
  const glassMesh = mesh(keep(merged(glassPieces)), glass);
  glassMesh.name = 'glass';
  glassMesh.castShadow = false;
  glassMesh.renderOrder = 2; // after the liquids inside it

  const waterMesh = mesh(
    keep(box(TANK.w - 2 * wall, TANK.water, TANK.d - 2 * wall, BATH.x, FLOOR + TANK.water / 2, 0)),
    water,
  );
  waterMesh.name = 'water';
  waterMesh.castShadow = false;
  waterMesh.renderOrder = 1.5; // after the tube and back wall (1.25), before the other glass (2)

  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The thermometer's mark for `t` °C, above the floor. */
function thermoY(t: number): number {
  return (
    THERMO_SCALE.bottom + ((t - THERMO.low) / (THERMO.high - THERMO.low)) * THERMO_SCALE.length
  );
}

/** The tube's liquid level above its inside bottom for `ml` of liquid: a hemisphere, then a bore. */
export function tubeLevel(ml: number): number {
  const r = TUBE.inner;
  const cap = (2 / 3) * Math.PI * r ** 3; // m³
  // shortcut: below the hemisphere (E > 1.9 mL leaves < 3.1 mL) the level stays at its rim, at
  // most 0.3 mm high; solve the cap's cubic if E's range ever grows.
  return r + Math.max(0, (ml * 1e-6 - cap) / (Math.PI * r * r));
}

// Seven-segment glyphs (bit 0 = a … bit 6 = g): the displays and printed labels.
const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f] as const;
const DASH = 0x40;
const GLYPH = { p: 0x73, h: 0x74, degree: 0x63, c: 0x39 } as const; // p, lowercase h, °, C
/** Each segment's centre in half-widths and half-heights, and whether it lies across. */
const SEGMENTS = [
  [0, 1, true],
  [1, 0.5, false],
  [1, -0.5, false],
  [0, -1, true],
  [-1, -0.5, false],
  [-1, 0.5, false],
  [0, 0, true],
] as const;

/**
 * The glyphs that show `value` with `decimals` decimals in `out.length` places, right-aligned,
 * leading zeros blank (one kept before the point); dashes for what does not fit or is not a number.
 */
export function glyphMasks(value: number, decimals: number, out: Uint8Array): Uint8Array {
  const n = Math.round(Math.abs(value) * 10 ** decimals);
  const fits = Number.isFinite(value) && value >= 0 && n < 10 ** out.length;
  for (let j = 0; j < out.length; j++) {
    const k = out.length - 1 - j; // its power of ten
    const digit = Math.floor(n / 10 ** k) % 10;
    out[j] = !fits ? DASH : k > decimals && n < 10 ** k ? 0 : (DIGITS[digit] ?? DASH);
  }
  return out;
}

/**
 * A display's number: its glyphs' first instance, how many, its decimals, and the value last
 * shown in its last decimal's units (undefined until the first: NaN must still draw its dashes).
 */
interface Field {
  readonly first: number;
  readonly masks: Uint8Array;
  readonly decimals: number;
  shown: number | undefined;
}

/**
 * The moving parts: both plungers, the extract in its syringe, the mixture (its rounded bottom
 * and its column) with the froth and bubbles on it, the thermometer's spirit and every display's
 * segments (one draw). `pose` assigns, allocating nothing, and skips what has not changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  const plungerLook = own(new THREE.MeshStandardMaterial({ vertexColors: true, ...LOOKS.plastic }));
  const extractLiquid = own(
    new THREE.MeshStandardMaterial({ color: '#c8a35a', roughness: 0.25, metalness: 0 }),
  );
  const mixture = own(
    new THREE.MeshStandardMaterial({
      color: '#e8f2f4',
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const CLEAR = new THREE.Color('#e8f2f4'); // buffer and peroxide
  const CLOUDY = new THREE.Color('#e6d9a2'); // with the tissue extract in
  const froth = own(new THREE.MeshStandardMaterial({ color: '#f4f1e8', ...LOOKS.matte }));
  const bubble = own(new THREE.MeshStandardMaterial({ color: '#ffffff', ...LOOKS.satin }));
  const spirit = own(new THREE.MeshBasicMaterial({ color: '#c8302b' })); // reads at any light
  const print = own(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const unit = keep(new THREE.CylinderGeometry(1, 1, 1, 20).translate(0, 0.5, 0));

  // The gas syringe's plunger, along +x from its seal's front face.
  const gas = mesh(
    keep(merged(plunger(0.0148, 0.008, 0.192, 0.022, 0.021)).rotateZ(-Math.PI / 2)),
    plungerLook,
  );
  gas.name = 'gas-plunger';
  gas.position.set(GAS_SYRINGE.zero, AXIS, 0);
  // The extract syringe's plunger, up from its seal; the extract under it.
  const extractPlunger = mesh(
    keep(merged(plunger(0.0058, 0.004, 0.06, 0.01, 0.0095))),
    plungerLook,
  );
  extractPlunger.name = 'extract-plunger';
  extractPlunger.position.set(EXTRACT.x, EXTRACT_ZERO, 0);
  extractPlunger.castShadow = false;
  const extract = mesh(unit, extractLiquid);
  extract.name = 'extract';
  extract.position.set(EXTRACT.x, EXTRACT_ZERO, 0);
  extract.scale.set(EXTRACT.bore - 0.0002, 1, EXTRACT.bore - 0.0002);
  extract.castShadow = false;

  // The mixture: its rounded bottom, the column above (scaled to the volume), the froth on top.
  const r = TUBE.inner - 0.0002;
  const centre = INNER_BOTTOM + TUBE.inner;
  const bottom = mesh(
    keep(new THREE.SphereGeometry(r, 20, 8, 0, 2 * Math.PI, Math.PI / 2, Math.PI / 2)),
    mixture,
  );
  bottom.name = 'mixture-bottom';
  bottom.position.set(TUBE.x, centre, 0);
  const column = mesh(unit, mixture);
  column.name = 'mixture';
  column.position.set(TUBE.x, centre, 0);
  column.scale.set(r, 0, r);
  for (const m of [bottom, column]) {
    m.castShadow = false;
    m.renderOrder = 1; // before the glass around it
  }
  const foam = mesh(unit, froth);
  foam.name = 'froth';
  foam.position.x = TUBE.x;
  foam.scale.set(r, 1, r);
  foam.castShadow = false;
  foam.visible = false;
  const bubbles = copies(
    keep(new THREE.SphereGeometry(BUBBLE, 8, 6)),
    bubble,
    Array.from({ length: BUBBLES }, () => new THREE.Matrix4()),
  );
  bubbles.name = 'bubbles';
  bubbles.castShadow = false;
  bubbles.frustumCulled = false; // its instances move
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // rewritten every running frame
  bubbles.count = 0;
  // Each bubble's place across the tube, start, speed and lowest height above the inside bottom,
  // where it just clears the round bottom of the mixture (golden-ratio spread: deterministic).
  const spread = Float32Array.from({ length: BUBBLES * 5 }, (_, i) => {
    const [b, k] = [Math.floor(i / 5), i % 5];
    const u = (b * 0.618034 + k * 0.381966) % 1;
    const angle = b * 2.39996;
    const radius = 0.0085 * Math.sqrt((b + 0.5) / BUBBLES);
    const lowest = TUBE.inner - Math.sqrt((r - BUBBLE) ** 2 - radius ** 2);
    return [radius * Math.cos(angle), radius * Math.sin(angle), u, 1.3 + 1.2 * u, lowest][k] ?? 0;
  });

  // The thermometer's spirit, up from its bulb.
  const thermo = mesh(unit, spirit);
  thermo.name = 'thermometer';
  thermo.position.set(THERMO.x, THERMO.bulb + 0.003, THERMO.z);
  thermo.scale.set(0.0011, 0, 0.0011);
  thermo.castShadow = false;

  // Every display's segments, one draw: the bath's red LEDs, the stopwatch's LCD, the labels' ink.
  const matrices: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  const glyph = (place: THREE.Matrix4, h: number, color: THREE.Color, mask = 0x7f) => {
    const first = matrices.length;
    const [w, t] = [0.55 * h, 0.13 * h];
    for (const [i, [sx, sy, across]] of SEGMENTS.entries()) {
      const on = mask & (1 << i) ? 1 : 0; // a segment a fixed glyph never lights: a point
      const segment = at((sx * (w - t)) / 2, (sy * (h - t)) / 2, 0).scale(
        new THREE.Vector3(on * (across ? w - t : t), on * (across ? t : h / 2 - t), on),
      );
      matrices.push(place.clone().multiply(segment));
      colors.push(color);
    }
    return first;
  };
  const point = (place: THREE.Matrix4, h: number, color: THREE.Color) => {
    const t = 0.13 * h;
    matrices.push(
      place
        .clone()
        .multiply(at(0.275 * h + 0.11 * h, -h / 2 + t / 2, 0).scale(new THREE.Vector3(t, t, 1))),
    );
    colors.push(color);
  };
  /** A number of `places` glyphs at x0, x0 + pitch, …, each placed by `place(x)`. */
  const field = (
    places: number,
    decimals: number,
    h: number,
    color: THREE.Color,
    place: (x: number) => THREE.Matrix4,
    x0: number,
  ): Field => {
    const pitch = 0.8 * h;
    const first = glyph(place(x0), h, color);
    for (let j = 1; j < places; j++) glyph(place(x0 + j * pitch), h, color);
    if (decimals > 0) point(place(x0 + (places - 1 - decimals) * pitch), h, color);
    return { first, masks: new Uint8Array(places), decimals, shown: undefined };
  };
  const led = new THREE.Color('#ff3b2f');
  const ink = new THREE.Color(INK); // the stopwatch's LCD and the labels' print
  const bath = (x: number) =>
    at(BATH.x - 0.035 + x, BATH.foot + BATH.base / 2, BATH.d / 2 + 0.0032);
  const temperature = field(3, 1, 0.012, led, bath, -0.019);
  glyph(bath(-0.019 + 3 * 0.0096), 0.012, led, GLYPH.degree);
  glyph(bath(-0.019 + 4 * 0.0096), 0.012, led, GLYPH.c);
  const watch = watchAt().multiply(at(0, 0.0091, -0.006, -Math.PI / 2));
  const clock = field(3, 1, 0.012, ink, (x) => watch.clone().multiply(at(x, 0, 0)), -0.0096);
  /** On a bottle's label, `x` round its front from the middle, at height y. */
  const label = (spot: { x: number; z: number }, y: number) => (x: number) => {
    const phi = x / (BOTTLE.label + 0.0006);
    const radius = BOTTLE.label + 0.0006;
    return at(spot.x + radius * Math.sin(phi), y, spot.z + radius * Math.cos(phi), 0, phi, 0);
  };
  glyph(label(BUFFER, 0.061)(-0.0036), 0.009, ink, GLYPH.p);
  glyph(label(BUFFER, 0.061)(0.0036), 0.009, ink, GLYPH.h);
  const pH = field(3, 1, 0.009, ink, label(BUFFER, 0.042), -0.0072);
  const substrate = field(3, 2, 0.009, ink, label(PEROXIDE, 0.042), -0.0072);
  const segment = keep(new THREE.PlaneGeometry(1, 1));
  const digits = copies(segment, print, matrices);
  colors.forEach((c, i) => digits.setColorAt(i, c));
  digits.name = 'digits';
  digits.castShadow = false;
  digits.receiveShadow = false;
  digits.frustumCulled = false; // segments switch on and off
  const lit = Float32Array.from(digits.instanceMatrix.array); // every segment of every field on

  /**
   * Shows `value` on `f`, if what it shows changed (the stopwatch's clock changes every frame, its
   * tenths do not): each segment lit, or folded to a point where it is (its translation and w
   * kept: an all-zero matrix would make bounds NaN).
   */
  const show = (f: Field, value: number) => {
    const shown = Math.round(value * 10 ** f.decimals); // NaN, ±0 and ±∞ kept apart by Object.is
    if (Object.is(shown, f.shown)) return;
    f.shown = shown;
    glyphMasks(value, f.decimals, f.masks);
    const target = digits.instanceMatrix.array;
    for (let j = 0; j < f.masks.length; j++) {
      const mask = f.masks[j] ?? 0;
      for (let s = 0; s < 7; s++) {
        const at16 = (f.first + j * 7 + s) * 16;
        const on = (mask >> s) & 1;
        for (let e = 0; e < 16; e++) target[at16 + e] = on || e >= 12 ? (lit[at16 + e] ?? 0) : 0;
      }
    }
    digits.instanceMatrix.needsUpdate = true;
  };

  const bubbleAt = new THREE.Matrix4();
  let bubblesAt = NaN; // the bubbles' clock when last placed
  let drawnOxygen = NaN;
  let drawnTemperature = NaN;
  let drawnLevel = NaN;
  let drawnExtract = NaN;
  let drawnRate = NaN;
  let injected: boolean | null = null;
  let time = 0; // bubbles' own clock: cosmetic, advances only while running

  const pose = ({ status, parameters, sample }: BenchPose, dt: number) => {
    const oxygen = sample.oxygen ?? NaN;
    const rate = sample.rate ?? NaN;
    const elapsed = sample.clock ?? NaN;
    const t = parameters.temperature ?? NaN;
    const e = parameters.enzymeVolume ?? NaN;

    // The gas syringe: its seal on the volume collected (none without a run), at most full.
    const ml = oxygen > 0 ? Math.min(oxygen, GAS_SYRINGE.capacity) : 0;
    if (ml !== drawnOxygen) {
      drawnOxygen = ml;
      gas.position.x = GAS_SYRINGE.zero + (ml / GAS_SYRINGE.capacity) * GAS_SYRINGE.length;
    }

    // The extract: drawn up into its syringe before a run, in the tube once one exists.
    const now = status === 'running' || status === 'stopped' || status === 'completed';
    const drawnUp = now ? 0 : e > 0 ? Math.min(e, MIXTURE) : 0;
    if (now !== injected) {
      injected = now;
      mixture.color.copy(now ? CLOUDY : CLEAR);
    }
    if (drawnUp !== drawnExtract) {
      drawnExtract = drawnUp;
      const length = drawnUp * EXTRACT_PER_ML;
      extract.visible = length > 0;
      extract.scale.y = length;
      extractPlunger.position.y = EXTRACT_ZERO + length;
    }
    const level = tubeLevel(MIXTURE - drawnUp);
    const moved = level !== drawnLevel;
    if (moved) {
      drawnLevel = level;
      column.scale.y = level - TUBE.inner;
      column.visible = column.scale.y > 0;
    }

    // Froth and bubbles from the rate (none without a run), the bubbles rising while it runs.
    const share = rate > 0 ? Math.sqrt(Math.min(rate / RATE_FULL, 1)) : 0;
    const frothed = share !== drawnRate || moved;
    if (frothed) {
      drawnRate = share;
      foam.visible = share > 0;
      foam.scale.y = 0.03 * share;
      foam.position.y = INNER_BOTTOM + level;
      bubbles.count = Math.round(BUBBLES * share);
    }
    if (status === 'running') time += dt;
    if (bubbles.count > 0 && (time !== bubblesAt || frothed)) {
      bubblesAt = time;
      for (let i = 0; i < bubbles.count; i++) {
        const u = ((spread[i * 5 + 2] ?? 0) + time * (spread[i * 5 + 3] ?? 1)) % 1;
        const lowest = spread[i * 5 + 4] ?? TUBE.inner;
        bubbleAt.makeTranslation(
          TUBE.x + (spread[i * 5] ?? 0),
          INNER_BOTTOM + lowest + u * (level - 0.0015 - lowest),
          spread[i * 5 + 1] ?? 0,
        );
        bubbles.setMatrixAt(i, bubbleAt);
      }
      bubbles.instanceMatrix.needsUpdate = true;
    }

    // The thermometer and the bath's display: the bath's set temperature.
    if (!Object.is(t, drawnTemperature)) {
      drawnTemperature = t;
      // Without a setting (a station's dial always has one): room temperature.
      const top = thermoY(Number.isFinite(t) ? Math.min(Math.max(t, THERMO.low), THERMO.high) : 20);
      thermo.scale.y = top - thermo.position.y;
    }
    show(temperature, t);
    show(clock, Number.isFinite(elapsed) ? elapsed : 0);
    show(pH, parameters.pH ?? NaN);
    show(substrate, parameters.substrate ?? NaN);
  };
  pose({ status: 'idle', parameters: {}, sample: {} }, 0); // until its station poses it
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const gasSyringeRig: BenchModel = { frame, rig, reads: ['oxygen', 'rate', 'clock'] };
