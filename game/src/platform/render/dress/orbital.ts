import * as THREE from 'three';
import type { RoomDefinition } from '../../../world/definitions';
import { drum, rod, sphere } from '../props/parts';
import {
  alongSign,
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

// Chemistry (Phase U-4, contract §4): the science module of an orbital station. Rounded white
// panels laid as a honeycomb (the benzene ring's hexagon), an amber hazard band at the floor with
// dark diagonal stripes, a teal trim line, three coloured service pipes with valves and gauges, a
// fume duct along the north wall under the ceiling; motifs on plain panels (a molecule in balls and
// sticks, the periodic table's grid); on the resin floor, hexagon inlays. Accent: teal and amber,
// apart from Physics' cyan and steel. Flat cladding lies behind everything; what stands out keeps
// clear of what stands at the wall.

const HAZARD = [0.1, 0.28] as const;
const LOWER = [0.3, 1.0] as const;
const TRIM = [1.02, 1.05] as const;
const HONEYCOMB = [1.08, 2.9] as const;
const PIPES = [3.0, 3.13, 3.26] as const;
const UPPER_FROM = 3.42;
/** A hexagon's circumradius (m) and the gap between two. */
const HEX = 0.26;
const HEX_GAP = 0.03;

export function orbitalModule(room: RoomDefinition, sizeOf: SizeOf): DressPart[] {
  const out = new Pieces();
  const h = room.bounds.max[1] - room.bounds.min[1];
  let motif = 0;
  for (const frame of wallFrames(room)) {
    const plan = new WallPlan(room, frame, sizeOf);
    const edges = moduleEdges(frame.span);
    // The hazard band: amber, dark stripes leaning across it.
    for (const [a0, a1] of plan.runs(HAZARD[0], HAZARD[1], true, 0)) {
      out.add('amber', wallBox(frame, a0, a1, HAZARD[0], HAZARD[1], 0, 0.012));
      const rise = HAZARD[1] - HAZARD[0];
      for (let a = a0 + 0.04; a + 0.1 + rise <= a1; a += 0.3) {
        // a whole stripe in the run
        const stripe = new THREE.Shape()
          .moveTo(0, 0)
          .lineTo(0.1, 0)
          .lineTo(0.1 + rise, rise)
          .lineTo(rise, rise)
          .closePath();
        const geometry = new THREE.ExtrudeGeometry(stripe, { depth: 0.002, bevelEnabled: false });
        const from = alongSign(frame) > 0 ? a : a + 0.1 + rise; // its shape runs along +x
        out.add('trim', geometry.applyMatrix4(onWall(frame, from, HAZARD[0], 0.012)));
      }
    }
    // Plain rounded panels below, behind the pipes and above; a teal line under the honeycomb.
    for (const [y0, y1] of [
      LOWER,
      [HONEYCOMB[1] + 0.03, UPPER_FROM - 0.03],
      [UPPER_FROM, h - 0.02],
    ] as const) {
      for (let k = 0; k + 1 < edges.length; k++) {
        const m0 = (edges[k] ?? 0) + 0.015;
        const m1 = (edges[k + 1] ?? 0) - 0.015;
        for (const [p0, p1] of plan.runs(y0, y1, true, 0)) {
          const a0 = Math.max(m0, p0);
          const a1 = Math.min(m1, p1);
          if (a1 - a0 > 0.1) out.add('hull', roundedPanel(frame, a0, a1, y0, y1));
        }
      }
    }
    for (const [a0, a1] of plan.runs(TRIM[0], TRIM[1], true, 0)) {
      out.add('inlay-teal', wallBox(frame, a0, a1, TRIM[0], TRIM[1], 0, 0.013));
    }
    // Motif panels first (every fourth module, where nothing stands), then the honeycomb round them.
    const panels: [number, number][] = [];
    for (let k = 0; k + 1 < edges.length; k++) {
      const [e0, e1] = [edges[k] ?? 0, edges[k + 1] ?? 0];
      if (k % 4 !== 2 || e1 - e0 < MODULE - 1e-6) continue;
      const c = (e0 + e1) / 2;
      const area = { a0: c - 0.55, a1: c + 0.55, y0: HONEYCOMB[0], y1: HONEYCOMB[1] };
      if (!plan.clear(area)) continue;
      panels.push([area.a0, area.a1]);
      out.add('hull', roundedPanel(frame, area.a0, area.a1, 1.25, 2.75));
      const place = onWall(frame, c, 2.0, 0.014);
      const pieces = MOTIFS[motif++ % MOTIFS.length]?.() ?? [];
      for (const { finish, geometry } of pieces) out.add(finish, geometry.applyMatrix4(place));
    }
    // The honeycomb: flat-topped hexagons in columns 1.5 R apart, every other column half a row up.
    const cell = new THREE.CylinderGeometry(HEX - HEX_GAP / 2 - 0.012, HEX - HEX_GAP / 2, 0.012, 6)
      .rotateX(Math.PI / 2)
      .rotateZ(Math.PI / 6) // flat-topped
      .translate(0, 0, 0.006);
    const rowH = Math.sqrt(3) * HEX;
    const [s0, s1] = frame.span;
    for (let col = 0, a = s0 + HEX; a <= s1 - HEX + 1e-6; col++, a += 1.5 * HEX) {
      for (
        let y = HONEYCOMB[0] + rowH / 2 + (col % 2) * (rowH / 2);
        y + rowH / 2 <= HONEYCOMB[1] + 1e-6;
        y += rowH
      ) {
        const patch = { a0: a - HEX, a1: a + HEX, y0: y - rowH / 2, y1: y + rowH / 2 };
        if (plan.openings.some((o) => o.a0 < patch.a1 && patch.a0 < o.a1 && patch.y0 < o.y1))
          continue;
        if (panels.some(([p0, p1]) => p0 - 0.02 < patch.a1 && patch.a0 < p1 + 0.02)) continue;
        out.add('hull', cell.clone().applyMatrix4(onWall(frame, a, y, 0)));
      }
    }
    cell.dispose();
    // Service pipes (teal, amber, steel) on stand-off brackets; valves and gauges along them.
    const finishes = ['pipe-teal', 'amber', 'steel'] as const;
    for (const [r0, r1] of plan.runs(PIPES[0] - 0.06, PIPES[2] + 0.06)) {
      // Short of a corner by more than a pipe's radius: a run along a whole wall stays inside it.
      const a0 = Math.max(r0, frame.span[0] + 0.04);
      const a1 = Math.min(r1, frame.span[1] - 0.04);
      PIPES.forEach((y, i) => {
        out.add(
          finishes[i] ?? 'steel',
          rod(0.032, wallPoint(frame, a0, y, 0.09), wallPoint(frame, a1, y, 0.09), 8),
        );
      });
      for (const e of edges) {
        if (e > a0 + 0.15 && e < a1 - 0.15) {
          out.add(
            'trim',
            wallBox(frame, e - 0.03, e + 0.03, PIPES[0] - 0.07, PIPES[2] + 0.07, 0, 0.13),
          );
        }
      }
      for (let a = a0 + 1.8; a < a1 - 0.4; a += 3.6) {
        // A valve on the teal pipe: body, stem and hand wheel facing the room.
        const valve = onWall(frame, a, PIPES[0], 0.09);
        out.add(
          'steel',
          new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8).rotateZ(Math.PI / 2).applyMatrix4(valve),
        );
        out.add(
          'steel',
          new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8)
            .rotateX(Math.PI / 2)
            .translate(0, 0, 0.08)
            .applyMatrix4(valve),
        );
        out.add(
          'amber',
          new THREE.TorusGeometry(0.06, 0.01, 4, 12).translate(0, 0, 0.13).applyMatrix4(valve),
        );
      }
      for (let a = a0 + 0.9; a < a1 - 0.3; a += 4.8) {
        // A gauge on the amber pipe: a dial on a short neck, its face to the room.
        const gauge = onWall(frame, a, PIPES[1] + 0.1, 0.09);
        out.add(
          'steel',
          drum(0.05, 0.05, 0, 0.03, 10)
            .rotateX(Math.PI / 2)
            .applyMatrix4(gauge),
        );
        out.add(
          'linen',
          drum(0.042, 0.042, 0, 0.032, 10)
            .rotateX(Math.PI / 2)
            .applyMatrix4(gauge),
        );
        out.add(
          'trim',
          new THREE.BoxGeometry(0.004, 0.035, 0.004)
            .translate(0.008, 0.012, 0.034)
            .rotateZ(-0.6)
            .applyMatrix4(gauge),
        );
      }
    }
    // The fume duct, along the north wall under the ceiling.
    if (frame.wall === 'north') {
      for (const [a0, a1] of plan.runs(h - 0.6, h, false, 0.05)) {
        out.add('aluminium', wallBox(frame, a0, a1, h - 0.55, h - 0.12, 0, 0.42));
        for (let a = a0 + 0.6; a < a1 - 0.2; a += MODULE) {
          out.add('trim', wallBox(frame, a - 0.03, a + 0.03, h - 0.57, h - 0.1, 0, 0.44));
        }
      }
    }
  }
  floorHexes(room, sizeOf, out);
  return out.parts();
}

