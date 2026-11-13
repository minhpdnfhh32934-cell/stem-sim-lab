import * as THREE from 'three';
import type { Prop } from '../../../gameplay/props';
import { slab } from '../assembly';
import { withSmallParts } from '../detail';
import type { Finish } from '../palette';
import { box, drum, part, type PropBuilder, type PropPart, rod, sphere } from './parts';

// The laboratories' furniture and fittings (docs: Z3 §4, Appendix A). Sizes come from the items:
// joinery (worktops, fronts, plinths, shelves) is laid out in metres inside the box; small fittings
// (stool, tap, extinguisher, microscope, safety shower) are drawn at their shipped size and scaled
// to the item's. Fronts face +z; what stands against a wall has its back at −z. All decorative:
// glassware, specimens and fittings show nothing a simulation would have to back up — no liquid
// levels, labels, readings or lit displays.

type G = THREE.BufferGeometry;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The kick plinth under cupboards, and how far it is set back from their sides and fronts. */
const PLINTH = 0.08;
const PLINTH_SET = 0.04;
/** A 30 mm worktop, overhanging the cupboards. */
const TOP = 0.03;
const OVERHANG = 0.02;
/** Cupboard fronts stand on a dark backing that shows as the gaps between them. */
const BACKING = 0.004;
const FRONT = 0.018;
const GAP = 0.008;
/** How far a bar handle stands out from its front. */
const HANDLE = 0.022;
/** What fronts and handles take before a carcass. */
const REACH = BACKING + FRONT + HANDLE;
/** A drawer over a door. */
const DRAWER = 0.14;

/** The pieces of the finishes cupboards share, gathered while a prop is built. */
interface Kit {
  readonly body: G[];
  readonly trim: G[];
  readonly steel: G[];
}
const kit = (): Kit => ({ body: [], trim: [], steel: [] });

/** The same pieces and their copies turned half round: the other side of a double-sided bench. */
const bothSides = (pieces: readonly G[]) => [
  ...pieces,
  ...pieces.map((g) => g.clone().rotateY(Math.PI)),
];

/** A finish's part, or none when the size left no room for its pieces (shelf contents). */
const some = (finish: Finish, casts: boolean, pieces: readonly G[]) =>
  pieces.length > 0 ? [part(finish, casts, pieces)] : [];

/** Every part scaled from the size it was drawn at to the item's. */
function scaled(parts: readonly PropPart[], sx: number, sy: number, sz: number) {
  for (const { geometry } of parts) geometry.scale(sx, sy, sz);
  return parts;
}

/** A box between two corners. */
const span = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/**
 * One bay of cupboard fronts on a carcass face at z (facing +z), across x0…x1 and y0…y1: the dark
 * backing, a drawer over a door (or a door alone), each with a steel bar handle near its top.
 */
function bay(k: Kit, x0: number, x1: number, y0: number, y1: number, z: number, drawer: number) {
  k.trim.push(span(x0, y0, z, x1, y1, z + BACKING));
  const [a, b, face] = [x0 + GAP / 2, x1 - GAP / 2, z + BACKING];
  const rows = drawer > 0 ? [y1 - drawer, y1, y0, y1 - drawer] : [y0, y1];
  for (let i = 0; i < rows.length; i += 2) {
    const [c0, c1] = [(rows[i] ?? 0) + GAP / 2, (rows[i + 1] ?? 0) - GAP / 2];
    k.body.push(span(a, c0, face, b, c1, face + FRONT));
    const [length, y] = [Math.min(0.16, (b - a) / 2), c1 - Math.min(0.05, (c1 - c0) / 2)];
    k.steel.push(box(length, 0.012, HANDLE, (a + b) / 2, y, face + FRONT + HANDLE / 2));
  }
}

/** A worktop w × d, its top the box's top, round a hole [x0, x1, z0, z1] if there is one. */
function worktop(w: number, d: number, top: number, hole?: readonly number[]): G[] {
  const y = top - TOP;
  if (!hole) return [span(-w / 2, y, -d / 2, w / 2, top, d / 2)];
  const [x0 = 0, x1 = 0, z0 = 0, z1 = 0] = hole;
  return [
    span(-w / 2, y, -d / 2, w / 2, top, z0),
    span(-w / 2, y, z1, w / 2, top, d / 2),
    span(-w / 2, y, z0, x0, top, z1),
    span(x1, y, z0, w / 2, top, z1),
  ];
}

/** A steel bowl hung in a worktop's hole, its rims flush with the top, a dark drain at its bottom. */
function bowl(k: Kit, hole: readonly number[], top: number, depth: number) {
  const [x0 = 0, x1 = 0, z0 = 0, z1 = 0] = hole;
  const [t, y] = [0.004, top - depth];
  k.steel.push(
    span(x0, y, z0, x1, y + t, z1),
    span(x0, y, z0, x1, top, z0 + t),
    span(x0, y, z1 - t, x1, top, z1),
    span(x0, y, z0 + t, x0 + t, top, z1 - t),
    span(x1 - t, y, z0 + t, x1, top, z1 - t),
  );
  const r = Math.min(0.025, (x1 - x0) / 6, (z1 - z0) / 6);
  k.trim.push(drum(r, r, y + t, y + t + 0.003, 12).translate((x0 + x1) / 2, 0, (z0 + z1) / 2));
}

