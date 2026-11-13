import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import { Assembly, at, loft, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import { box, drum, rod } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The air track (model mechanics.collision): a school air track with two gliders, in real sizes
 * (m). Track frame: x along the track from the launcher face (`bench.top`, 0) towards the far
 * buffer, y up from the item's base, z across it (+z the front, where the ruler and the timer
 * are). Fixed (frame): the triangular aluminium beam on its levelling feet (the entity's mesh, in
 * the item's colour: the largest part, so focus shows), its rows of air holes, the launcher
 * housing with its plunger, the far buffer block with the air inlet and hose, the ruler along the
 * beam's front (0 at the launcher face, cm ticks, figures every 0.1 m) and the digital timer's
 * case in front with its two windows. Moving (rig, from the pose only): the two gliders at
 * `positionA` and `positionB` (their centres; at `startA` and `startB` while there is no run),
 * each an inverted-V shell over the beam with a deck, a black 0.1 m card and a peg; the 50 g
 * slotted discs on the pegs, (m − 0.2 kg)/50 g each; the facing bumpers, their look from e (a
 * bright steel loop ≥ 0.95, a blued loop ≥ 0.7, a rubber pad ≥ 0.2, Velcro below); the two light
 * gates at `gate1` and `gate2`, each LED lit while either card is in its beam; and the timer's
 * windows, `gateTimeA` and `gateTimeB` read to the timer's resolution d. The impact is
 * instantaneous in the model, so no bumper is ever drawn compressed.
 */

/**
 * The layout drawn while the pose has no such parameter (idle: the dials only): the definition's
 * defaults and initial conditions (collisions.json), never a model input. Its test pins them.
 */
export const LAYOUT = {
  massA: 0.3,
  restitution: 1,
  timerResolution: 0.001,
  massB: 0.3,
  flagLength: 0.1,
  gliderLength: 0.2,
  startA: 0.15,
  startB: 0.8,
  gate1: 0.35,
  gate2: 1,
  trackLength: 1.5,
} as const;

/** The beam's section: a rectangle from `base` to `shoulder`, a triangle to the `apex`. */
const BEAM = { from: -0.1, to: 1.56, base: 0.03, shoulder: 0.06, apex: 0.12, half: 0.05 };
const FEET = { radius: 0.018, height: 0.012, single: 0.12, pair: 1.4, spread: 0.07 };
const HOLES = { from: 0.02, to: 1.48, pitch: 0.01, y: 0.09, radius: 0.0012 };
const RULER = { length: 1.5, height: 0.02, y: 0.045, px: 4096 };
const LAUNCHER = { length: 0.1, bottom: 0.03, top: 0.15, half: 0.05 };
const BUFFER = { x: 1.5, length: 0.06, bottom: 0.05, top: 0.15, half: 0.05 };
/** A glider: its shell's plates over the beam's slopes, the deck, the card on it, the peg. */
const GLIDER = { length: 0.2, skirt: 0.085, gap: 0.001, plate: 0.004, deck: 0.13, deckHalf: 0.032 };
const CARD = { length: 0.1, bottom: GLIDER.deck + 0.003, top: 0.223, thick: 0.0015 };
/** The gates' beam: above the discs (top 0.162), through the card. */
const BEAM_Y = 0.195;
/** How far a bumper stands out from its glider's end: A's front meets B's back at ℓ apart. */
const BUMPER = 0.02;
const PEG = { y: 0.142, radius: 0.004, half: 0.05 };
/** A 50 g brass disc: 8.5 g/cm³ at Ø 40 mm is 4.7 mm thick. */
const DISC = { radius: 0.02, thick: 0.0047, pitch: 0.005, first: GLIDER.deckHalf + 0.002 };
const MAX_DISCS = 12;
const GATE = { z: 0.085, post: 0.02, top: 0.26, sensor: 0.065, led: 0.265 };
const TIMER = { x: 0.65, z: 0.1, width: 0.18, depth: 0.08, height: 0.06 };
const TIMER_FRONT = TIMER.z + TIMER.depth / 2;
const LCD = { width: 0.0065, height: 0.012, stroke: 0.0012, pitch: 0.0115, y: 0.034, dx: 0.045 };
const PLACES = 5; // a window: up to 9.9999 s
const SLOTS = 8; // a place's seven segments and its decimal point
const DASH = 0x40;
/** Lit segments of a 7-segment digit, bit 0 = a (top) … bit 6 = g (middle), for 0–9. */
export const SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f] as const;
const GLIDER_KG = 0.2;
const DISC_KG = 0.05;
const LED_LIT = new THREE.Color('#ff2a1a');
const LED_DARK = new THREE.Color('#3a0e0a');

