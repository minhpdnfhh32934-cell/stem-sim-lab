import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { EMBLEM } from '../../ui/emblemShape';
import { loft, slab } from '../assembly';
import { box, drum, part, type PropBuilder, rod, sphere } from './parts';

// The hub's architecture and furniture (docs: Z3 §3.3). Sizes come from the items; the details
// (frames, chamfers, capitals) are in metres, kept inside the box at the sizes the hub ships.

/** The column's and pilaster's orders: base and capital heights, × the width. */
const BASE = 0.32;
const CAPITAL = 1.3;

/**
 * A column (cylinder item): a round shaft (radius 0.4 × the diameter) on a stone base, under a
 * flared stone capital as wide as the box that carries the beams. The collider stays the box.
 */
const column: PropBuilder = ([w = 0, h = 0]) => {
  const [r, bottom, top] = [w / 2, -h / 2, h / 2];
  const [base, capital] = [bottom + BASE * w, top - CAPITAL * w];
  return [
    part('body', true, [drum(0.8 * r, 0.8 * r, base, capital, 32, true)]),
    part('stone', true, [
      drum(r, r, bottom, bottom + 0.2 * w),
      drum(0.92 * r, 0.8 * r, bottom + 0.2 * w, base),
      drum(0.8 * r, r, capital, top - 0.6 * w),
      drum(r, r, top - 0.6 * w, top),
    ]),
  ];
};

/** A pilaster, its back on the wall (−z): the column's order in flat blocks, carrying a beam end. */
const pilaster: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const [base, capital] = [bottom + BASE * w, top - CAPITAL * w];
  /** A block on the wall, `a` of the width and `b` of the depth, from y0 to y1. */
  const block = (a: number, b: number, y0: number, y1: number) =>
    box(a * w, y1 - y0, b * d, 0, (y0 + y1) / 2, (b * d - d) / 2);
  return [
    part('body', true, [block(0.8, 0.75, base, capital)]),
    part('stone', true, [
      block(1, 1, bottom, bottom + 0.2 * w),
      block(0.9, 0.9, bottom + 0.2 * w, base),
      block(0.9, 0.9, capital, top - 0.6 * w),
      block(1, 1, top - 0.6 * w, top),
    ]),
  ];
};

/** A beam along the longer of its horizontal sides, its two lower edges chamfered. */
const beam: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const a = Math.min(w, d) / 2;
  const c = Math.min(0.04, a / 2, h / 4);
  const [y0, y1, half] = [-h / 2, h / 2, Math.max(w, d) / 2];
  const section = () =>
    [
      [-a + c, y0],
      [a - c, y0],
      [a, y0 + c],
      [a, y1],
      [-a, y1],
      [-a, y0 + c],
    ].map(([x = 0, y = 0]) => new THREE.Vector2(x, y));
  const geometry = loft(section, [
    [0, -half],
    [0, half],
  ]); // along z
  if (w > d) geometry.rotateY(Math.PI / 2);
  return [part('body', true, [geometry])];
};

/**
 * A high window band, its back on the wall (−z): the sky (`outside-sky`, painted by the time of day)
 * in a frame of the item's colour — head, sill and a mullion every ≈ 1.5 m — standing out from the
 * pane by half the depth. On the wall, so no shadow.
 */
const clerestory: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const rail = Math.min(0.1, h / 8);
  const m = Math.min(0.08, w / 20);
  const bays = Math.max(1, Math.round(w / 1.5));
  const mullions = Array.from({ length: bays + 1 }, (_, i) =>
    box(m, h - 2 * rail, d, -w / 2 + m / 2 + ((w - m) * i) / bays, 0, 0),
  );
  return [
    part('outside-sky', false, [box(w - 2 * m, h - 2 * rail, d / 2, 0, 0, -d / 4)]),
    part('body', false, [
      box(w, rail, d, 0, (h - rail) / 2, 0),
      box(w, rail, d, 0, (rail - h) / 2, 0),
      ...mullions,
    ]),
  ];
};

/**
 * A round roof light (cylinder item, its top the ceiling): a glowing disc (radius 0.42 × the
 * diameter) recessed in a dark band, ringed by a dark rim.
 */
const oculus: PropBuilder = ([w = 0, h = 0]) => {
  const r = w / 2;
  const disc = 0.84 * r;
  const tube = Math.min(0.12, h / 2 - 0.005);
  const rim = r - tube - 0.01; // the rim's centre line
  const band = new THREE.RingGeometry(disc, rim, 72).rotateX(Math.PI / 2); // facing down
  return [
    part('body', false, [drum(disc, disc, h / 2 - 0.06, h / 2 - 0.02, 72)]),
    // No shadow: the hall's key light hangs under it.
    part('frame-dark', false, [
      new THREE.TorusGeometry(rim, tube, 8, 72)
        .rotateX(Math.PI / 2)
        .translate(0, h / 2 - tube - 0.005, 0),
      band.translate(0, h / 2 - 0.03, 0),
    ]),
  ];
};

