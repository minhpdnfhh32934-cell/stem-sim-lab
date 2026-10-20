import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NO_INSETS, clampInsets, fitSphereDistance, viewWindow, type Insets } from './frame';

const FOV = 38;

/** A camera looking at the origin from `dir`, with the view window of the safe area. */
function camera(w: number, h: number, insets: Insets, distance: number, dir: THREE.Vector3) {
  const win = viewWindow(w, h, insets);
  const cam = new THREE.PerspectiveCamera(FOV, win.fullWidth / win.fullHeight, 0.1, 500);
  cam.setViewOffset(win.fullWidth, win.fullHeight, win.x, win.y, win.width, win.height);
  cam.position.copy(dir.clone().normalize().multiplyScalar(distance));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

/** Canvas pixel of a world point. */
function pixel(cam: THREE.PerspectiveCamera, p: THREE.Vector3, w: number, h: number) {
  const v = p.clone().project(cam);
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
}

describe('3D framing in the safe area', () => {
  it('the orbit target is drawn at the centre of the safe area', () => {
    for (const insets of [
      NO_INSETS,
      { top: 80, right: 0, bottom: 120, left: 0 },
      { top: 60, right: 300, bottom: 100, left: 20 },
    ]) {
      const cam = camera(800, 450, insets, 20, new THREE.Vector3(0.5, 0.4, 1));
      const c = pixel(cam, new THREE.Vector3(), 800, 450);
      expect(c.x).toBeCloseTo((insets.left + 800 - insets.right) / 2, 5);
      expect(c.y).toBeCloseTo((insets.top + 450 - insets.bottom) / 2, 5);
    }
  });

  it('a sphere at the fitted distance lies in the safe area from any direction', () => {
    const r = 5;
    for (const [w, h] of [
      [800, 450],
      [380, 600],
      [1200, 500],
    ] as [number, number][]) {
      for (const insets of [NO_INSETS, { top: 90, right: 260, bottom: 110, left: 0 }]) {
        const d = fitSphereDistance(r, FOV, w, h, insets);
        const i = clampInsets(w, h, insets);
        for (const dir of [
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(1, 1, 1),
          new THREE.Vector3(-0.3, -0.8, 0.5),
        ]) {
          const cam = camera(w, h, insets, d, dir);
          for (let k = 0; k < 200; k++) {
            // Points on the sphere (Fibonacci spiral).
            const y = 1 - (2 * (k + 0.5)) / 200;
            const rr = Math.sqrt(1 - y * y);
            const a = k * 2.39996;
            const p = pixel(
              cam,
              new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a)).multiplyScalar(r),
              w,
              h,
            );
            expect(p.x).toBeGreaterThanOrEqual(i.left - 1e-6);
            expect(p.x).toBeLessThanOrEqual(w - i.right + 1e-6);
            expect(p.y).toBeGreaterThanOrEqual(i.top - 1e-6);
            expect(p.y).toBeLessThanOrEqual(h - i.bottom + 1e-6);
          }
        }
      }
    }
  });

  it('huge controls on a tiny canvas still leave a safe area', () => {
    const i = clampInsets(300, 200, { top: 150, right: 250, bottom: 150, left: 100 });
    expect(300 - i.left - i.right).toBeGreaterThanOrEqual(0.4 * 300 - 1e-9);
    expect(200 - i.top - i.bottom).toBeGreaterThanOrEqual(0.35 * 200 - 1e-9);
    expect(clampInsets(300, 200, { top: -5, right: Number.NaN, bottom: 0, left: 0 })).toEqual(
      NO_INSETS,
    );
  });
});
