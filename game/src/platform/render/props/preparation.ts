import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { loft, type Outline, slab } from '../assembly';
import { sweep } from './hub';
import { box, drum, part, type PropBuilder, type PropPart, rod, sphere } from './parts';

// The preparation area's furniture and fittings (UX2): the changing room (PPE cabinet, bed, desk,
// chair, notice board) and the cleanroom corridor (lockers, gowning bench, PPE shelf, the
// hand-wash station and its dispensers, waste bin, wall rail, door casing, signs). Sizes come
// from the items; joinery and fittings are laid out in metres inside the box. Fronts face +z; what
// stands against a wall has its back at −z, except the wall fittings at the basin, whose items are
// set unturned on the corridor's west wall: their back is at −x (`onWestWall`). Decorative: the
// shelves' coats and glove boxes, the lockers' numbers and the notice board's sheets show nothing
// a simulation would have to back up.

type G = THREE.BufferGeometry;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** A slab with rounded corners and chamfered edges between two corners (its plan in x, z). */
const rounded = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  corner: number,
  bevel: number,
) =>
  slab(
    x1 - x0,
    z1 - z0,
    y1 - y0,
    corner,
    Math.min(bevel, (y1 - y0) / 3, (x1 - x0) / 4, (z1 - z0) / 4),
  ).translate((x0 + x1) / 2, y0, (z0 + z1) / 2);

/** The kick plinth under cabinets, set back from their sides and front. */
const PLINTH = 0.08;
const PLINTH_SET = 0.03;
/** Door fronts: their thickness, the gaps between them (a dark backing shows through). */
const FRONT = 0.018;
const GAP = 0.006;

/** A builder drawn with its back at −z, its parts turned so the back is at −x (the west wall). */
const onWestWall =
  (builder: PropBuilder): PropBuilder =>
  ([w = 0, h = 0, d = 0]) => {
    const parts = builder([d, h, w]);
    for (const { geometry } of parts) geometry.rotateY(Math.PI / 2);
    return parts;
  };

/**
 * The PPE cabinet (the wardrobe, its back at −z) in painted steel, the item's colour: a carcass
 * with a cornice, a recessed plinth and, inside, two shelves on the left (goggles, face shield) and
 * a round hanging rail on the right (the lab coat's hook); two full-height doors hinged at its
 * sides, each with a vertical steel bar handle by the seam and ventilation louvres top and bottom.
 * Only the doors move: each is a leaf that swings out about its hinge while the cabinet is open.
 */
const ppeCabinet: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const t = 0.018; // panels
  const handle = 0.028; // how far the handles stand off the doors
  const face = d / 2 - FRONT - handle; // the carcass's front
  const [y0, y1] = [bottom + PLINTH, top - 0.035]; // the doors' bottom and the cornice's underside
  // Where the PPE rests (rooms.json: a placement's y is its item's bottom; tied by a test): the
  // goggles on a shelf at 1.2 m, the face shield on one at 1.45 m, the coat's hook over a rail just
  // under the coat's top (1.75 m).
  const shelf = Math.min(bottom + 1.2, y1 - 0.3);
  const upper = Math.min(bottom + 1.45, y1 - 0.05);
  const rail = Math.min(bottom + 1.735, y1 - 0.05);
  const body: G[] = [
    span(-w / 2, y0, back, -w / 2 + t, y1, face),
    span(w / 2 - t, y0, back, w / 2, y1, face),
    span(-w / 2 + t, y0, back, w / 2 - t, y1, back + t),
    span(-w / 2 + t, y0, back + t, w / 2 - t, y0 + t, face), // the floor
    span(-w / 2 + t, shelf - t, back + t, -0.01, shelf, face - 0.02),
    span(-w / 2 + t, upper - t, back + t, -0.01, upper, face - 0.02),
    rounded(-w / 2, y1, back, w / 2, top, d / 2 - handle, 0.004, 0.006),
  ];
  const trim: G[] = [
    span(-w / 2 + PLINTH_SET, bottom, back, w / 2 - PLINTH_SET, y0, face - PLINTH_SET),
  ];
  const steel: G[] = [
    rod(0.008, v(0.01, rail, (back + face) / 2), v(w / 2 - t, rail, (back + face) / 2), 6),
  ];
  const parts = [part('body', true, body), part('steel', false, steel), part('trim', false, trim)];
  const length = Math.min(0.35, (y1 - y0) / 4);
  const hy = Math.min(bottom + 1.1, y1 - length / 2 - 0.05); // the handles' centre
  for (const s of [-1, 1] as const) {
    const [a, b] = s < 0 ? [-w / 2 + 0.002, -GAP / 2] : [GAP / 2, w / 2 - 0.002];
    // Hinged on the carcass's outer front edge, the free edge (and its handle) by the seam.
    const hinge = { x: (s * w) / 2, z: face, opens: s < 0 ? -1 : 1 } as const;
    const hx = s * (GAP / 2 + 0.05);
    const front = face + FRONT;
    const leafTrim: G[] = [];
    // Louvres: dark slots across the door, near its top and its bottom.
    const [lx, lw] = [(a + b) / 2, (b - a) * 0.6];
    for (const y of [y1 - 0.12, y0 + 0.12])
      for (let i = 0; i < 5; i++)
        leafTrim.push(box(lw, 0.008, 0.002, lx, y - i * 0.018, face + FRONT + 0.001));
    parts.push(
      part('body', true, [span(a, y0 + 0.004, face, b, y1 - 0.004, face + FRONT)], hinge),
      part(
        'steel',
        false,
        [
          box(0.014, length, 0.014, hx, hy, front + handle - 0.007),
          box(0.01, 0.01, handle - 0.014, hx, hy - length / 2 + 0.02, front + (handle - 0.014) / 2),
          box(0.01, 0.01, handle - 0.014, hx, hy + length / 2 - 0.02, front + (handle - 0.014) / 2),
        ],
        hinge,
      ),
      part('trim', false, leafTrim, hinge),
    );
  }
  return parts;
};