/** A panel with its edges drawn back (a chamfered box), flat on the wall: rounded to the eye. */
function roundedPanel(
  frame: Parameters<typeof wallBox>[0],
  a0: number,
  a1: number,
  y0: number,
  y1: number,
) {
  const [w, hgt] = [a1 - a0, y1 - y0];
  const r = Math.min(0.06, w / 4, hgt / 4);
  const shape = new THREE.Shape()
    .moveTo(-w / 2 + r, -hgt / 2)
    .lineTo(w / 2 - r, -hgt / 2)
    .quadraticCurveTo(w / 2, -hgt / 2, w / 2, -hgt / 2 + r)
    .lineTo(w / 2, hgt / 2 - r)
    .quadraticCurveTo(w / 2, hgt / 2, w / 2 - r, hgt / 2)
    .lineTo(-w / 2 + r, hgt / 2)
    .quadraticCurveTo(-w / 2, hgt / 2, -w / 2, hgt / 2 - r)
    .lineTo(-w / 2, -hgt / 2 + r)
    .quadraticCurveTo(-w / 2, -hgt / 2, -w / 2 + r, -hgt / 2);
  // Corners cut once (a chamfer reads as rounded at a few metres; the triangles stay few).
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: false,
    curveSegments: 1,
  }).translate(0, 0, 0.001);
  return geometry.applyMatrix4(onWall(frame, (a0 + a1) / 2, (y0 + y1) / 2, 0));
}