/** A ceiling luminaire (its top on the ceiling): a glowing diffuser recessed in a slim steel frame. */
const lightPanel: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const f = Math.min(0.04, w / 10, d / 10);
  return [
    part('body', false, [box(w - 2 * f, 0.8 * h, d - 2 * f, 0, 0.1 * h, 0)]),
    part('steel', false, [
      box(w, h, f, 0, 0, (d - f) / 2),
      box(w, h, f, 0, 0, (f - d) / 2),
      box(f, h, d - 2 * f, (w - f) / 2, 0, 0),
      box(f, h, d - 2 * f, (f - w) / 2, 0, 0),
    ]),
  ];
};

/**
 * A light strip set in the floor (placed 6 mm down, its top 4 mm above the floor): a glowing
 * strip, its top 2 mm above the floor, in a steel frame round it.
 */
const pathLight: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const f = Math.min(0.02, w / 5, d / 5);
  return [
    part('body', false, [box(w - 2 * f, 0.8 * h, d - 2 * f, 0, -0.1 * h, 0)]),
    part('steel', false, [
      box(f, h, d, (w - f) / 2, 0, 0),
      box(f, h, d, (f - w) / 2, 0, 0),
      box(w - 2 * f, h, f, 0, 0, (d - f) / 2),
      box(w - 2 * f, h, f, 0, 0, (f - d) / 2),
    ]),
  ];
};

// The emblem (ui/emblemShape.ts) in the hall: its strokes in view-box units (y down), each drawn as
// a bar or a flat band, twice as thick as the menu's (a 6 m emblem is read across the hall).
const BOLD = 2;
const MID = EMBLEM.size / 2;

/** A straight stroke from (x0, y0) to (x1, y1), `width` across, in view-box units. */
export type Stroke = readonly [x0: number, y0: number, x1: number, y1: number, width: number];

/** The dial's ticks, where the menu's dashes fall: from 3 o'clock, clockwise as the SVG draws. */
function ticks(): Stroke[] {
  const { r, length, dash, gap } = EMBLEM.ticks;
  return Array.from({ length: Math.round((2 * Math.PI * r) / (dash + gap)) }, (_, k) => {
    const a = (dash / 2 + k * (dash + gap)) / r;
    const [x, y, inner, outer] = [Math.cos(a), Math.sin(a), r - length / 2, r + length / 2];
    return [MID + inner * x, MID + inner * y, MID + outer * x, MID + outer * y, dash] as const;
  });
}

/** The floor tape and its marks (stroke 1, the SVG default). */
const tape = (): Stroke[] => {
  const { y, from, to, width, marks } = EMBLEM.tape;
  return [
    [from, y, to, y, width],
    ...marks.map(([x, length]) => [x, y, x, y + length, 1] as const),
  ];
};

/**
 * The flight's dashes, on the curve: the menu's dash and gap (a dash with its round caps), spread
 * evenly over the curve's length and symmetric about its top, where the ball is.
 */
export function flightDashes(): Stroke[] {
  const { from, control, to, width, dash, gap } = EMBLEM.flight;
  const at = (t: number, k: 0 | 1) =>
    (1 - t) ** 2 * from[k] + 2 * t * (1 - t) * control[k] + t ** 2 * to[k];
  const steps = 1024;
  const run = [0]; // the length along the curve at t = i / steps
  for (let i = 1; i <= steps; i++) {
    const [t0, t1] = [(i - 1) / steps, i / steps];
    run.push((run[i - 1] ?? 0) + Math.hypot(at(t1, 0) - at(t0, 0), at(t1, 1) - at(t0, 1)));
  }
  const total = run[steps] ?? 0;
  const tAt = (length: number) => {
    let i = 1;
    while (i < steps && (run[i] ?? 0) < length) i++;
    const [a, b] = [run[i - 1] ?? 0, run[i] ?? 0];
    return (i - 1 + (length - a) / (b - a)) / steps;
  };
  const count = Math.round(total / (dash + gap));
  const period = total / count;
  const half = (((dash + width) / (dash + gap)) * period) / 2;
  return Array.from({ length: count }, (_, k) => {
    const [t0, t1] = [tAt((k + 0.5) * period - half), tAt((k + 0.5) * period + half)];
    return [at(t0, 0), at(t0, 1), at(t1, 0), at(t1, 1), width] as const;
  });
}

/**
 * The emblem in the air at the hall's centre (box item): two copies crossed on the vertical axis,
 * in the x–y and z–y planes, sharing the ball and the satellite — face-on from the four doors, an
 * armillary from the diagonals — hung on four steel cables from the box's top (the ceiling). Its
 * square stands on the box's bottom; the cables take the height above it. No part casts: the
 * hall's key light hangs inside it, under the oculus, and would throw its rings across the floor.
 */
