import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { Assembly, loft, type Outline, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The osmosis bench (model biology.osmosis): a school practical laid out on a 0.70 × 0.35 m
 * patch of bench, real sizes in metres, from the item's base centre (+z is the front).
 * Fixed (frame): an epoxy-coated wire rack of six boiling tubes' places with three 25 × 150 mm
 * boiling tubes, the cylinder's tube labelled; a top-pan balance (0.20 × 0.25 m, pan Ø 0.12 m;
 * its case is the entity's mesh, in the item's colour: the largest part, so focus shows); a glazed white tile with the cork borer and a
 * scalpel; a whole potato; a 30 cm steel ruler; a folded paper towel with forceps; a digital timer.
 * Moving (rig, from the run only): the potato cylinder, its size from its volume (length
 * m₀/(ρ·π·r²) at the start, then uniform scale (V/V₀)^⅓, V = V₀ plus 1 mL per gram of water
 * taken up), on the balance pan before and after the soak and
 * upright in its tube during it: on its bottom, or floating with ρ/ρ_solution of it under the
 * surface where it is lighter than the solution (strong sucrose, as students see); the solution in
 * that tube (its level from the solution's volume, the part of the cylinder under its surface, and
 * the water it took up or gave); the tube label (the
 * dialled C, mol/L), the balance's readout (m₀ before, 0 while its pan is empty, the final mass
 * once the run has completed, each to its resolution d as `measurement.ts` reads it) and the
 * timer (the soaking time represented, h:mm).
 */

const TUBE = { radius: 0.0125, wall: 0.0012, length: 0.15 }; // a 25 × 150 mm boiling tube
const INNER = TUBE.radius - TUBE.wall;
const WIRE = 0.002; // the rack's wire radius
const RACK = { x: -0.225, z: -0.1, pitch: 0.036, places: 6, tier: 0.085, end: 0.025 };
const RING = TUBE.radius + WIRE + 0.0005; // a place's ring, to the wire's centre
const TUBE_BOTTOM = 2 * WIRE; // standing on the rack's base wires
const ACTIVE = 1; // the cylinder's tube, by place (left to right)
const SPARES = [3, 4]; // clean, empty tubes
const LABEL = { radius: TUBE.radius + 0.0003, y: 0.138, height: 0.018, wrap: 1.8 };
const BALANCE = { x: 0.21, z: 0, width: 0.2, depth: 0.25, height: 0.055, feet: 0.004 };
const BALANCE_TOP = BALANCE.feet + BALANCE.height;
const PAN = { z: -0.04, radius: 0.06, post: 0.005, floor: 0.003, rim: 0.006 };
const PAN_Y = BALANCE_TOP + PAN.post + PAN.floor; // where a cylinder lies on the pan
/** The balance's sloped front, in its side view (z forward, y up), counter-clockwise. */
const SLOPE = { front: 0.125, low: 0.025, back: 0.055 };
const TILE = { x: -0.05, z: 0.07, size: 0.15, height: 0.006 };
const TIMER = { x: 0.07, z: 0.06, width: 0.06, depth: 0.022, height: 0.045 };
const CYLINDER = { radius: 0.005, density: 1080 }; // the borer's 10 mm bore; potato ≈ 1.08 g/cm³
/**
 * Sucrose solution at 20 °C, ρ ≈ 998 + 129·C kg/m³ (C in mol/L): a linear fit, within 0.2 % of
 * the CRC density table from 0 to 1 mol/L (1.127 g/mL at 1 mol/L).
 */
const SUCROSE = { water: 998, perMolar: 129 };
/** The cylinder's length per gram at the start (m/g): 1 g / (ρ·π·r²). */
export const LENGTH_PER_GRAM = 1e-3 / (CYLINDER.density * Math.PI * CYLINDER.radius ** 2);
/** The solution poured into the cylinder's tube (m³): 40 mL, about 0.10 m deep. */
export const SOLUTION = 40e-6;
const BORE_AREA = Math.PI * INNER ** 2;
const ROUND_BOTTOM = (2 / 3) * Math.PI * INNER ** 3; // the tube's round bottom, full
const EQUATOR = TUBE_BOTTOM + TUBE.wall + INNER; // where its round bottom meets its straight bore
const WATER = 1e-6; // m³ per g of water moved (1 g/mL)