/**
 * A single bed, its headboard at +z: a dark painted steel frame (legs, rails, a low headboard and
 * footboard) under a mattress in the item's colour (its cover) and a white pillow.
 */
const bedFrame: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const leg = 0.045;
  const rail = bottom + 0.22; // the rails' top, under the mattress
  const mattress = Math.min(0.17, top - rail - 0.04);
  const frame: G[] = [
    span(-w / 2, bottom, d / 2 - leg, w / 2, top, d / 2), // headboard
    span(-w / 2, bottom, -d / 2, w / 2, rail + 0.12, -d / 2 + leg), // footboard
    span(-w / 2, rail - 0.08, -d / 2 + leg, -w / 2 + 0.03, rail, d / 2 - leg),
    span(w / 2 - 0.03, rail - 0.08, -d / 2 + leg, w / 2, rail, d / 2 - leg),
  ];
  const [z0, z1] = [-d / 2 + leg + 0.005, d / 2 - leg - 0.005];
  return [
    part('body', true, [
      rounded(-w / 2 + 0.035, rail, z0, w / 2 - 0.035, rail + mattress, z1, 0.05, 0.025),
    ]),
    part('frame-dark', true, frame),
    part('linen', true, [
      rounded(
        -w / 2 + 0.15,
        rail + mattress,
        z1 - 0.38,
        w / 2 - 0.15,
        Math.min(top, rail + mattress + 0.07),
        z1 - 0.04,
        0.06,
        0.025,
      ),
    ]),
  ];
};

/**
 * A study desk (its back at −z): a wooden top with chamfered edges in the item's colour on four
 * dark painted steel legs, a modesty panel at the back and a drawer under the top on the right,
 * with a steel pull.
 */
const deskDrawer: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const t = 0.03;
  const under = top - t;
  const leg = 0.04;
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      box(
        leg,
        under - bottom,
        leg,
        sx * (w / 2 - 0.03 - leg / 2),
        (bottom + under) / 2,
        sz * (d / 2 - 0.03 - leg / 2),
      ),
    ),
  );
  const [dx0, dx1] = [w / 2 - 0.07 - Math.min(0.42, w / 3), w / 2 - 0.07];
  const [dz0, dz1] = [-d / 2 + 0.06, d / 2 - 0.035];
  const drawer = Math.min(0.13, (under - bottom) / 4);
  return [
    part('body', true, [
      rounded(-w / 2, under, -d / 2, w / 2, top, d / 2, 0.012, 0.005),
      span(dx0, under - drawer, dz0, dx1, under, dz1),
    ]),
    part('frame-dark', true, [
      ...legs,
      span(-w / 2 + 0.07, under - 0.32, -d / 2 + 0.03, w / 2 - 0.07, under, -d / 2 + 0.045),
    ]),
    part('steel', false, [
      box(
        Math.min(0.14, (dx1 - dx0) / 2),
        0.012,
        0.018,
        (dx0 + dx1) / 2,
        under - drawer / 2,
        dz1 + 0.009,
      ),
    ]),
  ];
};

/**
 * A desk chair, facing −z (its back at +z): seat and backrest in the item's colour with rounded,
 * chamfered edges, on a steel tube frame — four legs, the back pair running up as the backrest's
 * uprights, and side stretchers.
 */
const chairFrame: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const r = 0.011;
  const seat = bottom + Math.min(0.46, h / 2); // the seat's top
  const [lx, front, rear] = [w / 2 - 0.035, -d / 2 + 0.04, d / 2 - 0.05];
  const steel: G[] = [];
  for (const x of [-lx, lx]) {
    steel.push(
      rod(r, v(x, bottom, front), v(x, seat - 0.04, front)),
      rod(r, v(x, bottom, rear), v(x, top - 0.03, rear)),
      rod(r, v(x, bottom + 0.16, front), v(x, bottom + 0.16, rear)),
    );
  }
  return [
    part('body', true, [
      rounded(
        -w / 2 + 0.01,
        seat - 0.045,
        -d / 2 + 0.01,
        w / 2 - 0.01,
        seat,
        d / 2 - 0.03,
        0.04,
        0.012,
      ),
      rounded(-w / 2 + 0.02, top - 0.3, rear + r, w / 2 - 0.02, top, d / 2, 0.02, 0.008),
    ]),
    part('steel', true, steel),
  ];
};

/**
 * A pinboard on the wall (its back at −z) in the item's colour, in an aluminium frame, with a few
 * blank white sheets pinned to it (what it says is read by inspecting it).
 */