const emblem: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const side = Math.min(w, d, h);
  const s = side / EMBLEM.size; // metres per unit
  const cy = side / 2 - h / 2; // the dial's centre
  const point = (x: number, y: number) => new THREE.Vector3((x - MID) * s, cy + (MID - y) * s, 0);
  const bar = ([x0, y0, x1, y1, width]: Stroke) =>
    rod((BOLD * width * s) / 2, point(x0, y0), point(x1, y1), 6);
  const ball3 = (x: number, y: number, r: number, segments?: number) => {
    const p = point(x, y);
    return sphere(r * s, p.x, p.y, p.z, segments);
  };
  const hoop = (r: number, width: number) =>
    new THREE.TorusGeometry(r * s, (BOLD * width * s) / 2, 8, 72).translate(0, cy, 0);
  const { inner, outer, strobes, ball, satellite } = EMBLEM;
  /** One face's pieces, and the same turned into the z–y plane. */
  const crossed = (pieces: THREE.BufferGeometry[]) => [
    ...pieces,
    ...pieces.map((g) => g.clone().rotateY(Math.PI / 2)),
  ];
  // Four cables from the outer ring, 45° either side of its top in both planes, to the ceiling.
  const reach = (outer.r * s) / Math.SQRT2;
  const cables = [
    [reach, 0],
    [-reach, 0],
    [0, reach],
    [0, -reach],
  ].map(([x = 0, z = 0]) =>
    rod(0.006, new THREE.Vector3(x, cy + reach, z), new THREE.Vector3(x, h / 2, z), 6),
  );
  return [
    part('body', false, crossed(ticks().map(bar))),
    part(
      'emblem-cyan',
      false,
      crossed([hoop(inner, 1), hoop(outer.r, outer.width), ...tape().map(bar)]),
    ),
    part('emblem-pale', false, [
      ...crossed([...flightDashes().map(bar), ...strobes.map(({ x, y, r }) => ball3(x, y, r))]),
      ball3(satellite.x, satellite.y, BOLD * satellite.r),
    ]),
    part('emblem-warm', false, [ball3(ball.x, ball.y, ball.r, 24)]),
    part('emblem-glow', false, [ball3(ball.x, ball.y, ball.glow, 24)]),
    part('steel', false, cables),
  ];
};

/**
 * The emblem laid in the floor (box item, placed 6 mm down, its top 4 mm above the floor): a disc
 * with the dial, tape and flight inlaid, upright seen from the entrance (+z: the view box's down).
 * Each colour lies a little above the one before it, in the menu's order, none in the same plane.
 */
const emblemFloor: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const r = Math.min(w, d) / 2;
  const s = r / MID;
  const level = (k: number) => h / 2 - k * h; // cyan, pale and warm at 0.1, 0.05 and 0 below the top
  /** A shape in the x–y plane (facing +z), laid flat facing up at its level, at view-box (x, y). */
  const lay = (g: THREE.BufferGeometry, k: number, x = MID, y = MID) =>
    g.rotateX(-Math.PI / 2).translate((x - MID) * s, level(k), (y - MID) * s);
  const band = ([x0, y0, x1, y1, width]: Stroke, k: number) =>
    lay(new THREE.PlaneGeometry(Math.hypot(x1 - x0, y1 - y0) * s, BOLD * width * s), k)
      .rotateY(-Math.atan2(y1 - y0, x1 - x0))
      .translate(((x0 + x1) / 2 - MID) * s, 0, ((y0 + y1) / 2 - MID) * s);
  const ring = (radius: number, width: number) => {
    const half = (BOLD * width) / 2;
    return lay(new THREE.RingGeometry((radius - half) * s, (radius + half) * s, 128), 0.1);
  };
  const { inner, outer, strobes, ball } = EMBLEM;
  return [
    part('body', false, [drum(0.98 * r, 0.98 * r, -h / 2, h / 2 - 0.25 * h, 96)]),
    part('inlay-cyan', false, [
      ring(inner, 1),
      ring(outer.r, outer.width),
      ...[...ticks(), ...tape()].map((stroke) => band(stroke, 0.1)),
    ]),
    part('inlay-pale', false, [
      ...flightDashes().map((stroke) => band(stroke, 0.05)),
      ...strobes.map(({ x, y, r: radius }) =>
        lay(new THREE.CircleGeometry(radius * s, 24), 0.05, x, y),
      ),
    ]),
    part('inlay-warm', false, [lay(new THREE.CircleGeometry(ball.r * s, 32), 0, ball.x, ball.y)]),
  ];
};

/** The doorway class every hub door is framed for: a 1.0 × 2.1 m leaf fits with its frame. */
const OPENING = { w: 1.2, h: 2.3 };