/** Lit segments of a 7-segment digit, bit 0 = a (top) … bit 6 = g (middle), for 0–9. */
export const SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f] as const;
const DASH = 0x40;
const SLOTS = 8; // a digit's seven segments and its decimal point

const tubeX = (place: number) => RACK.x + (place - (RACK.places - 1) / 2) * RACK.pitch;

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
      const miter = inset / (1 + a.dot(b)); // both edges moved in by the inset
      return new THREE.Vector2(x, y).addScaledVector(a.add(b), miter);
    });

/**
 * A thin-walled glass boiling tube about the y axis, its round bottom at y = 0: the outer wall up
 * to a rolled rim and the inner wall back down, one closed shell.
 */
function tubeGeometry(): THREE.LatheGeometry {
  const { radius: r, length } = TUBE;
  const outer = Array.from({ length: 7 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    return new THREE.Vector2(r * Math.cos(a), r + r * Math.sin(a));
  });
  const inner = Array.from({ length: 7 }, (_, i) => {
    const a = -(i / 6) * (Math.PI / 2);
    return new THREE.Vector2(INNER * Math.cos(a), r + INNER * Math.sin(a));
  });
  return new THREE.LatheGeometry(
    [
      ...outer,
      new THREE.Vector2(r, length - 0.004),
      new THREE.Vector2(r + 0.0009, length - 0.0025),
      new THREE.Vector2(r + 0.0009, length - 0.0008),
      new THREE.Vector2(r + 0.0004, length),
      new THREE.Vector2(INNER, length),
      ...inner,
    ],
    24,
  );
}

