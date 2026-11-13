import * as THREE from 'three';
import type { RoomDefinition } from '../../../world/definitions';
import { rod, sphere } from '../props/parts';
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

// Physics (Phase U-3, contract §4): the engineering deck of a starship. White hull panels with dark
// seams over a dark kick band, a cyan light strip at waist height and under the ceiling, a steel
// ledge, ribs every 2.4 m, vents and two conduits near the ceiling; motifs on panels (orbits, a
// wave, field lines); on the floor a guide line round the room and a few hatches. Accent: cyan and
// steel. Flat cladding lies behind everything; what stands out keeps clear of what stands at the
// wall. No light of its own: the strips glow, lighting nothing.

/** Heights above the floor (m). The ceiling's own (`h`) are given from the top. */
const KICK = [0.1, 0.42] as const;
const LOWER = [0.45, 1.02] as const;
const WAIST = [1.035, 1.065] as const;
const MID = [1.09, 2.62] as const;
const LEDGE = [2.64, 2.7] as const;
const UPPER_FROM = 2.73;
/** The dark cornice and the strip under it, from the ceiling down. */
const CORNICE = 0.48;
const TOP_STRIP = [0.53, 0.5] as const;
/** Depths off the wall (m): cladding, strips, the ledge, ribs. */
const PANEL_D = 0.012;
const STRIP_D = 0.017;
const SEAM = 0.03;