/**
 * A door's portal on the hub's side of its wall (its back on the wall): two jambs and a head,
 * leaving the doorway free at the bottom centre; a cool lit strip on the head's front, which is
 * set back from the jambs.
 */
const doorPortal: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [ow, oh] = [Math.min(OPENING.w, w - 0.2), Math.min(OPENING.h, h - 0.2)];
  const jamb = (w - ow) / 2;
  const head = oh - h / 2; // its underside, the doorway's top
  const recess = Math.min(0.02, d / 4);
  return [
    part('body', true, [
      box(jamb, h, d, -(ow + jamb) / 2, 0, 0),
      box(jamb, h, d, (ow + jamb) / 2, 0, 0),
      box(ow, h / 2 - head, d - recess, 0, (head + h / 2) / 2, -recess / 2),
    ]),
    part('glow-cool', false, [
      box(ow - 0.1, 0.05, recess / 2, 0, head + 0.08, (d - 1.5 * recess) / 2),
    ]),
  ];
};

/**
 * The reception desk (its front +z): a raised counter — a 5 cm white top with a steel nosing,
 * overhanging the front by 3 cm — over a lower white desk on the staff side (−z). The front is
 * three panels with dark seams between them (the logo plate is its own sign, on the middle one),
 * on a dark toe-kick plinth set back 5 cm under the front and sides.
 */
const receptionDesk: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, front] = [-h / 2, h / 2, d / 2];
  const t = 0.04; // panels and the staff desk's top
  const [counter, nose, over] = [0.05, 0.012, 0.03]; // the counter's thickness, nosing, overhang
  const [kick, recess, seam] = [0.1, 0.05, 0.01]; // the plinth's height and set-back; seam width
  const ledge = Math.min(0.32, d / 2); // the counter's depth
  const desk = bottom + Math.min(0.75, h - 0.25); // the staff desk's top
  const deskDepth = d - ledge - t;
  const face = front - over; // the front panels' face
  const tall = top - counter - bottom - kick; // the panels' height, from the plinth to the counter
  const mid = bottom + kick + tall / 2;
  const third = (w - 2 * seam) / 3;
  const side = (x: number) => box(t, tall, d - over - t, x, mid, (-over - t) / 2);
  return [
    part('body', true, [
      ...[-1, 0, 1].map((i) => box(third, tall, t, i * (third + seam), mid, face - t / 2)),
      side((t - w) / 2),
      side((w - t) / 2),
      box(w - 2 * t, top - counter - desk, t, 0, (desk + top - counter) / 2, front - ledge - t / 2),
    ]),
    part('worktop-white', true, [
      box(w, counter, ledge - nose, 0, top - counter / 2, front - nose - (ledge - nose) / 2),
      box(w - 2 * t, t, deskDepth, 0, desk - t / 2, (deskDepth - d) / 2),
    ]),
    part('steel', true, [box(w, counter, nose, 0, top - counter / 2, front - nose / 2)]),
    part('trim', true, [
      box(w - 2 * recess, kick, d - over - 2 * recess, 0, bottom + kick / 2, (face - d / 2) / 2),
      box(w - 2 * t, tall, 0.005, 0, mid, face - t - 0.0025), // behind the seams
    ]),
  ];
};

/**
 * A bench along the longer of w and d: a seat of four wooden-look slats (the item's colour) on
 * two steel leg frames joined by a stretcher.
 */
const benchSeat: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [length, depth, bottom, top] = [Math.max(w, d), Math.min(w, d), -h / 2, h / 2];
  const [seat, gap, bar] = [0.05, 0.015, 0.04];
  const slat = (depth - 3 * gap) / 4;
  const legs = top - seat - bottom;
  const x = length / 2 - Math.min(0.25, length / 6); // the leg frames
  const frame = (fx: number) => [
    box(bar, legs, bar, fx, bottom + legs / 2, depth / 2 - bar),
    box(bar, legs, bar, fx, bottom + legs / 2, bar - depth / 2),
    box(bar, 0.03, depth - bar, fx, bottom + 0.015, 0),
    box(bar, bar, depth - bar, fx, top - seat - bar / 2, 0),
  ];
  const parts = [
    part(
      'body',
      true,
      [0, 1, 2, 3].map((i) =>
        slab(length, slat, seat, 0.01, 0.004).translate(
          0,
          top - seat,
          (slat - depth) / 2 + i * (slat + gap),
        ),
      ),
    ),
    part('steel', true, [...frame(-x), ...frame(x), box(2 * x, bar, bar, 0, bottom + legs / 2, 0)]),
  ];
  if (d > w) for (const { geometry } of parts) geometry.rotateY(Math.PI / 2);
  return parts;
};

/**
 * A planter (cylinder item): a tapered pot with a lip (the item's colour), and foliage of three
 * faceted crowns of different sizes, the highest just under the box's top.
 */
