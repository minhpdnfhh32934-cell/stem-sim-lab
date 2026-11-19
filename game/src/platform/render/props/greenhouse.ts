import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { box, part, type PropBuilder } from './parts';

// Biology's doors between its rooms (Phase U D2, Phú 2026-11-05: the starship door's mechanism in
// Biology's own look, wood and glass, leaf-etched). A leaf is an entity sliding along its +x, its
// meeting edge at −x; the frame is decor across the wall's opening. Both are seen from both rooms:
// symmetric in z.

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** A leaf shape lying flat in a face (z): `len` long, pointing at `angle` from +y, at (x, y). */
function leafShape(len: number, angle: number, x: number, y: number, z: number) {
  const g = new THREE.SphereGeometry(1, 10, 6);
  g.scale(len * 0.28, len / 2, 0.0012);
  g.translate(0, len / 2, 0); // its stalk at the origin
  g.rotateZ(-angle);
  g.translate(x, y, z);
  return g;
}

/** A thin flat stem from (x0, y0) to (x1, y1), in a face (z). */
function stem(x0: number, y0: number, x1: number, y1: number, z: number) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const g = new THREE.BoxGeometry(0.006, length, 0.0016);
  g.rotateZ(-Math.atan2(x1 - x0, y1 - y0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  return g;
}

/**
 * A climbing vine in a face (z): a stem winding up from (x, y0) to y1 between x ± `sway`, a leaf
 * every `step` m on alternate sides.
 */
function vine(x: number, y0: number, y1: number, sway: number, step: number, z: number) {
  const pieces: THREE.BufferGeometry[] = [];
  const n = Math.max(2, Math.round((y1 - y0) / step));
  const at = (i: number) => [x + sway * Math.sin(i * 1.3), y0 + ((y1 - y0) * i) / n] as const;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = at(i);
    const [bx, by] = at(i + 1);
    pieces.push(stem(ax, ay, bx, by, z));
    const side = i % 2 ? 1 : -1;
    pieces.push(leafShape(step * 0.9, side * 0.9, bx, by, z));
  }
  return pieces;
}

/** The leaf's wooden stiles and rails (m), and where its middle rail stands. */
const STILE = 0.09;
const TOP_RAIL = 0.1;
const KICK = 0.24;
const MID = [0.95, 1.03] as const;
/** The glass pane's half thickness, in the middle of the leaf. */
const PANE = 0.005;

/**
 * A greenhouse door's leaf (it slides towards +x; its meeting edge at −x): a frame of stiles and
 * rails in the item's wood, a tall pane above the middle rail and a short one below in clear glass,
 * a vine of leaves etched up each pane on both faces, a darker astragal down the meeting edge and a
 * brass pull plate set into the wood beside it on both faces.
 */
const leaf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, t] = [-h / 2, h / 2, d / 2];
  const [x0, x1] = [-w / 2, w / 2];
  const [gx0, gx1] = [x0 + STILE, x1 - STILE];
  const [lowTop, upBottom] = [bottom + MID[0], bottom + MID[1]];
  const etched = [-1, 1].flatMap((face) => {
    const z = face * (PANE + 0.0013);
    const mid = (gx0 + gx1) / 2;
    return [
      ...vine(mid - 0.08, upBottom + 0.1, top - TOP_RAIL - 0.12, 0.12, 0.17, z),
      ...vine(mid + 0.1, bottom + KICK + 0.08, lowTop - 0.1, 0.06, 0.16, z),
    ];
  });
  return [
    part('body', true, [
      span(x0 + 0.02, bottom, -t, gx0, top, t),
      span(gx1, bottom, -t, x1, top, t),
      span(gx0, top - TOP_RAIL, -t, gx1, top, t),
      span(gx0, bottom, -t, gx1, bottom + KICK, t),
      span(gx0, lowTop, -t, gx1, upBottom, t),
    ]),
    // The astragal: the meeting edge, darker, a little thinner than the leaf.
    part('frame-dark', true, [span(x0, bottom, -t * 0.7, x0 + 0.02, top, t * 0.7)]),
    part('pane-glass', false, [
      span(gx0, upBottom, -PANE, gx1, top - TOP_RAIL, PANE),
      span(gx0, bottom + KICK, -PANE, gx1, lowTop, PANE),
    ]),
    part('etched-glass', false, etched),
    part(
      'amber',
      false,
      [-1, 1].map((face) =>
        span(
          x0 + 0.03,
          bottom + 0.9,
          Math.min(face * (t - 0.002), face * t),
          x0 + 0.07,
          bottom + 1.45,
          Math.max(face * (t - 0.002), face * t),
        ),
      ),
    ),
  ];
};

/**
 * A greenhouse door's frame across the opening (w × h, `d` deep through the wall: it stands out of
 * both faces): two jambs and a header in the item's wood, a pale wood inlay up each jamb, a garland
 * of leaves carved along the header's top on both faces, a warm light bar across it over the
 * opening, and a dark sill along the floor with the leaves' track down its middle. The opening is `OPENING`
 * wide and `HEIGHT` high (rooms.json's).
 */
const OPENING = 2;
const HEIGHT = 2.6;
/** How far (m) the jambs and header reach into the opening, past the wall's faces (starship.ts). */
const REVEAL = 0.012;
const frame: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, z0] = [-h / 2, d / 2];
  const z = z0 - 0.008; // the frame's faces; inlays, carving and lights stand out to the box
  const half = OPENING / 2 - REVEAL;
  const head = bottom + HEIGHT - REVEAL;
  const jambs = [span(-w / 2, bottom, -z, -half, head, z), span(half, bottom, -z, w / 2, head, z)];
  const inlays = [-1, 1].flatMap((side) => {
    const xm = side * (half + (w / 2 - half) / 2);
    return [-1, 1].map((face) =>
      span(
        xm - 0.025,
        bottom + 0.15,
        Math.min(face * z, face * (z + 0.004)),
        xm + 0.025,
        head - 0.12,
        Math.max(face * z, face * (z + 0.004)),
      ),
    );
  });
  const garland = [-1, 1].flatMap((face) => {
    const out: THREE.BufferGeometry[] = [];
    const y = h / 2 - 0.1;
    // Over the opening only: no leaf reaches the planes of its sides (the test's flicker rule).
    for (let i = 0; i < 11; i++) {
      const x = -0.85 + (i * 1.7) / 10;
      out.push(leafShape(0.12, (i % 2 ? 1 : -1) * 1.9, x, y, face * (z + 0.003)));
    }
    out.push(span(-0.92, y - 0.004, face * z, 0.92, y + 0.004, face * (z + 0.003)));
    return out;
  });
  return [
    part('body', true, [...jambs, span(-w / 2, head, -z, w / 2, h / 2, z)]),
    part('wood-light', false, inlays),
    part('foliage', false, garland),
    part('glow-warm', false, [
      span(-half + 0.1, head + 0.05, z, half - 0.1, head + 0.09, z0),
      span(-half + 0.1, head + 0.05, -z0, half - 0.1, head + 0.09, -z),
    ]),
    part('frame-dark', false, [span(-half, bottom, -0.18, half, bottom + 0.01, 0.18)]),
    part('trim', false, [span(-half, bottom + 0.01, -0.025, half, bottom + 0.012, 0.025)]),
  ];
};

export const GREENHOUSE_PROPS = {
  'greenhouse-leaf': leaf,
  'greenhouse-frame': frame,
} satisfies Partial<Record<Prop, PropBuilder>>;
