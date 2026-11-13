import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { slab } from '../assembly';
import { box, drum, type Hinge, part, type PropBuilder, type PropPart, rod, sphere } from './parts';

// The teacher's washroom (UX3): a close-coupled toilet, a wall-hung basin with its mixer and trap,
// a mirror and its light, a toilet roll holder, and the wall tiles shared by its walls. Ceramic is
// the item's own colour (the toilet's and the basin's body); stainless steel, the seat's plastic,
// tile grout and the mirror's glass are finishes. Backs are at −z, on a wall. UX3.1 adds its
// hinged door.

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
  slab(x1 - x0, z1 - z0, y1 - y0, corner, Math.min(bevel, (y1 - y0) / 3)).translate(
    (x0 + x1) / 2,
    y0,
    (z0 + z1) / 2,
  );

/** An upright oval solid: a drum stretched along z by `stretch`, centred at z = `z`. */
const oval = (r0: number, r1: number, y0: number, y1: number, stretch: number, z: number) =>
  drum(r0, r1, y0, y1, 32).scale(1, 1, stretch).translate(0, 0, z);

/**
 * Sanitary ware is laid out at its usual size (`nominal`, floor at y = 0) and fitted to the item's
 * box: a toilet or basin a little larger or smaller keeps its proportions.
 */
const fitted =
  (nominal: readonly [number, number, number], build: () => readonly PropPart[]): PropBuilder =>
  ([w = 0, h = 0, d = 0]) => {
    const [nw, nh, nd] = nominal;
    const parts = build();
    for (const { geometry } of parts)
      geometry.translate(0, -nh / 2, 0).scale(w / nw, h / nh, d / nd);
    return parts;
  };

/**
 * A close-coupled toilet (its cistern at −z, the wall): a back-to-wall pan and a tapered oval
 * bowl in the item's ceramic, the cistern and its lid on the pan's back, a closed seat and lid in
 * white plastic on two steel hinges, and the dual flush buttons on the cistern's lid.
 */
const toilet = fitted([0.4, 0.75, 0.65], () => [
  part('body', true, [
    rounded(-0.17, 0, -0.3, 0.17, 0.4, 0.06, 0.07, 0.01),
    oval(0.12, 0.185, 0, 0.4, 1.2, 0.09),
    rounded(-0.19, 0.4, -0.325, 0.19, 0.735, -0.14, 0.03, 0.01),
    rounded(-0.195, 0.735, -0.325, 0.195, 0.744, -0.135, 0.03, 0.003),
  ]),
  part('seat-white', true, [
    oval(0.19, 0.19, 0.4, 0.418, 1.2, 0.09),
    oval(0.185, 0.18, 0.418, 0.44, 1.2, 0.09),
  ]),
  part('steel', false, [
    drum(0.021, 0.021, 0.744, 0.75, 20).translate(-0.024, 0, -0.23),
    drum(0.021, 0.021, 0.744, 0.75, 20).translate(0.024, 0, -0.23),
    rod(0.008, v(-0.09, 0.428, -0.12), v(-0.05, 0.428, -0.12)),
    rod(0.008, v(0.05, 0.428, -0.12), v(0.09, 0.428, -0.12)),
  ]),
]);

/** A quarter of an upright cylinder of radius r about (x, z), from y0 to y1, from angle `from`. */
const quarter = (r: number, x: number, z: number, y0: number, y1: number, from: number) =>
  new THREE.CylinderGeometry(r, r, y1 - y0, 8, 1, false, from, Math.PI / 2).translate(
    x,
    (y0 + y1) / 2,
    z,
  );

/**
 * A wall-hung basin (its back at −z, the wall), rim 0.83 m up: a ceramic body in the item's
 * colour — a rounded underside, a rear deck carrying the tap, rounded front corners round a
 * square bowl — a stainless single-lever mixer whose spout ends over the drain, and a chrome
 * bottle trap under it to the wall. Nothing stands under it (knee room).
 */