const noticeBoard: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [back, f] = [-d / 2, Math.min(0.025, w / 12, h / 12)];
  const board = d / 2 - 0.008; // the board's face, inside the frame's
  const sheets: G[] = [];
  const [sw, sh] = [Math.min(0.15, w / 5), Math.min(0.21, h / 2.5)];
  const layout = [
    [-0.3, 0.12],
    [-0.08, 0.1],
    [0.15, 0.14],
    [-0.2, -0.17],
    [0.25, -0.12],
  ];
  for (const [u = 0, t = 0] of layout) {
    const [x, y] = [u * (w - 2 * f - sw), t * (h - 2 * f - sh) * 2];
    sheets.push(box(sw, sh, 0.002, x, y, board + 0.001));
  }
  return [
    part('body', false, [span(-w / 2 + f, -h / 2 + f, back, w / 2 - f, h / 2 - f, board)]),
    part('aluminium', false, [
      span(-w / 2, h / 2 - f, back, w / 2, h / 2, d / 2),
      span(-w / 2, -h / 2, back, w / 2, -h / 2 + f, d / 2),
      span(-w / 2, -h / 2 + f, back, -w / 2 + f, h / 2 - f, d / 2),
      span(w / 2 - f, -h / 2 + f, back, w / 2, h / 2 - f, d / 2),
    ]),
    part('linen', false, sheets),
  ];
};

/**
 * A sign on the wall (its back at −z): a printed panel in the item's colour — as large as its
 * label, which is drawn over its front — held off an aluminium backplate by four standoffs.
 */
const signStandoff: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const back = -d / 2 + Math.min(0.004, d / 6);
  const panel = d / 2 - Math.min(0.005, d / 5);
  const [px, py] = [0.49 * w, 0.48 * h]; // the label covers 98 % × 96 % of the front
  const r = Math.min(0.008, w / 20, h / 20);
  const [sx, sy] = [px - Math.min(0.04, w / 6), py - Math.min(0.04, h / 6)];
  return [
    part('body', false, [span(-px, -py, panel, px, py, d / 2)]),
    part('aluminium', false, [
      span(-w / 2, -h / 2, -d / 2, w / 2, h / 2, back),
      ...[-1, 1].flatMap((i) =>
        [-1, 1].map((j) => rod(r, v(i * sx, j * sy, back), v(i * sx, j * sy, panel), 10)),
      ),
    ]),
  ];
};

/** Seven-segment numerals: which segments (a…g) light for each digit. */
const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/** A number in raised strokes, centred at (x, y) on a face at z, each digit `dw` × `dh`. */
function numeral(n: number, x: number, y: number, z: number, dw: number, dh: number): G[] {
  const s = dw / 5; // the stroke
  const text = String(n);
  const pitch = dw + s * 1.5;
  const pieces: G[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const cx = x + (i - (text.length - 1) / 2) * pitch;
    const [l, r, t, m, b] = [
      cx - dw / 2 + s / 2,
      cx + dw / 2 - s / 2,
      y + dh / 2 - s / 2,
      y,
      y - dh / 2 + s / 2,
    ];
    const across = (yy: number) => box(dw, s, 0.001, cx, yy, z);
    const upright = (xx: number, y0: number, y1: number) =>
      box(s, y1 - y0 + s, 0.001, xx, (y0 + y1) / 2, z);
    const segment: Record<string, () => G> = {
      a: () => across(t),
      b: () => upright(r, m, t),
      c: () => upright(r, b, m),
      d: () => across(b),
      e: () => upright(l, b, m),
      f: () => upright(l, m, t),
      g: () => across(m),
    };
    for (const k of DIGITS[ch] ?? '') {
      const stroke = segment[k]?.();
      if (stroke) pieces.push(stroke);
    }
  }
  return pieces;
}

/**
 * A bank of steel lockers (its back at −z) in painted steel, the item's colour: columns about
 * 0.45 m wide, two tiers of doors where it is tall enough, each door with ventilation slots, a
 * white number plate (numbered from 1, top row first) and a steel latch by its opening edge, on a
 * dark backing that shows as the gaps, over a recessed plinth.
 */
const lockerBank: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const latch = 0.016;
  const face = d / 2 - FRONT - latch - 0.002; // the carcass's front (doors on a 2 mm backing)
  const columns = Math.max(1, Math.round(w / 0.45));
  const tiers = h >= 1.4 ? 2 : 1;
  const [y0, y1] = [bottom + PLINTH, top - 0.02];
  const [cw, th] = [(w - 0.02) / columns, (y1 - y0) / tiers];
  const body: G[] = [
    span(-w / 2, y0, back, w / 2, top, face),
    span(-w / 2, y1, face, w / 2, top, d / 2 - latch), // the top rail
  ];
  const trim: G[] = [
    span(-w / 2 + PLINTH_SET, bottom, back, w / 2 - PLINTH_SET, y0, face - PLINTH_SET),
    span(-w / 2, y0, face, w / 2, y1, face + 0.002),
  ];
  const [steel, plates]: [G[], G[]] = [[], []];
  const front = face + 0.002 + FRONT;
  for (let row = 0; row < tiers; row++) {
    for (let c = 0; c < columns; c++) {
      const [a, b] = [-w / 2 + 0.01 + c * cw + GAP / 2, -w / 2 + 0.01 + (c + 1) * cw - GAP / 2];
      const [lo, hi] = [y1 - (row + 1) * th + GAP / 2, y1 - row * th - GAP / 2];
      body.push(span(a, lo, face + 0.002, b, hi, front));
      const mid = (a + b) / 2;
      // Number plate near the top, vents under it, latch at mid-height by the opening edge.
      const [pw, ph] = [Math.min(0.08, (b - a) / 3), 0.05];
      const py = hi - 0.07;
      plates.push(box(pw, ph, 0.002, mid, py, front + 0.001));
      trim.push(...numeral(row * columns + c + 1, mid, py, front + 0.0025, pw / 4, ph * 0.6));
      for (let i = 0; i < 4; i++)
        trim.push(box((b - a) * 0.55, 0.007, 0.002, mid, py - 0.07 - i * 0.017, front + 0.001));
      steel.push(box(0.022, 0.07, latch, b - 0.035, (lo + hi) / 2, front + latch / 2));
    }
  }
  return [
    part('body', true, body),
    part('trim', false, trim),
    part('steel', false, steel),
    part('worktop-white', false, plates),
  ];
};