/** The bumper drawn for a coefficient of restitution: loops for springs, pads for soft or sticky. */
export const bumperKind = (e: number): 'elastic' | 'spring' | 'pad' | 'velcro' =>
  !(e < 0.95) ? 'elastic' : e >= 0.7 ? 'spring' : e >= 0.2 ? 'pad' : 'velcro';

/** Whole 50 g discs on a glider of mass m (a 0.2 kg glider): 0 to 6, visual only. */
export const discsFor = (m: number): number =>
  Math.min(6, Math.max(0, Math.round((m - GLIDER_KG) / DISC_KG))) || 0;

/**
 * The track frame's origin in the item's frame (origin at the centre of its box): under
 * `bench.top` (the launcher face, at the beam's apex) at the item's base. Frame and rig share it.
 */
function trackOrigin(item: ItemDefinition): THREE.Vector3 {
  const [x, , z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, -item.visual.size[1] / 2, z);
}

type G = THREE.BufferGeometry;
type Piece = readonly [geometry: G, color: string];

/** Pieces merged into one geometry (one draw), each in its vertex colour; the pieces freed. */
function merge(pieces: readonly Piece[]): G {
  const color = new THREE.Color();
  for (const [g, hex] of pieces) {
    g.deleteAttribute('uv');
    if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
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

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The beam: its section lofted along the track, from under the launcher to under the buffer. */
function beam(): G {
  const { base, shoulder, apex, half } = BEAM;
  const outline = () => [
    new THREE.Vector2(-half, base),
    new THREE.Vector2(half, base),
    new THREE.Vector2(half, shoulder),
    new THREE.Vector2(0, apex),
    new THREE.Vector2(-half, shoulder),
  ];
  // The loft stacks along z: a quarter turn about y takes that to x (the outline's u to −z).
  return loft(outline, [
    [0, BEAM.from],
    [0, BEAM.to],
  ]).rotateY(Math.PI / 2);
}

/** The ruler's marks: null without a 2D canvas (tests), the strip is then plain. */
function rulerTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const h = Math.round((RULER.px * RULER.height) / RULER.length); // the strip's proportions
  canvas.width = RULER.px;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) return null;
  const s = RULER.px / RULER.length; // px per metre
  const k = h / 54;
  c.fillStyle = '#f2d75a';
  c.fillRect(0, 0, RULER.px, h);
  c.fillStyle = '#1d2731';
  c.font = `600 ${Math.round(22 * k)}px system-ui, sans-serif`;
  c.textAlign = 'center';
  for (let cm = 0; cm <= RULER.length * 100; cm++) {
    const x = (cm / 100) * s;
    const tall = (cm % 10 === 0 ? 22 : cm % 5 === 0 ? 15 : 9) * k;
    c.fillRect(x - 1, 0, 2, tall);
    if (cm % 10 === 0)
      c.fillText(
        (cm / 100).toFixed(1),
        Math.min(Math.max(x, 20 * k), RULER.px - 20 * k),
        h - 5 * k,
      );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The fixed parts: the beam (the entity's mesh) and, merged by material, the dark plastics and
 * rubber (feet, launcher, buffer face, hose, air holes, timer bezels and keys), the bright metal
 * (feet stems, plunger, pusher, air inlet), the timer's case, the ruler and the windows' panels.
 */
function frame(item: ItemDefinition): BenchFrame {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const origin = trackOrigin(item);
  kit.group.position.copy(origin); // the parts are laid out in the track frame
  const body = keep(beam()).translate(origin.x, origin.y, origin.z);

  const dark = '#24282c';
  const plastics: Piece[] = [];
  const metal: Piece[] = [];
  // Levelling feet: one under the launcher end, two under the far end on a cross bar.
  for (const [x, z] of [
    [FEET.single, 0],
    [FEET.pair, -FEET.spread],
    [FEET.pair, FEET.spread],
  ] as const) {
    plastics.push([drum(FEET.radius, FEET.radius, 0, FEET.height, 16).translate(x, 0, z), dark]);
    metal.push([drum(0.004, 0.004, FEET.height, BEAM.base, 8).translate(x, 0, z), '#b9bfc5']);
  }
  plastics.push([box(0.03, 0.008, 0.17, FEET.pair, BEAM.base - 0.004, 0), dark]);
  // The air holes: a row along each slope, every cm, facing out of its face.
  const tilt = Math.atan2(BEAM.half, BEAM.apex - BEAM.shoulder);
  const slope = Math.hypot(BEAM.half, BEAM.apex - BEAM.shoulder);
  const zHole = (BEAM.half * (BEAM.apex - HOLES.y)) / (BEAM.apex - BEAM.shoulder);
  const lift = 0.0002;
  for (let x = HOLES.from; x <= HOLES.to + 1e-9; x += HOLES.pitch) {
    for (const side of [1, -1]) {
      const hole = new THREE.CircleGeometry(HOLES.radius, 6)
        .rotateX(side > 0 ? -tilt : Math.PI + tilt)
        .translate(
          x,
          HOLES.y + (lift * BEAM.half) / slope,
          side * (zHole + (lift * (BEAM.apex - BEAM.shoulder)) / slope),
        );
      plastics.push([hole, '#15181b']);
    }
  }
  // The launcher: its housing over the beam's near end, the plunger out of its back, the pusher.
  const lx = -LAUNCHER.length / 2;
  const ly = (LAUNCHER.bottom + LAUNCHER.top) / 2;
  plastics.push([
    box(LAUNCHER.length, LAUNCHER.top - LAUNCHER.bottom, 2 * LAUNCHER.half, lx, ly, 0),
    '#2e3338',
  ]);
  metal.push([rod(0.006, v(-LAUNCHER.length, 0.105, 0), v(-0.136, 0.105, 0), 10), '#c3c9cf']);
  plastics.push([
    new THREE.CylinderGeometry(0.012, 0.012, 0.011, 16)
      .rotateZ(Math.PI / 2)
      .translate(-0.1415, 0.105, 0),
    dark,
  ]);
  metal.push([box(0.01, 0.04, 0.04, 0.005, 0.105, 0), '#c3c9cf']);
  // The far buffer block, its rubber face, the air inlet on its end and the hose from it.
  plastics.push([
    box(
      BUFFER.length,
      BUFFER.top - BUFFER.bottom,
      2 * BUFFER.half,
      BUFFER.x + BUFFER.length / 2,
      0.1,
      0,
    ),
    '#2e3338',
  ]);
  plastics.push([box(0.004, 0.05, 0.06, BUFFER.x - 0.002, 0.105, 0), '#3a3d41']);
  metal.push([rod(0.012, v(BUFFER.x + BUFFER.length, 0.1, 0), v(1.59, 0.1, 0), 14), '#8a9096']);
  plastics.push([rod(0.009, v(1.59, 0.1, 0), v(1.645, 0.1, 0), 12), '#1c1e21']);
  // The timer's case in front, two keys on top, a bezel round each window.
  for (const s of [-1, 1]) {
    plastics.push([
      box(0.014, 0.004, 0.012, TIMER.x + s * 0.02, TIMER.height + 0.002, TIMER.z - 0.02),
      dark,
    ]);
    plastics.push([
      box(0.07, 0.026, 0.002, TIMER.x + s * LCD.dx, LCD.y, TIMER_FRONT + 0.001),
      dark,
    ]);
  }

  const vertexColours = (look: THREE.MeshStandardMaterialParameters) =>
    own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...look }));
  const part = (name: string, pieces: Piece[], material: THREE.Material, casts = true) => {
    const m = mesh(keep(merge(pieces)), material);
    m.name = name;
    m.castShadow = casts;
    return m;
  };
  part('plastic', plastics, vertexColours(LOOKS.plastic));
  part('metal', metal, vertexColours(LOOKS.metal));
  const timer = mesh(
    keep(slab(TIMER.width, TIMER.depth, TIMER.height, 0.006, 0.002).translate(TIMER.x, 0, TIMER.z)),
    own(new THREE.MeshStandardMaterial({ color: '#dfe1e3', ...LOOKS.plastic })),
  );
  timer.name = 'timer';
  const marks = rulerTexture();
  const ruler = mesh(
    keep(
      new THREE.PlaneGeometry(RULER.length, RULER.height).translate(
        RULER.length / 2,
        RULER.y,
        BEAM.half + 0.0005,
      ),
    ),
    own(
      new THREE.MeshStandardMaterial({
        color: marks ? '#ffffff' : '#f2d75a',
        map: marks,
        ...LOOKS.satin,
      }),
    ),
  );
  ruler.name = 'ruler';
  ruler.castShadow = false;
  const panels = mesh(
    keep(
      mergeGeometries(
        [-1, 1].map((s) =>
          new THREE.PlaneGeometry(0.064, 0.02).translate(
            TIMER.x + s * LCD.dx,
            LCD.y,
            TIMER_FRONT + 0.0021,
          ),
        ),
      ),
    ),
    own(new THREE.MeshBasicMaterial({ color: '#b7c6a2' })), // backlit: reads at any light
  );
  panels.name = 'panels';
  panels.castShadow = false;
  return {
    body,
    parts: kit.group,
    dispose: () => {
      kit.dispose();
      marks?.dispose(); // a material never frees its map
    },
  };
}

