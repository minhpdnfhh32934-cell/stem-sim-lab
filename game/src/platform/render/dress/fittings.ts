import type * as THREE from 'three';
import type { Opening, RoomDefinition, RoomStyle } from '../../../world/definitions';
import { box, drum } from '../props/parts';
import {
  type DressPart,
  footprint,
  moduleEdges,
  onWall,
  type Patch,
  Pieces,
  type SizeOf,
  wallFrames,
  WallPlan,
} from './frame';

// Ultra's fittings (Phase G, contract §4.4): what a real building has on its walls and ceilings and
// a model rarely shows — double sockets, an exit sign over each doorway, a fire alarm call point
// beside it, smoke detectors on the ceiling. Drawn under Ultra only, never under High or below;
// decoration only (no collider, nothing to touch). Each keeps clear of the openings, of what stands
// at the wall and of the room style's own features, or is left out.

/** Where a style's wall face is (its cladding's front, m) and where its sockets go (m up). */
interface StyleFit {
  readonly face: number;
  /** The sockets' height on a free wall; null: none (the style has its own things there). */
  readonly socket: number | null;
  /** The highest a sign over a doorway may reach (m above the floor; from the ceiling if < 0). */
  readonly signTop: number;
  /** How far a sign stands off the wall (m): in front of a ledge or trim it would cross. */
  readonly signFace: number;
  /** Smoke detectors on its ceiling (not under glazing). */
  readonly detectors: boolean;
}

const FIT: Record<RoomStyle, StyleFit> = {
  plain: { face: 0, socket: 0.3, signTop: -0.05, signFace: 0, detectors: true },
  // On the hull panels (0.012 m), in the lower row; a sign over a 2.6 m doorway crosses the steel
  // ledge (2.64–2.7 m, 0.035 m out), so it stands in front of it, under the cornice.
  'starship-deck': { face: 0.014, socket: 0.72, signTop: 4.4, signFace: 0.04, detectors: true },
  // On the rounded lower panels (0.013 m); signs under the service pipes (3.0 m).
  'orbital-module': { face: 0.014, socket: 0.65, signTop: 2.85, signFace: 0.014, detectors: true },
  // Boards to a beam at 2.42 m, planters at their foot, a glazed ceiling: signs and call points only.
  greenhouse: { face: 0.014, socket: null, signTop: 2.4, signFace: 0.014, detectors: false },
};

/** A double socket's plate (m): width, height. */
const SOCKET = [0.146, 0.086] as const;
/** Sockets along a free wall: one every this many metres at most. */
const SOCKET_STEP = 2.4;
/** The exit sign's box (m) and the gap over its doorway. */
const SIGN = [0.36, 0.15, 0.04] as const;
const SIGN_GAP = 0.08;
/** The call point's height (m, its centre) and its side. */
const CALL_Y = 1.4;
const CALL = 0.09;
/** Smoke detectors: at most this far apart (m), and kept this far from the walls. */
const DETECTOR_STEP = 6;
const DETECTOR_R = 0.055;

/**
 * A room's Ultra fittings, one merged geometry per finish, in world coordinates. `scene`: the rooms
 * drawn with it — a doorway into one of them with no other way out (a washroom, a store) gets no
 * exit sign.
 */