/**
 * A students' island bench, worked from both long sides: a dark epoxy top with a steel cup sink at
 * its centre (no tap: nothing rises above the worktop, the box's top) on two end pedestals of
 * cupboards — a drawer over a door on each side — with knee space between them, closed down the
 * middle by a modesty panel.
 */
const labIsland: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const [y0, y1] = [bottom + PLINTH, top - TOP]; // the cupboards' bottom and top
  const half = d / 2 - OVERHANG - REACH; // the pedestals' half depth
  const outer = w / 2 - OVERHANG;
  const width = Math.min(0.6, Math.max(0.3, 0.16 * w), outer); // a pedestal's
  const inner = outer - width; // half the knee space
  const cup = Math.min(0.16, w / 6, d / 6);
  const depth = Math.min(0.12, (y1 - y0) / 3); // the cup sink's
  const hole = [-cup / 2, cup / 2, -cup / 2, cup / 2];
  const k = kit();
  const front = kit(); // the +z side's fronts, turned for the −z side
  for (const x of [inner + width / 2, -inner - width / 2]) {
    k.body.push(box(width, y1 - y0, 2 * half, x, (y0 + y1) / 2, 0));
    k.trim.push(
      box(width - 2 * PLINTH_SET, PLINTH, 2 * (half - PLINTH_SET), x, bottom + PLINTH / 2, 0),
    );
    bay(front, x - width / 2, x + width / 2, y0, y1, half, DRAWER);
  }
  // The modesty panel, dark like the recess it closes, stops short of the floor and the cup sink.
  if (inner > 0) k.trim.push(span(-inner, y0 + 0.07, -0.01, inner, y1 - depth - 0.02, 0.01));
  bowl(k, hole, top, depth);
  return [
    part('body', true, [...k.body, ...bothSides(front.body)]),
    part('worktop-epoxy', true, worktop(w, d, top, hole)),
    part('steel', false, [...k.steel, ...bothSides(front.steel)]),
    part('trim', false, [...k.trim, ...bothSides(front.trim)]),
  ];
};

/**
 * A bench along a wall (its back at −z): a dark epoxy worktop over a run of cupboards — a drawer
 * over a door in each bay — on a recessed plinth. With a sink: a steel bowl in the middle bay, its
 * centre 0.3 m from the wall, under the wall tap (a separate item); that bay is a door alone.
 */
const wallBench =
  (sink: boolean): PropBuilder =>
  ([w = 0, h = 0, d = 0]) => {
    const [bottom, top] = [-h / 2, h / 2];
    const [y0, y1] = [bottom + PLINTH, top - TOP];
    const face = d / 2 - OVERHANG - REACH; // the cupboards' front
    const outer = w / 2 - OVERHANG;
    let bays = Math.max(1, Math.round((2 * outer) / 0.6));
    if (sink && bays % 2 === 0) bays += 1; // the sink's bay in the middle
    const width = (2 * outer) / bays;
    const depth = Math.min(0.2, (y1 - y0) / 2);
    const [sw, sd] = [Math.min(0.5, width - 0.1), Math.min(0.4, d - 0.2)];
    const sz = Math.min(0.3 - d / 2, face - 0.02 - sd / 2);
    const hole = sink ? [-sw / 2, sw / 2, sz - sd / 2, sz + sd / 2] : undefined;
    const k = kit();
    const carcass = (x0: number, x1: number, upTo: number) => {
      if (x1 - x0 > 1e-6) k.body.push(span(x0, y0, -d / 2, x1, upTo, face));
    };
    if (hole) {
      carcass(-outer, -width / 2, y1);
      carcass(width / 2, outer, y1);
      carcass(-width / 2, width / 2, top - depth - 0.01); // under the bowl
      k.body.push(span(-width / 2, top - depth - 0.01, -d / 2, width / 2, y1, -d / 2 + 0.01));
      bowl(k, hole, top, depth);
    } else carcass(-outer, outer, y1);
    for (let i = 0; i < bays; i++) {
      const x0 = -outer + i * width;
      bay(k, x0, x0 + width, y0, y1, face, sink && 2 * i === bays - 1 ? 0 : DRAWER);
    }
    k.trim.push(
      span(-outer + PLINTH_SET, bottom, -d / 2, outer - PLINTH_SET, y0, face - PLINTH_SET),
    );
    return [
      part('body', true, k.body),
      part('worktop-epoxy', true, worktop(w, d, top, hole)),
      part('steel', false, k.steel),
      part('trim', false, k.trim),
    ];
  };

/**
 * A storage cupboard (its back at −z) in the item's colour — safety yellow, acid blue — with two
 * doors (one if narrow) on a dark backing that shows as the gaps, steel bar handles at hand height
 * by the doors' meeting edge, on a recessed plinth.
 */