const planter: PropBuilder = ([w = 0, h = 0]) => {
  const [r, bottom, top] = [w / 2, -h / 2, h / 2];
  const pot = 0.42 * h;
  const lip = 0.08 * pot;
  // [x, z, radius] × r, and how far below the box's top each crown's top is, × h.
  const crowns = [
    [0.14, 0.1, 0.72, 0.02],
    [-0.34, -0.2, 0.56, 0.12],
    [0.2, -0.4, 0.52, 0.16],
  ];
  return [
    part('body', true, [
      drum(0.78 * r, 0.94 * r, bottom, bottom + pot - lip),
      drum(r, r, bottom + pot - lip, bottom + pot),
    ]),
    part(
      'foliage',
      true,
      crowns.map(([x = 0, z = 0, radius = 0, below = 0], i) =>
        new THREE.IcosahedronGeometry(radius * r, 1)
          .rotateY(i)
          .translate(x * r, top - below * h - radius * r, z * r),
      ),
    ),
  ];
};

/**
 * A pendant lamp hung from the ceiling (the box's top) by a steel cable from a ceiling cup: a wide
 * shade (the item's colour), glowing warm underneath.
 */
const pendant: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [r, bottom, top] = [Math.min(w, d) / 2, -h / 2, h / 2];
  const shade = Math.min(0.3, h / 4);
  const rim = bottom + 0.04;
  return [
    part('body', true, [drum(r, 0.3 * r, rim, rim + shade)]),
    part('glow-warm', false, [drum(0.94 * r, 0.94 * r, bottom, rim)]),
    part('steel', true, [
      rod(0.006, new THREE.Vector3(0, rim + shade, 0), new THREE.Vector3(0, top - 0.03, 0), 6),
      drum(0.08, 0.08, top - 0.03, top, 16),
    ]),
  ];
};

// UX2: the hub's floor field, wall finishes, department signage and displays, and lounge tables.

/**
 * A round tube of radius r along a polyline (closed: back to its first point), `sides` round:
 * each ring square to the line, its first side facing the board (+z). The line never runs along
 * z. (Instead of three's TubeGeometry, which brings the Curve family into the bundle.)
 */
export function sweep(points: readonly THREE.Vector3[], r: number, sides = 4, closed = false) {
  const n = points.length;
  const [ahead, across, up, out] = [0, 0, 0, 0].map(() => new THREE.Vector3()) as [
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
  ];
  const facing = new THREE.Vector3(0, 0, 1);
  const positions: number[] = [];
  const normals: number[] = [];
  points.forEach((p, i) => {
    const prev = points[closed ? (i + n - 1) % n : Math.max(0, i - 1)] ?? p;
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] ?? p;
    ahead.subVectors(next, prev).normalize();
    across.crossVectors(facing, ahead).normalize();
    up.crossVectors(ahead, across);
    for (let k = 0; k < sides; k++) {
      const a = (2 * Math.PI * k) / sides;
      out.copy(across).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
      positions.push(p.x + r * out.x, p.y + r * out.y, p.z + r * out.z);
      normals.push(out.x, out.y, out.z);
    }
  });
  const indices: number[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [a, b] = [i * sides, ((i + 1) % n) * sides];
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      indices.push(a + k, a + k1, b + k1, a + k, b + k1, b + k);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** The floor field's details (m): border band, tile size, joint width, the clear circle and ring. */
const FIELD = { border: 0.3, tile: 1.5, joint: 0.02, clear: 4.2, ring: 3.4 };

/**
 * The nave's floor (box item between the columns, placed 9 mm down, its top 1 mm above the floor,
 * under the path lights' glow): a border band on the column lines and a joint grid of ≈ 1.5 m
 * stone tiles (both the item's colour), left plain in a circle round the floor emblem; in that
 * circle a steel ring, and four cyan marks pointing at the four doors, as the path lights do.
 */
const floorField: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const y = h / 2;
  const flat = (sx: number, sz: number, x: number, z: number) =>
    new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2).translate(x, y, z);
  const b = Math.min(FIELD.border, w / 8, d / 8);
  const [iw, id] = [w - 2 * b, d - 2 * b];
  const clear = Math.min(FIELD.clear, iw / 2, id / 2);
  const ring = Math.min(FIELD.ring, clear - 0.5);
  /** A joint at c across the field, from −half to half along it, cut round the clear circle. */
  const joint = (c: number, half: number, alongX: boolean) => {
    const gap = Math.abs(c) < clear ? Math.sqrt(clear * clear - c * c) : 0;
    const spans =
      gap > 0 ? [[-half, -gap] as const, [gap, half] as const] : [[-half, half] as const];
    return spans
      .filter(([a, z]) => z - a > 1e-3)
      .map(([a, z]) =>
        alongX
          ? flat(z - a, FIELD.joint, (a + z) / 2, c)
          : flat(FIELD.joint, z - a, c, (a + z) / 2),
      );
  };
  const [nx, nz] = [iw, id].map((v) => Math.max(1, Math.round(v / FIELD.tile))) as [number, number];
  const joints = [
    ...Array.from({ length: nx - 1 }, (_, k) =>
      joint(-iw / 2 + ((k + 1) * iw) / nx, id / 2, false),
    ),
    ...Array.from({ length: nz - 1 }, (_, k) => joint(-id / 2 + ((k + 1) * id) / nz, iw / 2, true)),
  ].flat();
  const mark = (clear - 0.1 - (ring + 0.1)) / 2; // half a mark's length
  const at = ring + 0.1 + mark; // its centre's distance from the centre
  return [
    part('body', false, [
      flat(w, b, 0, (d - b) / 2),
      flat(w, b, 0, (b - d) / 2),
      flat(b, id, (w - b) / 2, 0),
      flat(b, id, (b - w) / 2, 0),
      ...joints,
    ]),
    part('steel', false, [
      new THREE.RingGeometry(ring - 0.03, ring + 0.03, 96).rotateX(-Math.PI / 2).translate(0, y, 0),
    ]),
    part('inlay-cyan', false, [
      flat(2 * mark, 0.06, at, 0),
      flat(2 * mark, 0.06, -at, 0),
      flat(0.06, 2 * mark, 0, at),
      flat(0.06, 2 * mark, 0, -at),
    ]),
  ];
};

