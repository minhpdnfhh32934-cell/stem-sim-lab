import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyViewport } from '../mitosis3d/camera';
import {
  CHROMOSOME_FOCUS,
  FOCUS_MARGIN,
  MEIOSIS2_DIR,
  VIEW_DIR,
  chromosomeFocusFrame,
  defaultInsets,
  overviewFrame,
  placeMeiosisCamera,
  type CameraFrame,
} from './camera';
import { meiosisTimelineFor } from './store';
import { DAUGHTER1_X, DAUGHTER2_Y, MEIOSIS, type Vec3 } from './timeline';

/** A camera placed for `frame` on a w × h canvas (as the view does). */
function cameraFor(frame: CameraFrame, w: number, h: number, dir: Vec3) {
  const placed = placeMeiosisCamera(frame, w, h, dir);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  applyViewport(cam, w, h);
  cam.position.set(...placed.position);
  cam.lookAt(...placed.target);
  cam.updateMatrixWorld(true);
  return cam;
}

/** Page pixels of a world point. */
function pixel(cam: THREE.PerspectiveCamera, p: Vec3, w: number, h: number): [number, number] {
  const v = new THREE.Vector3(...p).project(cam);
  return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
}

describe('meiosis 3D camera', () => {
  it('Basic chromosome focus: every chromosome of prophase I and metaphase I is inside, tighter than the cell', () => {
    for (const pairs of [1, 2, 3, 4]) {
      const tl = meiosisTimelineFor(pairs, true, 1);
      for (const w of tl.stages.filter((s) => CHROMOSOME_FOCUS.has(s.id))) {
        const f = chromosomeFocusFrame(tl, w.id);
        expect(chromosomeFocusFrame(tl, w.id)).toBe(f);
        const radius = Math.hypot(...f.points[0]!);
        // Closer than the germ cell's overview (the cell is about 1.6 × wider than this frame).
        expect(radius).toBeLessThan(0.75 * MEIOSIS.radius);
        for (let k = 0; k <= 10; k++) {
          const st = tl.stateAt(w.start + ((w.end - w.start) * k) / 10 - (k === 10 ? 1e-6 : 0));
          if (st.condensation < 0.5) continue;
          st.chromatids.forEach((c, i) => {
            if (!c.present) return;
            const info = tl.chromatids[i]!;
            for (const [d, l] of [
              [c.dirA, info.armA],
              [c.dirB, info.armB],
            ] as const) {
              const tip: Vec3 = [
                c.centromere[0] + d[0] * l,
                c.centromere[1] + d[1] * l,
                c.centromere[2] + d[2] * l,
              ];
              const r = Math.hypot(
                tip[0] - f.center[0],
                tip[1] - f.center[1],
                tip[2] - f.center[2],
              );
              // Inside, with the margin left around the outermost tip.
              expect(r * FOCUS_MARGIN).toBeLessThanOrEqual(radius + 1e-6);
            }
          });
        }
      }
    }
  });

  it('the chromosomes span at least 35 % of the free height at 1366 × 768 (metaphase I)', () => {
    const [w, h] = [800, 470];
    const free = h - defaultInsets(h).bottom;
    for (const pairs of [1, 2, 3, 4]) {
      const tl = meiosisTimelineFor(pairs, true, 1);
      const cam = cameraFor(chromosomeFocusFrame(tl, 'metaphase1'), w, h, VIEW_DIR);
      const st = tl.stateAt(tl.keyTime('metaphase1'));
      let top = Infinity;
      let bottom = -Infinity;
      let left = Infinity;
      let right = -Infinity;
      st.chromatids.forEach((c, i) => {
        if (!c.present) return;
        const info = tl.chromatids[i]!;
        for (const [d, l] of [
          [c.dirA, info.armA],
          [c.dirB, info.armB],
        ] as const) {
          const [x, y] = pixel(
            cam,
            [c.centromere[0] + d[0] * l, c.centromere[1] + d[1] * l, c.centromere[2] + d[2] * l],
            w,
            h,
          );
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      });
      // The set's size on screen (its larger extent: one bivalent may lie across the picture).
      const size = Math.max(bottom - top, right - left);
      expect(size / free, `2n = ${String(2 * pairs)}`).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('meiosis II is seen nearly from the front: none of the four final cells hides another', () => {
    const [w, h] = [800, 470];
    const cam = cameraFor(overviewFrame(2), w, h, MEIOSIS2_DIR);
    const cells: Vec3[] = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) => [sx * DAUGHTER1_X, sy * DAUGHTER2_Y, 0] as Vec3),
    );
    const disc = cells.map((c) => {
      const [x, y] = pixel(cam, c, w, h);
      const [ex] = pixel(cam, [c[0] + MEIOSIS.radius2, c[1], c[2]], w, h);
      return { x, y, r: Math.abs(ex - x) };
    });
    for (let i = 0; i < disc.length; i++)
      for (let j = i + 1; j < disc.length; j++) {
        const a = disc[i]!;
        const b = disc[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
      }
    // Mostly frontal and a little from above.
    expect(MEIOSIS2_DIR[2]).toBeGreaterThan(0.9);
    expect(MEIOSIS2_DIR[1]).toBeGreaterThan(0.2);
  });
});