const cabinetDoors: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const y0 = bottom + PLINTH;
  const face = d / 2 - REACH;
  const doors = w >= 0.7 ? 2 : 1;
  const leaf = (w - (doors + 1) * GAP) / doors;
  const length = Math.min(0.2, (top - y0) / 4);
  const y = Math.min(bottom + 1.05, top - GAP - 0.04 - length / 2); // the handles' centre
  const k = kit();
  k.body.push(span(-w / 2, y0, -d / 2, w / 2, top, face));
  k.trim.push(
    span(-w / 2 + PLINTH_SET, bottom, -d / 2, w / 2 - PLINTH_SET, y0, face - PLINTH_SET),
    span(-w / 2, y0, face, w / 2, top, face + BACKING),
  );
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + GAP + i * (leaf + GAP);
    k.body.push(span(x0, y0 + GAP, face + BACKING, x0 + leaf, top - GAP, face + BACKING + FRONT));
    const x = i === 0 ? x0 + leaf - 0.04 : x0 + 0.04;
    k.steel.push(box(0.014, length, HANDLE, x, y, d / 2 - HANDLE / 2));
  }
  return [part('body', true, k.body), part('steel', false, k.steel), part('trim', false, k.trim)];
};

/**
 * Open shelving: four corner posts and shelves, the lowest just off the floor, the highest the
 * box's top; and, for each shelf below the top, the height of its top and the clear height over it.
 */
function shelving(w: number, h: number, d: number, pitch: number) {
  const [bottom, top] = [-h / 2, h / 2];
  const [post, t, lowest] = [0.03, 0.02, bottom + 0.08];
  const n = Math.max(1, Math.round((top - lowest) / pitch));
  const step = (top - lowest) / n;
  const pieces: G[] = [];
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      pieces.push(box(post, h, post, x * (w / 2 - post / 2), 0, z * (d / 2 - post / 2)));
    }
  }
  const levels: { y: number; clear: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const y = lowest + i * step;
    pieces.push(span(-w / 2, y - t, -d / 2, w / 2, y, d / 2));
    if (i < n) levels.push({ y, clear: step - t });
  }
  return { pieces, levels, post };
}

/** Glassware by kind: radius and height before fitting a shelf. */
const GLASSWARE = {
  beaker: [0.05, 0.13],
  flask: [0.055, 0.17],
  cylinder: [0.017, 0.3],
  bottle: [0.038, 0.17],
} as const;
type Glassware = keyof typeof GLASSWARE;

/** What stands on each shelf from the bottom: groups of a kind (× its size), repeated along it. */
const SHELF_GROUPS: readonly (readonly (readonly [Glassware, number])[])[][] = [
  [
    [
      ['beaker', 1],
      ['beaker', 0.8],
      ['beaker', 0.65],
    ],
    [
      ['bottle', 1],
      ['bottle', 1],
    ],
  ],
  [
    [
      ['flask', 1],
      ['flask', 0.8],
      ['flask', 0.65],
    ],
    [
      ['beaker', 0.65],
      ['beaker', 0.65],
    ],
  ],
  [
    [
      ['cylinder', 1],
      ['cylinder', 0.8],
      ['cylinder', 0.65],
    ],
    [
      ['flask', 0.8],
      ['flask', 0.8],
    ],
  ],
  [
    [
      ['bottle', 1],
      ['bottle', 0.8],
      ['bottle', 1],
    ],
    [['flask', 0.65]],
  ],
];

/**
 * Steel shelving (its back at −z, the item's colour) of clean glassware before a dark back panel
 * that shows it up: beakers, conical flasks and measuring cylinders in clear glass, reagent bottles
 * in amber glass. Empty and unlabelled: decoration, not stock — no chemistry runs in the lab yet.
 */
const glasswareShelf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { pieces, levels, post } = shelving(w, h, d, 0.42);
  const [clear, amber]: [G[], G[]] = [[], []];
  const [start, end] = [-w / 2 + post + 0.03, w / 2 - post - 0.03];
  const z = -0.02 * Math.min(1, d / 0.4); // a little back from the shelves' front
  levels.forEach(({ y, clear: room }, i) => {
    const groups = SHELF_GROUPS[i % SHELF_GROUPS.length] ?? [];
    for (let x = start, g = 0; x < end; g++) {
      for (const [kind, size] of groups[g % groups.length] ?? []) {
        const [r0, h0] = GLASSWARE[kind];
        const r = Math.min(r0 * size, d / 2 - 0.04);
        const tall = Math.min(h0 * size, room - 0.04);
        if (x + 2 * r > end) return;
        const [base, at] = [y + 0.001, (g: G) => g.translate(x + r, 0, z)];
        if (kind === 'beaker') clear.push(at(drum(r, r, base, base + tall, 8)));
        if (kind === 'cylinder') clear.push(at(drum(r, r, base, base + tall, 8)));
        if (kind === 'flask') {
          clear.push(at(drum(r, 0.3 * r, base, base + 0.68 * tall, 8)));
          clear.push(at(drum(0.3 * r, 0.3 * r, base + 0.68 * tall, base + tall, 6)));
        }
        if (kind === 'bottle') {
          amber.push(at(drum(r, r, base, base + 0.7 * tall, 8)));
          amber.push(at(drum(r, 0.45 * r, base + 0.7 * tall, base + 0.82 * tall, 8)));
          amber.push(at(drum(0.45 * r, 0.45 * r, base + 0.82 * tall, base + tall, 6)));
        }
        x += 2 * r + 0.035;
      }
      x += 0.22; // between groups
    }
  });
  return [
    part('body', true, pieces),
    part('frame-dark', false, [
      span(-w / 2 + post, -h / 2, -d / 2 + 0.005, w / 2 - post, h / 2, -d / 2 + 0.01),
    ]),
    ...some('glass', false, clear),
    ...some('reagent-amber', false, amber),
  ];
};

