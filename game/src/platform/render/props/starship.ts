import type { Prop } from '../../../gameplay/props';
import { box, part, type PropBuilder } from './parts';

// The doors between a subject's rooms (Phase U, Phú: "a starship's door", two leaves that part from
// the middle, a groove where they meet). A leaf is an entity (its parts slide with its mesh, along
// its +x, its meeting edge at −x); the frame is decor across the wall's opening. Both are seen from
// both rooms: symmetric in z. Hull white, dark seams, a cyan light in the groove and over the door.

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** The groove at the meeting edge: its width (m), and the light strip's in it. */
const GROOVE = 0.035;
const STRIP = 0.008;
/** The hull seams across a leaf: heights from the floor (m). */
const SEAMS = [0.32, 1.05, 1.95];

/**
 * A starship door's leaf (it slides towards +x; its meeting edge at −x): a hull panel in the item's
 * colour; along the meeting edge a dark groove, recessed, a cyan light strip down its middle (the
 * two leaves' grooves make the door's lit seam); dark seams across both faces; a raised steel
 * inset panel with a narrow window; a dark kick band at the floor.
 */
const leaf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, t] = [-h / 2, h / 2, d / 2];
  const x0 = -w / 2;
  const hull = t - 0.006; // the panel's faces; seams, plates and the window stand out to t
  const seam = (y: number) => [
    span(x0 + GROOVE, y - 0.006, -t + 0.004, w / 2, y + 0.006, t - 0.004),
  ];
  const [ib, it] = [bottom + 0.45, bottom + 1.85]; // the inset panel
  const [ix0, ix1] = [x0 + GROOVE + 0.14, w / 2 - 0.1];
  const wx = (ix0 + ix1) / 2;
  return [
    part('body', true, [span(x0 + GROOVE, bottom, -hull, w / 2, top, hull)]),
    part('frame-dark', true, [
      // The groove: a recessed channel the leaf's height, its sides lit by the strip.
      span(x0, bottom, -t * 0.55, x0 + GROOVE, top, t * 0.55),
      ...SEAMS.flatMap((y) => seam(bottom + y)),
      span(x0 + GROOVE, bottom, -t + 0.003, w / 2, bottom + 0.12, t - 0.003),
    ]),
    part('glow-cyan', false, [
      span(
        x0 + GROOVE / 2 - STRIP / 2,
        bottom + 0.15,
        -t * 0.55 - 0.002,
        x0 + GROOVE / 2 + STRIP / 2,
        top - 0.15,
        t * 0.55 + 0.002,
      ),
    ]),
    part('aluminium', true, [span(ix0, ib, -t + 0.002, ix1, it, t - 0.002)]),
    part('vision-glass', false, [span(wx - 0.05, ib + 0.75, -t, wx + 0.05, it - 0.12, t)]),
  ];
};

/**
 * A starship door's frame across the opening (w × h, `d` deep through the wall: it stands out of
 * both faces): two jambs and a header in the item's colour, a cyan light bar under the header on
 * both faces, steel plates on the jambs, and a dark sill along the floor with the leaves' track
 * groove down its middle. The opening is `OPENING` wide and `HEIGHT` high (rooms.json's).
 */
const OPENING = 2;
const HEIGHT = 2.6;
/**
 * How far (m) the jambs and the header reach into the opening: past the wall's own faces round it
 * (the reveal), so that no face of the frame lies in one of the wall's (Phú: they flickered).
 */
const REVEAL = 0.012;
const frame: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, z0] = [-h / 2, d / 2];
  const z = z0 - 0.008; // the frame's faces; the light bars and plates stand out to the box
  const half = OPENING / 2 - REVEAL;
  const head = bottom + HEIGHT - REVEAL;
  const jambs = [span(-w / 2, bottom, -z, -half, head, z), span(half, bottom, -z, w / 2, head, z)];
  const plates = [-1, 1].flatMap((side) => {
    const xm = side * (half + (w / 2 - half) / 2);
    return [-1, 1].map((face) =>
      span(
        xm - 0.06,
        bottom + 0.9,
        Math.min(face * z, face * z0),
        xm + 0.06,
        bottom + 1.5,
        Math.max(face * z, face * z0),
      ),
    );
  });
  return [
    part('body', true, [...jambs, span(-w / 2, head, -z, w / 2, h / 2, z)]),
    part('glow-cyan', false, [
      span(-half + 0.1, head + 0.05, z, half - 0.1, head + 0.09, z0),
      span(-half + 0.1, head + 0.05, -z0, half - 0.1, head + 0.09, -z),
    ]),
    part('steel', true, plates),
    part('frame-dark', false, [span(-half, bottom, -0.18, half, bottom + 0.01, 0.18)]),
    part('trim', false, [span(-half, bottom + 0.01, -0.025, half, bottom + 0.012, 0.025)]),
  ];
};

export const STARSHIP_PROPS = {
  'starship-leaf': leaf,
  'starship-frame': frame,
} satisfies Partial<Record<Prop, PropBuilder>>;
