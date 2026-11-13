import { describe, expect, it } from 'vitest';
import { type ScreenPoint, projectToScreen } from './anchor';

const out = (): ScreenPoint => ({ x: 0, y: 0, visible: false });
const project = (point: [number, number, number], yaw = 0, pitch = 0) =>
  projectToScreen([0, 1.6, 0], yaw, pitch, 70, 1280, 720, point, out());

describe('projectToScreen', () => {
  it('puts a point straight ahead at the centre of the screen', () => {
    const p = project([0, 1.6, -3]); // yaw 0 looks along −z
    expect(p.visible).toBe(true);
    expect(p.x).toBeCloseTo(640, 6);
    expect(p.y).toBeCloseTo(360, 6);
  });

  it('puts what is to the right on the right, and what is above above', () => {
    expect(project([1, 1.6, -3]).x).toBeGreaterThan(640);
    expect(project([-1, 1.6, -3]).x).toBeLessThan(640);
    expect(project([0, 2.6, -3]).y).toBeLessThan(360);
  });

  it('follows the camera: turning by the yaw (about y) brings the point back to the centre', () => {
    // yaw π/2 looks along −x.
    const p = project([-3, 1.6, 0], Math.PI / 2);
    expect(p.x).toBeCloseTo(640, 6);
    expect(p.y).toBeCloseTo(360, 6);
  });

  it('follows the pitch: looking up by the angle to a point that is above', () => {
    const pitch = Math.atan2(1, 3);
    const p = project([0, 2.6, -3], 0, pitch);
    expect(p.x).toBeCloseTo(640, 6);
    expect(p.y).toBeCloseTo(360, 6);
  });

  it('uses the vertical field of view: the top edge of the view is half of it above the axis', () => {
    const half = (70 / 2) * (Math.PI / 180);
    const p = project([0, 1.6 + Math.tan(half) * 3, -3]);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('is not visible behind the eye or off screen, and writes into the object it is given', () => {
    expect(project([0, 1.6, 3]).visible).toBe(false);
    expect(project([50, 1.6, -3]).visible).toBe(false);
    const target = out();
    const result = projectToScreen([0, 1.6, 0], 0, 0, 70, 1280, 720, [0, 1.6, -3], target);
    expect(result).toBe(target);
  });
});
