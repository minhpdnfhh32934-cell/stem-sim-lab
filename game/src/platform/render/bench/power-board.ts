import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { decimals, quantize } from '../../../simulation/measurement';
import {
  CIRCUIT_PARALLEL,
  CIRCUIT_SERIES,
  CIRCUIT_SINGLE,
} from '../../../simulation/models/circuit';
import { Assembly, loft, slab } from '../assembly';
import { LOOKS } from '../looks';
import { GLYPHS, VOLTMETER_SCALE } from './circuit-board';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The electrical-power board (experiment `electrical-power`, model `electric.power`): the Ohm's-law
 * board, 0.72 × 0.42 m, with two aluminium-housed power resistors. Behind, the bench supply with
 * its LED readout, the digital ammeter and the moving-coil voltmeter (0–15 V); in front left the
 * knife switch K; in front, R1 (left) between posts a, b and R2 (right) between c, d, their wires
 * clamped under the post caps, each marked R1 / R2 on its housing. Supply + → K → ammeter → a →
 * network → B → track → supply −; the voltmeter across a and B. (A parallel of circuit-board.ts:
 * its parts are private.)
 *
 * Coordinates are on the board's top face (origin at its centre, `bench.top`), +z its front, in
 * metres. The frame is the board and four merged meshes, nothing that moves. The rig draws only
 * what the station gives it: the switch blade (`switch`), the voltmeter needle (`voltage`), the
 * ammeter (`current` to the dialled `ammeterResolution`), the supply's readout (the `voltage`
 * dial) and the link leads of the dialled `configuration`. The resistors are drawn as they are:
 * no glow or tint for their power.
 */

const FOOT = 0.006; // rubber feet under the board
const POST = { nut: 0.0065, nutH: 0.004, cap: 0.0055, capH: 0.012 };
const POST_TOP = POST.nutH + POST.capH;
const PLUG = 0.026; // a banana plug with its strain relief; plugs stack on a post
const SHROUD = 0.006; // a socket's shroud
const LEAD = 0.0021; // a lead's radius

const SUPPLY = { x: -0.24, z: -0.13, w: 0.2, d: 0.12, h: 0.13, face: -0.067 }; // face: its panel
const AMMETER = { x: -0.02, z: -0.14, w: 0.14, d: 0.08, h: 0.075, face: -0.1 };
const VOLTMETER = { x: 0.24, w: 0.16, back: -0.19, face: -0.07 };
/** The knife switch K: blade along +z from its hinge, raised `open` rad while open. */
export const SWITCH = { x: -0.27, z: 0, pivotY: 0.026, open: (55 * Math.PI) / 180 };
const DIAL = { pivot: -0.03, radius: 0.06 }; // in the dial's own frame
/** The power resistors: R1 between posts a, b at x[0], R2 between c, d at x[1]; along x. */
const RESISTOR = { length: 0.028, w: 0.016, h: 0.014, flange: 0.027, x: [-0.1, 0.1], z: 0.02 };
const WIRE_Y = 0.009; // the resistors' axis, clamped under the post caps

/** A lead's end: where its plug stands (x, y, z) and whether it points up (a post) or out (+z). */
type Terminal = readonly [number, number, number, 'up' | 'out'];
const post = (x: number, z: number): Terminal => [x, POST_TOP, z, 'up'];
const socket = (x: number, y: number, face: number): Terminal => [x, y, face + SHROUD, 'out'];
const ENDS = {
  k1: post(-0.31, 0), // into the switch's hinge
  k2: post(-0.23, 0.075), // out of its clip
  a: post(-0.13, 0.02), // the network's input: R1's posts a, b
  b: post(-0.07, 0.02),
  c: post(0.07, 0.02), // R2's
  d: post(0.13, 0.02),
  ret: post(0.23, 0.02), // the network's output B
  neg: post(-0.33, -0.02), // B's track ends here, by the supply's − socket
  va: post(0.17, -0.035), // a's track, for the voltmeter
  vb: post(0.31, -0.035), // B's track, for the voltmeter
  supplyMinus: socket(-0.28, 0.035, SUPPLY.face),
  supplyPlus: socket(-0.2, 0.035, SUPPLY.face),
  ammeterPlus: socket(-0.05, 0.018, AMMETER.face),
  ammeterCom: socket(0.01, 0.018, AMMETER.face),
  voltPlus: socket(0.205, 0.018, VOLTMETER.face),
  voltMinus: socket(0.275, 0.018, VOLTMETER.face),
} as const satisfies Record<string, Terminal>;
type End = keyof typeof ENDS;
const POSTS: readonly End[] = ['k1', 'k2', 'a', 'b', 'c', 'd', 'ret', 'neg', 'va', 'vb'];