export function fittings(
  room: RoomDefinition,
  sizeOf: SizeOf,
  scene: readonly RoomDefinition[] = [],
): DressPart[] {
  const fit = FIT[room.style];
  const out = new Pieces();
  const h = room.bounds.max[1] - room.bounds.min[1];
  const signTop = fit.signTop < 0 ? h + fit.signTop : fit.signTop;
  for (const frame of wallFrames(room)) {
    const plan = new WallPlan(room, frame, sizeOf);
    const free = (p: Patch) => !plan.occupants.some((o) => overlaps(o, p));
    // Sockets at the middle of the wall's modules (clear of a style's ribs and seams), where the
    // wall is free; over a bench or cabinet against the wall instead, a hand above its top.
    if (fit.socket !== null) {
      const edges = moduleEdges(frame.span);
      let last = -Infinity;
      for (let k = 0; k + 1 < edges.length; k++) {
        const a = ((edges[k] ?? 0) + (edges[k + 1] ?? 0)) / 2;
        if (a - last < SOCKET_STEP - 1e-6) continue;
        const counter = room.style === 'plain' ? plan.topOf(a - 0.1, a + 0.1, 1.2) : 0;
        const y = counter > 0.6 ? counter + 0.15 : fit.socket;
        const patch = {
          a0: a - SOCKET[0] / 2,
          a1: a + SOCKET[0] / 2,
          y0: y - SOCKET[1] / 2,
          y1: y + SOCKET[1] / 2,
        };
        if (!plan.clear(patch, 0.3, 0.3)) continue;
        socket(out, onWall(frame, a, y, fit.face));
        last = a;
      }
    }
    for (const o of room.openings.filter((o) => o.wall === frame.wall)) {
      const [o0, o1] = [o.center - o.width / 2, o.center + o.width / 2];
      // The sign over the doorway, over its door's frame (a name plate higher up is not the frame).
      const y0 = Math.max(o.height, plan.topOf(o0, o1, o.height + 0.4)) + SIGN_GAP;
      const sign = { a0: o.center - SIGN[0] / 2, a1: o.center + SIGN[0] / 2, y0, y1: y0 + SIGN[1] };
      if (sign.y1 <= signTop && free(sign) && !intoDeadEnd(room, o, scene)) {
        exitSign(out, onWall(frame, o.center, y0 + SIGN[1] / 2, fit.signFace));
      }
      // The call point beside it, on whichever side is free.
      for (const side of [1, -1]) {
        const a = side > 0 ? o1 + 0.25 : o0 - 0.25;
        const patch = { a0: a - 0.1, a1: a + 0.1, y0: CALL_Y - 0.1, y1: CALL_Y + 0.1 };
        if (a - 0.1 < frame.span[0] || a + 0.1 > frame.span[1]) continue;
        if (!free(patch) || plan.openings.some((p) => overlaps(p, patch))) continue;
        callPoint(out, onWall(frame, a, CALL_Y, fit.face));
        break;
      }
    }
  }
  if (fit.detectors) for (const [x, z] of detectorSpots(room, sizeOf)) detector(out, room, x, z);
  return out.parts();
}

/** Whether a doorway of `room` leads into a room of `scene` with no other doorway. */
function intoDeadEnd(room: RoomDefinition, o: Opening, scene: readonly RoomDefinition[]): boolean {
  const { min, max } = room.bounds;
  // A point half a metre across the wall (walls are 0.25 m thick), in the next room if there is one.
  const across = { north: [o.center, min[2] - 0.5], south: [o.center, max[2] + 0.5] };
  const [x, z] =
    o.wall === 'north' || o.wall === 'south'
      ? (across[o.wall] as [number, number])
      : [o.wall === 'west' ? min[0] - 0.5 : max[0] + 0.5, o.center];
  const next = scene.find(
    (r) =>
      r !== room &&
      x > r.bounds.min[0] &&
      x < r.bounds.max[0] &&
      z > r.bounds.min[2] &&
      z < r.bounds.max[2],
  );
  return next !== undefined && next.openings.length <= 1;
}

const overlaps = (p: Patch, q: Patch) => p.a0 < q.a1 && q.a0 < p.a1 && p.y0 < q.y1 && q.y0 < p.y1;

/** A double socket (modelled flat: x along the wall, y up, z out): plate, two faces, two rockers. */
function socket(out: Pieces, place: THREE.Matrix4) {
  const [w, h] = SOCKET;
  out.add('seat-white', box(w, h, 0.008, 0, 0, 0.004).applyMatrix4(place));
  for (const x of [-0.036, 0.036]) {
    out.add('seat-white', box(0.046, 0.046, 0.004, x, -0.006, 0.01).applyMatrix4(place));
    for (const dx of [-0.0095, 0.0095]) {
      out.add('trim', box(0.004, 0.009, 0.001, x + dx, -0.006, 0.0125).applyMatrix4(place));
    }
    out.add('trim', box(0.014, 0.008, 0.004, x, 0.031, 0.01).applyMatrix4(place));
  }
}