/**
 * A combined emergency shower and eyewash (its back at −z), in safety green: a supply pipe from a
 * floor flange up to an arm carrying the steel shower head, with a pull rod and triangle handle; a
 * steel eyewash bowl with two nozzles and a push flag at waist height. Drawn at 1 × 2.4 × 0.5 m.
 */
const safetyShower: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-1.2, 1.2];
  const [pz, r, arm, head] = [-0.18, 0.024, 1.08, 0.08]; // pipe z and radius, arm height, head z
  const [eye, ez] = [-0.22, 0.06]; // the eyewash bowl's rim height and its centre's z
  const at = (g: G, x: number, z: number) => g.translate(x, 0, z);
  const body: G[] = [
    at(drum(0.07, 0.07, bottom, bottom + 0.02, 16), 0, pz),
    at(drum(r, r, bottom + 0.02, arm, 12), 0, pz),
    sphere(r, 0, arm, pz, 10),
    rod(r, v(0, arm, pz), v(0, arm, head), 12),
    // wall brackets
    span(-0.025, -0.6, -0.25, 0.025, -0.57, pz),
    span(-0.025, 0.7, -0.25, 0.025, 0.73, pz),
    // pull rod and its triangle handle
    rod(0.006, v(0, arm - r, -0.06), v(0, 0.62, -0.06), 6),
    rod(0.008, v(-0.07, 0.5, -0.06), v(0.07, 0.5, -0.06), 6),
    rod(0.008, v(-0.07, 0.5, -0.06), v(0, 0.62, -0.06), 6),
    rod(0.008, v(0.07, 0.5, -0.06), v(0, 0.62, -0.06), 6),
    // eyewash feed, and its push flag
    rod(0.016, v(0, eye - 0.2, pz), v(0, eye - 0.2, ez), 10),
    sphere(0.016, 0, eye - 0.2, ez, 8),
    rod(0.016, v(0, eye - 0.2, ez), v(0, eye - 0.09, ez), 10),
    rod(0.008, v(0.112, eye - 0.03, ez), v(0.25, eye - 0.03, ez), 6),
    span(0.25, eye - 0.1, ez - 0.07, 0.262, eye + 0.04, ez + 0.07),
  ];
  const steel: G[] = [
    // the shower head: a shallow steel bowl, open below, on a short neck under the arm
    ...bowlOf(0.14, 0.04, arm - r - 0.1, arm - r - 0.015, 0.006, false).map((g) => at(g, 0, head)),
    at(drum(0.02, 0.02, arm - r - 0.02, arm, 10), 0, head),
    // the eyewash bowl, open above, and its two nozzles
    ...bowlOf(0.14, 0.06, eye, eye - 0.09, 0.006, true).map((g) => at(g, 0, ez)),
    at(drum(0.012, 0.012, eye - 0.084, eye - 0.05, 8), -0.045, ez),
    at(drum(0.012, 0.012, eye - 0.084, eye - 0.05, 8), 0.045, ez),
  ];
  return scaled(
    [part('body', true, body), part('steel', true, steel)],
    w / 1,
    h / (top - bottom),
    d / 0.5,
  );
};

/**
 * A round bowl about the y axis with walls t thick: radius `rim` at its open edge (height y1) and
 * `foot` at its closed end (height y0), open above when `up`, else open below (a shower head).
 * Each band is its own lathe so the rim and foot stay sharp.
 */
function bowlOf(rim: number, foot: number, y1: number, y0: number, t: number, up: boolean): G[] {
  const s = up ? 1 : -1; // which way the inside is from the walls' ends
  // The profile, travelled so each band's front is on its right: outside, rim, inside.
  const profile: [number, number][] = up
    ? [
        [0, y0],
        [foot, y0],
        [rim, y1],
        [rim - t, y1],
        [foot - t, y0 + s * t],
        [0, y0 + s * t],
      ]
    : [
        [0, y0 + s * t],
        [foot - t, y0 + s * t],
        [rim - t, y1],
        [rim, y1],
        [foot, y0],
        [0, y0],
      ];
  return profile.slice(1).map(([x, y], i) => {
    const [px = 0, py = 0] = profile[i] ?? [];
    const band = new THREE.LatheGeometry([new THREE.Vector2(px, py), new THREE.Vector2(x, y)], 16);
    // three's lathe leaves its last ring's normals unnormalised.
    const normal = band.getAttribute('normal');
    for (let k = 0; k < normal.count; k++) {
      const n = v(normal.getX(k), normal.getY(k), normal.getZ(k)).normalize();
      normal.setXYZ(k, n.x, n.y, n.z);
    }
    return band;
  });
}

/**
 * A wall-mounted fire extinguisher (cylinder item), red: its cylinder with a domed shoulder, a dark
 * valve with carrying handle and lever, a hose down its side to a nozzle, and the wall bracket
 * behind it. Drawn at 0.16 × 0.55 m.
 */