/** A round bar of radius `r` from a to b. */
function bar(r: number, a: THREE.Vector3, b: THREE.Vector3, segments = 6) {
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

/** The epoxy-coated wire rack: a top tier of rings, rails, base wires under each place, ends. */
function rackPieces(): Piece[] {
  const { x, z, pitch, places, tier, end } = RACK;
  const half = ((places - 1) / 2) * pitch + end;
  const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
  const pieces: Piece[] = [];
  for (let i = 0; i < places; i++) {
    const ring = new THREE.TorusGeometry(RING, WIRE, 6, 20).rotateX(Math.PI / 2);
    pieces.push([ring.translate(tubeX(i), tier, z)]);
    pieces.push([bar(WIRE, v(tubeX(i), WIRE, z - RING), v(tubeX(i), WIRE, z + RING))]);
  }
  for (const side of [-1, 1]) {
    const rz = z + side * RING;
    for (const y of [WIRE, 0.035, tier])
      pieces.push([bar(WIRE, v(x - half, y, rz), v(x + half, y, rz))]);
    for (const ex of [x - half, x + half]) pieces.push([bar(WIRE, v(ex, 0, rz), v(ex, tier, rz))]);
  }
  for (const ex of [x - half, x + half]) {
    for (const y of [WIRE, tier]) pieces.push([bar(WIRE, v(ex, y, z - RING), v(ex, y, z + RING))]);
  }
  return pieces;
}

/** The balance's case: its side view lofted across its width, chamfered, on its feet. */
function balanceCase(): THREE.BufferGeometry {
  const { width, height } = BALANCE;
  const outline = polygon([
    [-BALANCE.depth / 2, 0],
    [SLOPE.front, 0],
    [SLOPE.front, SLOPE.low],
    [SLOPE.back, height],
    [-BALANCE.depth / 2, height],
  ]);
  const bevel = 0.003;
  const g = loft(outline, [
    [bevel, -width / 2],
    [0, -width / 2 + bevel],
    [0, width / 2 - bevel],
    [bevel, width / 2],
  ]);
  // The outline's x (forward) becomes z, its loft axis x: a quarter turn about y.
  return g.rotateY(-Math.PI / 2).translate(BALANCE.x, BALANCE.feet, BALANCE.z);
}

/** The balance's sloped front: its centre, and the turn about x that lays a plane facing +z on it. */
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

/**
 * The fixed parts: the balance case (the entity's mesh) and, merged by material, the plastic and
 * glazed parts (wire rack, tile, timer, feet, keys), the metal ones (pan, borer, scalpel, ruler,
 * forceps), the matte ones (potato, paper towel, the tube's label, the ruler's marks), the glass
 * tubes and the two displays' backlit panels.
 */
function frame(item: ItemDefinition): BenchFrame {
  const [, h] = item.visual.size;
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
  // See-through: no depth write, so the solution and the cylinder inside show (palette.ts).
  const glass = own(
    new THREE.MeshStandardMaterial({
      color: '#e4f1f6',
      ...GLASSWARE_LOOK,
      opacity: 0.25, // two walls deep wherever it is seen
      depthWrite: false,
    }),
  );
  const backlit = own(new THREE.MeshBasicMaterial({ color: '#b7c6a2' })); // reads at any light

  const body = keep(merge([[balanceCase()]]));
  body.translate(0, -h / 2, 0);

  const dark = '#2b2f36';
  const shell: Piece[] = rackPieces().map(([g]): Piece => [g, '#2f6fb3']); // blue epoxy
  const steel: Piece[] = [];
  const soft: Piece[] = [];
  const panels: Piece[] = [];
  // Balance: four feet, the pan on its post, the display's bezel and panel, two keys.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.CylinderGeometry(0.008, 0.008, BALANCE.feet, 10);
      shell.push([
        foot.translate(
          BALANCE.x + sx * (BALANCE.width / 2 - 0.02),
          BALANCE.feet / 2,
          BALANCE.z + sz * (BALANCE.depth / 2 - 0.025),
        ),
        '#202428',
      ]);
    }
  }
  const panZ = BALANCE.z + PAN.z;
  steel.push([
    new THREE.CylinderGeometry(0.015, 0.018, PAN.post, 16).translate(
      BALANCE.x,
      BALANCE_TOP + PAN.post / 2,
      panZ,
    ),
    '#9aa2aa',
  ]);
  const { radius: pr, floor, rim } = PAN;
  steel.push([
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(pr - 0.003, 0),
        new THREE.Vector2(pr, rim / 2),
        new THREE.Vector2(pr, rim),
        new THREE.Vector2(pr - 0.0015, rim),
        new THREE.Vector2(pr - 0.004, floor),
        new THREE.Vector2(0, floor),
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
  shell.push([onSlope(new THREE.BoxGeometry(0.088, 0.03, 0.002), 0), dark]);
  panels.push([onSlope(new THREE.PlaneGeometry(0.08, 0.024), 0.0011)]);
  for (const k of [0, 1]) {
    shell.push([onSlope(new THREE.BoxGeometry(0.012, 0.009, 0.003), 0, 0.063 + k * 0.018), dark]);
  }

  // The white tile; on it the cork borer (a brass tube on a T handle) and the scalpel.
  shell.push([
    slab(TILE.size, TILE.size, TILE.height, 0.004, 0.0015).translate(TILE.x, 0, TILE.z),
    '#f6f6f2',
  ]);
  const borerY = TILE.height + 0.006;
  const borerZ = TILE.z - 0.035;
  const borerFrom = TILE.x - 0.065;
  steel.push([
    bar(
      0.006,
      new THREE.Vector3(borerFrom, borerY, borerZ),
      new THREE.Vector3(borerFrom + 0.12, borerY, borerZ),
      16,
    ),
    '#c9a24a',
  ]);
  steel.push([
    new THREE.TorusGeometry(0.0055, 0.0007, 6, 16)
      .rotateY(Math.PI / 2)
      .translate(borerFrom + 0.12, borerY, borerZ),
    '#8a6a2c',
  ]);
  steel.push([
    bar(
      0.0035,
      new THREE.Vector3(borerFrom, borerY - 0.0015, borerZ - 0.025),
      new THREE.Vector3(borerFrom, borerY - 0.0015, borerZ + 0.025),
      10,
    ),
    '#c9a24a',
  ]);
  const scalpelZ = TILE.z + 0.045;
  const handleY = TILE.height + 0.00125;
  steel.push([
    new THREE.BoxGeometry(0.075, 0.0025, 0.008).translate(TILE.x - 0.025, handleY, scalpelZ),
    '#b9c0c7',
  ]);
  const blade = loft(
    polygon([
      [0, -0.0035],
      [0.026, -0.0035],
      [0.038, 0.0005],
      [0.03, 0.003],
      [0, 0.0035],
    ]),
    [
      [0, 0],
      [0, 0.0005],
    ],
  );
  steel.push([
    blade.rotateX(-Math.PI / 2).translate(TILE.x + 0.0125, TILE.height + 0.001, scalpelZ),
    '#dfe4e8',
  ]);

  // The whole potato; the steel ruler, its marks every 5 mm; the paper towel and forceps.
  soft.push([
    new THREE.SphereGeometry(1, 20, 14).scale(0.045, 0.03, 0.034).translate(-0.26, 0.03, 0.07),
    '#b58a55',
  ]);
  const ruler = { from: -0.33, z: 0.16, width: 0.025, thick: 0.0008 };
  steel.push([
    new THREE.BoxGeometry(0.3, ruler.thick, ruler.width).translate(
      ruler.from + 0.15,
      ruler.thick / 2,
      ruler.z,
    ),
    '#b9bfc5',
  ]);
  for (let mm = 0; mm <= 300; mm += 5) {
    const long = mm % 50 === 0 ? 0.01 : mm % 10 === 0 ? 0.0065 : 0.004;
    soft.push([
      new THREE.BoxGeometry(0.0004, 0.0002, long).translate(
        ruler.from + 0.0005 + mm / 1000 - (mm === 300 ? 0.001 : 0),
        ruler.thick + 0.0001,
        ruler.z - ruler.width / 2 + long / 2,
      ),
      '#2b2f36',
    ]);
  }
  const towel = { x: 0.065, z: -0.09 };
  soft.push([
    new THREE.BoxGeometry(0.08, 0.0015, 0.11).translate(towel.x, 0.00075, towel.z),
    '#f3f0e8',
  ]);
  for (const s of [-1, 1]) {
    const arm = new THREE.BoxGeometry(0.1, 0.0015, 0.0035).translate(0.05, 0, 0);
    steel.push([
      arm
        .rotateY(Math.PI / 2 + s * 0.035)
        .translate(towel.x + s * 0.0005, 0.0015 + 0.00075 + (s > 0 ? 0.0015 : 0), towel.z + 0.05),
      '#c4cad0',
    ]);
  }

  // The timer: a white case standing on the bench, two keys on top, its display facing +z.
  shell.push([
    slab(TIMER.width, TIMER.depth, TIMER.height, 0.004, 0.0015).translate(TIMER.x, 0, TIMER.z),
    '#f2f2ef',
  ]);
  for (const s of [-1, 1]) {
    shell.push([
      new THREE.BoxGeometry(0.012, 0.003, 0.01).translate(
        TIMER.x + s * 0.014,
        TIMER.height + 0.0015,
        TIMER.z,
      ),
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

  // The tubes: the cylinder's, labelled at the front, and the spares.
  const glassPieces: Piece[] = [ACTIVE, ...SPARES].map((place) => [
    tubeGeometry().translate(tubeX(place), TUBE_BOTTOM, RACK.z),
  ]);
  soft.push([
    new THREE.CylinderGeometry(
      LABEL.radius,
      LABEL.radius,
      LABEL.height,
      16,
      1,
      true,
      -LABEL.wrap / 2,
      LABEL.wrap,
    ).translate(tubeX(ACTIVE), LABEL.y, RACK.z),
    '#fbfaf5',
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
  part('glass', glassPieces, glass, false).renderOrder = 2; // after the solution inside it
  part('backlit', panels, backlit, false);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** A 7-segment readout: `digits` places, each a transform for a digit `size` drawn on its face. */
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
  box: THREE.BufferGeometry,
  parent: THREE.Object3D,
  material: THREE.Material,
  name: string,
  places: readonly THREE.Matrix4[],
  size: { width: number; height: number; stroke: number },
  extra: readonly THREE.Matrix4[] = [],
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
  // Every segment starts dark; `extra` (a colon) is always lit.
  const off = on.map((m) => new THREE.Matrix4().makeScale(0, 0, 0).copyPosition(m));
  const mesh = kit.copies(box, material, [...on, ...extra], parent);
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

/**
 * The cylinder, the solution in its tube and the three readouts; `pose` places and lights them
 * from the station (status, the dials or the run's inputs, `mass` and `labTime`), allocating
 * nothing and redrawing a readout only when what it shows changes.
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
  const flesh = own(new THREE.MeshStandardMaterial({ color: '#efe2ae', ...LOOKS.matte }));
  const solution = own(
    new THREE.MeshStandardMaterial({
      color: '#d9eaf2', // sucrose solution: clear and colourless
      ...LOOKS.glass,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const ink = own(new THREE.MeshBasicMaterial({ color: '#1d2731' }));

  const cylinder = mesh(
    keep(new THREE.CylinderGeometry(CYLINDER.radius, CYLINDER.radius, 1, 16)),
    flesh,
    base,
  );
  cylinder.name = 'cylinder';
  cylinder.castShadow = false;
  const x = tubeX(ACTIVE);
  const liquidR = INNER - 0.0002;
  const column = new THREE.CylinderGeometry(liquidR, liquidR, 1, 20).translate(0, 0.5, 0);
  // Its side and top: no bottom disc inside the round bottom below.
  column.setDrawRange(0, 20 * 6 + 20 * 3);
  const liquid = mesh(keep(column), solution, base);
  liquid.name = 'solution';
  liquid.position.set(x, EQUATOR, RACK.z);
  liquid.castShadow = false;
  liquid.renderOrder = 1; // before the glass around it
  const bottom = mesh(
    keep(new THREE.SphereGeometry(liquidR, 20, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
    solution,
    base,
  );
  bottom.position.copy(liquid.position);
  bottom.name = 'solution-bottom';
  bottom.castShadow = false;
  bottom.renderOrder = 1;

  // The tube's label: three places of C (mol/L), wrapped round the tube.
  const label = { width: 0.0034, height: 0.007, stroke: 0.0007 };
  const labelAt = [-0.0052, 0, 0.0052].map((u) =>
    new THREE.Matrix4()
      .makeTranslation(x, LABEL.y, RACK.z)
      .multiply(new THREE.Matrix4().makeRotationY(u / LABEL.radius))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, LABEL.radius + 0.0001)),
  );
  const box = keep(new THREE.BoxGeometry(1, 1, 1)); // every segment of the three readouts
  const tag = readout(kit, box, base, ink, 'label-digits', labelAt, label);
  // The balance: five places on its panel.
  const face = slopeFace(-0.015);
  const lcd = { width: 0.0065, height: 0.012, stroke: 0.0012 };
  const balanceAt = [0, 1, 2, 3, 4].map((i) =>
    new THREE.Matrix4()
      .makeTranslation(
        face.centre.x + (i - 2) * 0.0115,
        face.centre.y + face.normal.y * 0.0012,
        face.centre.z + face.normal.z * 0.0012,
      )
      .multiply(new THREE.Matrix4().makeRotationX(face.turn)),
  );
  const scale = readout(kit, box, base, ink, 'balance-digits', balanceAt, lcd);
  // The timer: h:mm, its colon always lit.
  const front = TIMER.z + TIMER.depth / 2 + 0.0005;
  const timerY = TIMER.height * 0.55;
  const timerAt = [-0.0145, 0.0035, 0.0145].map((u) =>
    new THREE.Matrix4().makeTranslation(TIMER.x + u, timerY, front),
  );
  const dot = (v: number) =>
    new THREE.Matrix4()
      .makeScale(0.0012, 0.0012, 0.0002)
      .setPosition(TIMER.x - 0.0055, timerY + v, front);
  const clock = readout(kit, box, base, ink, 'timer-digits', timerAt, lcd, [
    dot(0.003),
    dot(-0.003),
  ]);

  // What is drawn now: pose skips what has not changed.
  let label100 = NaN;
  let weighed = NaN; // the mass on the pan (g), 0 when empty
  let resolution = NaN;
  let minutes = NaN;
  const pose = ({ status, parameters, sample: values }: BenchPose) => {
    const c = parameters.concentration ?? NaN;
    const m0 = parameters.initialMass ?? NaN;
    const d = parameters.balanceResolution ?? NaN;
    const mass = values.mass ?? NaN;
    const time = values.labTime ?? NaN;
    const soaking = status === 'running' || status === 'stopped';
    const after = status === 'completed';
    // The cylinder's mass now: the run's while one exists, else the dialled m₀.
    const m = (soaking || after) && mass > 0 ? mass : m0;
    const shown = m0 > 0 && m > 0;

    cylinder.visible = shown;
    let volume = SOLUTION;
    if (shown) {
      const v0 = m0 * LENGTH_PER_GRAM * Math.PI * CYLINDER.radius ** 2; // m₀/ρ
      const v = v0 + (m - m0) * WATER; // the water taken up (or given) adds (or takes) its volume
      const k = Math.cbrt(Math.max(0, v) / v0);
      const r = CYLINDER.radius * k;
      const length = m0 * LENGTH_PER_GRAM * k;
      cylinder.scale.set(k, length, k);
      volume -= (m - m0) * WATER; // that water left (or joined) the solution
      if (soaking) {
        // Lighter than the solution, it floats with ρ/ρ_solution of it under (no C: sunk).
        const rho = (m * 1e-3) / v;
        const fluid = SUCROSE.water + SUCROSE.perMolar * c;
        const under = rho < fluid ? rho / fluid : 1;
        volume += v * under; // what it displaces
        const surface = EQUATOR + (volume - ROUND_BOTTOM) / BORE_AREA;
        // Upright on the tube's round bottom, its flat end where the bore is as wide as it.
        const sag = INNER - Math.sqrt(Math.max(0, INNER ** 2 - r ** 2));
        const rest = TUBE_BOTTOM + TUBE.wall + sag;
        // shortcut: a floater too long for the solution's depth would rest on the bottom with less
        // under than drawn; 40 mL is deep enough for every cylinder the dials allow (≤ 6 g).
        const foot = under < 1 ? Math.max(rest, surface - under * length) : rest;
        cylinder.rotation.z = 0;
        cylinder.position.set(x, foot + length / 2, RACK.z);
      } else {
        cylinder.rotation.z = Math.PI / 2; // lying on the pan
        cylinder.position.set(BALANCE.x, PAN_Y + r, BALANCE.z + PAN.z);
      }
    }
    liquid.scale.y = Math.max(0.001, (volume - ROUND_BOTTOM) / BORE_AREA);

    const c100 = Math.round(c * 100);
    if (!Object.is(c100, label100)) {
      label100 = c100;
      if (Number.isFinite(c100)) number(tag, c100, 2);
      else blank(tag);
    }

    const pan = soaking ? 0 : shown ? m : NaN;
    if (!Object.is(pan, weighed) || !Object.is(d, resolution)) {
      weighed = pan;
      resolution = d;
      if (d > 0 && Number.isFinite(d) && pan >= 0) {
        const point = decimals(d);
        number(scale, Math.round(quantize(pan, d) * 10 ** point), point);
      } else blank(scale);
    }

    const min = time >= 0 ? Math.floor(time / 60) : 0;
    if (min !== minutes) {
      minutes = min;
      const hours = light(clock, 0, SEGMENTS[Math.floor(min / 60) % 10] ?? 0);
      const tens = light(clock, 1, SEGMENTS[Math.floor((min % 60) / 10)] ?? 0);
      const units = light(clock, 2, SEGMENTS[min % 10] ?? 0);
      if (hours || tens || units) clock.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const osmosisRack: BenchModel = { frame, rig, reads: ['labTime', 'mass'] };