export function starshipDeck(room: RoomDefinition, sizeOf: SizeOf): DressPart[] {
  const out = new Pieces();
  const h = room.bounds.max[1] - room.bounds.min[1];
  const upper = [UPPER_FROM, h - TOP_STRIP[0] - 0.03] as const;
  let motif = 0;
  for (const frame of wallFrames(room)) {
    const plan = new WallPlan(room, frame, sizeOf);
    const edges = moduleEdges(frame.span);
    // Hull panels in three rows, a seam between modules; cut at the openings only.
    for (const [y0, y1] of [LOWER, MID, upper]) {
      if (y1 - y0 < 0.2) continue;
      for (let k = 0; k + 1 < edges.length; k++) {
        const m0 = (edges[k] ?? 0) + SEAM / 2;
        const m1 = (edges[k + 1] ?? 0) - SEAM / 2;
        for (const [p0, p1] of plan.runs(y0, y1, true, 0)) {
          const a0 = Math.max(m0, p0);
          const a1 = Math.min(m1, p1);
          if (a1 - a0 > 0.1) out.add('hull', wallBox(frame, a0, a1, y0, y1, 0, PANEL_D));
        }
      }
    }
    for (const [a0, a1] of plan.runs(KICK[0], KICK[1], true, 0)) {
      out.add('frame-dark', wallBox(frame, a0, a1, KICK[0], KICK[1], 0, PANEL_D + 0.002));
    }
    for (const [a0, a1] of plan.runs(h - CORNICE, h, true, 0)) {
      out.add('frame-dark', wallBox(frame, a0, a1, h - CORNICE, h, 0, PANEL_D));
    }
    // What stands out: strips, the ledge, the conduits — cut at what stands at the wall too.
    for (const [y0, y1] of [WAIST, [h - TOP_STRIP[0], h - TOP_STRIP[1]] as const]) {
      for (const [a0, a1] of plan.runs(y0, y1)) {
        out.add('glow-cyan', wallBox(frame, a0, a1, y0, y1, 0, STRIP_D));
      }
    }
    for (const [a0, a1] of plan.runs(LEDGE[0], LEDGE[1])) {
      out.add('steel', wallBox(frame, a0, a1, LEDGE[0], LEDGE[1], 0, 0.035));
    }
    const pipes = [h - 0.3, h - 0.19];
    for (const [a0, a1] of plan.runs(h - 0.36, h - 0.13)) {
      pipes.forEach((y, i) => {
        out.add(
          i === 0 ? 'steel' : 'trim',
          rod(0.03, wallPoint(frame, a0, y, 0.075), wallPoint(frame, a1, y, 0.075), 10),
        );
      });
      for (const e of edges) {
        if (e > a0 + 0.1 && e < a1 - 0.1) {
          out.add('steel', wallBox(frame, e - 0.025, e + 0.025, h - 0.36, h - 0.13, 0, 0.11));
        }
      }
    }
    // Ribs every second module edge, rising from above what stands in front of them.
    for (let k = 2; k < edges.length - 1; k += 2) {
      const e = edges[k] ?? 0;
      const [a0, a1] = [e - 0.07, e + 0.07];
      const top = h - CORNICE;
      const y0 = Math.max(KICK[1], plan.topOf(a0 - 0.03, a1 + 0.03, top) + 0.05);
      if (top - y0 < 0.8 || !plan.clear({ a0, a1, y0, y1: top }, 0.3, 0.9)) continue;
      out.add('aluminium', wallBox(frame, a0, a1, y0, top, 0, 0.07));
      out.add('frame-dark', wallBox(frame, e - 0.09, e + 0.09, top - 0.14, top, 0, 0.09));
      if (y0 === KICK[1]) {
        out.add('frame-dark', wallBox(frame, e - 0.09, e + 0.09, KICK[1], KICK[1] + 0.1, 0, 0.09));
      }
    }
    // Vents in the upper row, motifs on the middle row, each where nothing stands.
    for (let k = 0; k + 1 < edges.length; k++) {
      const [e0, e1] = [edges[k] ?? 0, edges[k + 1] ?? 0];
      if (e1 - e0 < MODULE - 1e-6) continue;
      const c = (e0 + e1) / 2;
      const vy = (upper[0] + upper[1]) / 2;
      if (k % 4 === 1 && upper[1] - upper[0] > 0.45) {
        const vent = { a0: c - 0.36, a1: c + 0.36, y0: vy - 0.15, y1: vy + 0.15 };
        if (plan.clear(vent)) {
          out.add('trim', wallBox(frame, vent.a0, vent.a1, vent.y0, vent.y1, 0, 0.018));
          for (let s = -1; s <= 1; s++) {
            const y = vy + s * 0.08;
            out.add('steel', wallBox(frame, c - 0.33, c + 0.33, y - 0.015, y + 0.015, 0, 0.024));
          }
        }
      }
      const my = (MID[0] + MID[1]) / 2;
      if (k % 4 === 3 && plan.clear({ a0: c - 0.55, a1: c + 0.55, y0: MID[0], y1: MID[1] })) {
        const place = onWall(frame, c, my, PANEL_D);
        const pieces = MOTIFS[motif++ % MOTIFS.length]?.() ?? [];
        out.add('inlay-cyan', ...pieces.map((g) => g.applyMatrix4(place)));
      }
    }
  }
  floorMarks(room, sizeOf, out);
  return out.parts();
}

/** A line of the motifs (radius 7 mm), standing just off the panel. */
const line = (points: THREE.Vector3[], closed = false) =>
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points, closed),
    Math.max(16, points.length),
    0.007,
    4,
    closed,
  ).translate(0, 0, 0.008);

/** Points of an ellipse of radii (rx, ry), turned by `turn` in the panel's plane. */
const ellipse = (rx: number, ry: number, turn: number, n = 32) =>
  Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    const [x, y] = [rx * Math.cos(t), ry * Math.sin(t)];
    return new THREE.Vector3(
      x * Math.cos(turn) - y * Math.sin(turn),
      x * Math.sin(turn) + y * Math.cos(turn),
      0,
    );
  });