const extinguisher: PropBuilder = ([w = 0, h = 0]) => {
  const [bottom, top] = [-0.275, 0.275];
  const r = 0.064;
  const body = [
    drum(0.058, r, bottom, bottom + 0.012, 16),
    drum(r, r, bottom + 0.012, top - 0.135, 16),
    drum(r, 0.028, top - 0.135, top - 0.095, 16),
    drum(0.017, 0.017, top - 0.095, top - 0.072, 10),
  ];
  const hose = 0.0065;
  const trim = [
    drum(0.022, 0.02, top - 0.072, top - 0.045, 10),
    box(0.1, 0.008, 0.024, -0.005, top - 0.04, 0),
    new THREE.BoxGeometry(0.09, 0.008, 0.02).rotateZ(0.12).translate(0, top - 0.012, 0),
    box(0.012, 0.03, 0.02, -0.042, top - 0.028, 0),
    rod(hose, v(0.018, top - 0.06, 0), v(0.07, top - 0.1, 0), 6),
    sphere(hose, 0.07, top - 0.1, 0, 6),
    rod(hose, v(0.07, top - 0.1, 0), v(0.07, bottom + 0.14, 0), 6),
    drum(0.006, 0.0095, bottom + 0.095, bottom + 0.14, 8).translate(0.07, 0, 0),
    new THREE.TorusGeometry(r + 0.003, 0.003, 3, 16).rotateX(Math.PI / 2).translate(0, 0.02, 0),
    box(0.034, 0.11, 0.008, 0, 0.02, -0.072),
  ];
  const [sx, sy] = [w / 0.16, h / (top - bottom)];
  const parts = scaled([part('body', true, body), part('trim', false, trim)], sx, sy, sx);
  // Ultra only (render/detail.ts): what a close look at a real one shows — the shell's rolled
  // seams and foot ring; the safety pin through the valve with its pull ring and tamper seal, the
  // valve's knurled collar, the hose's ribs and couplings, the horn's ribs.
  const ring = (radius: number, tube: number, y: number, x = 0, z = 0, turn = Math.PI / 2) =>
    new THREE.TorusGeometry(radius, tube, 6, 32).rotateX(turn).translate(x, y, z);
  const fit = (pieces: THREE.BufferGeometry[]) => pieces.map((g) => g.scale(sx, sy, sx));
  const [shell, fittings] = parts;
  if (shell) {
    withSmallParts(shell.geometry, () =>
      fit([
        ring(r + 0.0015, 0.0022, top - 0.135),
        ring(r - 0.001, 0.0025, bottom + 0.012),
        ring(r + 0.001, 0.0012, bottom + 0.06),
      ]),
    );
  }
  if (fittings) {
    withSmallParts(fittings.geometry, () => {
      const hoseRibs = Array.from({ length: 7 }, (_, i) =>
        ring(hose + 0.0012, 0.0009, top - 0.11 - i * 0.04, 0.07, 0),
      );
      const knurl = Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return box(0.002, 0.02, 0.002, Math.cos(a) * 0.0222, top - 0.06, Math.sin(a) * 0.0222);
      });
      return fit([
        ...knurl,
        rod(0.0016, v(-0.03, top - 0.03, 0), v(0.012, top - 0.03, 0), 6),
        ring(0.011, 0.0018, top - 0.03, -0.042, 0, 0),
        drum(0.003, 0.003, top - 0.036, top - 0.024, 8).translate(-0.024, 0, 0.004),
        ...hoseRibs,
        ring(hose + 0.002, 0.0016, top - 0.098, 0.07, 0),
        ring(0.0105, 0.0014, bottom + 0.1, 0.07, 0),
        ring(0.0085, 0.001, bottom + 0.118, 0.07, 0),
      ]);
    });
  }
  return parts;
};

/**
 * A compound microscope, its eyepiece leaning to the front (+z) and its arm at the back: the foot
 * and arm in the item's colour with the head and eyepiece; steel stage, condenser, lamp lens,
 * revolving nosepiece with three objectives, tube and focus knobs. Unlit: it shows nothing.
 * Drawn at 0.25 × 0.4 × 0.3 m.
 */
const microscope: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const knobs = [-1, 1].flatMap((s) => [
    rod(0.02, v(s * 0.0225, -0.1, -0.1), v(s * 0.04, -0.1, -0.1), 10),
    rod(0.012, v(s * 0.04, -0.1, -0.1), v(s * 0.052, -0.1, -0.1), 10),
  ]);
  const objectives = [
    [0, 0.016, 0.04],
    [-0.014, -0.008, 0.032],
    [0.014, -0.008, 0.025],
  ].map(([x = 0, z = 0, length = 0]) =>
    drum(0.007, 0.008, 0.03 - length, 0.03, 8).translate(x, 0, z),
  );
  const parts = [
    part('body', true, [
      slab(0.17, 0.24, 0.035, 0.03, 0.004).translate(0, -0.2, -0.025),
      span(-0.0225, -0.165, -0.125, 0.0225, 0.07, -0.075),
      span(-0.025, 0.045, -0.125, 0.025, 0.095, 0.005),
      span(-0.0175, -0.065, -0.08, 0.0175, -0.035, -0.035),
      rod(0.011, v(0, 0.155, 0.025), v(0, 0.178, 0.048), 10),
    ]),
    part('steel', true, [
      span(-0.06, -0.045, -0.055, 0.06, -0.035, 0.055),
      drum(0.016, 0.016, -0.075, -0.045, 12),
      drum(0.02, 0.022, -0.165, -0.155, 12),
      drum(0.03, 0.026, 0.03, 0.045, 16),
      ...objectives,
      rod(0.015, v(0, 0.075, -0.055), v(0, 0.155, 0.025), 10),
      ...knobs,
    ]),
  ];
  return scaled(parts, w / 0.25, h / 0.4, d / 0.3);
};