// ---- the timer's readout --------------------------------------------------------------------

/** The two windows' 7-segment places as one instanced mesh: a transform per segment. */
interface Readout {
  readonly mesh: THREE.InstancedMesh;
  readonly on: readonly THREE.Matrix4[];
  /** The same, unlit: shrunk to nothing where it stands (so the readout keeps its bounds). */
  readonly off: readonly THREE.Matrix4[];
  /** Each place's lit segments (bit 7: its point) as now drawn; −1 before the first. */
  readonly shown: Int16Array;
}

function readout(kit: Assembly, parent: THREE.Object3D, places: readonly THREE.Matrix4[]): Readout {
  const { width: w, height: h, stroke: s } = LCD;
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
    layout.map(([u, vv, flat]) => {
      const [sx, sy] = flat === null ? [s, s] : flat ? [w - s, s] : [s, h / 2 - s];
      return place
        .clone()
        .multiply(new THREE.Matrix4().makeScale(sx, sy, t).setPosition(u, vv, t / 2));
    }),
  );
  const off = on.map((m) => new THREE.Matrix4().makeScale(0, 0, 0).copyPosition(m));
  const mesh = kit.copies(
    kit.keep(new THREE.BoxGeometry(1, 1, 1)),
    kit.own(new THREE.MeshBasicMaterial({ color: '#1d2731' })),
    [...on],
    parent,
  );
  mesh.computeBoundingSphere(); // once, every segment lit: culling stays right whatever it shows
  off.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = 'timer-digits';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return { mesh, on, off, shown: new Int16Array(places.length).fill(-1) };
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
 * Shows `n` (an integer ≥ 0, or NaN for blank) with `point` decimals right-aligned in window `w`;
 * dashes when it does not fit. Returns whether anything changed.
 */
