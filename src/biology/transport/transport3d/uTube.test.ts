import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUBE } from './osmosis';
import { ARM_START, GLASS_INNER, LIQUID_SHARE, U_BEND, halfAxis, sweepTube, uAxis } from './uTube';

const TOP = 9.4;

describe('U-tube axis', () => {
  it('each half runs from the membrane (x = 0, channel axis) to the top of its arm', () => {
    for (const s of [-1, 1] as const) {
      const axis = halfAxis(s, TOP, 8);
      expect(axis[0]).toMatchObject({ x: 0, y: -TUBE.r });
      expect(axis.at(-1)).toMatchObject({ x: s * TUBE.a, y: TOP });
      // Above ARM_START the arm is straight (x = ±a), so a surface there is a flat circle.
      for (const p of axis) if (p.y >= ARM_START - 1e-9) expect(p.x).toBeCloseTo(s * TUBE.a, 9);
      // Tangents are unit and turn smoothly (at most one bend step at a time).
      for (let i = 1; i < axis.length; i++) {
        const a = axis[i - 1]!;
        const b = axis[i]!;
        expect(Math.hypot(b.tx, b.ty)).toBeCloseTo(1, 9);
        const turn = Math.acos(Math.min(1, a.tx * b.tx + a.ty * b.ty));
        expect(turn).toBeLessThanOrEqual(Math.PI / 2 / 8 + 1e-9);
      }
    }
  });

  it('the whole U is one continuous path through the membrane, glass that never folds', () => {
    const axis = uAxis(TOP, 8);
    expect(axis[0]).toMatchObject({ x: -TUBE.a, y: TOP });
    expect(axis.at(-1)).toMatchObject({ x: TUBE.a, y: TOP });
    expect(axis.filter((p) => p.x === 0 && p.y === -TUBE.r)).toHaveLength(1);
    for (let i = 1; i < axis.length; i++) {
      const a = axis[i - 1]!;
      const b = axis[i]!;
      // Each step goes forward along the tangent.
      expect((b.x - a.x) * a.tx + (b.y - a.y) * a.ty).toBeGreaterThan(0);
    }
    // The bend's inner side stays open: the outer glass radius is below the bend radius.
    expect(TUBE.r).toBeLessThan(U_BEND);
    expect(LIQUID_SHARE).toBeLessThan(GLASS_INNER);
  });
});

describe('swept tube', () => {
  const faceCheck = (g: THREE.BufferGeometry) => {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const index = g.getIndex();
    if (!index) throw new Error('indexed');
    const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);
    let agree = 0;
    for (let k = 0; k < index.count; k += 3) {
      const [a, b, c] = [index.getX(k), index.getX(k + 1), index.getX(k + 2)];
      const n = new THREE.Vector3()
        .subVectors(v(b), v(a))
        .cross(new THREE.Vector3().subVectors(v(c), v(a)));
      if (n.lengthSq() < 1e-12) continue;
      const vn = new THREE.Vector3().fromBufferAttribute(nor, a);
      agree += Math.sign(n.dot(vn));
    }
    return agree;
  };

  it('every vertex lies at the radius around its ring’s axis point; faces match the normals', () => {
    const axis = halfAxis(1, TOP, 6);
    const sides = 12;
    const g = sweepTube(axis, 0.5, sides);
    const pos = g.getAttribute('position');
    expect(pos.count).toBe(axis.length * (sides + 1));
    axis.forEach((p, i) => {
      for (let j = 0; j <= sides; j++) {
        const k = i * (sides + 1) + j;
        const d = Math.hypot(pos.getX(k) - p.x, pos.getY(k) - p.y, pos.getZ(k));
        expect(d).toBeCloseTo(0.5, 6);
        // In the plane normal to the tangent (float32 positions).
        expect((pos.getX(k) - p.x) * p.tx + (pos.getY(k) - p.y) * p.ty).toBeCloseTo(0, 6);
      }
    });
    const faces = (g.getIndex()?.count ?? 0) / 3;
    expect(faceCheck(g)).toBe(faces);
    // Inside out: the faces turn towards the axis with the normals.
    const inner = sweepTube(axis, 0.5, sides, true);
    expect(faceCheck(inner)).toBe(faces);
    const n0 = new THREE.Vector3().fromBufferAttribute(inner.getAttribute('normal'), 0);
    const p0 = new THREE.Vector3().fromBufferAttribute(inner.getAttribute('position'), 0);
    expect(n0.dot(p0.sub(new THREE.Vector3(axis[0]!.x, axis[0]!.y, 0)))).toBeLessThan(0);
    g.dispose();
    inner.dispose();
  });
});