/** Specimen jars by place along a shelf: radius and height, × the shelf's fit. */
const JARS = [
  [0.06, 0.24],
  [0.045, 0.16],
  [0.065, 0.2],
  [0.04, 0.13],
  [0.055, 0.28],
] as const;

/**
 * A specimen display cabinet (its back at −z), in the item's colour: shelves behind two glazed
 * doors, generic jars of preserving fluid with dark lids on every shelf — unlabelled, nothing
 * modelled inside them — on a dark plinth, dark handles by the doors' meeting edge.
 */
const specimenCabinet: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const [t, y0, door, frame] = [0.022, bottom + PLINTH, 0.022, 0.045];
  const face = d / 2 - HANDLE - door; // the carcass's front
  const [floor, ceiling] = [y0 + t, top - t];
  const n = Math.max(1, Math.round((ceiling - floor) / 0.45));
  const step = (ceiling - floor) / n;
  const body: G[] = [
    span(-w / 2, y0, -d / 2, -w / 2 + t, top, face),
    span(w / 2 - t, y0, -d / 2, w / 2, top, face),
    span(-w / 2 + t, ceiling, -d / 2, w / 2 - t, top, face),
    span(-w / 2 + t, y0, -d / 2, w / 2 - t, floor, face),
    span(-w / 2 + t, floor, -d / 2, w / 2 - t, ceiling, -d / 2 + 0.01),
  ];
  const [fluid, trim, glass]: [G[], G[], G[]] = [[], [], []];
  const reach = Math.min(0.07, (face + d / 2 - 0.03) / 2); // the largest jar's radius
  for (let i = 0; i < n; i++) {
    const y = floor + i * step; // the shelf's top
    if (i > 0) body.push(span(-w / 2 + t, y - 0.018, -d / 2 + 0.01, w / 2 - t, y, face - 0.01));
    const room = step - (i < n - 1 ? 0.018 : 0) - 0.03;
    for (let x = -w / 2 + t + 0.03, j = i * 2; ; j++) {
      const [r0, h0] = JARS[j % JARS.length] ?? JARS[0];
      const r = Math.min(r0, reach);
      const tall = Math.min(h0, room - 0.03);
      if (x + 2 * r > w / 2 - t - 0.03) break;
      const z = (face - d / 2) / 2;
      fluid.push(drum(r, r, y + 0.001, y + tall, 8).translate(x + r, 0, z));
      trim.push(drum(0.85 * r, 0.85 * r, y + tall, y + tall + 0.025, 6).translate(x + r, 0, z));
      x += 2 * r + (j % 2 ? 0.1 : 0.05);
    }
  }
  const doors = w >= 0.7 ? 2 : 1;
  const leaf = (w - (doors + 1) * GAP) / doors;
  const [z0, z1] = [face, face + door];
  const length = Math.min(0.16, (top - y0) / 5);
  for (let i = 0; i < doors; i++) {
    const [a, b] = [-w / 2 + GAP + i * (leaf + GAP), -w / 2 + GAP + i * (leaf + GAP) + leaf];
    const [c, e] = [y0 + GAP, top - GAP];
    body.push(
      span(a, c, z0, a + frame, e, z1),
      span(b - frame, c, z0, b, e, z1),
      span(a + frame, c, z0, b - frame, c + frame, z1),
      span(a + frame, e - frame, z0, b - frame, e, z1),
    );
    glass.push(span(a + frame, c + frame, z0 + 0.009, b - frame, e - frame, z0 + 0.013));
    const x = i === 0 ? b - frame / 2 : a + frame / 2;
    const y = Math.min(bottom + 1.05, e - frame - length / 2);
    trim.push(box(0.012, length, HANDLE, x, y, d / 2 - HANDLE / 2));
  }
  trim.push(span(-w / 2 + PLINTH_SET, bottom, -d / 2, w / 2 - PLINTH_SET, y0, face - PLINTH_SET));
  return [
    part('body', true, body),
    part('trim', false, trim),
    part('glass', false, glass),
    ...some('specimen-fluid', false, fluid),
  ];
};

/**
 * A laboratory refrigerator (its back at −z), in the item's colour: a cabinet with a full-height
 * door on a dark gasket line, a steel bar handle, a dark kick grille. No display: it shows no
 * temperature.
 */
const refrigerator: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const [kick, door, gasket] = [Math.min(0.1, h / 10), 0.045, 0.006];
  const face = d / 2 - HANDLE - door - gasket; // the cabinet's front
  const y0 = bottom + kick;
  const length = Math.min(0.6, (top - y0) / 3);
  const [x, y] = [-w / 2 + 0.07, Math.min(bottom + 1.2, top - 0.12 - length / 2)]; // the handle
  const out = face + gasket + door; // the door's front
  return [
    part('body', true, [
      span(-w / 2, bottom, -d / 2, w / 2, top, face),
      span(-w / 2 + 0.007, y0 + 0.007, face + gasket, w / 2 - 0.007, top - 0.007, out),
    ]),
    part('steel', false, [
      box(0.022, length, 0.014, x, y, d / 2 - 0.007),
      span(x - 0.009, y + length / 2 - 0.04, out, x + 0.009, y + length / 2 - 0.02, d / 2 - 0.014),
      span(x - 0.009, y - length / 2 + 0.02, out, x + 0.009, y - length / 2 + 0.04, d / 2 - 0.014),
    ]),
    part('trim', false, [
      span(-w / 2 + 0.005, y0 + 0.002, face, w / 2 - 0.005, top - 0.002, face + gasket),
      span(-w / 2 + 0.01, bottom + 0.005, face, w / 2 - 0.01, y0 - 0.005, out),
    ]),
  ];
};