function show(r: Readout, w: number, n: number, point: number): boolean {
  const fits = n >= 0 && n < 10 ** PLACES && point < PLACES;
  let changed = false;
  for (let i = 0; i < PLACES; i++) {
    const power = 10 ** (PLACES - 1 - i);
    const units = i === PLACES - 1 - point;
    const digit = Math.floor(n / power) % 10;
    const lead = i < PLACES - 1 - point && Math.floor(n / power) === 0;
    const bits = Number.isNaN(n)
      ? 0
      : !fits
        ? DASH
        : (lead ? 0 : (SEGMENTS[digit] ?? 0)) | (units && point > 0 ? 0x80 : 0);
    changed = light(r, w * PLACES + i, bits) || changed;
  }
  return changed;
}

// ---- rig ------------------------------------------------------------------------------------

/** A glider's shell, deck, card and peg about its centre (x 0), in vertex colours. */
function gliderPieces(): Piece[] {
  const { length, skirt, gap, plate, deck, deckHalf } = GLIDER;
  const rise = BEAM.apex - BEAM.shoulder;
  const slope = Math.hypot(BEAM.half, rise);
  const tilt = Math.atan2(rise, BEAM.half); // a slope's angle to the horizontal
  const alu = '#c9ced3';
  const pieces: Piece[] = [];
  // Each plate lies `gap` off its slope, from the apex down to the skirt, `plate` thick.
  const yTop = BEAM.apex + (gap * slope) / BEAM.half; // where the gapped slopes meet
  const along = ((yTop - skirt) * slope) / rise;
  const mid = (yTop + skirt) / 2;
  const zMid = (BEAM.half * (yTop - mid)) / rise; // the gapped slope at mid-height
  for (const side of [-1, 1]) {
    pieces.push([
      box(length, plate, along)
        .rotateX(side * tilt)
        .translate(
          0,
          mid + (plate / 2) * (BEAM.half / slope),
          side * (zMid + (plate / 2) * (rise / slope)),
        ),
      alu,
    ]);
  }
  pieces.push([box(length, 0.006, 2 * deckHalf, 0, deck, 0), alu]);
  pieces.push([
    box(CARD.length, CARD.top - CARD.bottom, CARD.thick, 0, (CARD.top + CARD.bottom) / 2, 0),
    '#15181b',
  ]);
  pieces.push([
    new THREE.CylinderGeometry(PEG.radius, PEG.radius, 2 * PEG.half, 10)
      .rotateX(Math.PI / 2)
      .translate(0, PEG.y, 0),
    '#b9bfc5',
  ]);
  return pieces;
}

