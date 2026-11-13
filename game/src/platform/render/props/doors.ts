import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { slab } from '../assembly';
import { box, part, type PropBuilder } from './parts';

// The walk-through doors' one visual language (UX3): the sliding leaf, and on each side of its
// wall the hardware around it — a track cover (header) over the leaf and its travel, the track
// rail behind the leaf's top, a jamb on the side the leaf closes against, and small wall plates.
// The leaf is an entity (its parts slide with its mesh); the rest is decor on the wall face.
// Rooms set the hardware's colour (the item's); the profiles stay the same everywhere. The leaf is
// seen from both faces (its two rooms) and the wall pieces are turned by π on half the walls, so
// each is symmetric: the leaf in z, the wall pieces in x.

type G = THREE.BufferGeometry;

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** An upright bar from x0 to x1 and y0 to y1, `d` thick, its four long edges rounded. */
const post = (x0: number, x1: number, y0: number, y1: number, d: number, z = 0) =>
  slab(x1 - x0, d, y1 - y0, 0.005, 0.002).translate((x0 + x1) / 2, y0, z);

/** A flat plate on the wall (its back at z0), w × h, `t` thick, its corners rounded. */
const plate = (w: number, h: number, t: number, z0: number) =>
  slab(w, h, t, Math.min(0.012, w / 8), 0.001)
    .rotateX(Math.PI / 2)
    .translate(0, 0, z0);

/** A flat shape facing +z at depth z. */
const flat = (geometry: G, x: number, y: number, z: number) => geometry.translate(x, y, z);

/** The leaf's frame members (m): stiles, top and bottom rails, the kick plate's height. */
const STILE = 0.1;
const RAIL = 0.1;
const KICK = 0.2;
/** The vision panel (controlled glass): its half width and its bottom and top above the floor. */
const GLASS = { half: 0.15, bottom: 1.0, top: 1.85, gasket: 0.012 };
/** The flush pull in the stile at the closing (−x) edge: width, height and centre above the floor. */
const PULL = { w: 0.035, h: 0.16, y: 1.0, depth: 0.022 };

/**
 * A sliding door leaf (front ±z, the same on both faces; it slides towards +x): an aluminium frame
 * in the item's colour — two stiles with rounded edges, top and bottom rails — round a white inset
 * panel 8 mm back from the frame; a tall vision panel of tinted safety glass in a dark gasket,
 * opaque because the scene behind a closed door is not loaded; a stainless kick plate on both
 * faces; and a flush pull recessed into the closing stile on both faces.
 */
const doorLeaf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top, t] = [-h / 2, h / 2, d / 2];
  const [x0, x1] = [-w / 2 + STILE, w / 2 - STILE]; // the panel field
  const yk = bottom + KICK; // the kick plate's top
  const [y0, y1] = [yk + RAIL, top - RAIL];
  const [panel, kick] = [t - 0.008, t - 0.004]; // their faces (±z)
  const [gb, gt] = [bottom + GLASS.bottom, bottom + GLASS.top];
  const outer = GLASS.half + GLASS.gasket;
  const pullX = -w / 2 + STILE / 2;
  const [pb, pt] = [bottom + PULL.y - PULL.h / 2, bottom + PULL.y + PULL.h / 2];
  const [px0, px1] = [pullX - PULL.w / 2, pullX + PULL.w / 2];
  return [
    part('body', true, [
      post(x1, w / 2, yk, top, d),
      post(-w / 2, x0, yk, pb, d),
      post(-w / 2, x0, pt, top, d),
      span(-w / 2, pb, -t, px0, pt, t), // beside the pull
      span(px1, pb, -t, x0, pt, t),
      span(x0, y1, -t, x1, top, t),
      span(x0, yk, -t, x1, y0, t),
      span(-w / 2, bottom, -kick, w / 2, yk, kick), // behind the kick plates
    ]),
    part('worktop-white', true, [
      span(x0, y0, -panel, x1, gb - GLASS.gasket, panel),
      span(x0, gt + GLASS.gasket, -panel, x1, y1, panel),
      span(x0, gb - GLASS.gasket, -panel, -outer, gt + GLASS.gasket, panel),
      span(outer, gb - GLASS.gasket, -panel, x1, gt + GLASS.gasket, panel),
    ]),
    part('rubber', false, [
      span(-outer, gb - GLASS.gasket, -panel - 0.002, outer, gb, panel + 0.002),
      span(-outer, gt, -panel - 0.002, outer, gt + GLASS.gasket, panel + 0.002),
      span(-outer, gb, -panel - 0.002, -GLASS.half, gt, panel + 0.002),
      span(GLASS.half, gb, -panel - 0.002, outer, gt, panel + 0.002),
      span(px0, pb, PULL.depth - t, px1, pt, t - PULL.depth), // the pull's cup, both faces
    ]),
    part('vision-glass', true, [span(-GLASS.half, gb, -t + 0.016, GLASS.half, gt, t - 0.016)]),
    part(
      'steel',
      false,
      [
        [-t, -kick],
        [kick, t],
      ].map(([z0 = 0, z1 = 0]) =>
        span(-w / 2 + 0.005, bottom + 0.005, z0, w / 2 - 0.005, yk - 0.005, z1),
      ),
    ),
  ];
};