/**
 * A plant growth shelf (its back at −z): shelving in the item's colour with potted seedlings on
 * each level under cool-white grow strips fixed beneath the shelf above.
 */
const plantShelf: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const { pieces, levels, post } = shelving(w, h, d, 0.56);
  const [pots, leaves, glow]: [G[], G[], G[]] = [[], [], []];
  const run = w - 2 * post - 0.04; // the length plants stand along
  const n = Math.max(1, Math.floor(run / 0.26));
  const r = Math.min(0.06, run / n / 2 - 0.02, d / 2 - 0.05); // a pot's
  levels.forEach(({ y, clear }, i) => {
    for (const z of [-d / 5, d / 5]) {
      glow.push(
        span(-w / 2 + 0.06, y + clear - 0.012, z - 0.015, w / 2 - 0.06, y + clear, z + 0.015),
      );
    }
    const pot = Math.min(0.11, clear / 4);
    for (let j = 0; j < n; j++) {
      const x = -run / 2 + (j + 0.5) * (run / n);
      pots.push(drum(0.75 * r, r, y, y + pot, 8).translate(x, 0, 0));
      // A crown on the pot, its size and turn varying along the shelf.
      const s = 1.35 + 0.35 * (((i * 3 + j * 7) % 5) / 4);
      const crown = Math.min(s * r, clear / 2 - pot / 2 - 0.03);
      leaves.push(
        new THREE.IcosahedronGeometry(crown, 0)
          .scale(1, 1.3, 1)
          .rotateY(i + 2 * j)
          .translate(x, y + pot + crown * 1.05, 0),
      );
    }
  });
  return [
    part('body', true, pieces),
    part('pot', true, pots),
    part('foliage', true, leaves),
    part('glow-cool', false, glow),
  ];
};

/**
 * A benchtop fume hood on its base cupboard (its back at −z), in the item's colour: side posts, a
 * housing with a steel exhaust collar on top, a glazed sash raised over the working opening with a
 * steel pull bar; inside, a dark work surface and a light baffle with slots before the dark back.
 * Unlit, no airflow display: hazard handling is not simulated yet.
 */
const fumeHood: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-h / 2, h / 2];
  const base = bottom + Math.min(0.87, 0.4 * h); // the base cupboard's top
  const deck = base + TOP; // the work surface
  const crown = top - Math.min(0.1, 0.05 * h); // the housing's top, under the exhaust collar
  const ceiling = crown - Math.min(0.2, 0.1 * h); // the chamber's ceiling
  const post = Math.min(0.12, w / 8);
  const inner = w / 2 - post; // the chamber's half width
  const face = d / 2 - REACH; // the base cupboard's front
  const sash = d / 2 - 0.05; // the sash's front
  const opening = deck + Math.min(0.45, (ceiling - deck) / 2); // the sash's bottom edge
  const back = -d / 2 + 0.03; // the chamber's dark back
  const k = kit();
  const glass: G[] = [];
  k.body.push(
    span(-w / 2, bottom + PLINTH, -d / 2, w / 2, base, face),
    span(-w / 2, deck, -d / 2, -inner, ceiling, d / 2),
    span(inner, deck, -d / 2, w / 2, ceiling, d / 2),
    span(-w / 2, ceiling, -d / 2, w / 2, crown, d / 2),
    span(-inner, deck, -d / 2, inner, ceiling, back - 0.01),
  );
  bay(k, -w / 2, 0, bottom + PLINTH, base, face, 0);
  bay(k, 0, w / 2, bottom + PLINTH, base, face, 0);
  k.trim.push(
    span(-w / 2 + PLINTH_SET, bottom, -d / 2, w / 2 - PLINTH_SET, bottom + PLINTH, face - 0.04),
    span(-w / 2, base, -d / 2, w / 2, deck, d / 2),
    span(-inner, deck, back - 0.01, inner, ceiling, back),
  );
  // The baffle: three panels before the back, a slot under each.
  const bands = 3;
  const [b0, b1] = [deck + 0.06, ceiling - 0.02];
  const pitch = (b1 - b0) / bands;
  for (let i = 0; i < bands; i++) {
    const y = b0 + i * pitch;
    k.body.push(span(-inner + 0.01, y + 0.025, back + 0.02, inner - 0.01, y + pitch, back + 0.032));
  }
  // The sash: a frame round its pane, slid up into the housing over the opening.
  const [s0, s1, rail] = [sash - 0.03, sash, 0.03];
  k.body.push(
    span(-inner, opening, s0, inner, opening + 0.05, s1),
    span(-inner, ceiling - rail, s0, inner, ceiling, s1),
    span(-inner, opening + 0.05, s0, -inner + rail, ceiling - rail, s1),
    span(inner - rail, opening + 0.05, s0, inner, ceiling - rail, s1),
  );
  glass.push(
    span(-inner + rail, opening + 0.05, s0 + 0.013, inner - rail, ceiling - rail, s0 + 0.017),
  );
  const collar = Math.min(0.13, w / 6, d / 4);
  k.steel.push(
    rod(
      0.012,
      v(-inner + 0.1, opening + 0.025, s1 + 0.024),
      v(inner - 0.1, opening + 0.025, s1 + 0.024),
      8,
    ),
    span(-inner + 0.11, opening + 0.019, s1, -inner + 0.13, opening + 0.031, s1 + 0.016),
    span(inner - 0.13, opening + 0.019, s1, inner - 0.11, opening + 0.031, s1 + 0.016),
    drum(collar, collar, crown, top, 24),
  );
  return [
    part('body', true, k.body),
    part('trim', false, k.trim),
    part('steel', false, k.steel),
    part('glass', false, glass),
  ];
};