/** A light gate about its beam's x: base plate under the track, two posts, crossbar, sensors. */
function gatePieces(): Piece[] {
  const dark = '#23272b';
  const pieces: Piece[] = [[box(0.05, 0.006, 2 * GATE.z + 0.03, 0, 0.003, 0), dark]];
  for (const side of [-1, 1]) {
    pieces.push([box(GATE.post, GATE.top, GATE.post, 0, GATE.top / 2, side * GATE.z), dark]);
    pieces.push([box(0.02, 0.03, 0.02, 0, BEAM_Y, side * GATE.sensor), dark]);
    pieces.push([
      new THREE.CircleGeometry(0.005, 12)
        .rotateY(side > 0 ? Math.PI : 0)
        .translate(0, BEAM_Y, side * (GATE.sensor - 0.0101)),
      '#3d5a6e',
    ]);
  }
  pieces.push([box(GATE.post, GATE.post, 2 * GATE.z, 0, GATE.top - GATE.post / 2, 0), dark]);
  return pieces;
}

/** A bumper standing out +x from a glider's end face at x 0, centred at the glider's mid-height. */
function bumperGeometry(kind: ReturnType<typeof bumperKind>): G {
  const y = 0.105;
  if (kind === 'elastic' || kind === 'spring') {
    const steel = kind === 'elastic' ? '#e3e7ea' : '#3b4a66';
    const r = BUMPER / 2 - 0.0005;
    return merge([
      [
        new THREE.CylinderGeometry(r, r, 0.03, 18, 1, true)
          .rotateX(Math.PI / 2)
          .translate(r + 0.0005, y, 0),
        steel,
      ],
      [box(0.006, 0.002, 0.03, 0.003, y + r, 0), steel],
      [box(0.006, 0.002, 0.03, 0.003, y - r, 0), steel],
    ]);
  }
  const face = kind === 'pad' ? '#3a3d41' : '#1c1a18';
  const thick = kind === 'pad' ? 0.006 : 0.004;
  return merge([
    [box(BUMPER - thick, 0.03, 0.04, (BUMPER - thick) / 2, y, 0), '#2e3338'],
    [box(thick, 0.036, 0.046, BUMPER - thick / 2, y, 0), face],
  ]);
}