/**
 * A sliding door's track cover over the leaf and its travel (its back on the wall, −z): a fascia
 * in the item's colour with rounded long edges, a top and a back plate; from below, a dark soffit
 * inside it and dark end caps.
 */
const doorHeader: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const fascia = 0.012;
  const back = -d / 2;
  return [
    part('body', true, [
      slab(h, fascia, w, 0.004, 0.001)
        .rotateZ(-Math.PI / 2)
        .translate(-w / 2, 0, d / 2 - fascia / 2),
      span(-w / 2, h / 2 - 0.008, back, w / 2, h / 2, d / 2 - fascia),
      span(-w / 2, -h / 2, back, w / 2, h / 2 - 0.008, back + 0.006),
    ]),
    part('trim', false, [
      span(-w / 2, -h / 2 + 0.03, back + 0.006, w / 2, -h / 2 + 0.036, d / 2 - fascia),
      span(-w / 2, -h / 2, back + 0.006, -w / 2 + 0.006, h / 2 - 0.008, d / 2 - fascia),
      span(w / 2 - 0.006, -h / 2, back + 0.006, w / 2, h / 2 - 0.008, d / 2 - fascia),
    ]),
  ];
};

/** The track rail behind the leaf's top (its back on the wall, −z): a dark C-channel. */
const doorRail: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [back, web, flange] = [-d / 2, 0.006, 0.012];
  return [
    part('body', false, [
      span(-w / 2, -h / 2, back, w / 2, h / 2, back + web),
      span(-w / 2, -h / 2, back + web, w / 2, -h / 2 + flange, d / 2),
      span(-w / 2, h / 2 - flange, back + web, w / 2, h / 2, d / 2),
    ]),
  ];
};

/**
 * The jamb the leaf closes against (its back on the wall, −z): a post in the item's colour with
 * rounded edges and, on both sides, rubber buffers at hand height — or, `sealed` (the clean
 * areas), a full-height silicone seal line.
 */
const doorJamb =
  (sealed: boolean): PropBuilder =>
  ([w = 0, h = 0, d = 0]) => {
    const [bottom, edge] = [-h / 2, 0.005];
    const [y0, y1] = sealed ? [bottom + 0.01, -bottom - 0.01] : [bottom + 0.96, bottom + 1.04];
    return [
      part('body', true, [post(-w / 2 + edge, w / 2 - edge, bottom, -bottom, d)]),
      part(
        sealed ? 'seal' : 'rubber',
        false,
        [-w / 2, w / 2 - edge].map((x) => span(x, y0, -d / 2 + 0.005, x + edge, y1, d / 2 - 0.01)),
      ),
    ];
  };

/** A small square wall plate (its back on the wall, −z): its 5 mm base in the item's colour. */
const BASE = 0.005;

/**
 * The clean-area pictogram: a blue disc on the white plate with a gowned, hooded figure and a
 * sparkle in white.
 */
const cleanPlate: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const z = -d / 2 + BASE;
  const r = (Math.min(w, h) / 2) * 0.75;
  const gown = new THREE.Shape([
    new THREE.Vector2(-0.45 * r, -0.62 * r),
    new THREE.Vector2(0.45 * r, -0.62 * r),
    new THREE.Vector2(0.22 * r, 0.12 * r),
    new THREE.Vector2(-0.22 * r, 0.12 * r),
  ]);
  return [
    part('body', false, [plate(w, h, BASE, -d / 2)]),
    part('sign-blue', false, [flat(new THREE.CircleGeometry(r, 32), 0, 0, z + 0.001)]),
    part('linen', false, [
      flat(new THREE.CircleGeometry(0.17 * r, 16), 0, 0.36 * r, z + 0.002),
      flat(new THREE.ShapeGeometry(gown), 0, 0, z + 0.002),
      flat(new THREE.CircleGeometry(0.14 * r, 4), 0.42 * r, 0.38 * r, z + 0.002),
    ]),
  ];
};

/** The laboratory warning plate: a yellow triangle with a black border and "!" (ISO 7010 W001). */
const hazardPlate: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const z = -d / 2 + BASE;
  const r = (Math.min(w, h) / 2) * 0.85; // the border triangle's circumradius
  const down = -r / 4; // centres the triangle's height on the plate
  const triangle = (radius: number, at: number) =>
    flat(new THREE.CircleGeometry(radius, 3, Math.PI / 2), 0, down, at);
  const mark = (y0: number, y1: number) =>
    flat(new THREE.PlaneGeometry(0.07 * r, (y1 - y0) * r), 0, ((y0 + y1) / 2) * r, z + 0.0025);
  return [
    part('body', false, [plate(w, h, BASE, -d / 2)]),
    part('trim', false, [triangle(r, z + 0.0005), mark(-0.12, 0.32), mark(-0.3, -0.19)]),
    part('hazard-yellow', false, [triangle(0.78 * r, z + 0.0015)]),
  ];
};

export const DOOR_PROPS = {
  'door-leaf': doorLeaf,
  'door-header': doorHeader,
  'door-rail': doorRail,
  'door-jamb': doorJamb(false),
  'door-jamb-sealed': doorJamb(true),
  'door-plate-clean': cleanPlate,
  'door-plate-hazard': hazardPlate,
} satisfies Partial<Record<Prop, PropBuilder>>;
