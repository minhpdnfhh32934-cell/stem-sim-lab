/**
 * Procedural geometry of the Mendel lab bench (illustration only, no number of the model in any
 * shape): the Punnett tray with one recessed slot per cell and two header channels for the
 * gametes, the parents' pedestals, the phenotype cylinders (glass with a real wall thickness and
 * a foot) and the marks engraved on them. Every function returns a fresh geometry; the scene
 * hands it to its SceneKit, which frees it.
 */
import * as THREE from 'three';
import { LAYOUT, half, trayEdges, tubeTop, type BoardDims } from './layout';

const L = LAYOUT;

/** A rounded rectangle path (centre, half sizes, corner radius), counter-clockwise. */
function roundedRect(
  path: THREE.Path,
  cx: number,
  cy: number,
  hx: number,
  hy: number,
  r: number,
  clockwise = false,
): void {
  const rr = Math.max(0.001, Math.min(r, hx, hy));
  const x0 = cx - hx;
  const x1 = cx + hx;
  const y0 = cy - hy;
  const y1 = cy + hy;
  if (!clockwise) {
    path.moveTo(x0 + rr, y0);
    path.lineTo(x1 - rr, y0);
    path.quadraticCurveTo(x1, y0, x1, y0 + rr);
    path.lineTo(x1, y1 - rr);
    path.quadraticCurveTo(x1, y1, x1 - rr, y1);
    path.lineTo(x0 + rr, y1);
    path.quadraticCurveTo(x0, y1, x0, y1 - rr);
    path.lineTo(x0, y0 + rr);
    path.quadraticCurveTo(x0, y0, x0 + rr, y0);
  } else {
    path.moveTo(x0 + rr, y0);
    path.quadraticCurveTo(x0, y0, x0, y0 + rr);
    path.lineTo(x0, y1 - rr);
    path.quadraticCurveTo(x0, y1, x0 + rr, y1);
    path.lineTo(x1 - rr, y1);
    path.quadraticCurveTo(x1, y1, x1, y1 - rr);
    path.lineTo(x1, y0 + rr);
    path.quadraticCurveTo(x1, y0, x1 - rr, y0);
    path.lineTo(x0 + rr, y0);
  }
}

/**
 * The tray's walls: a bevelled frame whose holes are the cells' slots and the two header
 * channels (the mother's along the left edge, the father's along the back). The walls stand on
 * the floor (`floorY`) and rise `wallH`; the floor itself is a separate slab.
 */
export function trayGeometry(d: BoardDims, curveSegments: number): THREE.BufferGeometry {
  const h = half(d);
  const e = trayEdges(d);
  // Shape coordinates: (x, −z), so that extruding along +z and turning the shape up gives y.
  const shape = new THREE.Shape();
  roundedRect(
    shape,
    (e.x0 + e.x1) / 2,
    -(e.z0 + e.z1) / 2,
    (e.x1 - e.x0) / 2,
    (e.z1 - e.z0) / 2,
    0.42,
  );
  const hole = (cx: number, cz: number, hx: number, hz: number, r: number) => {
    const p = new THREE.Path();
    roundedRect(p, cx, -cz, hx, hz, r, true);
    shape.holes.push(p);
  };
  for (let i = 0; i < d.rows; i++)
    for (let j = 0; j < d.cols; j++) {
      const x = (j - (d.cols - 1) / 2) * L.cell;
      const z = (i - (d.rows - 1) / 2) * L.cell;
      hole(x, z, L.slotHalf, L.slotHalf, 0.16);
    }
  const span = (n: number) => (n * L.cell) / 2 - (L.cell / 2 - L.slotHalf);
  // Header channels: the gametes rest in them.
  hole(-h.x - L.headerGap, 0, L.channelHalf, span(d.rows), L.channelHalf * 0.9);
  hole(0, -h.z - L.headerGap, span(d.cols), L.channelHalf, L.channelHalf * 0.9);
  const bevel = 0.035;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: L.wallH - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: Math.max(2, Math.round(curveSegments)),
  });
  // Extrusion runs along +z from −bevel; turn it up (shape y → −z, extrusion → +y).
  g.rotateX(-Math.PI / 2);
  g.translate(0, L.floorY + bevel, 0);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A lathe profile (radius, height) as a closed solid of revolution. */
function lathe(points: [number, number][], sides: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    Math.max(12, Math.round(sides)),
  );
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A parent's pedestal: a low disc with a rounded top edge (radius `pedestalR`, top at `pedestalH`). */
export function pedestalGeometry(sides: number): THREE.BufferGeometry {
  const R = L.pedestalR;
  const H = L.pedestalH;
  const pts: [number, number][] = [[0, 0]];
  pts.push([R + 0.06, 0], [R + 0.06, H * 0.35], [R, H * 0.5]);
  // Rounded top edge.
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    pts.push([R - 0.08 + 0.08 * Math.cos(a), H - 0.08 + 0.08 * Math.sin(a)]);
  }
  pts.push([0, H]);
  return lathe(pts, sides);
}

/**
 * A cylinder's glass: a foot, an outer wall, a lip and an inner wall down to the inner bottom
 * (at `plinthH`, where the liquid starts) — a real wall thickness, no wire edges.
 */
export function cylinderGlassGeometry(sides: number): THREE.BufferGeometry {
  const top = tubeTop();
  const ri = L.tubeIn;
  const ro = L.tubeOut;
  const foot = ro + 0.2;
  const pts: [number, number][] = [
    [0, L.plinthH - 0.02],
    [ri - 0.03, L.plinthH - 0.02],
    [ri, L.plinthH + 0.02],
    [ri, top - 0.02],
    [(ri + ro) / 2, top + 0.015],
    [ro + 0.012, top - 0.01],
    [ro, top - 0.05],
    [ro, 0.16],
    [foot - 0.04, 0.1],
    [foot, 0.06],
    [foot - 0.02, 0],
    [0, 0],
  ];
  return lathe(pts, sides);
}

/** An engraved mark: a short arc around the front of a cylinder (centred on +z, lying flat). */
export function markGeometry(sides: number): THREE.BufferGeometry {
  const arc = 1.5;
  const g = new THREE.TorusGeometry(
    L.tubeOut + 0.004,
    0.013,
    4,
    Math.max(8, Math.round(sides / 2)),
    arc,
  );
  // Torus in the xy plane from angle 0: centre the arc on +y, then lay it flat facing +z.
  g.rotateZ(Math.PI / 2 - arc / 2);
  g.rotateX(Math.PI / 2);
  g.computeBoundingSphere();
  return g;
}

/** A gamete's seat in its channel: a shallow ring the bead rests in. */
export function seatGeometry(sides: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(L.gameteR * 0.62, 0.035, 6, Math.max(12, Math.round(sides)));
  g.rotateX(Math.PI / 2);
  g.translate(0, L.floorY + 0.035, 0);
  g.computeBoundingSphere();
  return g;
}