/**
 * A step-over gowning bench (no front or back): a laminate seat in the item's colour with
 * rounded corners on stainless leg frames — two legs, a foot rail and a seat rail at each end —
 * over a slatted steel shelf for shoes.
 */
const gowningBench: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const seat = top - 0.04;
  const r = 0.014;
  const [lx, lz] = [w / 2 - 0.04, d / 2 - 0.12];
  const steel: G[] = [];
  for (const z of [-lz, lz]) {
    steel.push(
      rod(r, v(-lx, bottom, z), v(-lx, seat, z)),
      rod(r, v(lx, bottom, z), v(lx, seat, z)),
      rod(r, v(-lx, bottom + r, z), v(lx, bottom + r, z)),
      rod(r, v(-lx, seat - r, z), v(lx, seat - r, z)),
    );
  }
  const shelf = bottom + 0.13;
  for (let i = 0; i < 4; i++) {
    const x = -lx + 0.03 + (i * (2 * lx - 0.06)) / 3;
    steel.push(rod(0.008, v(x, shelf, -lz), v(x, shelf, lz)));
  }
  return [
    part('body', true, [rounded(-w / 2, seat, -d / 2, w / 2, top, d / 2, 0.04, 0.008)]),
    part('steel', true, steel),
  ];
};

/**
 * The PPE shelf (its back at −z), painted steel in the item's colour: two columns of
 * compartments on four levels, a white label strip on each compartment's front edge (blank),
 * folded spare lab coats on the upper levels and boxes of gloves on the lower ones.
 */
const ppeShelf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const t = 0.02;
  const levels = 4;
  const lowest = bottom + 0.1; // the bottom shelf's top
  const pitch = (top - t - lowest) / levels;
  const body: G[] = [
    span(-w / 2, bottom, back, -w / 2 + t, top, d / 2),
    span(w / 2 - t, bottom, back, w / 2, top, d / 2),
    span(-w / 2 + t, top - t, back, w / 2 - t, top, d / 2),
    span(-w / 2 + t, bottom, back, w / 2 - t, top - t, back + 0.01),
    span(-t / 2, lowest, back + 0.01, t / 2, top - t, d / 2),
  ];
  const [labels, coats, gloves]: [G[], G[], G[]] = [[], [], []];
  const cw = (w - 3 * t) / 2; // a compartment's width
  for (let i = 0; i < levels; i++) {
    const y = lowest + i * pitch; // the shelf's top
    body.push(span(-w / 2 + t, y - t, back + 0.01, w / 2 - t, y, d / 2 - 0.003));
    const room = pitch - t - 0.03;
    for (const s of [-1, 1]) {
      const cx = s * (t / 2 + cw / 2);
      labels.push(box(Math.min(0.12, cw / 3), 0.022, 0.002, cx, y - t / 2, d / 2 - 0.001));
      if (i >= 2) {
        // A stack of folded coats.
        const [fw, fd, fh] = [
          Math.min(0.34, cw - 0.06),
          Math.min(0.26, d - 0.06),
          Math.min(0.05, room / 3),
        ];
        for (let k = 0; k < 3; k++)
          coats.push(
            rounded(
              cx - fw / 2,
              y + k * fh,
              -fd / 2,
              cx + fw / 2,
              y + (k + 1) * fh - 0.004,
              fd / 2,
              0.02,
              0.008,
            ),
          );
      } else {
        // A row of glove boxes, end on.
        const [gw, gh, gd] = [0.115, Math.min(0.09, room), Math.min(0.24, d - 0.06)];
        const n = Math.max(1, Math.floor((cw - 0.02) / (gw + 0.015)));
        for (let k = 0; k < n; k++) {
          const x = cx + (k - (n - 1) / 2) * (gw + 0.015);
          gloves.push(span(x - gw / 2, y, -gd / 2, x + gw / 2, y + gh, gd / 2));
        }
      }
    }
  }
  return [
    part('body', true, body),
    part('worktop-white', false, labels),
    part('linen', false, coats),
    part('glove-blue', false, gloves),
  ];
};

/**
 * The hand-wash basin (its back at −z, the wall): a vanity in the item's colour — carcass, one
 * door on a dark backing with a steel pull — on a recessed plinth, under a 30 mm solid-surface
 * countertop with an undermounted stainless bowl and its drain. The bowl sits back, under the
 * wall faucet (0.1 m from the wall over a 0.5 m deep basin).
 */
