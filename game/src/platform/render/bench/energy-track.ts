import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { trackPoint } from '../../../simulation/models/energy';
import { Assembly, at, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import { box, part } from '../props/parts';
import { SEGMENTS } from './osmosis-rack';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The energy track (model `mechanics.energy-track`): an aluminium channel shaped like a valley —
// two straight 30° ramps, each turned level by an arc, and a flat between them — on legs over the
// bench, end stops at the ramp tops; two light gates, each a U standing under the track with its
// sensor heads facing each other across the cart's flag; a digital timer in front showing both
// blocking times; a vertical ruler at each ramp (0 at the flat, to 0.40 m). The cart: a low body
// on four wheels with a card flag standing on it (the beam crosses the flag's middle), 0.25 kg
// steel bars beside the flag and a card sail on top of it, held at its release height by a latch.
//
// Item frame: origin at the centre of the item's box, +z the front; `bench.top` is gate A's beam
// point on the flat (the rig's origin), the track in the x–y plane, the cart starting on −x. The
// track's shape here is the definition's (`TRACK`, pinned by the test) and every point of it comes
// from the model's own `trackPoint`, so the drawn track, the resting cart and a run's `x`, `height`
// and `trackAngle` agree. `pose` only assigns and skips what has not changed.

const DEG = Math.PI / 180;
/** The track as the definition's `initialConditions` set it (the dials never change these). */
export const TRACK = {
  rampAngle: 30,
  arcRadius: 0.3,
  flatLength: 0.3,
  rampLength: 0.72,
  gateHeight: 0.06,
  flagWidth: 0.025,
} as const;
const ALPHA = TRACK.rampAngle * DEG;
const FLAT_END = TRACK.flatLength / 2; // arc length of the flat's end
const ARC_END = FLAT_END + TRACK.arcRadius * ALPHA;
const TRACK_END = ARC_END + TRACK.rampLength;
/** Height of the arcs' upper ends: R(1 − cos α), as the model writes it. */
const ARC_TOP = 2 * TRACK.arcRadius * Math.sin(ALPHA / 2) ** 2;
/** Arc length of gate B's beam (as `load` in the model). */
const GATE_B = ARC_END + (TRACK.gateHeight - ARC_TOP) / Math.sin(ALPHA);

const PLATE = { width: 0.12, thick: 0.012 } as const;
const RAIL = { width: 0.008, height: 0.015 } as const;
const STOP = { thick: 0.02, height: 0.05 } as const; // the end stops at the ramp tops
const LEG = { radius: 0.008, z: 0.045 } as const;
const FOOT = { radius: 0.016, height: 0.004 } as const;
/** A gate's U: its base on the bench under the track, uprights outside the rails, heads inside. */
const GATE = { z: 0.075, post: 0.02, width: 0.03, base: 0.008, head: 0.02, above: 0.016 } as const;
/** A gate's beam above the track surface, along its normal: the flag's middle. */
const BEAM = 0.066;
const CART = { length: 0.12, width: 0.08, height: 0.02, clearance: 0.016 } as const;
const BODY_TOP = CART.clearance + CART.height;
const WHEEL = { radius: 0.012, width: 0.006, x: 0.042, z: 0.043 } as const;
const FLAG = { height: 0.06, thick: 0.002 } as const; // TRACK.flagWidth wide, up from the body
// A 0.25 kg steel bar: 70 × 40 × 11 mm (7.85 g/cm³ → 0.24 kg), beside the flag, the third on top.
const BAR = { length: 0.07, width: 0.04, thick: 0.011 } as const;
const BAR_KG = 0.25;
const CART_KG = 0.25;
const BARS_AT: readonly [number, number][] = [
  [0.03, BODY_TOP],
  [-0.03, BODY_TOP],
  [0.03, BODY_TOP + BAR.thick],
];
const TIMER = { x: -0.22, z: 0.105, width: 0.15, depth: 0.06, height: 0.07 } as const;
const DIGIT = { width: 0.006, height: 0.011, stroke: 0.0012, pitch: 0.011 } as const;
const PLACES = 5; // per readout: "0.0126" at the finest resolution, 0.0001 s
const RULER = { x: 0.58, z: 0.075, width: 0.03, top: 0.4 } as const;
/** The idle setup until the station gives its dials: the definition's defaults. */
const IDLE = { releaseHeight: 0.2, mass: 0.5, sailArea: 0, timerResolution: 0.001 } as const;
const DASH = 0x40;
const SLOTS = 8; // a digit's seven segments and its decimal point

/** Gate A's beam point on the flat, in the item's frame: `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** Pieces merged into one geometry (one draw). */
const merged = (pieces: THREE.BufferGeometry[]) => part('body', true, pieces).geometry;

/** A canvas texture painted by `draw`; null outside a browser (tests): the part stays plain. */
function painted2d(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Point = { x: number; y: number; slope: number };

/** The track at arc length s (the model's mapping), in the rig's frame. */
const trackAt = (
  s: number,
  releaseHeight: number = IDLE.releaseHeight,
): Point & { release: number } => trackPoint({ ...TRACK, releaseHeight }, s);

/** The track's profile: the arcs in 12 segments each, the straights between their ends. */
function profile(): Point[] {
  const n = 12;
  const s = [-TRACK_END];
  for (let i = 0; i <= n; i++) s.push(-ARC_END + ((ARC_END - FLAT_END) * i) / n);
  for (let i = 0; i <= n; i++) s.push(FLAT_END + ((ARC_END - FLAT_END) * i) / n);
  s.push(TRACK_END);
  return s.map((v) => trackAt(v));
}

/**
 * A bar of rectangular section — n0..n1 along the track's normal, z0..z1 across it — swept along
 * the profile: smooth along the track, creased across its section, closed at both ends.
 */
function sweep(n0: number, n1: number, z0: number, z1: number, points: readonly Point[]) {
  const corners: readonly [number, number][] = [
    [n0, z0],
    [n0, z1],
    [n1, z1],
    [n1, z0],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  const vertex = (p: Point, n: number, z: number) =>
    positions.push(p.x - n * Math.sin(p.slope), p.y + n * Math.cos(p.slope), z) / 3 - 1;
  for (let e = 0; e < 4; e++) {
    const [an, az] = corners[e] ?? [0, 0];
    const [bn, bz] = corners[(e + 1) % 4] ?? [0, 0];
    const first = positions.length / 3;
    for (const p of points) {
      vertex(p, an, az);
      vertex(p, bn, bz);
    }
    for (let k = 0; k + 1 < points.length; k++) {
      const i = first + 2 * k;
      indices.push(i, i + 2, i + 3, i, i + 3, i + 1);
    }
  }
  for (const [p, flip] of [
    [points[0], false],
    [points[points.length - 1], true],
  ] as const) {
    if (!p) continue;
    const [p0, p1, p2, p3] = corners.map(([n, z]) => vertex(p, n, z));
    const a = p0 ?? 0;
    const b = p1 ?? 0;
    const c = p2 ?? 0;
    const d = p3 ?? 0;
    indices.push(...(flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A gate's beam point in the rig's frame: BEAM along the normal over the track at s. */
function beamAt(s: number): THREE.Vector3 {
  const p = trackAt(s);
  return new THREE.Vector3(p.x - BEAM * Math.sin(p.slope), p.y + BEAM * Math.cos(p.slope), 0);
}

/**
 * The fixed parts: the track with its rails and end stops (the entity's mesh), its legs and feet,
 * the gates' U-frames and heads, the timer's case and panel, and the two rulers.
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const top = topOf(item);
  const floor = -top.y - item.visual.size[1] / 2; // the bench, in the rig's frame
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(top);
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const textures: THREE.Texture[] = [];
  const points = profile();
  const half = PLATE.width / 2;

  // 1. The track: the plate between its rails, a stop across each ramp top.
  const stops = [-TRACK_END, TRACK_END].map((s) => {
    const p = trackAt(s);
    const inward = s < 0 ? 1 : -1;
    return box(STOP.thick, STOP.height, PLATE.width)
      .translate(inward * STOP.thick * 0.5, STOP.height / 2 - PLATE.thick, 0)
      .rotateZ(p.slope)
      .translate(p.x, p.y, 0);
  });
  const body = keep(
    merged([
      sweep(-PLATE.thick, 0, -half, half, points),
      sweep(0, RAIL.height, half - RAIL.width, half, points),
      sweep(0, RAIL.height, -half, -half + RAIL.width, points),
      ...stops,
    ]).translate(top.x, top.y, top.z),
  );

  // 2. Legs under the track (a unit rod scaled to each height) on rubber feet.
  const legsAt = [0.1, ARC_END + 0.1, ARC_END + 0.4, TRACK_END - 0.05].flatMap((s) =>
    [-s, s].flatMap((v) => {
      const p = trackAt(v);
      const under = p.y - PLATE.thick / Math.cos(p.slope) + 0.002; // just into the plate
      return [-1, 1].map((side) => ({ x: p.x, z: side * LEG.z, height: under - floor }));
    }),
  );
  copies(
    keep(new THREE.CylinderGeometry(LEG.radius, LEG.radius, 1, 10).translate(0, 0.5, 0)),
    steel,
    legsAt.map(({ x, z, height }) =>
      new THREE.Matrix4().makeScale(1, height, 1).setPosition(x, floor + FOOT.height, z),
    ),
  ).name = 'legs';
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  copies(
    keep(new THREE.CylinderGeometry(FOOT.radius, FOOT.radius + 0.002, FOOT.height, 12)),
    rubber,
    legsAt.map(({ x, z }) => at(x, floor + FOOT.height / 2, z)),
  ).castShadow = false;

  // 3. Dark plastic: each gate's U (its base under the track, uprights outside the rails, heads
  //    facing each other across the flag), the timer's case and the rulers' feet.
  const gates = [beamAt(0), beamAt(GATE_B)].flatMap((beam) => {
    const postTop = beam.y + GATE.above;
    return [
      box(GATE.width, GATE.base, 2 * GATE.z + GATE.post, beam.x, floor + GATE.base / 2, 0),
      ...[-1, 1].flatMap((side) => [
        box(GATE.width, postTop - floor, GATE.post, beam.x, (postTop + floor) / 2, side * GATE.z),
        box(GATE.head, GATE.head, 0.012, beam.x, beam.y, side * (GATE.z - GATE.post / 2 - 0.006)),
      ]),
    ];
  });
  mesh(
    keep(
      merged([
        ...gates,
        slab(TIMER.width, TIMER.depth, TIMER.height, 0.006, 0.002).translate(
          TIMER.x,
          floor,
          TIMER.z,
        ),
        ...[-1, 1].map((side) =>
          box(0.05, 0.006, 0.03, side * RULER.x, floor + 0.003, RULER.z + 0.012),
        ),
      ]),
    ),
    plastic,
  ).name = 'dark-parts';

  // 4. The timer's panel: pale LCD glass with each readout's name; the digits are the rig's.
  const panel = painted2d(520, 160, (ctx) => {
    ctx.fillStyle = '#c4d2b0';
    ctx.fillRect(0, 0, 520, 160);
    ctx.fillStyle = '#1d2731';
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('A  Δt', 36, 48);
    ctx.fillText('B  Δt', 296, 48);
    ctx.textAlign = 'right';
    ctx.fillText('s', 250, 130);
    ctx.fillText('s', 510, 130);
  });
  if (panel) textures.push(panel);
  const front = TIMER.z + TIMER.depth / 2;
  const screen = mesh(
    keep(new THREE.PlaneGeometry(0.13, 0.04)),
    own(new THREE.MeshBasicMaterial({ color: panel ? '#ffffff' : '#c4d2b0', map: panel })),
  );
  screen.name = 'timer-panel';
  screen.position.set(TIMER.x, floor + 0.04, front + 0.0005);
  screen.castShadow = false;

  // 5. The rulers: one scale, 0 at the flat, centimetres to 0.40 m, figures every 5 cm, standing
  //    on the bench in front of each ramp.
  const rulerH = RULER.top + 0.02 - floor;
  const scale = painted2d(128, Math.round((128 * rulerH) / RULER.width), (ctx) => {
    const h = ctx.canvas.height;
    const px = h / rulerH; // px per metre
    ctx.fillStyle = '#f2d75a';
    ctx.fillRect(0, 0, 128, h);
    ctx.fillStyle = '#1d2731';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let cm = 0; cm <= RULER.top * 100; cm++) {
      const y = h - (cm / 100 - floor) * px;
      const long = cm % 10 === 0 ? 48 : cm % 5 === 0 ? 34 : 20;
      ctx.fillRect(0, y - 1.5, long, 3);
      if (cm % 5 === 0) ctx.fillText(String(cm), 122, y + 11);
    }
    ctx.fillText('cm', 122, 36);
  });
  if (scale) textures.push(scale);
  const rulers = copies(
    keep(new THREE.PlaneGeometry(RULER.width, rulerH)),
    own(
      new THREE.MeshStandardMaterial({
        color: scale ? '#ffffff' : '#f2d75a',
        map: scale,
        ...LOOKS.satin,
      }),
    ),
    [-1, 1].map((side) => at(side * RULER.x, floor + rulerH / 2, RULER.z)),
  );
  rulers.name = 'rulers';
  rulers.castShadow = false;

  return {
    body,
    parts: kit.group,
    dispose: () => {
      kit.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

/** The timer's two 7-segment readouts: one instanced mesh, a transform per segment. */
interface Readout {
  readonly mesh: THREE.InstancedMesh;
  readonly on: readonly THREE.Matrix4[];
  /** The same, unlit: shrunk to nothing where it stands (so the readout keeps its bounds). */
  readonly off: readonly THREE.Matrix4[];
  /** Each place's lit segments (bit 7: its point) as now drawn; −1 before the first. */
  readonly shown: Int16Array;
}

function readout(kit: Assembly, material: THREE.Material, places: readonly THREE.Matrix4[]) {
  const { width: w, height: h, stroke: s } = DIGIT;
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
  const mesh = kit.copies(kit.keep(new THREE.BoxGeometry(1, 1, 1)), material, on);
  mesh.computeBoundingSphere(); // once, every segment lit: culling stays right whatever it shows
  off.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = 'timer-digits';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return { mesh, on, off, shown: new Int16Array(places.length).fill(-1) } as Readout;
}

/** Lights place `i`: `bits` its segments, bit 7 its point. Returns whether it changed. */
function light(r: Readout, i: number, bits: number): boolean {
  if (r.shown[i] === bits) return false;
  r.shown[i] = bits;
  for (let k = 0; k < SLOTS; k++) {
    const m = (bits & (1 << k) ? r.on : r.off)[i * SLOTS + k];
    if (m) r.mesh.setMatrixAt(i * SLOTS + k, m);
  }
  return true;
}

/**
 * Shows `n` (an integer ≥ 0) with `point` decimals, right-aligned in the PLACES places from
 * `first`: blank for NaN, dashes when it does not fit.
 */
function show(r: Readout, first: number, n: number, point: number): void {
  const fits = n >= 0 && n < 10 ** PLACES && point < PLACES;
  let changed = false;
  for (let i = 0; i < PLACES; i++) {
    const power = 10 ** (PLACES - 1 - i);
    const units = i === PLACES - 1 - point;
    const lead = i < PLACES - 1 - point && Math.floor(n / power) === 0;
    const bits = Number.isNaN(n)
      ? 0
      : !fits
        ? DASH
        : (lead ? 0 : (SEGMENTS[Math.floor(n / power) % 10] ?? 0)) |
          (units && point > 0 ? 0x80 : 0);
    changed = light(r, first + i, bits) || changed;
  }
  if (changed) r.mesh.instanceMatrix.needsUpdate = true;
}

/**
 * What the run sets: the cart (body, wheels spun by `position`, flag, bars by the mass, sail by
 * its area) at the run's `x`, `height` and `trackAngle` — at the latch on the near ramp before
 * one — the latch and the ruler's pointer at the release height, the gates' lamps while
 * `beamA`/`beamB` block, and the timer's readouts of `gateTimeA`/`gateTimeB` at the dialled
 * resolution, as `measurement.ts` reads them. `pose` only assigns, skipping what has not changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const top = topOf(item);
  const floor = -top.y - item.visual.size[1] / 2;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(top);
  const paint = own(new THREE.MeshStandardMaterial({ color: '#2f6fc4', ...LOOKS.satin }));
  const grey = own(new THREE.MeshStandardMaterial({ color: '#4a4f55', ...LOOKS.plastic }));
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic }));
  const card = own(new THREE.MeshStandardMaterial({ color: '#e8dcb5', ...LOOKS.matte }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#8c949c', ...LOOKS.metal }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#c8322a', ...LOOKS.plastic }));
  const lampOff = own(new THREE.MeshStandardMaterial({ color: '#4a1512', ...LOOKS.plastic }));
  const lampOn = own(new THREE.MeshBasicMaterial({ color: '#ff3b2f' }));
  const ink = own(new THREE.MeshBasicMaterial({ color: '#1d2731' }));

  // The cart, in its own frame: origin at its reference point on the track surface, +x towards
  // the far ramp; it turns about z with the track.
  const cart = new THREE.Group();
  cart.name = 'cart';
  kit.group.add(cart);
  mesh(
    keep(
      merged([
        slab(CART.length, CART.width, CART.height, 0.008, 0.002).translate(0, CART.clearance, 0),
        // the axle housings under the body
        ...[-1, 1].map((s) =>
          box(0.02, CART.clearance - 0.004, CART.width - 0.02, s * WHEEL.x, WHEEL.radius + 0.002),
        ),
      ]),
    ),
    paint,
    cart,
  ).name = 'cart-body';
  const wheelAt = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => new THREE.Vector3(sx * WHEEL.x, WHEEL.radius, sz * WHEEL.z)),
  );
  const wheels = copies(
    keep(
      merged([
        new THREE.CylinderGeometry(WHEEL.radius, WHEEL.radius, WHEEL.width, 16).rotateX(
          Math.PI / 2,
        ),
        // two crossing spokes, just proud of each face: the spin shows
        box(2 * WHEEL.radius - 0.004, 0.003, WHEEL.width + 0.0015),
        box(0.003, 2 * WHEEL.radius - 0.004, WHEEL.width + 0.0015),
      ]),
    ),
    grey,
    wheelAt.map((p) => at(p.x, p.y, p.z)),
    cart,
  );
  wheels.name = 'wheels';
  wheels.castShadow = false;
  const flag = mesh(
    keep(box(TRACK.flagWidth, FLAG.height, FLAG.thick, 0, BODY_TOP + FLAG.height / 2, 0)),
    plastic,
    cart,
  );
  flag.name = 'flag';
  const bars = copies(
    keep(slab(BAR.width, BAR.length, BAR.thick, 0.002, 0.001)),
    steel,
    BARS_AT.map(([x, y]) => at(x, y, 0)),
    cart,
  );
  bars.name = 'bars';
  bars.computeBoundingBox(); // the full set: what culling and boxes use whatever `count` shows
  bars.computeBoundingSphere();
  // The sail: a unit card standing on the flag's top, scaled to its side.
  const sail = mesh(keep(box(0.001, 1, 1, 0, 0.5, 0)), card, cart);
  sail.name = 'sail';
  sail.position.y = BODY_TOP + FLAG.height;

  // The latch: a bar across the track behind the cart, clamped to both rails; it turns with the
  // ramp (in its frame, up the ramp is −x).
  const latch = mesh(
    keep(
      merged([
        box(0.012, 0.03, PLATE.width - 2 * RAIL.width - 0.002, 0, 0.015, 0),
        ...[-1, 1].map((s) =>
          box(0.03, 0.012, 0.014, 0, RAIL.height + 0.006, s * (PLATE.width / 2 - RAIL.width / 2)),
        ),
      ]).translate(-(CART.length / 2 + 0.01), 0, 0),
    ),
    steel,
  );
  latch.name = 'latch';
  // The release ruler's pointer: a red index at h.
  const pointer = mesh(keep(box(0.01, 0.004, 0.004)), red);
  pointer.name = 'pointer';
  pointer.position.set(-RULER.x + RULER.width / 2 + 0.006, 0, RULER.z);
  pointer.castShadow = false;

  // Each gate's lamp on its front upright's top: lit while its beam is blocked.
  const lamps = [beamAt(0), beamAt(GATE_B)].map((beam, i) => {
    const lamp = mesh(keep(box(0.008, 0.005, 0.008)), lampOff);
    swaps(lamp, lampOn);
    lamp.name = i === 0 ? 'lamp-a' : 'lamp-b';
    lamp.position.set(beam.x, beam.y + GATE.above + 0.0025, GATE.z);
    lamp.castShadow = false;
    return lamp;
  });

  // The timer's readouts, A then B, on its panel.
  const front = TIMER.z + TIMER.depth / 2 + 0.0012;
  const digits = readout(
    kit,
    ink,
    [-0.034, 0.034].flatMap((cx) =>
      Array.from({ length: PLACES }, (_, i) =>
        new THREE.Matrix4().makeTranslation(
          TIMER.x + cx + (i - (PLACES - 1) / 2) * DIGIT.pitch,
          floor + 0.033,
          front,
        ),
      ),
    ),
  );

  // What is drawn now: pose skips what has not changed.
  let release = NaN; // h
  let restS = NaN; // the latch's s, where the cart waits
  const rest = { x: 0, y: 0, slope: 0 };
  let mass = NaN;
  let area = NaN;
  let cx = NaN;
  let cy = NaN;
  let slope = NaN;
  let along = NaN; // s, for the wheels
  let litA = false;
  let litB = false;
  let resolution = NaN;
  let timeA = NaN;
  let timeB = NaN;
  const spin = new THREE.Matrix4();
  const pose = ({ parameters, sample }: BenchPose) => {
    const h = finite(parameters.releaseHeight, IDLE.releaseHeight);
    if (h !== release) {
      release = h;
      restS = trackAt(0, h).release;
      const p = trackAt(restS, h);
      rest.x = p.x;
      rest.y = p.y;
      rest.slope = p.slope;
      latch.position.set(p.x, p.y, 0);
      latch.rotation.z = p.slope;
      pointer.position.y = h;
    }
    const m = finite(parameters.mass, IDLE.mass);
    if (m !== mass) {
      mass = m;
      bars.count = Math.min(BARS_AT.length, Math.max(0, Math.round((m - CART_KG) / BAR_KG)));
    }
    const a = finite(parameters.sailArea, IDLE.sailArea);
    if (a !== area) {
      area = a;
      sail.visible = a > 0;
      const side = Math.sqrt(Math.max(0, a));
      sail.scale.set(1, side, side);
    }
    // The run's own place on the track; before one, at the latch.
    const run = Number.isFinite(sample.x) && Number.isFinite(sample.height);
    const x = run ? (sample.x ?? 0) : rest.x;
    const y = run ? (sample.height ?? 0) : rest.y;
    const angle = run ? finite(sample.trackAngle, rest.slope) : rest.slope;
    if (x !== cx || y !== cy) {
      cx = x;
      cy = y;
      cart.position.set(x, y, 0);
    }
    if (angle !== slope) {
      slope = angle;
      cart.rotation.z = angle;
    }
    const s = finite(sample.position, restS);
    if (s !== along) {
      along = s;
      spin.makeRotationZ(-s / WHEEL.radius);
      wheelAt.forEach((p, i) => wheels.setMatrixAt(i, spin.setPosition(p)));
      wheels.instanceMatrix.needsUpdate = true;
    }
    const onA = sample.beamA === 1;
    if (onA !== litA) {
      litA = onA;
      if (lamps[0]) lamps[0].material = onA ? lampOn : lampOff;
    }
    const onB = sample.beamB === 1;
    if (onB !== litB) {
      litB = onB;
      if (lamps[1]) lamps[1].material = onB ? lampOn : lampOff;
    }
    const d = finite(parameters.timerResolution, IDLE.timerResolution);
    const tA = sample.gateTimeA ?? NaN;
    const tB = sample.gateTimeB ?? NaN;
    if (d !== resolution || !Object.is(tA, timeA) || !Object.is(tB, timeB)) {
      resolution = d;
      timeA = tA;
      timeB = tB;
      const point = d > 0 ? decimals(d) : 0;
      const counts = (t: number) =>
        d > 0 && Number.isFinite(t) ? Math.round(quantize(t, d) * 10 ** point) : NaN;
      show(digits, 0, counts(tA), point);
      show(digits, PLACES, counts(tB), point);
    }
  };
  pose({ status: 'idle', parameters: {}, sample: {} });
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

const finite = (value: number | undefined, otherwise: number) =>
  value !== undefined && Number.isFinite(value) ? value : otherwise;

export const energyTrack: BenchModel = {
  frame,
  rig,
  reads: ['x', 'height', 'trackAngle', 'position', 'beamA', 'beamB', 'gateTimeA', 'gateTimeB'],
};