/**
 * A wainscot along a wall (its back on the wall, −z): a dark painted skirting that takes the kicks
 * and the floor cleaner, panels ≈ 1.2 m wide with dark seams between them, and a stainless rail on
 * top at chair-back height. On the wall, so no shadow.
 */
const wainscot: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const [skirt, rail, seam] = [Math.min(0.12, h / 6), Math.min(0.04, h / 12), 0.012];
  const depth = 0.6 * d; // the panels', from the wall
  const n = Math.max(1, Math.round(w / 1.2));
  const [pw, ph] = [(w - (n - 1) * seam) / n, h - skirt - rail];
  const y = bottom + skirt + ph / 2;
  return [
    part(
      'body',
      false,
      Array.from({ length: n }, (_, i) =>
        box(pw, ph, depth, -w / 2 + pw / 2 + i * (pw + seam), y, back + depth / 2),
      ),
    ),
    part('frame-dark', false, [
      box(w, skirt, d, 0, bottom + skirt / 2, 0),
      box(w, ph, 0.004, 0, y, back + 0.002), // seen in the seams
    ]),
    part('steel', false, [box(w, rail, d, 0, top - rail / 2, 0)]),
  ];
};

/**
 * A department sign's mounting (its back on the wall, −z): a dark painted backplate fixed by four
 * steel bolts at its corners, over a band in the department's colour (the body: the item's
 * colour), and four steel stand-offs that hold the sign 3 cm off the plate, centred above the band.
 */
const signMount: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const plate = Math.min(0.04, 0.6 * d);
  const band = Math.min(0.1, h / 5);
  const [z, front] = [plate / 2 - d / 2, plate - d / 2];
  /** A round peg standing out of the plate at (x, y). */
  const peg = (x: number, y: number, r: number, length: number) =>
    drum(r, r, 0, length, 12)
      .rotateX(Math.PI / 2)
      .translate(x, y, front);
  const [bx, by] = [w / 2 - 0.07, (h - band) / 2 - 0.07]; // bolts, from the plate's centre
  const [sx, sy] = [w / 2 - 0.4, (h - band) / 4]; // stand-offs, behind the sign
  const corners = (x: number, y: number) =>
    [-1, 1].flatMap((i) => [-1, 1].map((j) => [i * x, band / 2 + j * y] as const));
  return [
    part('body', false, [box(w, band, plate, 0, (band - h) / 2, z)]),
    part('frame-dark', false, [box(w, h - band, plate, 0, band / 2, z)]),
    part('steel', false, [
      ...corners(bx, by).map(([x, y]) => peg(x, y, 0.02, 0.008)),
      ...corners(sx, sy).map(([x, y]) => peg(x, y, 0.015, d - plate)),
    ]),
  ];
};

/**
 * A display board on the wall (its back on the wall, −z): a panel in the item's colour in a slim
 * steel frame 1 cm proud of it; `front` is the panel's face (z), what the display stands on.
 */
function board(w: number, h: number, d: number) {
  const t = Math.min(0.03, d / 2);
  const f = Math.min(0.03, w / 20, h / 20);
  const [back, deep] = [-d / 2, t + 0.01];
  const z = back + deep / 2;
  return {
    panel: box(w - 2 * f, h - 2 * f, t, 0, 0, back + t / 2),
    frame: [
      box(w, f, deep, 0, (h - f) / 2, z),
      box(w, f, deep, 0, (f - h) / 2, z),
      box(f, h - 2 * f, deep, (w - f) / 2, 0, z),
      box(f, h - 2 * f, deep, (f - w) / 2, 0, z),
    ],
    front: back + t,
  };
}