/** Motifs etched on a panel (about 1 × 1.3 m, centred): an atom's orbits, a wave, field lines. */
const MOTIFS: (() => THREE.BufferGeometry[])[] = [
  () => {
    const parts: THREE.BufferGeometry[] = [0, Math.PI / 3, (2 * Math.PI) / 3].map((turn) =>
      line(ellipse(0.42, 0.15, turn), true),
    );
    parts.push(sphere(0.055, 0, 0, 0.045, 10)); // its back just off the panel
    return parts;
  },
  () => {
    const wave = Array.from({ length: 33 }, (_, i) => {
      const x = -0.45 + (0.9 * i) / 32;
      return new THREE.Vector3(x, 0.22 * Math.sin((2 * Math.PI * (x + 0.45)) / 0.45), 0);
    });
    const axis = [new THREE.Vector3(-0.47, 0, 0), new THREE.Vector3(0.47, 0, 0)];
    const second = wave.map((p) => new THREE.Vector3(p.x, -0.45 + 0.6 * p.y, 0));
    return [line(wave), line(axis), line(second)];
  },
  () => {
    const pieces: THREE.BufferGeometry[] = [
      sphere(0.045, -0.3, 0, 0.035, 10),
      sphere(0.045, 0.3, 0, 0.035, 10),
    ];
    for (const bulge of [-0.42, -0.22, 0.22, 0.42]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.28, 0, 0),
        new THREE.Vector3(0, bulge * 1.6, 0),
        new THREE.Vector3(0.28, 0, 0),
      );
      pieces.push(line(curve.getPoints(16)));
    }
    pieces.push(line([new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(0.25, 0, 0)]));
    return pieces;
  },
];

/** Floor marks 6 mm high: a guide line 0.75 m in from the walls, and hatches where the floor is free. */
function floorMarks(room: RoomDefinition, sizeOf: SizeOf, out: Pieces): void {
  const { min, max } = room.bounds;
  const y = min[1];
  const inset = 0.75;
  const t = 0.05;
  const mark = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    finish: 'inlay-cyan' | 'aluminium' | 'frame-dark',
    top = 0.006,
  ) =>
    out.add(
      finish,
      new THREE.BoxGeometry(x1 - x0, top, z1 - z0).translate(
        (x0 + x1) / 2,
        y + top / 2,
        (z0 + z1) / 2,
      ),
    );
  // The guide line, open in front of each doorway.
  for (const frame of wallFrames(room)) {
    const plan = new WallPlan(room, frame, sizeOf);
    const lineAt = frame.at + frame.inward * inset;
    const [s0, s1] = [frame.span[0] + inset, frame.span[1] - inset];
    let from = s0;
    const gaps = plan.openings.map((o) => [o.a0, o.a1] as const).sort((p, q) => p[0] - q[0]);
    const pieces: [number, number][] = [];
    for (const [g0, g1] of gaps) {
      if (g0 > from) pieces.push([from, Math.min(g0, s1)]);
      from = Math.max(from, g1);
    }
    if (from < s1) pieces.push([from, s1]);
    for (const [a0, a1] of pieces) {
      if (a1 - a0 < 0.1) continue;
      if (frame.alongX) mark(a0, a1, lineAt - t / 2, lineAt + t / 2, 'inlay-cyan');
      else mark(lineAt - t / 2, lineAt + t / 2, a0, a1, 'inlay-cyan');
    }
  }
  // Hatches (1 m square, a dark frame round an aluminium plate) on a 3.6 m grid, where nothing stands.
  const boxes = room.placements.flatMap((p) => {
    const box = footprint(p, sizeOf);
    return box ? [box] : [];
  });
  const free = (x: number, z: number) =>
    boxes.every(
      ([x0, y0, z0, x1, , z1]) =>
        y0 > y + 0.3 || x1 < x - 1.1 || x0 > x + 1.1 || z1 < z - 1.1 || z0 > z + 1.1,
    );
  let hatches = 0;
  for (let x = min[0] + 2.4; x < max[0] - 2; x += 3.6) {
    for (let z = min[2] + 2.4; z < max[2] - 2; z += 3.6) {
      if (hatches >= 6 || !free(x, z)) continue;
      hatches++;
      const [a, b] = [0.5, 0.46];
      mark(x - a, x + a, z - a, z - b, 'frame-dark');
      mark(x - a, x + a, z + b, z + a, 'frame-dark');
      mark(x - a, x - b, z - b, z + b, 'frame-dark');
      mark(x + b, x + a, z - b, z + b, 'frame-dark');
      mark(x - b, x + b, z - b, z + b, 'aluminium', 0.004);
    }
  }
}
