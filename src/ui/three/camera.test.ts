import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  KEY_ORBIT_STEP,
  easeInOut,
  easeInOutCubic,
  fitDistance,
  orbitForKey,
  placeCamera,
  tweenCamera,
  viewBasis,
  zoomLimits,
  type CameraPose,
  type Vec3,
} from './camera';

const len = (v: Vec3) => Math.hypot(...v);
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe('camera maths', () => {
  it('viewBasis matches Object3D.lookAt', () => {
    const dir: Vec3 = [0.4, 0.5, 1];
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(...dir);
    cam.lookAt(0, 0, 0);
    const { right, up } = viewBasis(dir);
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    expect(r.x).toBeCloseTo(right[0], 9);
    expect(r.z).toBeCloseTo(right[2], 9);
    expect(u.y).toBeCloseTo(up[1], 9);
  });

  it('fitDistance puts every point inside the view', () => {
    const tan = { h: 0.5, up: 0.3, down: 0.3 };
    const dir: Vec3 = [0, 0, 1];
    const pts: Vec3[] = [
      [2, 0, 0],
      [0, 1, 0],
      [0, -1, 0.5],
    ];
    const d = fitDistance(pts, tan, dir, 1);
    for (const p of pts) {
      const depth = d - p[2];
      expect(Math.abs(p[0]) / depth).toBeLessThanOrEqual(tan.h + 1e-12);
      expect(Math.abs(p[1]) / depth).toBeLessThanOrEqual(tan.up + 1e-12);
    }
  });

  it('zoom limits keep the camera outside the bound; placement stays within them', () => {
    const lim = zoomLimits(5, [1, 0, 0], 30, { gap: 0.5, maxDistance: 80 });
    expect(lim.min).toBeCloseTo(6.5, 12);
    expect(lim.max).toBe(80);
    const p = placeCamera([1, 0, 0], [[0.1, 0, 0]], { h: 1, up: 1, down: 1 }, [0, 0, 1], lim);
    expect(p.distance).toBe(lim.min);
    expect(len(sub(p.position, p.target))).toBeCloseTo(lim.min, 12);
  });

  it('a tween starts and ends exactly at its poses and turns along the shorter arc', () => {
    const from: CameraPose = { target: [0, 0, 0], position: [0, 0, 10] };
    const to: CameraPose = { target: [1, 0, 0], position: [1 + 20, 0, 0] };
    expect(tweenCamera(from, to, 0)).toEqual(from);
    expect(tweenCamera(from, to, 1)).toEqual(to);
    expect(tweenCamera(from, to, 1.5)).toEqual(to);
    const mid = tweenCamera(from, to, 0.5);
    // Halfway (eased 0.5): the direction is halfway round (45°), the distance geometric (√200).
    const d = sub(mid.position, mid.target);
    expect(len(d)).toBeCloseTo(Math.sqrt(200), 9);
    expect(Math.atan2(d[0], d[2])).toBeCloseTo(Math.PI / 4, 9);
    expect(mid.target[0]).toBeCloseTo(0.5, 12);
    // Never through the subject: every step keeps the camera at least the nearer distance away.
    for (let u = 0; u <= 1; u += 0.05) {
      const p = tweenCamera(from, to, u);
      expect(len(sub(p.position, p.target))).toBeGreaterThanOrEqual(10 - 1e-9);
    }
  });

  it('easing is smooth at both ends', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    // Slower start than the smoothstep, symmetric.
    expect(easeInOutCubic(0.2)).toBeLessThan(easeInOut(0.2));
    expect(easeInOutCubic(0.8)).toBeCloseTo(1 - easeInOutCubic(0.2), 12);
    expect(easeInOut(-1)).toBe(0);
  });

  it('arrow keys orbit; other keys do nothing', () => {
    expect(orbitForKey('ArrowLeft')).toEqual({ left: KEY_ORBIT_STEP, up: 0 });
    expect(orbitForKey('ArrowRight')).toEqual({ left: -KEY_ORBIT_STEP, up: 0 });
    expect(orbitForKey('ArrowUp')).toEqual({ left: 0, up: KEY_ORBIT_STEP });
    expect(orbitForKey('ArrowDown')).toEqual({ left: 0, up: -KEY_ORBIT_STEP });
    expect(orbitForKey('Enter')).toBeNull();
  });
});