type Cell = readonly [column: number, row: number];

/**
 * Where the 118 elements stand in the 18-column table, by block: [column, row], row 0 at the top;
 * the f block (lanthanum to lutetium, actinium to lawrencium) in rows 7.5 and 8.5 under the table,
 * from the column its gap leaves in rows 5 and 6. Helium is s-block, drawn over the noble gases.
 */
export function periodicCells(): Record<'s' | 'p' | 'd' | 'f', Cell[]> {
  const cells: Record<'s' | 'p' | 'd' | 'f', Cell[]> = {
    s: [
      [0, 0],
      [17, 0],
    ],
    p: [],
    d: [],
    f: [],
  };
  for (let row = 1; row < 7; row++) {
    cells.s.push([0, row], [1, row]);
    for (let c = 12; c < 18; c++) cells.p.push([c, row]);
    if (row >= 3) for (let c = row < 5 ? 2 : 3; c < 12; c++) cells.d.push([c, row]);
  }
  for (const row of [7.5, 8.5]) for (let c = 2; c < 17; c++) cells.f.push([c, row]);
  return cells;
}

/**
 * The periodic table on a display board (Chemistry's wall): a raised tile per element, coloured by
 * block — s warm, p cyan, d pale, f lavender — no symbols (a decor display, not a reference).
 */
const periodicTable: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { panel, frame, front } = board(w, h, d);
  const u = Math.min((w - 0.3) / 18, (h - 0.3) / 9.5);
  const [tile, relief] = [0.86 * u, Math.min(0.015, d / 2 - front)];
  const tiles = (cells: readonly Cell[]) =>
    cells.map(([c, r]) =>
      box(tile, tile, relief, (c - 8.5) * u, (4.25 - r) * u, front + relief / 2),
    );
  const blocks = periodicCells();
  return [
    part('body', false, [panel]),
    part('steel', false, frame),
    part('inlay-warm', false, tiles(blocks.s)),
    part('inlay-cyan', false, tiles(blocks.p)),
    part('inlay-pale', false, tiles(blocks.d)),
    part('tile-f', false, tiles(blocks.f)),
  ];
};

/**
 * The learning progress board (Phú, 2026-11-10): the display boards' frame round a dark screen;
 * what it shows is drawn over it by `render/progressBoard.ts` from the save.
 */
const progressBoard: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { panel, frame } = board(w, h, d);
  return [part('body', false, [panel]), part('steel', false, frame)];
};

/**
 * An atom on a display board, in relief: three steel elliptical orbits turned 60° apart, each with
 * its electron, round a nucleus of protons (warm) and neutrons (pale) — the textbook picture.
 */
const atomModel: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { panel, frame, front } = board(w, h, d);
  const room = d / 2 - front; // the depth in front of the panel
  const z = front + room / 2;
  const a = 0.42 * Math.min(w, h);
  const b = 0.34 * a;
  const on = (turn: number, t: number) => {
    const [x, y] = [a * Math.cos(t), b * Math.sin(t)];
    const [c, s] = [Math.cos(turn), Math.sin(turn)];
    return new THREE.Vector3(x * c - y * s, x * s + y * c, z);
  };
  const turns = [0, Math.PI / 3, (2 * Math.PI) / 3];
  const orbits = turns.map((turn) =>
    sweep(
      Array.from({ length: 40 }, (_, i) => on(turn, (2 * Math.PI * i) / 40)),
      Math.min(0.018, room / 4),
      4,
      true,
    ),
  );
  const e = Math.min(0.04, room / 2.5);
  const electrons = turns.map((turn, i) => {
    const p = on(turn, 0.6 + 2.1 * i);
    return sphere(e, p.x, p.y, p.z, 8);
  });
  const n = Math.min(0.055, room / 3.2);
  const nucleon = (k: number) =>
    sphere(
      n,
      1.1 * n * Math.cos((k * Math.PI) / 3),
      1.1 * n * Math.sin((k * Math.PI) / 3),
      z + (k % 2 ? n : -n) / 2,
      8,
    );
  return [
    part('body', false, [panel]),
    part('steel', true, [...frame, ...orbits]),
    part('inlay-warm', true, [sphere(n, 0, 0, z, 8), ...[0, 2, 4].map(nucleon)]),
    part('inlay-pale', true, [1, 3, 5].map(nucleon)),
    part('inlay-cyan', true, electrons),
  ];
};

/** Base pairs per helix turn (B-DNA has ≈ 10.5), and which half of each rung is warm. */
const PAIRS_PER_TURN = 10;
const PAIRING = [0, 1, 1, 0, 1, 0, 0, 1, 0, 1];

/**
 * DNA's double helix on a display board (Biology's wall), upright and in shallow relief: two cyan
 * backbones a half-turn apart, ≈ 0.9 m a turn, joined by base-pair rungs, each half warm or pale.
 */