const RED = '#c62828';
const BLACK = '#1b1d20';
const BLUE = '#2f6fd6';
type Lead = readonly [End, End, string];

/** Fixed leads: the supply, switch and meters to the board's posts. */
const LEADS: readonly Lead[] = [
  ['supplyPlus', 'k1', RED],
  ['k2', 'ammeterPlus', RED],
  ['ammeterCom', 'a', BLACK],
  ['supplyMinus', 'neg', BLACK],
  ['voltPlus', 'va', RED],
  ['voltMinus', 'vb', BLACK],
];
/** The link leads of each configuration (the model's `configuration` values). */
const LINKS: readonly (readonly [number, readonly Lead[]])[] = [
  [CIRCUIT_SINGLE, [['b', 'ret', BLUE]]],
  [
    CIRCUIT_SERIES,
    [
      ['b', 'c', BLUE],
      ['d', 'ret', BLUE],
    ],
  ],
  [
    CIRCUIT_PARALLEL,
    [
      ['a', 'c', BLUE],
      ['b', 'd', BLUE],
      ['d', 'ret', BLUE],
    ],
  ],
];
type XZ = readonly [number, number];
const xz = (end: End): XZ => [ENDS[end][0], ENDS[end][2]];
/** Printed copper tracks, as polylines between posts. */
const TRACKS: readonly (readonly XZ[])[] = [
  [xz('k1'), [SWITCH.x, 0]],
  [xz('k2'), [SWITCH.x, 0.075]],
  [xz('a'), [-0.13, -0.035], xz('va')],
  [xz('ret'), [0.31, 0.02], xz('vb')],
  [xz('ret'), [0.23, 0.19], [-0.33, 0.19], xz('neg')],
];
const COPPER = '#c8874e';
const DASH = 64;

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The voltmeter's dial plane on its sloping face: x right, y up the slope, z out of it. */
function dialFrame(): THREE.Matrix4 {
  const up = new THREE.Vector3(0, 0.09, -0.08).normalize();
  const out = new THREE.Vector3(0, 0.08, 0.09).normalize();
  return new THREE.Matrix4()
    .makeBasis(new THREE.Vector3(1, 0, 0), up, out)
    .setPosition(VOLTMETER.x, 0.08, -0.11);
}

type Piece = readonly [THREE.BufferGeometry, string];

/** Pieces merged into one geometry, each in its own colour (vertex colours, one draw). */
function merged(pieces: readonly Piece[]): THREE.BufferGeometry {
  const colour = new THREE.Color();
  const geometries = pieces.map(([geometry, hex]) => {
    geometry.deleteAttribute('uv');
    const count = geometry.getAttribute('position').count;
    if (!geometry.index) geometry.setIndex([...Array(count).keys()]);
    colour.set(hex);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colour.toArray(colours, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return geometry;
  });
  const result = mergeGeometries(geometries);
  for (const g of geometries) g.dispose();
  return result;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** An upright round part of radius r0 below, r1 above, from y0 to y1 at (x, z). */
const drum = (r0: number, r1: number, y0: number, y1: number, x: number, z: number, sides = 12) =>
  new THREE.CylinderGeometry(r1, r0, y1 - y0, sides).translate(x, (y0 + y1) / 2, z);

/** A round part along z (a knob, a socket's shroud) of radius r, from z0 to z0 + length. */
const along = (r: number, length: number, x: number, y: number, z0: number, sides = 16) =>
  new THREE.CylinderGeometry(r, r, length, sides)
    .rotateX(Math.PI / 2)
    .translate(x, y, z0 + length / 2);

type Stroke = readonly [number, number, number, number];
/** Segments a–g of a printed digit in a cell 0.6 wide and 1 tall, as GLYPHS numbers them. */
const SEGMENTS: readonly Stroke[] = [
  [0, 1, 0.6, 1],
  [0.6, 1, 0.6, 0.5],
  [0.6, 0.5, 0.6, 0],
  [0, 0, 0.6, 0],
  [0, 0, 0, 0.5],
  [0, 0.5, 0, 1],
  [0, 0.5, 0.6, 0.5],
];
const LETTERS: Readonly<Record<string, readonly Stroke[]>> = {
  V: [
    [0, 1, 0.3, 0],
    [0.3, 0, 0.6, 1],
  ],
  A: [
    [0, 0, 0.3, 1],
    [0.3, 1, 0.6, 0],
    [0.12, 0.4, 0.48, 0.4],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 0.55, 1],
    [0.55, 1, 0.55, 0.5],
    [0, 0.5, 0.55, 0.5],
    [0.25, 0.5, 0.6, 0],
  ],
};

/** Printed `text` (digits, V, A, R) `size` tall, centred on (x, y) in the plane z = z0. */
function legend(text: string, size: number, x: number, y: number, z0: number) {
  const t = size * 0.13;
  const advance = size * 0.85;
  const left = x - ((text.length - 1) * advance + size * 0.6) / 2;
  return Array.from({ length: text.length }, (_, k) => k).flatMap((k) => {
    const char = text.charAt(k);
    const glyph = GLYPHS[Number(char)];
    const strokes =
      LETTERS[char] ?? SEGMENTS.filter((_, s) => glyph !== undefined && (glyph & (1 << s)) !== 0);
    return strokes.map(([x0, y0, x1, y1]) => {
      const length = Math.hypot(x1 - x0, y1 - y0) * size;
      return new THREE.BoxGeometry(length + t, t, 0.0003)
        .rotateZ(Math.atan2(y1 - y0, x1 - x0))
        .translate(
          left + k * advance + ((x0 + x1) / 2) * size,
          y + ((y0 + y1) / 2 - 0.5) * size,
          z0 + 0.00015,
        );
    });
  });
}

/** A lathe about y, the profile given as [radius, y] pairs. */
const lathe = (profile: readonly (readonly [number, number])[], sides = 12) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    sides,
  );