const handWashSink: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const t = 0.03;
  const pull = 0.024;
  const face = d / 2 - 0.02 - FRONT - pull; // the carcass's front, under the overhang
  const deep = Math.min(0.16, (h - PLINTH - t) / 3); // the bowl
  const [x0, x1] = [-Math.min(0.22, w / 2 - 0.06), Math.min(0.22, w / 2 - 0.06)];
  const [z0, z1] = [back + 0.03, Math.min(back + 0.37, face - 0.02)];
  const [y0, y1] = [bottom + PLINTH, top - t];
  const under = top - deep - 0.01; // the carcass's top under the bowl
  const body: G[] = [
    span(-w / 2, y0, back, w / 2, under, face),
    span(-w / 2, under, back, x0, y1, face),
    span(x1, under, back, w / 2, y1, face),
    span(x0, under, back, x1, y1, z0),
    span(x0, under, z1, x1, y1, face),
    span(-w / 2 + GAP, y0 + GAP, face + 0.002, w / 2 - GAP, y1 - GAP, face + 0.002 + FRONT),
  ];
  const ty = top - t;
  const counter = [
    span(-w / 2, ty, back, w / 2, top, z0),
    span(-w / 2, ty, z0, x0, top, z1),
    span(x1, ty, z0, w / 2, top, z1),
    rounded(-w / 2, ty, z1, w / 2, top, d / 2, 0.004, 0.006),
  ];
  const s = 0.003;
  const yb = top - deep;
  const steel: G[] = [
    span(x0, yb, z0, x1, yb + s, z1),
    span(x0, yb, z0, x1, ty, z0 + s),
    span(x0, yb, z1 - s, x1, ty, z1),
    span(x0, yb, z0 + s, x0 + s, ty, z1 - s),
    span(x1 - s, yb, z0 + s, x1, ty, z1 - s),
    box(
      0.012,
      Math.min(0.2, (y1 - y0) / 3),
      pull - 0.006,
      w / 2 - 0.06,
      y1 - 0.15,
      face + 0.002 + FRONT + (pull - 0.006) / 2,
    ),
  ];
  const trim: G[] = [
    span(-w / 2 + PLINTH_SET, bottom, back, w / 2 - PLINTH_SET, y0, face - PLINTH_SET),
    span(-w / 2, y0, face, w / 2, y1, face + 0.002),
    drum(0.025, 0.025, yb + s, yb + s + 0.003, 16).translate(0, 0, (z0 + z1) / 2),
  ];
  return [
    part('body', true, body),
    part('stone', true, counter),
    part('steel', false, steel),
    part('trim', false, trim),
  ];
};

/**
 * A wall-mounted mixer (its back at −x, the west wall): a steel wall flange, a spout out to the
 * box's centre and down to an outlet at its bottom (where the item's water stream hangs), and a
 * long elbow lever over it reaching the box's front, so it is worked without the hands.
 */
const wallFaucet: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [wall, bottom, top] = [-w / 2, -h / 2, h / 2];
  const flange = Math.min(0.012, w / 10);
  const [r, arm] = [Math.min(0.011, d / 6), bottom + 0.5 * h]; // the spout's radius and height
  return [
    part('body', true, [
      rod(r, v(wall + flange, arm, 0), v(0, arm, 0), 12),
      sphere(r, 0, arm, 0, 12),
      rod(r, v(0, arm, 0), v(0, bottom + 0.012, 0), 12),
      drum(r + 0.002, r + 0.001, bottom, bottom + 0.012, 12),
      rod(0.006, v(wall + flange, top - 0.02, 0), v(w / 2 - 0.006, top - 0.006, 0), 8),
      sphere(0.006, w / 2 - 0.006, top - 0.006, 0, 8),
    ]),
    part('steel', false, [
      drum(Math.min(0.032, d / 2, h / 2), Math.min(0.032, d / 2, h / 2), 0, flange, 20)
        .rotateZ(-Math.PI / 2)
        .translate(wall, (arm + top - 0.02) / 2, 0),
    ]),
  ];
};

/**
 * A wall-mounted liquid dispenser — soap, hand rub — drawn with its back at −z: an aluminium wall
 * bracket, a rounded housing in the item's colour, a dark push plate on its lower front and the
 * nozzle under it.
 */
const liquidDispenser: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const plate = Math.min(0.005, d / 10);
  const [hy0, hy1] = [bottom + 0.035, top - 0.012];
  const front = d / 2 - 0.008; // the housing's front
  return [
    part('body', true, [
      rounded(
        -w / 2 + 0.006,
        hy0,
        back + plate,
        w / 2 - 0.006,
        hy1,
        front,
        Math.min(0.015, w / 4),
        0.005,
      ),
    ]),
    part('aluminium', false, [span(-w / 2, bottom + 0.02, back, w / 2, top, back + plate)]),
    part('trim', false, [
      span(-w / 2 + 0.014, hy0 + 0.006, front, w / 2 - 0.014, hy0 + 0.07, d / 2),
      box(0.012, hy0 - bottom, 0.012, 0, (bottom + hy0) / 2, front - 0.02),
    ]),
  ];
};

/**
 * A paper towel dispenser, drawn with its back at −z: an aluminium wall plate, a rounded housing
 * in the item's colour with a dark sight slot, and a sheet of towel hanging from its bottom slot.
 */
