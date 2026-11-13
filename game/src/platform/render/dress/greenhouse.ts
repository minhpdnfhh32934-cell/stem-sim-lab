import * as THREE from 'three';
import type { RoomDefinition } from '../../../world/definitions';
import type { Finish } from '../palette';
import { rod } from '../props/parts';
import {
  type DressPart,
  footprint,
  MODULE,
  moduleEdges,
  onWall,
  Pieces,
  type SizeOf,
  wallBox,
  wallFrames,
  WallPlan,
  wallPoint,
} from './frame';

// Biology (Phase U-5, contract §4): a greenhouse. Light wood boards up the walls to a beam, wooden
// panels above with leaves cut in, a living moss wall where a long stretch of wall is free,
// trellises with a climbing plant over a fern in its planter, a glazed ceiling between wooden beams
// (bright, as if lit by the sky — it lights nothing), a border of wooden decking round the floor.
// Flat cladding lies behind everything; what stands out keeps clear of what stands at the wall.

const BOARDS = [0.1, 2.4] as const;
const BEAM = [2.42, 2.58] as const;
const UPPER_FROM = 2.62;
const BOARD = 0.14;
const BOARD_GAP = 0.012;
/** Where a plant may grow on a wall: nothing in front from the floor to here. */
const PLANT_TOP = 3.3;

/** A fixed sequence (the same room every time): a simple linear congruential generator. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function greenhouse(room: RoomDefinition, sizeOf: SizeOf): DressPart[] {
  const out = new Pieces();
  const h = room.bounds.max[1] - room.bounds.min[1];
  const random = seeded(11);
  for (const frame of wallFrames(room)) {
    const plan = new WallPlan(room, frame, sizeOf);
    const edges = moduleEdges(frame.span);
    // Boards up to the beam, cut at the openings only (flat).
    for (const [p0, p1] of plan.runs(BOARDS[0], BOARDS[1], true, 0)) {
      for (let a = p0; a < p1 - 0.03; a += BOARD) {
        const a1 = Math.min(a + BOARD - BOARD_GAP, p1);
        const shade: Finish = random() < 0.12 ? 'wood' : 'wood-light';
        out.add(shade, wallBox(frame, a, a1, BOARDS[0], BOARDS[1], 0, 0.012));
      }
    }
    for (const [a0, a1] of plan.runs(BEAM[0], BEAM[1])) {
      out.add('wood', wallBox(frame, a0, a1, BEAM[0], BEAM[1], 0, 0.06));
    }
    // Panels above, every other one with leaves cut in (flat, behind everything).
    for (let k = 0; k + 1 < edges.length; k++) {
      const m0 = (edges[k] ?? 0) + 0.02;
      const m1 = (edges[k + 1] ?? 0) - 0.02;
      for (const [p0, p1] of plan.runs(UPPER_FROM, h - 0.02, true, 0)) {
        const a0 = Math.max(m0, p0);
        const a1 = Math.min(m1, p1);
        if (a1 - a0 < 0.1) continue;
        out.add('wood-light', wallBox(frame, a0, a1, UPPER_FROM, h - 0.02, 0, 0.01));
        if (k % 2 === 1 && a1 - a0 > MODULE - 0.1 && h - UPPER_FROM > 1.2) {
          const c = (a0 + a1) / 2;
          const y = (UPPER_FROM + h) / 2;
          for (const [x, yy, turn, size] of [
            [-0.18, 0.12, 0.5, 0.34],
            [0.2, -0.1, -0.6, 0.3],
            [0.02, -0.32, 0.1, 0.22],
          ] as const) {
            out.add(
              'wood',
              leaf(size, 0.004)
                .rotateZ(turn)
                .translate(x, yy, 0.01)
                .applyMatrix4(onWall(frame, c, y, 0)),
            );
          }
        }
      }
    }
    // A moss wall over the longest free stretch (at least 2.4 m), and trellises where it is free.
    const free = plan.runs(0, PLANT_TOP).filter(([a0, a1]) => a1 - a0 > 1.4);
    const longest = free.reduce<[number, number] | null>(
      (best, run) => (!best || run[1] - run[0] > best[1] - best[0] ? run : best),
      null,
    );
    if (
      longest &&
      longest[1] - longest[0] >= 2.6 &&
      plan.clear({ a0: longest[0], a1: longest[1], y0: 0, y1: PLANT_TOP }, 0.4)
    ) {
      const [a0, a1] = [longest[0] + 0.15, Math.min(longest[1] - 0.15, longest[0] + 4.95)];
      mossWall(out, frame, a0, a1, 0.7, 2.3, random);
    }
    for (const [r0, r1] of free) {
      if (longest && r0 === longest[0]) continue;
      for (let c = r0 + 0.7; c + 0.7 <= r1; c += 3.0) {
        if (!plan.clear({ a0: c - 0.6, a1: c + 0.6, y0: 0, y1: PLANT_TOP }, 0.4)) continue;
        trellis(out, frame, c, random);
      }
    }
  }
  glazedCeiling(room, sizeOf, out);
  decking(room, sizeOf, out);
  return out.parts();
}

/** A leaf: a pointed oval with its midrib, `size` long, `depth` thick, lying in its xy plane. */
function leaf(size: number, depth: number): THREE.BufferGeometry {
  const w = size * 0.36;
  const shape = new THREE.Shape()
    .moveTo(0, -size / 2)
    .quadraticCurveTo(w, -size / 6, 0, size / 2)
    .quadraticCurveTo(-w, -size / 6, 0, -size / 2);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
}