const dnaHelix: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { panel, frame, front } = board(w, h, d);
  const room = d / 2 - front;
  const strand = Math.min(0.025, room / 6);
  const [R, deep, z, H] = [0.3 * w, room / 2 - strand, front + room / 2, h - 0.36];
  const turns = Math.max(1, Math.round(H / 0.9));
  const at = (t: number, phase: number) => {
    const a = 2 * Math.PI * turns * t + phase;
    return new THREE.Vector3(R * Math.cos(a), H * (t - 0.5), z + deep * Math.sin(a));
  };
  const steps = 32 * turns;
  const backbone = (phase: number) =>
    sweep(
      Array.from({ length: steps + 1 }, (_, i) => at(i / steps, phase)),
      strand,
    );
  const warm: THREE.BufferGeometry[] = [];
  const pale: THREE.BufferGeometry[] = [];
  const pairs = PAIRS_PER_TURN * turns;
  for (let k = 0; k < pairs; k++) {
    const t = (k + 0.5) / pairs;
    const [p, q] = [at(t, 0), at(t, Math.PI)];
    const m = p.clone().lerp(q, 0.5);
    const [first, second] = [rod(strand / 2, p, m, 4), rod(strand / 2, m, q, 4)];
    const flip = PAIRING[k % PAIRING.length] === 1;
    warm.push(flip ? second : first);
    pale.push(flip ? first : second);
  }
  return [
    part('body', false, [panel]),
    part('steel', true, frame),
    part('inlay-cyan', true, [backbone(0), backbone(Math.PI)]),
    part('inlay-warm', true, warm),
    part('inlay-pale', true, pale),
  ];
};

/**
 * A standing wave on a display board (Physics' wall): its two extreme shapes, ±A sin(kx) over two
 * wavelengths, in cyan and pale, on a steel axis, the five nodes marked warm.
 */
const standingWave: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { panel, frame, front } = board(w, h, d);
  const room = d / 2 - front;
  const z = front + room / 2;
  const [L, A, loops, steps] = [w - 0.4, 0.3 * h, 4, 64];
  const shape = (sign: number) =>
    sweep(
      Array.from(
        { length: steps + 1 },
        (_, i) =>
          new THREE.Vector3(
            L * (i / steps - 0.5),
            sign * A * Math.sin((Math.PI * loops * i) / steps),
            z,
          ),
      ),
      Math.min(0.016, room / 4),
    );
  const node = Math.min(0.035, room / 2.5);
  return [
    part('body', false, [panel]),
    part('steel', true, [...frame, box(L, 0.01, 0.01, 0, 0, z)]),
    part('inlay-cyan', true, [shape(1)]),
    part('inlay-pale', true, [shape(-1)]),
    part(
      'inlay-warm',
      true,
      Array.from({ length: loops + 1 }, (_, k) => sphere(node, L * (k / loops - 0.5), 0, z, 8)),
    ),
  ];
};

/**
 * A low lounge table: a 4 cm top with rounded, chamfered edges (the item's colour), on a steel
 * frame of four legs and rails, with a dark shelf low down for leaflets.
 */
const lowTable: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const [t, leg, inset] = [0.04, 0.035, 0.05];
  const [x, z, legs] = [w / 2 - inset, d / 2 - inset, h - t];
  const rail = top - t - 0.015;
  return [
    part('body', true, [slab(w, d, t, 0.03, 0.006).translate(0, top - t, 0)]),
    part('steel', true, [
      ...[-1, 1].flatMap((i) =>
        [-1, 1].map((j) => box(leg, legs, leg, i * x, bottom + legs / 2, j * z)),
      ),
      box(2 * x, 0.03, leg, 0, rail, z),
      box(2 * x, 0.03, leg, 0, rail, -z),
      box(leg, 0.03, 2 * z - leg, x, rail, 0),
      box(leg, 0.03, 2 * z - leg, -x, rail, 0),
    ]),
    part('frame-dark', true, [box(2 * x, 0.02, 2 * z, 0, bottom + 0.12, 0)]),
  ];
};

export const HUB_PROPS = {
  column,
  pilaster,
  beam,
  clerestory,
  oculus,
  'light-panel': lightPanel,
  emblem,
  'emblem-floor': emblemFloor,
  'door-portal': doorPortal,
  'reception-desk': receptionDesk,
  'bench-seat': benchSeat,
  planter,
  pendant,
  'path-light': pathLight,
  // UX2 lobby
  'floor-field': floorField,
  wainscot,
  'sign-mount': signMount,
  'periodic-table': periodicTable,
  'progress-board': progressBoard,
  'atom-model': atomModel,
  'dna-helix': dnaHelix,
  'standing-wave': standingWave,
  'low-table': lowTable,
} satisfies Partial<Record<Prop, PropBuilder>>;