const towelDispenser: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const plate = Math.min(0.005, d / 10);
  const hy0 = bottom + 0.025; // the housing's bottom
  const front = d / 2 - 0.004;
  return [
    part('body', true, [
      rounded(-w / 2 + 0.005, hy0, back + plate, w / 2 - 0.005, top - 0.008, front, 0.02, 0.008),
    ]),
    part('aluminium', false, [span(-w / 2, bottom + 0.03, back, w / 2, top, back + plate)]),
    part('trim', false, [
      span(-0.012, (hy0 + top) / 2 - 0.05, front, 0.012, (hy0 + top) / 2 + 0.07, d / 2),
      span(-w / 2 + 0.04, hy0 - 0.003, front - 0.035, w / 2 - 0.04, hy0, front - 0.02),
    ]),
    part('linen', false, [
      span(-w / 2 + 0.05, bottom, front - 0.03, w / 2 - 0.05, hy0, front - 0.027),
    ]),
  ];
};

/**
 * A glove box in a steel wall holder, drawn with its back at −z: the box in the item's colour,
 * its dispensing opening on the front with a glove's cuff showing; the holder's back plate,
 * tray, side cheeks and front lip.
 */
const gloveDispenser: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const s = 0.003; // the holder's sheet
  const front = d / 2 - s;
  const mid = (bottom + s + top) / 2 + 0.01;
  const [ow, oh] = [Math.min(0.08, w / 3), Math.min(0.035, h / 4)];
  return [
    part('body', true, [span(-w / 2 + s, bottom + s, back + s, w / 2 - s, top, front)]),
    part('steel', false, [
      span(-w / 2, bottom, back, w / 2, top, back + s),
      span(-w / 2, bottom, back + s, w / 2, bottom + s, d / 2),
      span(-w / 2, bottom + s, back + s, -w / 2 + s, bottom + 0.6 * h, d / 2),
      span(w / 2 - s, bottom + s, back + s, w / 2, bottom + 0.6 * h, d / 2),
      span(-w / 2 + s, bottom + s, front, w / 2 - s, bottom + 0.035, d / 2),
    ]),
    part('trim', false, [
      drum(1, 1, 0, 1, 24)
        .scale(ow / 2, 0.001, oh / 2)
        .rotateX(Math.PI / 2)
        .translate(0, mid, front + 0.0005),
    ]),
    part('glove-blue', false, [
      sphere(1, 0, 0, 0, 10)
        .scale(ow / 3, oh / 3, 0.0025)
        .translate(0, mid, front + 0.0003),
    ]),
  ];
};

/**
 * A stainless pedal bin (its pedal at +z): a round bin in the item's colour on a rubber foot ring,
 * a stainless lid with its hinge at the back, a rubber pedal at the front.
 */
const pedalBin: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const r = Math.min(w, d) / 2 - 0.015;
  const lid = top - 0.03;
  return [
    part('body', true, [drum(r, r, bottom + 0.02, lid, 32)]),
    part('steel', true, [
      drum(r + 0.006, r - 0.02, lid, top, 32),
      box(0.07, 0.022, d / 2 - r, 0, lid + 0.006, -d / 2 + (d / 2 - r) / 2),
    ]),
    part('rubber', true, [
      drum(r - 0.006, r, bottom, bottom + 0.02, 32),
      box(
        Math.min(0.12, w / 2.5),
        0.016,
        d / 2 - r + 0.03,
        0,
        bottom + 0.035,
        d / 2 - (d / 2 - r + 0.03) / 2,
      ),
    ]),
  ];
};

/**
 * A wall protection rail (its back at −z): a rounded vinyl bumper in the item's colour, its ends
 * capped round, on an aluminium mounting channel, with a dark grip strip along its face.
 */
const wallRail: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const channel = Math.min(0.008, d / 4);
  const front = d / 2 - 0.002;
  return [
    part('body', true, [
      rounded(
        -w / 2 + 0.005,
        bottom + 0.012,
        back + channel,
        w / 2 - 0.005,
        top - 0.012,
        front,
        0.015,
        0.008,
      ),
    ]),
    part('aluminium', false, [
      span(-w / 2 + 0.02, bottom, back, w / 2 - 0.02, top, back + channel),
    ]),
    part('trim', false, [span(-w / 2 + 0.04, -0.012, front - 0.002, w / 2 - 0.04, 0.012, d / 2)]),
  ];
};

/**
 * A door casing round a doorway (its back in the wall, −z): two jambs and a head in the item's
 * colour, standing off the wall, with dark plinth blocks at the jambs' feet. The doorway itself
 * (between the jambs, under the head) stays empty.
 */
const architrave: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, back] = [-h / 2, h / 2, -d / 2];
  const jamb = Math.min(0.1, w / 8);
  const plinth = Math.min(0.15, h / 10);
  return [
    part('body', true, [
      span(-w / 2, bottom + plinth, back, -w / 2 + jamb, top - jamb, d / 2),
      span(w / 2 - jamb, bottom + plinth, back, w / 2, top - jamb, d / 2),
      rounded(-w / 2, top - jamb, back, w / 2, top, d / 2, 0.004, 0.006),
    ]),
    part('trim', true, [
      span(-w / 2, bottom, back, -w / 2 + jamb, bottom + plinth, d / 2),
      span(w / 2 - jamb, bottom, back, w / 2, bottom + plinth, d / 2),
    ]),
  ];
};

