import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HungFall } from './fall';

describe('HungFall', () => {
  /** A ring and a ball in the x–y plane round (2, 3.4, -3), as the hall's emblem has. */
  const hungAt = (y: number) => {
    const object = new THREE.Group();
    object.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.06, 8, 72),
        new THREE.MeshStandardMaterial({ color: '#4fb3d9' }),
      ),
      new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 8).translate(0, 0.5, 0),
        new THREE.MeshStandardMaterial({ color: '#ffb454' }),
      ),
    );
    object.position.set(2, y, -3);
    return object;
  };

  it('falls when the cables give way, breaks into pieces of itself, and they come to lie on the floor', () => {
    const object = hungAt(3.4);
    const fall = new HungFall();
    fall.start([{ object, bottom: 2.6, size: 5.2 }], 0, false);
    fall.update(0.1, 1); // the cables still holding
    expect(object.position.y).toBe(3.4);
    for (let i = 0; i < 60; i++) fall.update(1 / 60, 1);
    expect(object.visible).toBe(false); // broken on the floor: its pieces drawn instead
    // the ring in arcs, the ball whole: more than a few pieces, fewer than its triangles
    expect(fall.pieceCount).toBeGreaterThan(8);
    expect(fall.pieceCount).toBeLessThan(40);
    expect(fall.heights().length).toBeGreaterThan(80); // and the glass
    for (let i = 0; i < 900; i++) fall.update(1 / 60, 1);
    // lying: nothing under the floor, nothing left in the air
    for (const h of fall.heights()) {
      expect(h).toBeGreaterThanOrEqual(-1e-3);
      expect(h).toBeLessThan(0.01);
    }
  });

  it('walked in long after: lying broken already; mended: whole again where it hung', () => {
    const object = hungAt(3.4);
    const fall = new HungFall();
    fall.start([{ object, bottom: 2.6, size: 5.2 }], 0, true);
    expect(object.visible).toBe(false);
    expect(fall.down).toBe(true);
    for (const h of fall.heights()) expect(h).toBeLessThan(0.01);
    fall.restore();
    expect(object.visible).toBe(true);
    expect(object.position.toArray()).toEqual([2, 3.4, -3]);
    expect(fall.heights()).toEqual([]);
    expect(fall.group.children.length).toBe(0);
    expect(fall.down).toBe(false);
  });
});