/** A living moss wall: a wooden frame round a green bed, cushions of moss and leaves on it. */
function mossWall(
  out: Pieces,
  frame: Parameters<typeof wallBox>[0],
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  random: () => number,
) {
  out.add('wood', wallBox(frame, a0 - 0.06, a1 + 0.06, y0 - 0.06, y0, 0, 0.1));
  out.add('wood', wallBox(frame, a0 - 0.06, a1 + 0.06, y1, y1 + 0.06, 0, 0.1));
  out.add('wood', wallBox(frame, a0 - 0.06, a0, y0, y1, 0, 0.1));
  out.add('wood', wallBox(frame, a1, a1 + 0.06, y0, y1, 0, 0.1));
  out.add('moss', wallBox(frame, a0, a1, y0, y1, 0, 0.02));
  const n = Math.round((a1 - a0) * (y1 - y0) * 20);
  for (let i = 0; i < n; i++) {
    const a = a0 + 0.05 + random() * (a1 - a0 - 0.1);
    const y = y0 + 0.05 + random() * (y1 - y0 - 0.1);
    const r = 0.03 + random() * 0.05;
    const cushion = new THREE.IcosahedronGeometry(r, 0).scale(1, 0.8, 0.6);
    const finish: Finish = random() < 0.35 ? 'foliage' : 'moss';
    out.add(finish, cushion.translate(0, 0, 0.02 + r * 0.6).applyMatrix4(onWall(frame, a, y, 0)));
  }
}