/**
 * The gliders, their discs and bumpers, the gates with their LEDs and the timer's readout; `pose`
 * places and lights them from the pose, allocating nothing and rewriting only what changed.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(trackOrigin(item));
  const plastic = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.satin }),
  );
  const metal = own(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      side: THREE.DoubleSide, // the loops are open strips
      ...LOOKS.metal,
    }),
  );
  const rubber = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.rubber }),
  );

  const gliders = copies(keep(merge(gliderPieces())), plastic, [
    at(LAYOUT.startA, 0, 0),
    at(LAYOUT.startB, 0, 0),
  ]);
  gliders.name = 'gliders';
  gliders.frustumCulled = false; // they move: their bounds would go stale
  const discs = copies(
    keep(new THREE.CylinderGeometry(DISC.radius, DISC.radius, DISC.thick, 24).rotateX(Math.PI / 2)),
    metal,
    Array.from({ length: MAX_DISCS }, () => new THREE.Matrix4()),
  );
  discs.name = 'discs';
  discs.frustumCulled = false;
  discs.count = 0;
  const bumpers = {
    elastic: keep(bumperGeometry('elastic')),
    spring: keep(bumperGeometry('spring')),
    pad: keep(bumperGeometry('pad')),
    velcro: keep(bumperGeometry('velcro')),
  };
  const bumperA = mesh(bumpers.elastic, metal);
  bumperA.name = 'bumper-a';
  const bumperB = mesh(bumpers.elastic, metal);
  bumperB.name = 'bumper-b';
  swaps(bumperA, rubber);
  swaps(bumperB, rubber);
  bumperB.rotation.y = Math.PI; // on B's back, facing A
  const gates = copies(keep(merge(gatePieces())), plastic, [
    at(LAYOUT.gate1, 0, 0),
    at(LAYOUT.gate2, 0, 0),
  ]);
  gates.name = 'gates';
  const leds = copies(
    keep(new THREE.SphereGeometry(0.005, 10, 6)),
    own(new THREE.MeshBasicMaterial({ color: '#ffffff' })),
    [at(LAYOUT.gate1, GATE.led, 0), at(LAYOUT.gate2, GATE.led, 0)],
  );
  leds.name = 'leds';
  leds.castShadow = false;
  leds.setColorAt(0, LED_DARK); // makes the colour buffer once: pose only rewrites it
  leds.setColorAt(1, LED_DARK);
  const places = [0, 1].flatMap((w) =>
    Array.from({ length: PLACES }, (_, i) =>
      new THREE.Matrix4().makeTranslation(
        TIMER.x + (w ? 1 : -1) * LCD.dx + (i - (PLACES - 1) / 2) * LCD.pitch,
        LCD.y,
        TIMER_FRONT + 0.0023,
      ),
    ),
  );
  const windows = readout(kit, kit.group, places);

  // What is drawn now: pose skips what has not changed.
  const m = new THREE.Matrix4();
  let xA = NaN;
  let xB = NaN;
  let nA = -1;
  let nB = -1;
  let kind: ReturnType<typeof bumperKind> | null = null;
  let g1 = NaN;
  let g2 = NaN;
  let lit1: boolean | null = null;
  let lit2: boolean | null = null;
  let readA = NaN;
  let readB = NaN;
  let point = NaN;

  const place = (glider: number, x: number, from: number, n: number) => {
    gliders.setMatrixAt(glider, m.makeTranslation(x, 0, 0));
    for (let k = 0; k < n; k++) {
      const z = (k % 2 ? 1 : -1) * (DISC.first + (Math.floor(k / 2) + 0.5) * DISC.pitch);
      discs.setMatrixAt(from + k, m.makeTranslation(x, PEG.y, z));
    }
  };
  const pose = ({ parameters: p, sample: s }: BenchPose) => {
    // NaN (no run, or after RESET): the gliders at rest at their starts.
    const a = s.positionA ?? NaN;
    const b = s.positionB ?? NaN;
    const posA = Number.isFinite(a) ? a : (p.startA ?? LAYOUT.startA);
    const posB = Number.isFinite(b) ? b : (p.startB ?? LAYOUT.startB);
    const countA = discsFor(p.massA ?? LAYOUT.massA);
    const countB = discsFor(p.massB ?? LAYOUT.massB);
    if (posA !== xA || posB !== xB || countA !== nA || countB !== nB) {
      xA = posA;
      xB = posB;
      nA = countA;
      nB = countB;
      place(0, xA, 0, nA);
      place(1, xB, nA, nB);
      discs.count = nA + nB;
      gliders.instanceMatrix.needsUpdate = true;
      discs.instanceMatrix.needsUpdate = true;
      bumperA.position.x = xA + GLIDER.length / 2 - BUMPER;
      bumperB.position.x = xB - GLIDER.length / 2 + BUMPER;
    }
    const look = bumperKind(p.restitution ?? LAYOUT.restitution);
    if (look !== kind) {
      kind = look;
      const material = look === 'pad' || look === 'velcro' ? rubber : metal;
      bumperA.geometry = bumperB.geometry = bumpers[look];
      bumperA.material = bumperB.material = material;
    }
    const gate1 = p.gate1 ?? LAYOUT.gate1;
    const gate2 = p.gate2 ?? LAYOUT.gate2;
    if (gate1 !== g1 || gate2 !== g2) {
      g1 = gate1;
      g2 = gate2;
      gates.setMatrixAt(0, m.makeTranslation(g1, 0, 0));
      gates.setMatrixAt(1, m.makeTranslation(g2, 0, 0));
      leds.setMatrixAt(0, m.makeTranslation(g1, GATE.led, 0));
      leds.setMatrixAt(1, m.makeTranslation(g2, GATE.led, 0));
      gates.instanceMatrix.needsUpdate = true;
      leds.instanceMatrix.needsUpdate = true;
    }
    // A gate's LED is lit while either card is in its beam.
    const half = (p.flagLength ?? LAYOUT.flagLength) / 2;
    const on1 = Math.abs(xA - g1) < half || Math.abs(xB - g1) < half;
    const on2 = Math.abs(xA - g2) < half || Math.abs(xB - g2) < half;
    if (on1 !== lit1 || on2 !== lit2) {
      lit1 = on1;
      lit2 = on2;
      leds.setColorAt(0, on1 ? LED_LIT : LED_DARK);
      leds.setColorAt(1, on2 ? LED_LIT : LED_DARK);
      if (leds.instanceColor) leds.instanceColor.needsUpdate = true;
    }
    // The windows: each gate time as the timer reads it (0 until its card arrives), to d.
    const d = p.timerResolution ?? LAYOUT.timerResolution;
    const tA = s.gateTimeA ?? NaN;
    const tB = s.gateTimeB ?? NaN;
    const valid = d > 0 && Number.isFinite(d);
    const digits = valid ? decimals(d) : NaN;
    const nextA = valid
      ? Math.round(quantize(Number.isFinite(tA) ? tA : 0, d) * 10 ** digits)
      : NaN;
    const nextB = valid
      ? Math.round(quantize(Number.isFinite(tB) ? tB : 0, d) * 10 ** digits)
      : NaN;
    if (!Object.is(nextA, readA) || !Object.is(nextB, readB) || !Object.is(digits, point)) {
      readA = nextA;
      readB = nextB;
      point = digits;
      const changed = show(windows, 0, readA, point);
      if (show(windows, 1, readB, point) || changed) windows.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  pose({ status: 'idle', parameters: {}, sample: {} }); // until its session exists
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const airTrack: BenchModel = {
  frame,
  rig,
  reads: ['positionA', 'positionB', 'gateTimeA', 'gateTimeB'],
  // Either glider's centre at its farthest: B's at the far buffer.
  fullScale: {
    positionA: LAYOUT.trackLength - LAYOUT.gliderLength / 2,
    positionB: LAYOUT.trackLength - LAYOUT.gliderLength / 2,
  },
};