type Piece = {
  finish: 'inlay-teal' | 'amber' | 'linen' | 'trim' | 'steel';
  geometry: THREE.BufferGeometry;
};

/** Motifs on a plain panel (about 1 × 1.4 m, centred): a molecule, the periodic table's grid. */
const MOTIFS: (() => Piece[])[] = [
  () => {
    // Ethanol's skeleton in balls and sticks, flat on the panel: C–C–O with its hydrogens.
    const atoms: [number, number, number, 'trim' | 'amber' | 'linen'][] = [
      [-0.2, 0, 0.07, 'trim'],
      [0.12, 0.12, 0.07, 'trim'],
      [0.42, -0.05, 0.065, 'amber'],
      [-0.34, 0.26, 0.04, 'linen'],
      [-0.4, -0.2, 0.04, 'linen'],
      [-0.18, -0.32, 0.04, 'linen'],
      [0.08, 0.44, 0.04, 'linen'],
      [0.3, 0.36, 0.04, 'linen'],
      [0.6, 0.18, 0.04, 'linen'],
    ];
    const bonds = [
      [0, 1],
      [1, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [1, 6],
      [1, 7],
      [2, 8],
    ];
    const pieces: Piece[] = atoms.map(([x, y, r, finish]) => ({
      finish,
      geometry: sphere(r, x, y, r + 0.005, 16),
    }));
    for (const [i, j] of bonds) {
      const [p, q] = [atoms[i ?? 0], atoms[j ?? 0]];
      if (!p || !q) continue;
      pieces.push({
        finish: 'steel',
        geometry: rod(
          0.014,
          new THREE.Vector3(p[0], p[1], 0.04),
          new THREE.Vector3(q[0], q[1], 0.04),
          8,
        ),
      });
    }
    return pieces;
  },
  () => {
    // The periodic table's outline: 18 groups, 7 periods, the s, p, d blocks in their places.
    const pieces: Piece[] = [];
    const s = 0.05;
    for (let period = 0; period < 7; period++) {
      for (let group = 0; group < 18; group++) {
        const there =
          period === 0 ? group === 0 || group === 17 : period < 3 ? group < 2 || group > 11 : true;
        if (!there) continue;
        const finish = group < 2 ? 'amber' : group > 11 ? 'inlay-teal' : 'trim';
        pieces.push({
          finish,
          geometry: new THREE.BoxGeometry(s - 0.008, s - 0.008, 0.006).translate(
            (group - 8.5) * s,
            (3 - period) * s,
            0.003,
          ),
        });
      }
    }
    return pieces;
  },
];

/** Hexagon inlays on the floor (a ring laid 4 mm up, a benzene's circle inside), where nothing stands. */
function floorHexes(room: RoomDefinition, sizeOf: SizeOf, out: Pieces): void {
  const { min, max } = room.bounds;
  const y = min[1];
  const boxes = room.placements.flatMap((p) => {
    const box = footprint(p, sizeOf);
    return box ? [box] : [];
  });
  const free = (x: number, z: number) =>
    boxes.every(
      ([x0, y0, z0, x1, , z1]) =>
        y0 > y + 0.3 || x1 < x - 0.9 || x0 > x + 0.9 || z1 < z - 0.9 || z0 > z + 0.9,
    );
  let n = 0;
  for (let x = min[0] + 2.2; x < max[0] - 1.8; x += 3.2) {
    for (let z = min[2] + 2.2; z < max[2] - 1.8; z += 3.2) {
      if (n >= 8 || !free(x, z)) continue;
      n++;
      const ring = new THREE.RingGeometry(0.5, 0.56, 6, 1).rotateX(-Math.PI / 2);
      out.add('inlay-teal', ring.translate(x, y + 0.004, z));
      const circle = new THREE.RingGeometry(0.28, 0.31, 32, 1).rotateX(-Math.PI / 2);
      out.add('amber', circle.translate(x, y + 0.004, z));
    }
  }
}
