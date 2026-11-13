import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals } from '../../../simulation/measurement';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { box, drum, rod } from '../props/parts';
import { SEGMENTS } from './osmosis-rack';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The whirling-bung apparatus (model mechanics.circular-motion), real sizes in metres from the
 * item's base centre (+z the front, y up); the tube's axis is the item's. Fixed (frame): a weighted
 * base, two uprights and a split bridge (the entity's mesh, in the item's colour: the largest part,
 * so focus shows); in steel the collar that clamps the tube in the bridge, the guard rail (two hoops
 * on four posts), the start flag's post and the radial rule from the +x upright to the +x post; in
 * plastic the red start flag, the stopwatch's case and keys and the rule's marks; in glass the
 * short tube; the stopwatch's backlit panel. Moving (rig, from the station only): the bung at
 * (x, tube top − drop, z) from the run's `x`, `z`, `drop`, its axis along the string; the string in
 * two straight pieces, tube top to bung and tube top down through the tube to the hanger; the
 * marker clip L from the tube top along the string (just below the tube while a run exists); the
 * hanger of slotted 50 g discs, (M − 0.05)/0.05 of them, hanging below the clip or standing on
 * the base when the slack string lets it; the stopwatch's digits: `stopwatch` read to the dialled
 * resolution d, as `measurement.ts` reads it, and `turnsCounted` on its lap counter. Without a run
 * the bung rests on the tube's rim and nothing moves; a completed run stays where it ended.
 */

const BASE = { w: 0.3, d: 0.25, h: 0.03 };
const UPRIGHT = { x: 0.08, w: 0.02, d: 0.03 };
const BRIDGE = { y: 0.42, h: 0.02 };
/** The glass tube on the axis: a 12 mm tube with smooth rims. */
export const TUBE = { r: 0.006, bore: 0.004, bottom: 0.42, top: 0.55 };
const COLLAR = { r: 0.012, y0: 0.405, y1: 0.435 };
/** The guard rail: two hoops on four posts, their feet inside the item's 0.45 m half-width. */
const GUARD = { r: 0.435, wire: 0.004, low: 0.3, high: 0.6, post: 0.005, foot: 0.012 };
const RULE = {
  from: 0.09,
  to: GUARD.r + GUARD.post,
  y: GUARD.low + GUARD.wire,
  w: 0.025,
  t: 0.0008,
};
const FLAG = { x0: GUARD.r - 0.06, x1: GUARD.r - GUARD.post, y0: 0.56, y1: 0.6 };
const WATCH = { x: 0.1, z: 0.08, w: 0.06, d: 0.075, h: 0.018 };
const WATCH_TOP = BASE.h + WATCH.h;
/** A rubber bung of about 40 g (r 15–19 mm, 36 mm tall); the dialled m scales it by ∛(m/0.04). */
export const BUNG = { r0: 0.015, r1: 0.019, h: 0.036, mass: 0.04 };
/** The 50 g mass hanger: its hook's top is its origin, its plate `length` below. */
export const HANGER = {
  hook: 0.008,
  rod: 0.002,
  length: 0.1,
  plate: 0.02,
  plateH: 0.004,
  mass: 0.05,
};
/** Slotted 50 g brass discs on the hanger, up to the 0.4 kg the dial allows. */
export const DISC = { r: 0.02, h: 0.005, mass: 0.05, max: 7 };
/** The string below the marker clip to the hanger's hook (fixed: the clip rides with the string). */
export const BELOW_CLIP = 0.12;
/** The clip while a run exists: just below the tube's lower end. */
export const CLIP_RUNNING = TUBE.bottom - 0.01;
/** The hanger's hook when it stands on the base. */
export const STANDING_HOOK = BASE.h + HANGER.length;
const STRING_R = 0.0006;
const UP = new THREE.Vector3(0, 1, 0);

const DASH = 0x40;
const SLOTS = 8; // a digit's seven segments and its decimal point

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

