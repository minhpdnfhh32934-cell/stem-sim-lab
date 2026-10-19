import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONSTRICTION, ChromosomeTube, ringStations, rodRadius } from './chromosomeTube';

const SHAPE = { armA: 1.2, armB: 0.8, radius: 0.15, sides: 8 };

describe('chromosome tube', () => {
  it('rings run from tip A to tip B, closer together at the tips and the waist', () => {
    const s = ringStations(SHAPE.armA, SHAPE.armB, SHAPE.radius);
    expect(s[0]).toBeCloseTo(-SHAPE.armA, 6);
    expect(s[s.length - 1]).toBeCloseTo(SHAPE.armB, 6);
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThan(s[i - 1]!);
    expect(s.some((x) => Math.abs(x) < 1e-9)).toBe(true);
  });

  it('round tips, full arms and a waist at the centromere', () => {
    const r = (x: number, waist = 1) => rodRadius(x, SHAPE.armA, SHAPE.armB, SHAPE.radius, waist);
    expect(r(-SHAPE.armA)).toBe(0);
    expect(r(SHAPE.armB)).toBe(0);
    expect(r(-0.6)).toBeCloseTo(SHAPE.radius, 9);
    expect(r(0)).toBeCloseTo(SHAPE.radius * (1 - CONSTRICTION.depth), 9);
    // No waist on a decondensed thread.
    expect(r(0, 0)).toBeCloseTo(SHAPE.radius, 9);
  });

  it('colours piece by piece: each ring takes the colour of its segment', () => {
    const tube = new ChromosomeTube(SHAPE);
    const a = new THREE.Color('#d55e00');
    const b = new THREE.Color('#0072b2');
    // A crossover: the first 40 % of the chromatid from one parent, the rest from the other.
    tube.setColours([
      { from: 0, to: 0.4, color: a },
      { from: 0.4, to: 1, color: b },
    ]);
    for (let i = 0; i < tube.rings; i++) {
      const want = tube.shareAt(i) <= 0.4 ? a : b;
      const [r, g, bl] = tube.colourAt(i);
      expect([r, g, bl]).toEqual([Math.fround(want.r), Math.fround(want.g), Math.fround(want.b)]);
    }
    tube.dispose();
  });

  it('writes a closed tube around its line with outward normals', () => {
    const tube = new ChromosomeTube(SHAPE);
    const n = tube.rings;
    const centre = new Float32Array(n * 3);
    const radii = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = tube.stations[i]!;
      centre[3 * i] = s;
      radii[i] = rodRadius(s, SHAPE.armA, SHAPE.armB, SHAPE.radius);
    }
    tube.write(centre, radii);
    const pos = tube.geometry.getAttribute('position');
    const nor = tube.geometry.getAttribute('normal');
    const sides = tube.sides;
    for (let i = 1; i < n - 1; i++) {
      for (let a = 0; a < sides; a++) {
        const k = i * sides + a;
        const out = new THREE.Vector3(pos.getX(k) - centre[3 * i]!, pos.getY(k), pos.getZ(k));
        expect(out.length()).toBeCloseTo(radii[i]!, 5);
        const normal = new THREE.Vector3(nor.getX(k), nor.getY(k), nor.getZ(k));
        if (radii[i]! > 1e-6) expect(normal.dot(out)).toBeGreaterThan(0);
      }
    }
    // Front faces point outwards: a ray from outside hits the tube at its near side.
    const mesh = new THREE.Mesh(tube.geometry, new THREE.MeshBasicMaterial());
    const hit = new THREE.Raycaster(new THREE.Vector3(0.5, 0, 5), new THREE.Vector3(0, 0, -1))
      .intersectObject(mesh)
      .at(0);
    expect(hit?.point.z).toBeCloseTo(SHAPE.radius, 2);
    expect(hit?.face?.normal.z).toBeGreaterThan(0);
    expect(tube.ringOfFace(hit?.faceIndex ?? -1)).toBeGreaterThan(0);
    tube.dispose();
  });
});