const wallBasin = fitted([0.5, 1, 0.4], () => {
  const [floor, rim] = [0.7, 0.83]; // the bowl's floor (the underside's top) and the rim
  const [tap, drain] = [-0.14, 0.035]; // where the mixer and the drain stand (z)
  return [
    part('body', true, [
      rounded(-0.25, 0.62, -0.2, 0.25, floor, 0.2, 0.05, 0.015),
      span(-0.25, floor, -0.2, 0.25, rim, -0.08),
      span(-0.25, floor, -0.08, -0.2, rim, 0.15),
      span(0.2, floor, -0.08, 0.25, rim, 0.15),
      span(-0.2, floor, 0.15, 0.2, rim, 0.2),
      quarter(0.05, 0.2, 0.15, floor, rim, 0),
      quarter(0.05, -0.2, 0.15, floor, rim, -Math.PI / 2),
    ]),
    part('steel', false, [
      drum(0.022, 0.022, floor, floor + 0.003, 16).translate(0, 0, drain),
      drum(0.028, 0.028, rim, rim + 0.006, 20).translate(0, 0, tap),
      drum(0.02, 0.02, rim + 0.006, 0.95, 20).translate(0, 0, tap),
      rod(0.011, v(0, 0.93, tap), v(0, 0.93, drain), 12),
      sphere(0.011, 0, 0.93, drain, 12),
      drum(0.012, 0.012, 0.905, 0.93, 12).translate(0, 0, drain),
      rod(0.006, v(0, 0.95, tap - 0.01), v(0, 0.985, -0.07)),
      sphere(0.007, 0, 0.985, -0.07, 8),
      rod(0.016, v(0, 0.62, drain), v(0, 0.5, drain), 12),
      drum(0.032, 0.032, 0.38, 0.5, 16).translate(0, 0, drain),
      rod(0.016, v(0, 0.46, drain), v(0, 0.46, -0.19), 12),
      drum(0.035, 0.035, 0, 0.01, 16)
        .rotateX(Math.PI / 2)
        .translate(0, 0.46, -0.2),
    ]),
  ];
});

/**
 * A mirror on the wall (its back at −z): silvered glass in a slim frame of the item's colour
 * (satin aluminium) on a back plate, the frame 4 mm proud of the glass.
 */
const mirror: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const f = Math.min(0.015, w / 10, h / 10);
  const plate = -d / 2 + Math.min(0.004, d / 5);
  return [
    part('body', false, [
      span(-w / 2, -h / 2, -d / 2, w / 2, h / 2, plate),
      span(-w / 2, h / 2 - f, plate, w / 2, h / 2, d / 2),
      span(-w / 2, -h / 2, plate, w / 2, -h / 2 + f, d / 2),
      span(-w / 2, -h / 2 + f, plate, -w / 2 + f, h / 2 - f, d / 2),
      span(w / 2 - f, -h / 2 + f, plate, w / 2, h / 2 - f, d / 2),
    ]),
    part('mirror', false, [
      span(-w / 2 + f, -h / 2 + f, plate, w / 2 - f, h / 2 - f, d / 2 - Math.min(0.004, d / 5)),
    ]),
  ];
};

/**
 * The light over the mirror (its back at −z): an aluminium bar with a glowing diffuser along its
 * underside (the item's colour, a `light` look), which washes the mirror and the basin below.
 */
const mirrorLight: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const lens = Math.min(0.012, h / 3);
  return [
    part('body', false, [
      span(-w / 2 + 0.008, -h / 2, -d / 2 + 0.012, w / 2 - 0.008, -h / 2 + lens, d / 2 - 0.006),
    ]),
    part('aluminium', false, [span(-w / 2, -h / 2 + lens, -d / 2, w / 2, h / 2, d / 2)]),
  ];
};

/**
 * A toilet roll holder (its back at −z): a steel wall plate at its left and an arm out to a
 * spindle along the wall (the item's colour), with a paper roll on it.
 */
const rollHolder: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const r = Math.min(0.055, h / 2.6, d / 2.2); // the roll
  const [yc, zc] = [-h / 2 + r + 0.001, d / 2 - r - 0.001]; // the spindle
  const x0 = -w / 2 + 0.015; // the arm
  const length = Math.min(0.1, w - 0.05);
  return [
    part('body', false, [
      span(-w / 2, yc - 0.035, -d / 2, -w / 2 + 0.03, yc + 0.035, -d / 2 + 0.008),
      rod(0.006, v(x0, yc, -d / 2 + 0.008), v(x0, yc, zc)),
      sphere(0.006, x0, yc, zc, 8),
      rod(0.008, v(x0, yc, zc), v(w / 2 - 0.005, yc, zc)),
    ]),
    part('linen', false, [
      drum(r, r, -length / 2, length / 2, 24)
        .rotateZ(Math.PI / 2)
        .translate(w / 2 - 0.01 - length / 2, yc, zc),
    ]),
  ];
};