/** A banana plug and its strain relief, standing on y = 0, PLUG tall. */
const plug = () =>
  lathe([
    [0, 0],
    [0.0042, 0],
    [0.0046, 0.003],
    [0.0046, 0.016],
    [0.0034, 0.02],
    [0.0026, PLUG],
    [0, PLUG],
  ]);

/** A convex outline (counter-clockwise) shrunk by `by` along each edge's normal: a chamfer. */
const shrink = (points: readonly THREE.Vector2[]) => (by: number) =>
  points.map((p, i) => {
    const prev = points[(i + points.length - 1) % points.length] ?? p;
    const next = points[(i + 1) % points.length] ?? p;
    const n1 = new THREE.Vector2(prev.y - p.y, p.x - prev.x).normalize();
    const n2 = new THREE.Vector2(p.y - next.y, next.x - p.x).normalize();
    return n1
      .add(n2)
      .multiplyScalar(by / (1 + n1.dot(n2)))
      .add(p);
  });

/**
 * A round tube of `radius` along the points, its rings turned with the curve (each ring's normal
 * the previous one's, projected off the tangent), open at both ends.
 */
function tube(points: readonly THREE.Vector3[], radius: number, sides = 6) {
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const r = new THREE.Vector3();
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)] ?? p;
    const next = points[Math.min(points.length - 1, i + 1)] ?? p;
    t.subVectors(next, prev).normalize();
    if (i === 0) n.set(Math.abs(t.y) < 0.9 ? 0 : 1, Math.abs(t.y) < 0.9 ? 1 : 0, 0);
    n.addScaledVector(t, -n.dot(t)).normalize();
    b.crossVectors(t, n);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      r.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
      positions.push(p.x + r.x * radius, p.y + r.y * radius, p.z + r.z * radius);
      normals.push(r.x, r.y, r.z);
    }
    if (i === 0) return;
    for (let j = 0; j < sides; j++) {
      const a0 = (i - 1) * sides + j;
      const a1 = (i - 1) * sides + ((j + 1) % sides);
      index.push(a0, a1, a1 + sides, a0, a1 + sides, a0 + sides);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

/** A cable of `radius` from `p0` to `p1`, leaving each along `d0`, `d1` with the given lift. */
function cable(
  p0: THREE.Vector3,
  d0: THREE.Vector3,
  p1: THREE.Vector3,
  d1: THREE.Vector3,
  lift: number,
  radius: number,
) {
  const c0 = p0.clone().addScaledVector(d0, lift);
  const c1 = p1.clone().addScaledVector(d1, lift);
  const points = Array.from({ length: 25 }, (_, i) => {
    const s = i / 24;
    const u = 1 - s;
    return new THREE.Vector3()
      .addScaledVector(p0, u * u * u)
      .addScaledVector(c0, 3 * u * u * s)
      .addScaledVector(c1, 3 * u * s * s)
      .addScaledVector(p1, s * s * s);
  });
  return tube(points, radius);
}

/** Plugs already in each post: the next plug stacks on them. */
function plugsIn(leads: readonly Lead[]): Map<End, number> {
  const count = new Map<End, number>();
  for (const [from, to] of leads)
    for (const end of [from, to]) count.set(end, (count.get(end) ?? 0) + 1);
  return count;
}

const UP = new THREE.Vector3(0, 1, 0);
const OUT = new THREE.Vector3(0, 0, 1);

/** The leads with their plugs, each in its colour; `stacked` counts the plugs per post. */
function leadPieces(leads: readonly Lead[], stacked: Map<End, number>): Piece[] {
  const end = (e: End) => {
    const [x, y, z, way] = ENDS[e];
    if (way === 'up') {
      const level = stacked.get(e) ?? 0;
      stacked.set(e, level + 1);
      const base = y + level * PLUG;
      return {
        tip: new THREE.Vector3(x, base + PLUG, z),
        dir: UP,
        plug: plug().translate(x, base, z),
      };
    }
    const geometry = plug()
      .rotateX(Math.PI / 2)
      .translate(x, y, z);
    return { tip: new THREE.Vector3(x, y, z + PLUG), dir: OUT, plug: geometry };
  };
  return leads.flatMap(([from, to, colour]): Piece[] => {
    const p0 = end(from);
    const p1 = end(to);
    // A cubic from each plug's tip along its axis: the lead leaves both plugs straight.
    const lift = 0.015 + 0.3 * p0.tip.distanceTo(p1.tip);
    return [
      [cable(p0.tip, p0.dir, p1.tip, p1.dir, lift, LEAD), colour],
      [p0.plug, colour],
      [p1.plug, colour],
    ];
  });
}

/** A material of `look`: in `color`, or else white and coloured by its vertices (merged parts). */
const material = (look: 'plastic' | 'metal' | 'matte' | 'satin', color?: string) =>
  new THREE.MeshStandardMaterial({
    color: color ?? '#ffffff',
    ...LOOKS[look],
    vertexColors: color === undefined,
  });

/**
 * The fixed parts: the board (the entity's mesh) on rubber feet, and the rest merged by material —
 * plastic (cases, posts, knobs, the resistors' end seals, the fixed leads), metal (tracks, nuts,
 * the switch's brass, the resistors' housings and wires), print (the voltmeter's dial, the LCD's
 * face, the units, the R1 / R2 marks) and glass. Nothing is painted with the entity material but the board.
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const boardTop = item.bench?.top[1] ?? 0; // from the item's base
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const body = keep(slab(w, d, boardTop - FOOT, 0.012, 0.002));
  body.translate(0, -h / 2 + FOOT, 0);
  const onBoard = new THREE.Group();
  onBoard.position.copy(topOf(item));
  kit.group.add(onBoard);

  const plastic: Piece[] = [];
  const metal: Piece[] = [];
  const print: Piece[] = [];
  const glass: Piece[] = [];
  const ink = '#e9ecef';
  const dark = '#2b2f36';
  const bezel = '#15191e';
  const lcdFace = '#a9b8a2';

  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      plastic.push([
        drum(0.012, 0.012, -boardTop, -boardTop + FOOT, sx * (w / 2 - 0.03), sz * (d / 2 - 0.03)),
        BLACK,
      ]);

  // Copper tracks, a pad at each bend; a pad under each post, its brass nut and its cap.
  for (const line of TRACKS) {
    line.forEach(([x, z], i) => {
      metal.push([drum(0.0025, 0.0025, 0, 0.0006, x, z), COPPER]);
      const [nx, nz] = line[i + 1] ?? [x, z];
      const length = Math.hypot(nx - x, nz - z);
      if (length === 0) return;
      const track = new THREE.BoxGeometry(length, 0.0006, 0.005)
        .rotateY(-Math.atan2(nz - z, nx - x))
        .translate((x + nx) / 2, 0.0003, (z + nz) / 2);
      metal.push([track, COPPER]);
    });
  }
  for (const name of POSTS) {
    const [x, z] = xz(name);
    metal.push([drum(0.009, 0.009, 0, 0.0007, x, z, 20), COPPER]);
    metal.push([drum(POST.nut, POST.nut, 0, POST.nutH, x, z, 6), '#c9a24a']);
    plastic.push([drum(POST.cap, 0.0048, POST.nutH, POST_TOP, x, z), '#1f2328']);
  }
  // White print: + and − by the supply's posts.
  const line = (w: number, d: number, x: number, z: number): Piece => [
    box(w, 0.0004, d, x, 0.0002, z),
    ink,
  ];
  const [k1x, k1z] = xz('k1');
  const [negx, negz] = xz('neg');
  print.push(
    line(0.008, 0.0014, k1x, k1z + 0.016),
    line(0.0014, 0.008, k1x, k1z + 0.016),
    line(0.008, 0.0014, negx, negz + 0.016),
  );

  // The bench supply: case, black panel, LED window, voltage knob on its skirt, power rocker,
  // vents on top. (Its sockets are with the others below.)
  const s = SUPPLY;
  plastic.push(
    [slab(s.w, s.d, s.h, 0.01, 0.003).translate(s.x, 0, s.z), '#cfd3d8'],
    [box(s.w - 0.012, s.h - 0.012, 0.003, s.x, s.h / 2, s.face - 0.0015), '#1d2126'],
    [box(0.066, 0.032, 0.001, s.x - 0.025, 0.095, s.face + 0.0005), '#2a0c0c'],
    [along(0.013, 0.014, s.x + 0.06, 0.095, s.face + 0.002, 24), '#30353b'],
    [box(0.0016, 0.009, 0.001, s.x + 0.06, 0.1, s.face + 0.0165), '#f2f2f2'],
    [box(0.012, 0.016, 0.006, s.x - 0.08, 0.095, s.face + 0.003), '#c0392b'],
  );
  metal.push([along(0.017, 0.002, s.x + 0.06, 0.095, s.face, 32), '#b4bcc4']);
  for (let k = 0; k < 5; k++)
    plastic.push([box(0.12, 0.001, 0.004, s.x, s.h, -0.165 + k * 0.012), '#2a2e33']);

  // The ammeter: case, LCD bezel (a plate, and a frame out to the glass's front), its pale face
  // (the digits are the rig's), its glass.
  const a = AMMETER;
  plastic.push(
    [slab(a.w, a.d, a.h, 0.008, 0.0025).translate(a.x, 0, a.z), '#3a4a5c'],
    [box(0.1, 0.04, 0.003, a.x, 0.05, a.face + 0.0015), bezel],
    [box(0.1, 0.003, 0.0034, a.x, 0.0685, a.face + 0.0047), bezel],
    [box(0.1, 0.003, 0.0034, a.x, 0.0315, a.face + 0.0047), bezel],
    [box(0.003, 0.034, 0.0034, a.x + 0.0485, 0.05, a.face + 0.0047), bezel],
    [box(0.003, 0.034, 0.0034, a.x - 0.0485, 0.05, a.face + 0.0047), bezel],
  );
  print.push([box(0.088, 0.03, 0.001, a.x, 0.05, a.face + 0.0035), lcdFace]);
  glass.push([box(0.094, 0.034, 0.0012, a.x, 0.05, a.face + 0.0058), '#ffffff']);
  // The units printed beside the readouts: A right of the ammeter's LCD, V by the supply's LEDs.
  print.push(...legend('A', 0.008, a.x + 0.056, 0.05, a.face).map((g): Piece => [g, ink]));
  print.push(...legend('V', 0.008, s.x + 0.02, 0.095, s.face).map((g): Piece => [g, ink]));

  // The voltmeter: a sloping housing, its bezel, the white dial with 0–15 V ticks (every 0.5 V,
  // longer every volt and every 5 V, numbered 0, 5, 10, 15 and marked V), the pivot cap, the glass.
  const profile = [
    [VOLTMETER.back, 0],
    [VOLTMETER.face, 0],
    [VOLTMETER.face, 0.035],
    [-0.15, 0.125],
    [VOLTMETER.back, 0.125],
  ].map(([z = 0, y = 0]) => new THREE.Vector2(z, y));
  const half = VOLTMETER.w / 2;
  const housing = loft(shrink(profile), [
    [0.003, -half],
    [0, -half + 0.003],
    [0, half - 0.003],
    [0.003, half],
  ]).rotateY(-Math.PI / 2); // the outline's x becomes z, the levels run along x
  plastic.push([housing.translate(VOLTMETER.x, 0, 0), '#262a30']);
  const dial = dialFrame();
  const onDial = (geometry: THREE.BufferGeometry) => geometry.applyMatrix4(dial);
  plastic.push(
    [onDial(box(0.142, 0.006, 0.009, 0, 0.0505, 0.0045)), bezel],
    [onDial(box(0.142, 0.006, 0.009, 0, -0.0505, 0.0045)), bezel],
    [onDial(box(0.006, 0.107, 0.009, 0.068, 0, 0.0045)), bezel],
    [onDial(box(0.006, 0.107, 0.009, -0.068, 0, 0.0045)), bezel],
  );
  print.push([onDial(box(0.13, 0.095, 0.001, 0, 0, 0.0005)), '#f4f2ea']);
  for (let i = 0; i <= 30; i++) {
    const long = i % 10 === 0 ? 0.011 : i % 2 === 0 ? 0.008 : 0.0045;
    const width = i % 10 === 0 ? 0.0012 : i % 2 === 0 ? 0.0009 : 0.0006;
    const angle = VOLTMETER_SCALE.sweep / 2 - (VOLTMETER_SCALE.sweep * i) / 30;
    const tick = box(width, long, 0.0003, 0, DIAL.radius - long / 2, 0)
      .rotateZ(angle)
      .translate(0, DIAL.pivot, 0.0012);
    print.push([onDial(tick), BLACK]);
    if (i % 10 === 0) {
      const r = DIAL.radius - 0.017; // the numerals inside the long ticks
      const label = String((VOLTMETER_SCALE.full * i) / 30);
      const at = legend(
        label,
        0.007,
        -r * Math.sin(angle),
        DIAL.pivot + r * Math.cos(angle),
        0.0012,
      );
      print.push(...at.map((g): Piece => [onDial(g), BLACK]));
    }
  }
  print.push(...legend('V', 0.009, 0, -0.012, 0.0012).map((g): Piece => [onDial(g), BLACK]));
  print.push([onDial(along(0.004, 0.003, 0, DIAL.pivot, 0.002)), BLACK]);
  glass.push([onDial(box(0.13, 0.095, 0.0015, 0, 0, 0.0075)), '#ffffff']);

  // Panel sockets: shrouds, red for +, black for − and COM.
  for (const [name, [x, y, z, way]] of Object.entries(ENDS))
    if (way === 'out')
      plastic.push([
        along(0.006, SHROUD, x, y, z - SHROUD, 12),
        name.endsWith('Plus') ? RED : BLACK,
      ]);

  // The knife switch K: porcelain base, the hinge's two brass cheeks and pin, the clip's fork.
  const k = SWITCH;
  plastic.push([slab(0.045, 0.104, 0.012, 0.005, 0.002).translate(k.x, 0, 0.04), '#efece4']);
  for (const sx of [-1, 1])
    metal.push(
      [box(0.0015, 0.02, 0.012, k.x + sx * 0.0018, 0.022, k.z), '#c9a24a'],
      [box(0.0012, 0.022, 0.01, k.x + sx * 0.0017, 0.023, 0.075), '#c9a24a'],
    );
  const pin = new THREE.CylinderGeometry(0.0018, 0.0018, 0.012, 10).rotateZ(Math.PI / 2);
  metal.push([pin.translate(k.x, k.pivotY, k.z), '#b4bcc4']);

  // The power resistors: a gold anodised housing on its mounting flanges, dark end seals, the
  // tinned wires out of each end to the posts; R1 / R2 printed on the housing's front.
  const res = RESISTOR;
  const l = res.length / 2;
  for (let i = 0; i < res.x.length; i++) {
    const cx = res.x[i] ?? 0;
    metal.push(
      [box(res.length, res.h, res.w, cx, WIRE_Y, res.z), '#c8a85a'],
      [box(res.length * 0.7, 0.002, res.flange, cx, 0.001, res.z), '#c8a85a'],
    );
    const ends = i === 0 ? [ENDS.a, ENDS.b] : [ENDS.c, ENDS.d];
    for (const s of [-1, 1]) {
      const seal = box(0.002, res.h * 0.7, res.w * 0.7, cx + s * (l + 0.001), WIRE_Y, res.z);
      plastic.push([seal, dark]);
      const post = ends[s < 0 ? 0 : 1]?.[0] ?? cx;
      const inner = cx + s * (l + 0.002);
      const wire = new THREE.CylinderGeometry(0.0006, 0.0006, Math.abs(post - inner), 6)
        .rotateZ(Math.PI / 2)
        .translate((post + inner) / 2, WIRE_Y, res.z);
      metal.push([wire, '#d0d5da']);
    }
    const mark = legend(`R${i + 1}`, 0.007, cx, WIRE_Y, res.z + res.w / 2);
    print.push(...mark.map((g): Piece => [g, BLACK]));
  }

  plastic.push(...leadPieces(LEADS, new Map()));

  const housings = mesh(keep(merged(plastic)), own(material('plastic')), onBoard);
  housings.name = 'housings';
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  // See-through glass writes no depth, so the needle and the digits behind it show.
  const glassy = new THREE.MeshStandardMaterial({
    color: '#cfe8f0',
    ...LOOKS.glass,
    opacity: 0.25,
    depthWrite: false,
  });
  const others: [string, THREE.Material, Piece[]][] = [
    ['metal', own(material('metal')), metal],
    ['print', own(material('matte')), print],
    ['glass', own(glassy), glass],
  ];
  for (const [name, mat, pieces] of others) {
    const m = mesh(keep(merged(pieces)), mat, onBoard);
    m.name = name;
    m.castShadow = false;
  }
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/**
 * A seven-segment readout of `digits` digits (each with its decimal point) as one draw.
 */
function readout(
  kit: Assembly,
  material: THREE.Material,
  digits: number,
  height: number,
  pitch: number,
) {
  const width = height * 0.55;
  const t = height * 0.13;
  const v = height / 2 - t; // a vertical segment's length
  const layout: (readonly [number, number, number, number])[] = [
    [0, height / 2 - t / 2, width - t, t], // a
    [width / 2 - t / 2, height / 4, t, v], // b
    [width / 2 - t / 2, -height / 4, t, v], // c
    [0, -height / 2 + t / 2, width - t, t], // d
    [-width / 2 + t / 2, -height / 4, t, v], // e
    [-width / 2 + t / 2, height / 4, t, v], // f
    [0, 0, width - t, t], // g
    [width / 2 + t, -height / 2 + t / 2, t, t], // the decimal point
  ];
  const lit: THREE.Matrix4[] = [];
  for (let k = 0; k < digits; k++) {
    const x0 = (k - (digits - 1) / 2) * pitch;
    for (const [x, y, sx, sy] of layout)
      lit.push(new THREE.Matrix4().makeScale(sx, sy, 1).setPosition(x0 + x, y, 0));
  }
  const off = new THREE.Matrix4().makeScale(0, 0, 0);
  const mesh = kit.copies(kit.keep(new THREE.BoxGeometry(1, 1, 0.0006)), material, lit);
  mesh.castShadow = false;
  mesh.computeBoundingSphere(); // while every segment is lit: three.js never recomputes it
  /**
   * Shows `value`, the reading × 10^decimals (an integer ≥ 0), with at least `places` digits
   * (leading zeros blank beyond them), or dashes for none (NaN).
   */
  const show = (value: number, decimals: number, places = decimals + 1) => {
    const fits = value >= 0 && value < 10 ** digits;
    for (let k = 0; k < digits; k++) {
      const place = digits - 1 - k; // from the right
      const p = 10 ** place;
      const glyph = !fits
        ? DASH
        : place >= places && value < p
          ? 0 // a leading zero
          : (GLYPHS[Math.floor(value / p) % 10] ?? 0);
      for (let s = 0; s < 8; s++) {
        const on = s < 7 ? (glyph & (1 << s)) !== 0 : fits && decimals > 0 && place === decimals;
        mesh.setMatrixAt(k * 8 + s, on ? (lit[k * 8 + s] ?? off) : off);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { mesh, show };
}

/** Decimals a reading shows when its resolution dial is not there (a bare rig). */
const DEFAULT_DECIMALS = 3;

/** The moving and changing parts; `pose` sets them from the station, allocating nothing. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));

  // The switch's blade and handle, about the hinge pin.
  const lever = new THREE.Group();
  lever.name = 'switch';
  lever.position.set(SWITCH.x, SWITCH.pivotY, SWITCH.z);
  kit.group.add(lever);
  const copper = own(material('metal', '#c9773f'));
  const blade = mesh(keep(box(0.002, 0.01, 0.09, 0, 0, 0.043)), copper, lever);
  const grip = lathe(
    [
      [0, 0],
      [0.0035, 0],
      [0.0055, 0.004],
      [0.006, 0.016],
      [0.0045, 0.024],
      [0, 0.026],
    ],
    16,
  );
  grip.rotateX(Math.PI / 2).translate(0, 0, 0.086);
  const handle = mesh(keep(grip), own(material('plastic', BLACK)), lever);
  blade.castShadow = false;
  handle.castShadow = false;

  // The voltmeter's needle, on the dial's pivot.
  const mount = new THREE.Group();
  dialFrame().decompose(mount.position, mount.quaternion, mount.scale);
  kit.group.add(mount);
  const red = own(new THREE.MeshBasicMaterial({ color: '#b3261e' })); // reads at any light
  const needle = mesh(keep(box(0.0008, 0.064, 0.0005, 0, 0.026, 0)), red, mount);
  needle.name = 'needle';
  needle.position.set(0, DIAL.pivot, 0.004);
  needle.castShadow = false;

  // The readouts: the supply's red LEDs (V, one decimal) and the ammeter's LCD (A, 4 digits).
  const ledOn = own(new THREE.MeshBasicMaterial({ color: '#ff4a3d' }));
  const led = readout(kit, ledOn, 3, 0.02, 0.017);
  led.mesh.name = 'supply-readout';
  led.mesh.position.set(SUPPLY.x - 0.025, 0.095, SUPPLY.face + 0.0012);
  const lcdInk = own(new THREE.MeshBasicMaterial({ color: '#1a1f1a' }));
  const lcd = readout(kit, lcdInk, 4, 0.02, 0.019);
  lcd.mesh.name = 'ammeter-readout';
  lcd.mesh.position.set(AMMETER.x - 0.002, 0.05, AMMETER.face + 0.0043);

  // The link leads of each configuration; only the dialled one shows.
  const links = LINKS.map(([configuration, leads]) => {
    const m = mesh(keep(merged(leadPieces(leads, plugsIn(LEADS)))), own(material('plastic')));
    m.name = `links-${configuration}`;
    m.castShadow = false;
    m.visible = false;
    return { configuration, mesh: m };
  });

  // Until the first pose: supply dashes, ammeter 0.
  led.show(NaN, 1);
  lcd.show(0, DEFAULT_DECIMALS);

  /** Shows `value` read to `d` on the ammeter (zeros for none). */
  const read = (value: number, d: number) => {
    const step = d > 0 && Number.isFinite(d) ? d : NaN;
    const places = Number.isFinite(step) ? decimals(step) : DEFAULT_DECIMALS;
    if (Number.isFinite(value) && Number.isFinite(step))
      lcd.show(Math.round(quantize(value, step) * 10 ** places), places);
    else lcd.show(0, places);
  };

  // What is shown; null until the first pose.
  let closed: boolean | null = null;
  let volts: number | null = null;
  let amps = NaN;
  let ampStep = NaN;
  let supply: number | null = null;
  let wiring: number | null = null;
  const pose = ({ parameters, sample }: BenchPose) => {
    // Without a run (NaN) the circuit is open: switch up, both meters at 0.
    const shut = sample.switch === 1;
    if (shut !== closed) {
      closed = shut;
      lever.rotation.x = shut ? 0 : -SWITCH.open;
    }
    const v = sample.voltage ?? NaN;
    const u = Number.isFinite(v) ? v : 0;
    if (u !== volts) {
      volts = u;
      const scale = Math.min(Math.max(u / VOLTMETER_SCALE.full, 0), 1); // pinned at its stops
      needle.rotation.z = VOLTMETER_SCALE.sweep / 2 - VOLTMETER_SCALE.sweep * scale;
    }
    const i = sample.current ?? NaN;
    const dI = parameters.ammeterResolution ?? NaN;
    if (!Object.is(i, amps) || !Object.is(dI, ampStep)) {
      amps = i;
      ampStep = dI;
      read(i, dI);
    }
    const set = parameters.voltage ?? NaN;
    if (!Object.is(set, supply)) {
      supply = set;
      led.show(Math.round(set * 10), 1); // NaN: dashes
    }
    const c = parameters.configuration ?? NaN;
    if (!Object.is(c, wiring)) {
      wiring = c;
      for (let k = 0; k < links.length; k++) {
        const link = links[k];
        if (link) link.mesh.visible = link.configuration === c;
      }
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const powerBoard: BenchModel = {
  frame,
  rig,
  reads: ['switch', 'voltage', 'current'],
};