// UX3.1 PPE: what the PPE cabinet holds, each modelled at its item's shipped size (in metres) and
// stretched to the size asked. Built from primitives and lofts: recognisable, not photorealistic.

/** A builder modelled at a reference size, its parts stretched to the size asked. */
const stretched =
  ([rw, rh, rd]: readonly [number, number, number], build: () => PropPart[]): PropBuilder =>
  ([w = 0, h = 0, d = 0]) => {
    const parts = build();
    for (const { geometry } of parts) geometry.scale(w / rw, h / rh, d / rd);
    return parts;
  };

/** The same surface seen from the other side (the inside of a shell). */
function inward(geometry: G): G {
  const index = geometry.getIndex();
  for (let i = 0; index && i < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < normal.count; i++)
    normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
  return geometry;
}

/** Upright flat bars, h high and t thick, centred at height y along a path of (x, z) points. */
function chain(points: readonly (readonly [number, number])[], y: number, h: number, t: number) {
  return points.slice(1).map(([x1, z1], i) => {
    const [x0, z0] = points[i] ?? [x1, z1];
    return box(Math.hypot(x1 - x0, z1 - z0), h, t)
      .rotateY(Math.atan2(z0 - z1, x1 - x0))
      .translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  });
}

/**
 * A lab coat (the item's colour, matte cotton) hanging on a wire hanger, its front at +z: a torso
 * with sloping shoulders, two sleeves with turned-back cuffs, a collar round the back of the neck,
 * lapels, a front placket with four press studs, two patch pockets and a breast pocket, a hem
 * band. The hanger's hook curls over the cabinet's rail at (y 0.485, z −0.023), just under the
 * box's top; its shoulders are inside the coat.
 */
const coatOnHanger = stretched([0.5, 1, 0.12], () => {
  // The front view (x, y), counter-clockwise from the hem; insets chamfer its edges.
  const corners = [
    [-0.19, -0.5],
    [0.19, -0.5],
    [0.185, 0.32],
    [0.17, 0.4],
    [0.055, 0.452],
    [-0.055, 0.452],
    [-0.17, 0.4],
    [-0.185, 0.32],
  ] as const;
  const torso: Outline = (inset) =>
    corners.map(([x, y]) => new THREE.Vector2(x - Math.sign(x) * inset, y - Math.sign(y) * inset));
  const fabric: G[] = [
    loft(torso, [
      [0.006, -0.045],
      [0, -0.039],
      [0, 0.039],
      [0.006, 0.045],
    ]),
  ];
  const linen: G[] = [
    box(0.12, 0.04, 0.012, 0, 0.45, -0.036), // the collar, behind the hanger's neck
    box(0.028, 0.6, 0.004, 0, -0.19, 0.047), // the placket
    box(0.08, 0.09, 0.005, 0.11, 0.17, 0.047), // the breast pocket
    box(0.384, 0.03, 0.092, 0, -0.485, 0), // the hem
  ];
  const steel: G[] = [
    rod(0.0025, v(0, 0.448, -0.023), v(0, 0.485, -0.011), 6), // the hanger's neck, up to the hook
    // The hook: from the neck, up over the rail and down its back.
    new THREE.TorusGeometry(0.012, 0.0025, 6, 10, Math.PI + 0.4)
      .rotateZ(-0.4)
      .rotateY(Math.PI / 2)
      .translate(0, 0.485, -0.023),
  ];
  for (const y of [0.06, -0.07, -0.2, -0.33])
    steel.push(
      drum(0.006, 0.006, -0.002, 0.002, 8)
        .rotateX(Math.PI / 2)
        .translate(0, y, 0.05),
    );
  for (const s of [-1, 1] as const) {
    const [shoulder, cuff] = [v(s * 0.155, 0.37, 0), v(s * 0.205, -0.17, 0.012)];
    const along = cuff.clone().sub(shoulder).normalize();
    fabric.push(rod(0.042, shoulder, cuff, 12));
    const lapel = [
      [0.055, 0.45],
      [0.12, 0.33],
      [0.01, 0.12],
    ].map(([x = 0, y = 0]) => new THREE.Vector2(s * x, y));
    if (s > 0) lapel.reverse(); // counter-clockwise
    const turnUp = [
      cuff.clone().addScaledVector(along, -0.05),
      cuff.clone().addScaledVector(along, 0.002),
    ];
    linen.push(
      rod(0.044, turnUp[0] ?? cuff, turnUp[1] ?? cuff, 12), // the cuff
      loft(
        () => lapel,
        [
          [0, 0.044],
          [0, 0.05],
        ],
      ),
      box(0.11, 0.13, 0.006, s * 0.1, -0.22, 0.047), // a patch pocket
    );
    steel.push(rod(0.003, v(0, 0.448, -0.023), v(s * 0.18, 0.395, -0.023), 6)); // a shoulder
  }
  return [part('body', true, fabric), part('linen', false, linen), part('steel', false, steel)];
});

/**
 * Splash goggles (frame in the item's colour), standing on their lower rim, front at +z: two eye
 * cups, each a skirt flaring toward the face round a clear lens (see-through: the cup is open at
 * the back), joined by a bridge, with indirect vents on top; strap buckles at the sides and the
 * elastic strap looped behind.
 */