type G = THREE.BufferGeometry;
type Piece = readonly [geometry: G, color?: string];

/** Pieces merged into one geometry (one draw), each in its vertex colour if it has one. */
function merge(pieces: readonly Piece[]): G {
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

/** A solid of revolution about +y through (r, y). */
const lathe = (profile: readonly (readonly [number, number])[], segments = 24) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The painted castings: base, uprights, the bridge in two halves either side of the collar. */
function bodyPieces(): Piece[] {
  const pieces: Piece[] = [[slab(BASE.w, BASE.d, BASE.h, 0.012, 0.003)]];
  for (const s of [-1, 1]) {
    pieces.push([
      box(UPRIGHT.w, BRIDGE.y - BASE.h, UPRIGHT.d, s * UPRIGHT.x, (BRIDGE.y + BASE.h) / 2, 0),
    ]);
    const inner = COLLAR.r;
    const outer = UPRIGHT.x + UPRIGHT.w / 2;
    pieces.push([box(outer - inner, BRIDGE.h, UPRIGHT.d, (s * (inner + outer)) / 2, BRIDGE.y, 0)]);
  }
  return pieces;
}

/** Steel: the collar, the guard's hoops, posts and feet, the rule and its bracket. */
function steelPieces(): Piece[] {
  const pieces: Piece[] = [
    [
      lathe([
        [TUBE.r + 0.0005, COLLAR.y0],
        [COLLAR.r, COLLAR.y0],
        [COLLAR.r, COLLAR.y1],
        [TUBE.r + 0.0005, COLLAR.y1],
      ]),
    ],
  ];
  for (const y of [GUARD.low, GUARD.high]) {
    pieces.push([
      new THREE.TorusGeometry(GUARD.r, GUARD.wire, 8, 96).rotateX(Math.PI / 2).translate(0, y, 0),
    ]);
  }
  for (const [x, z] of [
    [GUARD.r, 0],
    [-GUARD.r, 0],
    [0, GUARD.r],
    [0, -GUARD.r],
  ] as const) {
    pieces.push([drum(GUARD.post, GUARD.post, 0, GUARD.high, 10).translate(x, 0, z)]);
    pieces.push([drum(GUARD.foot, GUARD.foot - 0.003, 0, 0.006, 16).translate(x, 0, z)]);
  }
  const mid = (RULE.from + RULE.to) / 2;
  pieces.push([box(RULE.to - RULE.from, RULE.t, RULE.w, mid, RULE.y + RULE.t / 2, 0)]);
  pieces.push([box(0.02, 0.004, RULE.w, UPRIGHT.x + UPRIGHT.w / 2 + 0.01, RULE.y - 0.002, 0)]);
  return pieces;
}

/** Plastic, by vertex colour: the start flag, the stopwatch's case and keys, the rule's marks. */
function plasticPieces(): Piece[] {
  const dark = '#2b2f36';
  const pieces: Piece[] = [
    [
      box(
        FLAG.x1 - FLAG.x0,
        FLAG.y1 - FLAG.y0,
        0.002,
        (FLAG.x0 + FLAG.x1) / 2,
        (FLAG.y0 + FLAG.y1) / 2,
        0,
      ),
      '#d0312d',
    ],
    [slab(WATCH.w, WATCH.d, WATCH.h, 0.008, 0.002).translate(WATCH.x, BASE.h, WATCH.z), dark],
  ];
  for (const s of [-1, 1]) {
    pieces.push([
      box(0.012, 0.003, 0.008, WATCH.x + s * 0.016, WATCH_TOP + 0.0015, WATCH.z + 0.028),
      '#5a626b',
    ]);
  }
  // The rule's marks every centimetre from the axis (longer every 5 and 10 cm): it reads r.
  for (let cm = 10; cm <= 44; cm++) {
    const long = cm % 10 === 0 ? 0.012 : cm % 5 === 0 ? 0.008 : 0.005;
    pieces.push([
      box(0.0005, 0.0002, long, cm / 100, RULE.y + RULE.t + 0.0001, -RULE.w / 2 + long / 2),
      dark,
    ]);
  }
  return pieces;
}

/**
 * The fixed parts: the castings (the entity's mesh) and, merged by material, the steel, the
 * plastics, the glass tube (see-through: the string inside shows) and the stopwatch's panel.
 */
function frame(item: ItemDefinition): BenchFrame {
  const [, h] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.y = -h / 2; // the parts are laid out from the base
  const body = keep(merge(bodyPieces()));
  body.translate(0, -h / 2, 0);

  const part = (name: string, pieces: Piece[], material: THREE.Material, casts = true) => {
    const m = mesh(keep(merge(pieces)), material);
    m.name = name;
    m.castShadow = casts;
    return m;
  };
  part(
    'metal',
    steelPieces(),
    own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal })),
  );
  part(
    'plastic',
    plasticPieces(),
    own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, ...LOOKS.plastic })),
    false,
  );
  const tube = lathe([
    [TUBE.bore, TUBE.bottom + 0.001],
    [TUBE.r - 0.001, TUBE.bottom],
    [TUBE.r, TUBE.bottom + 0.001],
    [TUBE.r, TUBE.top - 0.001],
    [TUBE.r - 0.001, TUBE.top],
    [TUBE.bore, TUBE.top - 0.001],
    [TUBE.bore, TUBE.bottom + 0.001],
  ]);
  part(
    'glass',
    [[tube]],
    own(
      new THREE.MeshStandardMaterial({
        color: '#e4f1f6',
        ...GLASSWARE_LOOK,
        opacity: 0.3,
        depthWrite: false,
      }),
    ),
    false,
  ).renderOrder = 2; // after the string inside it
  part(
    'backlit',
    [
      [
        new THREE.PlaneGeometry(0.044, 0.028)
          .rotateX(-Math.PI / 2)
          .translate(WATCH.x, WATCH_TOP + 0.0004, WATCH.z - 0.01),
      ],
    ],
    own(new THREE.MeshBasicMaterial({ color: '#b7c6a2' })), // reads at any light
    false,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** A 7-segment readout: `places` transforms, each a digit `size` drawn on its face, one draw. */
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
  places: readonly (readonly [frame: THREE.Matrix4, size: { w: number; h: number; s: number }])[],
): Readout {
  const t = 0.0002;
  const on = places.flatMap(([place, { w, h, s }]) => {
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
    return layout.map(([u, vv, flat]) => {
      const [sx, sy] = flat === null ? [s, s] : flat ? [w - s, s] : [s, h / 2 - s];
      return place
        .clone()
        .multiply(new THREE.Matrix4().makeScale(sx, sy, t).setPosition(u, vv, t / 2));
    });
  });
  const off = on.map((m) => new THREE.Matrix4().makeScale(0, 0, 0).copyPosition(m));
  const mesh = kit.copies(kit.keep(new THREE.BoxGeometry(1, 1, 1)), material, [...on], parent);
  mesh.computeBoundingSphere(); // once, every segment lit: culling stays right whatever it shows
  off.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = 'stopwatch-digits';
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
 * Shows `n` (an integer ≥ 0; NaN: blank) with `point` decimals, right-aligned in `count` places
 * from `first`; dashes when it does not fit. Returns whether anything changed.
 */
function number(r: Readout, first: number, count: number, n: number, point: number): boolean {
  const fits = n >= 0 && n < 10 ** count && point < count;
  let changed = false;
  for (let i = 0; i < count; i++) {
    const power = 10 ** (count - 1 - i);
    const units = i === count - 1 - point;
    const digit = Math.floor(n / power) % 10;
    const lead = i < count - 1 - point && Math.floor(n / power) === 0;
    const bits = Number.isNaN(n)
      ? 0
      : !fits
        ? DASH
        : (lead ? 0 : (SEGMENTS[digit] ?? 0)) | (units && point > 0 ? 0x80 : 0);
    changed = light(r, first + i, bits) || changed;
  }
  return changed;
}

/**
 * The bung, the string, the clip, the hanger and its discs and the stopwatch's digits; `pose`
 * places and lights them from the station, allocating nothing and rewriting a buffer only when
 * what it shows changes.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  // Its parts are laid out from the base centre, as the frame's.
  const base = new THREE.Group();
  const [tx, ty, tz] = item.bench?.top ?? [0, 0, 0];
  base.position.set(-tx, -ty, -tz);
  kit.group.add(base);
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c3c9cf', ...LOOKS.metal }));

  // The bung: a frustum along +y, its narrow end at −y (towards the tube), centred on its string.
  const { r0, r1, h } = BUNG;
  const bung = mesh(
    keep(
      lathe(
        [
          [0, -h / 2],
          [r0, -h / 2],
          [r1, h / 2],
          [0, h / 2],
        ],
        20,
      ),
    ),
    own(new THREE.MeshStandardMaterial({ color: '#8a4a3a', ...LOOKS.rubber })),
    base,
  );
  bung.name = 'bung';

  // The string: two pieces of one unit line along +y (0: tube top down to the hook; 1: tube top
  // to the bung, drawn only while a run exists).
  const strings = copies(
    keep(new THREE.CylinderGeometry(STRING_R, STRING_R, 1, 5).translate(0, 0.5, 0)),
    own(new THREE.MeshStandardMaterial({ color: '#f1eee4', ...LOOKS.matte })),
    [new THREE.Matrix4(), new THREE.Matrix4()],
    base,
  );
  strings.name = 'string';
  strings.castShadow = false;
  strings.frustumCulled = false; // it moves: its bounds would go stale

  // The marker clip: a loop of wire round the string.
  const clip = mesh(
    keep(new THREE.TorusGeometry(0.004, 0.0007, 6, 12).scale(1, 2.5, 1)),
    steel,
    base,
  );
  clip.name = 'clip';
  clip.castShadow = false;

  // The hanger: hook, rod and plate, its hook's top at its origin.
  const { hook, rod: rr, length, plate, plateH } = HANGER;
  const hanger = mesh(
    keep(
      merge([
        [new THREE.TorusGeometry(hook, rr, 6, 12, Math.PI).translate(0, -hook, 0)],
        [rod(rr, v(hook, -hook, 0), v(hook, -length + plateH, 0), 8)],
        [drum(plate, plate, -length, -length + plateH, 24).translate(hook, 0, 0)],
      ]),
    ),
    steel,
    base,
  );
  hanger.name = 'hanger';
  hanger.castShadow = false;
  const discs = copies(
    keep(drum(DISC.r, DISC.r, -DISC.h / 2, DISC.h / 2, 24)),
    own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal })),
    Array.from({ length: DISC.max }, () => new THREE.Matrix4()),
    base,
  );
  discs.name = 'discs';
  discs.castShadow = false;
  discs.frustumCulled = false;
  discs.count = 0;

  // The stopwatch's digits on its panel, facing up: the lap counter (2 places) at the back right,
  // the time (4 places) below it.
  const face = (x: number, z: number) => at(x, WATCH_TOP + 0.0006, z, -Math.PI / 2);
  const time = { w: 0.0055, h: 0.0095, s: 0.0012 };
  const laps = { w: 0.0035, h: 0.006, s: 0.0008 };
  const digits = readout(kit, base, own(new THREE.MeshBasicMaterial({ color: '#1d2731' })), [
    [face(WATCH.x + 0.008, WATCH.z - 0.019), laps],
    [face(WATCH.x + 0.014, WATCH.z - 0.019), laps],
    ...[0, 1, 2, 3].map((i): [THREE.Matrix4, typeof time] => [
      face(WATCH.x + (i - 1.5) * 0.0095, WATCH.z - 0.005),
      time,
    ]),
  ]);

  // What is drawn now: pose skips what has not changed.
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let hookY = NaN;
  let stacked = -1;
  let resolution = NaN;
  let point = 0;
  let unit = 1; // the shown integer per step of d
  const pose = ({ status, parameters, sample }: BenchPose) => {
    const x = sample.x ?? NaN;
    const z = sample.z ?? NaN;
    const drop = sample.drop ?? NaN;
    const exists = status === 'running' || status === 'stopped' || status === 'completed';
    const run = exists && Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(drop);
    const L = parameters.length ?? NaN;
    const big = parameters.hangingMass ?? NaN;
    const small = parameters.bungMass ?? NaN;
    const d = parameters.stopwatchResolution ?? NaN;

    const k = small > 0 ? Math.cbrt(small / BUNG.mass) : 1;
    bung.scale.set(k, k, k);
    if (run) {
      bung.position.set(x, TUBE.top - drop, z);
      dir.set(x, -drop, z);
      const along = dir.length();
      dir.divideScalar(along > 0 ? along : 1);
      q.setFromUnitVectors(UP, dir);
      bung.quaternion.copy(q);
      pos.set(0, TUBE.top, 0);
      scale.set(1, along, 1);
      strings.setMatrixAt(1, m.compose(pos, q, scale));
    } else {
      bung.position.set(0, TUBE.top + (k * h) / 2, 0);
      bung.quaternion.identity();
    }
    strings.count = run ? 2 : 1;

    // The clip L from the tube top along the string; the hanger BELOW_CLIP under it, or standing
    // on the base where the string would be slack.
    const clipY = run ? CLIP_RUNNING : TUBE.top - L;
    clip.visible = Number.isFinite(clipY);
    clip.position.y = clip.visible ? clipY : 0;
    const hang = clip.visible ? Math.max(clipY - BELOW_CLIP, STANDING_HOOK) : STANDING_HOOK;
    const n =
      big > HANGER.mass ? Math.min(DISC.max, Math.round((big - HANGER.mass) / DISC.mass)) : 0;
    const moved = hang !== hookY || n !== stacked;
    if (moved) {
      hookY = hang;
      stacked = n;
      hanger.position.y = hang;
      pos.set(hook, hang - length + plateH + DISC.h / 2, 0);
      for (let i = 0; i < n; i++) {
        discs.setMatrixAt(i, m.makeTranslation(pos.x, pos.y + i * DISC.h, 0));
      }
      discs.count = n;
      discs.instanceMatrix.needsUpdate = true;
      pos.set(0, hang, 0);
      scale.set(1, TUBE.top - hang, 1);
      strings.setMatrixAt(0, m.compose(pos, q.identity(), scale));
    }
    if (run || moved) strings.instanceMatrix.needsUpdate = true;

    // The stopwatch: t to d (the nearest step, as quantize reads it, in d's places), laps counted.
    if (!Object.is(d, resolution)) {
      resolution = d;
      point = d > 0 && Number.isFinite(d) ? decimals(d) : 0;
      unit = Math.round(d * 10 ** point);
    }
    const t = run ? (sample.stopwatch ?? NaN) : 0;
    const shown =
      d > 0 && Number.isFinite(d) && t >= 0 ? Math.floor(t / d + 0.5 + 1e-9) * unit : NaN;
    const turns = run ? (sample.turnsCounted ?? NaN) : 0;
    const lapsChanged = number(digits, 0, 2, Number.isFinite(turns) ? Math.round(turns) : NaN, 0);
    if (number(digits, 2, 4, shown, point) || lapsChanged) {
      digits.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  pose({ status: 'idle', parameters: {}, sample: {} }); // until its session exists
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const whirlingApparatus: BenchModel = {
  frame,
  rig,
  reads: ['x', 'z', 'drop', 'stopwatch', 'turnsCounted'],
};