/** An exit sign: a slim aluminium box, a lit green face, a white doorway and an arrow to it. */
function exitSign(out: Pieces, place: THREE.Matrix4) {
  const [w, h, d] = SIGN;
  out.add('aluminium', box(w, h, d, 0, 0, d / 2).applyMatrix4(place));
  out.add('exit-green', box(w - 0.024, h - 0.024, 0.002, 0, 0, d + 0.001).applyMatrix4(place));
  const z = d + 0.0025;
  const white = (bw: number, bh: number, x: number, y: number, turn = 0) =>
    box(bw, bh, 0.001, 0, 0, 0).rotateZ(turn).translate(x, y, z).applyMatrix4(place);
  // The doorway: two jambs and a head, on the right.
  out.add('glow-cool', white(0.008, 0.09, 0.07, -0.005), white(0.008, 0.09, 0.124, -0.005));
  out.add('glow-cool', white(0.062, 0.008, 0.097, 0.04));
  // The arrow, pointing at it.
  out.add('glow-cool', white(0.11, 0.012, -0.06, 0));
  out.add('glow-cool', white(0.04, 0.012, -0.012, 0.012, -Math.PI / 4));
  out.add('glow-cool', white(0.04, 0.012, -0.012, -0.012, Math.PI / 4));
}

/** A fire alarm call point: a red box with its white break window. */
function callPoint(out: Pieces, place: THREE.Matrix4) {
  out.add('alarm-red', box(CALL, CALL, 0.05, 0, 0, 0.025).applyMatrix4(place));
  out.add('seat-white', box(0.052, 0.052, 0.003, 0, 0.004, 0.0515).applyMatrix4(place));
}

/** A smoke detector under the ceiling at (x, z): a base ring, its body, a dark sensor slot band. */
function detector(out: Pieces, room: RoomDefinition, x: number, z: number) {
  const top = room.bounds.max[1];
  const place = (g: THREE.BufferGeometry) => g.translate(x, top, z);
  out.add('seat-white', place(drum(DETECTOR_R + 0.008, DETECTOR_R + 0.008, -0.008, 0, 32)));
  out.add('seat-white', place(drum(DETECTOR_R - 0.01, DETECTOR_R, -0.04, -0.008, 32)));
  out.add('trim', place(drum(DETECTOR_R - 0.006, DETECTOR_R - 0.006, -0.03, -0.02, 32)));
}

/**
 * Where the smoke detectors go: a grid at most `DETECTOR_STEP` apart, each spot nudged off what
 * hangs from the ceiling (lights, diffusers, ducts) or dropped if it cannot be.
 */
export function detectorSpots(room: RoomDefinition, sizeOf: SizeOf): [number, number][] {
  const { min, max } = room.bounds;
  const [w, d] = [max[0] - min[0], max[2] - min[2]];
  if (w < 2 || d < 2) return [];
  const hanging = room.placements
    .map((p) => footprint(p, sizeOf))
    .filter((b): b is NonNullable<typeof b> => b !== null && b[4] > max[1] - 0.5);
  const clear = (x: number, z: number) =>
    x > min[0] + 0.6 &&
    x < max[0] - 0.6 &&
    z > min[2] + 0.6 &&
    z < max[2] - 0.6 &&
    !hanging.some(
      ([x0, , z0, x1, , z1]) => x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3,
    );
  const [nx, nz] = [Math.ceil(w / DETECTOR_STEP), Math.ceil(d / DETECTOR_STEP)];
  const spots: [number, number][] = [];
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const [x, z] = [min[0] + ((i + 0.5) * w) / nx, min[2] + ((k + 0.5) * d) / nz];
      const tries: [number, number][] = [
        [x, z],
        [x + 0.6, z],
        [x - 0.6, z],
        [x, z + 0.6],
        [x, z - 0.6],
        [x + 1.2, z],
        [x - 1.2, z],
      ];
      const spot = tries.find(([tx, tz]) => clear(tx, tz));
      if (spot) spots.push(spot);
    }
  }
  return spots;
}