/** A trellis of crossed slats 1 m wide, a planter at its foot with a fern, a climber up the slats. */
function trellis(
  out: Pieces,
  frame: Parameters<typeof wallBox>[0],
  c: number,
  random: () => number,
) {
  const [y0, y1, w] = [0.55, PLANT_TOP - 0.05, 1.0];
  const place = onWall(frame, c, 0, 0);
  // The slats: two frames' uprights and diagonals crossing every 0.25 m.
  out.add('wood', wallBox(frame, c - w / 2, c - w / 2 + 0.04, y0, y1, 0.02, 0.05));
  out.add('wood', wallBox(frame, c + w / 2 - 0.04, c + w / 2, y0, y1, 0.02, 0.05));
  const span = y1 - y0;
  for (let c = y0 - w / 2; c <= y1 + w / 2; c += 0.3) {
    for (const lean of [1, -1] as const) {
      const slat = slatAcross(w, y0, y1, c, lean);
      if (slat) out.add('wood-light', slat.applyMatrix4(place));
    }
  }
  // The planter on the floor, 0.3 m out, and a fern of fronds in it.
  out.add('wood', wallBox(frame, c - 0.5, c + 0.5, 0, 0.45, 0, 0.3));
  out.add('pot', wallBox(frame, c - 0.46, c + 0.46, 0.45, 0.47, 0.02, 0.28));
  for (let i = 0; i < 9; i++) {
    const turn = -0.9 + (1.8 * i) / 8 + (random() - 0.5) * 0.2;
    const frond = leaf(0.4 + random() * 0.1, 0.006)
      .translate(0, 0.2, 0)
      .rotateX(0.4 + random() * 0.3) // leaning out of the planter, into the room
      .rotateZ(turn)
      .translate((random() - 0.5) * 0.3, 0.46, 0.15);
    out.add('foliage', frond.applyMatrix4(place));
  }
  // The climber: a stem winding up the slats, leaves along it.
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    points.push(
      new THREE.Vector3(0.32 * Math.sin(t * 7 + random()), y0 + 0.05 + t * (span - 0.15), 0.06),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  out.add('wood', new THREE.TubeGeometry(curve, 48, 0.012, 5, false).applyMatrix4(place));
  for (let i = 1; i < 26; i++) {
    const p = curve.getPoint(i / 26);
    const side = i % 2 === 0 ? 1 : -1;
    const blade = leaf(0.12 + random() * 0.06, 0.004)
      .rotateZ(side * (0.6 + random() * 0.5))
      .translate(p.x + side * 0.05, p.y, 0.065);
    out.add('foliage', blade.applyMatrix4(place));
  }
}

/** One slat of a trellis w wide from y0 to y1: the line y = c + lean·x, clipped to it. */
function slatAcross(w: number, y0: number, y1: number, c: number, lean: 1 | -1) {
  const [lo, hi] = [(y0 - c) * lean, (y1 - c) * lean].sort((p, q) => p - q) as [number, number];
  const [xa, xb] = [Math.max(-w / 2, lo), Math.min(w / 2, hi)];
  if (xb - xa < 0.05) return null;
  return rod(
    0.012,
    new THREE.Vector3(xa, c + lean * xa, 0.035),
    new THREE.Vector3(xb, c + lean * xb, 0.035),
    4,
  );
}

/** Wooden beams across the ceiling every 2.4 m, glazing between them; around the fixtures. */
function glazedCeiling(room: RoomDefinition, sizeOf: SizeOf, out: Pieces) {
  const { min, max } = room.bounds;
  const top = max[1];
  const fixtures = room.placements.flatMap((p) => {
    const box = footprint(p, sizeOf);
    return box && box[4] > top - 0.45 ? [box] : [];
  });
  const hits = (x0: number, x1: number, z0: number, z1: number) =>
    fixtures.some(([fx0, , fz0, fx1, , fz1]) => fx0 < x1 && x0 < fx1 && fz0 < z1 && z0 < fz1);
  // Panes: 1.2 × 2.4 m cells, each where no fixture hangs.
  for (let x = min[0]; x < max[0] - 0.1; x += MODULE) {
    for (let z = min[2]; z < max[2] - 0.1; z += 2 * MODULE) {
      const [x0, x1, z0, z1] = [
        x + 0.03,
        Math.min(x + MODULE, max[0]) - 0.03,
        z + 0.03,
        Math.min(z + 2 * MODULE, max[2]) - 0.03,
      ];
      if (hits(x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + 0.05)) continue;
      out.add(
        'sky',
        new THREE.BoxGeometry(x1 - x0, 0.004, z1 - z0).translate(
          (x0 + x1) / 2,
          top - 0.003,
          (z0 + z1) / 2,
        ),
      );
    }
  }
  // Beams along x every 2.4 m (deep), mullions along z every 1.2 m (slim): each cut round fixtures.
  for (let z = min[2] + 2 * MODULE; z < max[2] - 0.2; z += 2 * MODULE) {
    for (const [x0, x1] of cut(min[0], max[0], (a, b) => hits(a, b, z - 0.1, z + 0.1))) {
      out.add(
        'wood',
        new THREE.BoxGeometry(x1 - x0, 0.12, 0.1).translate((x0 + x1) / 2, top - 0.06, z),
      );
    }
  }
  for (let x = min[0] + MODULE; x < max[0] - 0.2; x += MODULE) {
    for (const [z0, z1] of cut(min[2], max[2], (a, b) => hits(x - 0.04, x + 0.04, a, b))) {
      out.add(
        'wood-light',
        new THREE.BoxGeometry(0.05, 0.05, z1 - z0).translate(x, top - 0.025, (z0 + z1) / 2),
      );
    }
  }
}

/** A line from s0 to s1 in 0.2 m steps, keeping the stretches where `blocked` is false. */
function cut(
  s0: number,
  s1: number,
  blocked: (a: number, b: number) => boolean,
): [number, number][] {
  const out: [number, number][] = [];
  let from: number | null = null;
  const step = 0.2;
  for (let a = s0; a < s1 - 1e-6; a += step) {
    const b = Math.min(a + step, s1);
    if (blocked(a, b)) {
      if (from !== null && a - from > 0.1) out.push([from, a]);
      from = null;
    } else if (from === null) from = a;
  }
  if (from !== null && s1 - from > 0.1) out.push([from, s1]);
  return out;
}

/** A border of wooden decking round the floor (0.9 m wide), planks along each wall, open at doorways. */
function decking(room: RoomDefinition, sizeOf: SizeOf, out: Pieces) {
  const width = 0.9;
  const plank = 0.15;
  for (const frame of wallFrames(room)) {
    const plan = new WallPlan(room, frame, sizeOf);
    // Its ends meet the next walls' borders: north and south run the whole wall, west and east between.
    const inset = frame.alongX ? 0 : width;
    const gaps = plan.openings.map((o) => [o.a0, o.a1] as const);
    for (let d = 0.005; d + plank <= width + 1e-6; d += plank) {
      let from = frame.span[0] + inset;
      const end = frame.span[1] - inset;
      const pieces: [number, number][] = [];
      for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
        if (g0 > from) pieces.push([from, Math.min(g0, end)]);
        from = Math.max(from, g1);
      }
      if (from < end) pieces.push([from, end]);
      for (const [a0, a1] of pieces) {
        if (a1 - a0 < 0.1) continue;
        const p = wallPoint(frame, (a0 + a1) / 2, 0.003, d + plank / 2);
        const [lx, lz] = frame.alongX ? [a1 - a0, plank - 0.01] : [plank - 0.01, a1 - a0];
        out.add('wood-light', new THREE.BoxGeometry(lx, 0.006, lz).translate(p.x, p.y, p.z));
      }
    }
  }
}