/** Wall tiles: 200 mm square, 3 mm joints, under a 10 mm aluminium edge trim. */
const TILE = 0.2;
const JOINT = 0.003;
const CAP = 0.01;

/**
 * Tiled wall cladding (its back at −z, on the wall): square tiles in the item's colour laid from
 * its bottom left corner, the last row and column cut to fit, standing proud of a grey grout bed,
 * and an aluminium edge trim along its top.
 */
const tileWainscot: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [back, front, top] = [-d / 2, d / 2, h / 2 - CAP];
  const bed = back + 0.6 * d;
  const tiles: G[] = [];
  for (let row = 0; -h / 2 + row * TILE < top - JOINT; row++) {
    const y = -h / 2 + row * TILE;
    for (let col = 0; -w / 2 + col * TILE < w / 2 - JOINT; col++) {
      const x = -w / 2 + col * TILE;
      tiles.push(
        span(
          x + JOINT / 2,
          y + JOINT / 2,
          bed - 0.001,
          Math.min(x + TILE, w / 2) - JOINT / 2,
          Math.min(y + TILE, top) - JOINT / 2,
          front - 0.2 * d,
        ),
      );
    }
  }
  return [
    part('body', false, tiles),
    part('grout', false, [span(-w / 2, -h / 2, back, w / 2, top, bed)]),
    part('aluminium', false, [span(-w / 2, top, back, w / 2, h / 2, front)]),
  ];
};

/** The washroom door's casing width (each leg) and head height; the leaf's thickness (m). */
const CASING = 0.08;
const HEAD = 0.07;
const LEAF = 0.04;

/**
 * The washroom door (UX3.1; its back, −z, on the wall face; the Teacher Room at +z): a painted
 * casing round the opening in the item's colour, and a flush solid leaf — no vision panel, unlike
 * the sliding lab doors — hung on three steel knuckle hinges at the +x jamb, which swings out
 * into the Teacher Room. On its room face, a steel lever on a round rose at the free edge, 1 m
 * up, an emergency-release turn under it, and a steel kick plate. Only the leaf moves.
 */
const wcDoor: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [half, bottom, top, back] = [w / 2 - CASING, -h / 2 + 0.01, h / 2 - HEAD, -d / 2];
  const face = back + LEAF; // the leaf's room face
  // The leaf turns about its room face's edge at the +x jamb (the west one, as placed).
  const hinge: Hinge = { x: half, z: face, opens: 1 };
  const [lx, ly, lz] = [-half + 0.08, -h / 2 + 1, d / 2 - 0.01]; // the lever's spindle and bar
  const rose = (r: number, y: number) =>
    drum(r, r, 0, 0.008, 20)
      .rotateX(Math.PI / 2)
      .translate(lx, y, face);
  const knuckle = (y: number) =>
    drum(0.009, 0.009, y - 0.05, y + 0.05, 12).translate(half, 0, face);
  return [
    part('body', true, [
      span(-w / 2, -h / 2, back, -half, h / 2, 0),
      span(half, -h / 2, back, w / 2, h / 2, 0),
      span(-half, top, back, half, h / 2, 0),
    ]),
    part('body', true, [span(-half, bottom, back, half, top, face)], hinge),
    part(
      'steel',
      false,
      [
        knuckle(top - 0.2),
        knuckle((top + bottom) / 2 + 0.25),
        knuckle(bottom + 0.2),
        rose(0.026, ly),
        rod(0.007, v(lx, ly, face + 0.008), v(lx, ly, lz)),
        rod(0.009, v(lx, ly, lz), v(lx + 0.12, ly, lz), 10),
        rose(0.018, ly - 0.1),
        // The kick plate, brushed steel like the lab doors' (black, it read as a gap under it).
        span(-half + 0.03, bottom, face, half - 0.03, bottom + 0.2, face + 0.0015),
      ],
      hinge,
    ),
    part(
      'trim',
      false,
      [box(0.004, 0.022, 0.003, lx, ly - 0.1, face + 0.0095)], // the release's slot
      hinge,
    ),
  ];
};

export const WASHROOM_PROPS = {
  toilet,
  'wall-basin': wallBasin,
  mirror,
  'mirror-light': mirrorLight,
  'roll-holder': rollHolder,
  'tile-wainscot': tileWainscot,
  'wc-door': wcDoor,
} satisfies Partial<Record<Prop, PropBuilder>>;
