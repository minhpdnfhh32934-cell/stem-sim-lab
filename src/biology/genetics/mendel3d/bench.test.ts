import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cylinderGlassGeometry, markGeometry, pedestalGeometry, trayGeometry } from './bench';
import { stepFrame } from './camera';
import {
  LAYOUT,
  QUARTERS,
  barHeight,
  cellPoint,
  gameteSlot,
  parentCenter,
  pedestalX,
  trayEdges,
  tubeTop,
  type BoardDims,
  type Vec3,
} from './layout';

const D: BoardDims = { rows: 4, cols: 4, loci: 2, classes: 4 };

/** A ray straight down onto (x, z): what it meets first on the tray's walls (or nothing). */
function wallHit(g: THREE.BufferGeometry, x: number, z: number): number | null {
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(mesh)[0];
  return hit ? hit.point.y : null;
}

describe('Mendel bench geometry', () => {
  it('the tray: walls around every cell slot and both header channels, inside its edges', () => {
    const g = trayGeometry(D, 4);
    g.computeBoundingBox();
    const box = g.boundingBox ?? new THREE.Box3();
    const e = trayEdges(D);
    // The bevel adds at most its size around the outline.
    expect(box.min.x).toBeGreaterThan(e.x0 - 0.05);
    expect(box.max.x).toBeLessThan(e.x1 + 0.05);
    expect(box.min.y).toBeCloseTo(LAYOUT.floorY, 6);
    expect(box.max.y).toBeCloseTo(LAYOUT.floorY + LAYOUT.wallH, 6);
    const p: Vec3 = [0, 0, 0];
    // Every slot and every gamete seat is open (a token or a gamete rests on the floor there).
    for (let i = 0; i < D.rows; i++)
      for (let j = 0; j < D.cols; j++) {
        cellPoint(D, i, j, p);
        expect(wallHit(g, p[0], p[2]), `cell ${String(i)},${String(j)}`).toBeNull();
      }
    for (const parent of [0, 1] as const)
      for (let k = 0; k < 4; k++) {
        gameteSlot(D, parent, k, p);
        expect(wallHit(g, p[0], p[2])).toBeNull();
      }
    // Between two slots stands a wall.
    cellPoint(D, 0, 0, p);
    expect(wallHit(g, p[0] + LAYOUT.cell / 2, p[2])).toBeCloseTo(LAYOUT.floorY + LAYOUT.wallH, 2);
    g.dispose();
  });

  it('a cylinder holds probability 1 below its rim; marks sit at 1/4 … 1; pedestals are low', () => {
    const glass = cylinderGlassGeometry(24);
    glass.computeBoundingBox();
    expect(glass.boundingBox?.max.y ?? 0).toBeGreaterThan(LAYOUT.plinthH + barHeight(1));
    expect(glass.boundingBox?.max.y ?? 0).toBeLessThanOrEqual(tubeTop() + 0.02);
    // The liquid column (radius barHalf) fits inside the glass wall.
    expect(LAYOUT.barHalf).toBeLessThan(LAYOUT.tubeIn);
    expect(QUARTERS.map((q) => barHeight(q) / LAYOUT.barH)).toEqual([0.25, 0.5, 0.75, 1]);
    const mark = markGeometry(24);
    mark.computeBoundingBox();
    // An arc on the front of the glass (+z), lying flat.
    expect(mark.boundingBox?.min.z ?? 0).toBeGreaterThan(0);
    expect(Math.abs(mark.boundingBox?.max.y ?? 1)).toBeLessThan(0.05);
    const ped = pedestalGeometry(24);
    ped.computeBoundingBox();
    expect(ped.boundingBox?.max.y ?? 0).toBeCloseTo(LAYOUT.pedestalH, 6);
    for (const g of [glass, mark, ped]) g.dispose();
  });

  it('a parent stands on its pedestal, clear of the tray', () => {
    const c: Vec3 = [0, 0, 0];
    const e = trayEdges(D);
    parentCenter(D, 0, c);
    expect(c[1] - LAYOUT.parentR).toBeCloseTo(LAYOUT.pedestalH, 6);
    expect(c[0] + LAYOUT.parentR).toBeLessThan(e.x0);
    parentCenter(D, 1, c);
    expect(c[2] + LAYOUT.parentR).toBeLessThan(e.z0);
  });

  it('a step jump frames the parents and tray (meiosis, gametes), the board, or everything', () => {
    const xs = (k: number) => {
      const f = stepFrame(k, D);
      return f ? f.points.map((p) => p[0] + f.center[0]) : null;
    };
    for (const k of [0, 1]) {
      const x = xs(k) ?? [];
      // Both parents in, the cylinders out (they come at the last step).
      expect(Math.min(...x)).toBeLessThanOrEqual(parentCenter(D, 0, [0, 0, 0])[0] - LAYOUT.parentR);
      expect(Math.max(...x)).toBeLessThan(pedestalX(D, 0) - LAYOUT.tubeOut);
    }
    expect(xs(2)).not.toBeNull();
    expect(stepFrame(3, D)).toBeNull();
  });
});