const safetyGoggles = stretched([0.18, 0.07, 0.1], () => {
  const [rx, ry] = [0.038, 0.031]; // a cup's front half-axes
  const flare = 1.08; // the back rim over the front
  const cy = -0.035 + ry * flare; // the cups' centre height: they stand on their back rims
  const frame: G[] = [rod(0.005, v(-0.012, 0.011, 0.01), v(0.012, 0.011, 0.01), 8)]; // the bridge
  const lenses: G[] = [];
  const strap: G[] = [box(0.176, 0.018, 0.004, 0, cy, -0.047)];
  for (const s of [-1, 1] as const) {
    const x = s * 0.046;
    const oval = (geometry: G, z: number) => geometry.scale(rx, ry, 1).translate(x, cy, z);
    const skirt = (r: number) =>
      new THREE.CylinderGeometry(r, r * flare, 0.06, 16, 1, true).rotateX(Math.PI / 2);
    frame.push(
      oval(skirt(1), 0),
      oval(inward(skirt(0.94)), 0),
      oval(new THREE.RingGeometry(0.94, 1, 16), 0.03), // the rim round the lens
      box(0.012, 0.004, 0.012, x - 0.015, cy + ry + 0.001, 0), // vents
      box(0.012, 0.004, 0.012, x + 0.015, cy + ry + 0.001, 0),
    );
    lenses.push(oval(new THREE.CircleGeometry(0.94, 16), 0.028));
    strap.push(
      box(0.005, 0.022, 0.014, s * 0.0875, cy, -0.008), // the buckle
      box(0.003, 0.018, 0.034, s * 0.0885, cy, -0.03),
    );
  }
  return [part('body', true, frame), part('glass', false, lenses), part('rubber', false, strap)];
});

/**
 * A face shield standing on its visor's lower edge, front at +z: the visor (the body: the item is
 * see-through, in its own colour), a curved clear sheet 0.25 m high and 0.27 m round, clipped into
 * a dark brow frame; a dark edge binding; the headgear behind: a headband with side arms from the
 * brow frame's ends, a crown strap and the ratchet knob at the back.
 */
const faceShield = stretched([0.26, 0.3, 0.18], () => {
  // The visor: its radius, half the angle it spans, its axis (a vertical line at x 0, z zc).
  const [r, half, zc] = [0.155, Math.asin(0.12 / 0.155), -0.076];
  const at = (radius: number, a: number) =>
    [radius * Math.sin(a), zc + radius * Math.cos(a)] as const;
  const arcAt = (radius: number, n: number) =>
    Array.from({ length: n + 1 }, (_, i) => at(radius, -half + (2 * half * i) / n));
  const visor = new THREE.CylinderGeometry(r, r, 0.25, 16, 1, true, -half, 2 * half).translate(
    0,
    -0.025,
    zc,
  );
  const [ex, ez] = at(r, half);
  const [bx, bz] = at(r + 0.004, half); // the brow frame's end
  const headband = Array.from({ length: 13 }, (_, i) => {
    const a = (2 * Math.PI * i) / 12;
    return [0.08 * Math.sin(a), -0.015 + 0.07 * Math.cos(a)] as const;
  });
  const crown = [
    [-0.08, 0.12],
    [-0.055, 0.136],
    [0, 0.142],
    [0.055, 0.136],
    [0.08, 0.12],
  ].map(([x = 0, y = 0]) => v(x, y, -0.015));
  const trim: G[] = [
    ...chain(arcAt(r + 0.004, 10), 0.115, 0.04, 0.008), // the brow frame
    ...chain(headband, 0.115, 0.02, 0.004),
    ...chain(
      [
        [-bx, bz],
        [-0.08, -0.015],
      ],
      0.115,
      0.03,
      0.006,
    ), // the side arms
    ...chain(
      [
        [bx, bz],
        [0.08, -0.015],
      ],
      0.115,
      0.03,
      0.006,
    ),
    drum(0.016, 0.016, -0.004, 0.004, 12)
      .rotateX(Math.PI / 2)
      .translate(0, 0.115, -0.084),
    // The edge binding: down one side, round the bottom, up the other.
    sweep(
      [v(-ex, 0.097, ez), ...arcAt(r, 12).map(([x, z]) => v(x, -0.1485, z)), v(ex, 0.097, ez)],
      0.0015,
    ),
    sweep(crown, 0.004), // the crown strap
  ];
  return [part('body', false, [visor]), part('trim', false, trim)];
});

export const PREPARATION_PROPS = {
  'ppe-cabinet': ppeCabinet,
  'bed-frame': bedFrame,
  'desk-drawer': deskDrawer,
  'chair-frame': chairFrame,
  'notice-board': noticeBoard,
  'sign-standoff': signStandoff,
  'locker-bank': lockerBank,
  'gowning-bench': gowningBench,
  'ppe-shelf': ppeShelf,
  'hand-wash-sink': handWashSink,
  'wall-faucet': wallFaucet,
  'liquid-dispenser': onWestWall(liquidDispenser),
  'towel-dispenser': onWestWall(towelDispenser),
  'glove-dispenser': onWestWall(gloveDispenser),
  'pedal-bin': pedalBin,
  'wall-rail': wallRail,
  architrave,
  // UX3.1 PPE
  'coat-on-hanger': coatOnHanger,
  'safety-goggles': safetyGoggles,
  'face-shield': faceShield,
} satisfies Partial<Record<Prop, PropBuilder>>;