/**
 * A lab stool (cylinder item): a round seat in the item's colour on a steel seat plate, four splayed
 * steel legs and a foot ring. Drawn at 0.36 × 0.65 m.
 */
const stool: PropBuilder = ([w = 0, h = 0]) => {
  const [bottom, top] = [-0.325, 0.325];
  const seat = top - 0.05;
  const [rTop, rFoot, ring] = [0.095, 0.158, bottom + 0.2];
  const legs = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return rod(
      0.011,
      v(rTop * c, seat + 0.005, rTop * s),
      v(rFoot * c, bottom + 0.0015, rFoot * s),
      6,
    );
  });
  const along = (ring - (seat + 0.005)) / (bottom + 0.0015 - (seat + 0.005));
  return scaled(
    [
      part('body', true, [
        drum(0.165, 0.17, seat, top - 0.012, 24),
        drum(0.17, 0.158, top - 0.012, top, 24),
      ]),
      part('steel', true, [
        drum(0.11, 0.11, seat - 0.012, seat, 16),
        ...legs,
        new THREE.TorusGeometry(rTop + along * (rFoot - rTop), 0.008, 4, 20)
          .rotateX(Math.PI / 2)
          .translate(0, ring, 0),
      ]),
    ],
    w / 0.36,
    h / (top - bottom),
    w / 0.36,
  );
};

/**
 * A laboratory gooseneck tap rising from the worktop by the wall (its back at −z): a flange and
 * valve body, a riser, the swan neck arching forward over the sink and a short spout, in steel (the
 * item's colour); a dark wrist lever and nozzle. Drawn at 0.12 × 0.35 × 0.3 m.
 */
const tap: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const [bottom, top] = [-0.175, 0.175];
  const [zr, zs, tube] = [-0.115, 0.12, 0.009]; // the riser's and spout's z
  const radius = (zs - zr) / 2;
  const yc = top - 0.002 - tube - radius; // the arch's centre
  const ys = yc - 0.045; // the spout's end
  const at = (g: G, z: number) => g.translate(0, 0, z);
  return scaled(
    [
      part('body', false, [
        at(drum(0.028, 0.028, bottom, bottom + 0.01, 16), zr),
        at(drum(0.02, 0.02, bottom + 0.01, bottom + 0.07, 12), zr),
        at(drum(tube, tube, bottom + 0.07, yc, 10), zr),
        new THREE.TorusGeometry(radius, tube, 6, 16, Math.PI)
          .rotateY(Math.PI / 2)
          .translate(0, yc, (zr + zs) / 2),
        at(drum(tube, tube, ys, yc, 10), zs),
      ]),
      part('trim', false, [
        at(drum(0.008, 0.01, ys - 0.02, ys, 10), zs),
        box(0.1, 0.01, 0.014, 0, bottom + 0.05, zr),
      ]),
    ],
    w / 0.12,
    h / (top - bottom),
    d / 0.3,
  );
};

/**
 * A wall light switch (front +z): an 86 mm square plate in the item's colour and a dark rocker
 * across its middle, so it reads from across the room. Drawn at 0.086 × 0.086 × 0.016 m.
 */
const lightSwitch: PropBuilder = ([w = 0, h = 0, d = 0]) => {
  const plate = [box(0.086, 0.086, 0.008, 0, 0, -0.004), box(0.05, 0.062, 0.004, 0, 0, 0.002)];
  const rocker = [new THREE.BoxGeometry(0.03, 0.05, 0.004).rotateX(0.06).translate(0, 0, 0.004)];
  return scaled(
    [part('body', true, plate), part('trim', false, rocker)],
    w / 0.086,
    h / 0.086,
    d / 0.016,
  );
};

export const LAB_PROPS = {
  'lab-island': labIsland,
  stool,
  'wall-bench': wallBench(false),
  'wall-bench-sink': wallBench(true),
  tap,
  'cabinet-doors': cabinetDoors,
  'glassware-shelf': glasswareShelf,
  'safety-shower': safetyShower,
  extinguisher,
  microscope,
  'specimen-cabinet': specimenCabinet,
  refrigerator,
  'plant-shelf': plantShelf,
  'fume-hood': fumeHood,
  'light-switch': lightSwitch,
} satisfies Partial<Record<Prop, PropBuilder>>;
