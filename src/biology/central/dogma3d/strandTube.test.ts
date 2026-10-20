import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RADIUS, TWIST } from './bdna';
import { strandPose, type Vec3 } from './layout';
import { StrandTube } from './strandTube';

const SUB = 4;
const RADIAL = 8;
const R = 0.12;

/** A tube through the resting coding strand of base pairs [from, from + n). */
function helixTube(from: number, n: number, capacity = n): StrandTube {
  const t = new StrandTube({ capacity, radius: R, sub: SUB, radial: RADIAL, axis: { y: 0, z: 0 } });
  t.count = n;
  const back: Vec3 = [0, 0, 0];
  const tip: Vec3 = [0, 0, 0];
  for (let i = from - 1; i <= from + n; i++) {
    strandPose(i, 'coding', 0, TWIST * i, back, tip);
    t.set(i - from, back);
  }
  return t;
}

/** Centre and radius of ring r (mean of its vertices, their mean distance from it). */
function ring(t: StrandTube, r: number): { c: THREE.Vector3; radius: number } {
  const pos = t.geometry.getAttribute('position') as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let j = 0; j < RADIAL; j++) c.add(v.fromBufferAttribute(pos, r * (RADIAL + 1) + j));
  c.divideScalar(RADIAL);
  let radius = 0;
  for (let j = 0; j < RADIAL; j++)
    radius += v.fromBufferAttribute(pos, r * (RADIAL + 1) + j).distanceTo(c) / RADIAL;
  return { c, radius };
}

describe('backbone tube (Catmull–Rom through the nucleotides)', () => {
  it('passes through every point with the tube radius; the ends are rounded tips', () => {
    const t = helixTube(0, 12);
    t.build();
    const back: Vec3 = [0, 0, 0];
    const tip: Vec3 = [0, 0, 0];
    for (let k = 1; k < 11; k++) {
      strandPose(k, 'coding', 0, TWIST * k, back, tip);
      const { c, radius } = ring(t, k * SUB);
      expect(c.distanceTo(new THREE.Vector3(...back))).toBeLessThan(1e-5);
      expect(radius).toBeCloseTo(R, 5);
      // On the helix: the ring centre is RADIUS from the axis.
      expect(Math.hypot(c.y, c.z)).toBeCloseTo(RADIUS, 4);
    }
    // Closed tips at both ends.
    expect(ring(t, 0).radius).toBeLessThan(1e-6);
    expect(ring(t, 11 * SUB).radius).toBeLessThan(1e-6);
  });

  it('draws whole segments; a twin draws its own range of the same buffers', () => {
    const t = helixTube(0, 12);
    t.build();
    const per = SUB * RADIAL * 6;
    t.show(2, 7);
    expect(t.geometry.drawRange).toEqual({ start: 2 * per, count: 5 * per });
    const twin = t.twin();
    t.show(7, 11, twin);
    expect(twin.drawRange).toEqual({ start: 7 * per, count: 4 * per });
    expect(twin.getAttribute('position')).toBe(t.geometry.getAttribute('position'));
    expect(t.geometry.drawRange.start).toBe(2 * per);
    // Out of range: clamped to the points in use.
    t.show(-3, 99);
    expect(t.geometry.drawRange).toEqual({ start: 0, count: 11 * per });
    twin.dispose();
    t.geometry.dispose();
  });

  it('two tubes sharing a point and its neighbours meet without a seam', () => {
    // One tube over pairs 0 … 11, another over pairs 6 … 11 (without a tip at its start).
    const whole = helixTube(0, 12);
    whole.build();
    const part = helixTube(6, 6);
    part.caps.start = false;
    part.build();
    const a = whole.geometry.getAttribute('position') as THREE.BufferAttribute;
    const b = part.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let j = 0; j <= RADIAL; j++) {
      const i = 6 * SUB * (RADIAL + 1) + j;
      expect(b.getX(j)).toBeCloseTo(a.getX(i), 5);
      expect(b.getY(j)).toBeCloseTo(a.getY(i), 5);
      expect(b.getZ(j)).toBeCloseTo(a.getZ(i), 5);
    }
  });

  it('a partial rebuild uploads only the rings of those segments', () => {
    const t = helixTube(0, 20, 30);
    t.build();
    const pos = t.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.clearUpdateRanges();
    t.build(5, 8);
    const ring3 = (RADIAL + 1) * 3;
    expect(pos.updateRanges).toEqual([{ start: 5 * SUB * ring3, count: 3 * SUB * ring3 }]);
    t.geometry.dispose();
  });
});
