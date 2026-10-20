import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CONSTRICTION,
  ChromosomeTube,
  TUBE_SHADE_ATTRIBUTE,
  TUBE_SURFACE_ATTRIBUTE,
  ringStations,
  rodRadius,
} from './chromosomeTube';

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

  it('each vertex keeps a fixed place on the surface (relief stays on it as the tube moves)', () => {
    const tube = new ChromosomeTube(SHAPE);
    const surf = tube.geometry.getAttribute(TUBE_SURFACE_ATTRIBUTE);
    const before = Array.from(surf.array);
    const n = tube.rings;
    const centre = new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 2 : i * 0.01));
    tube.write(centre, new Float32Array(n).fill(0.05));
    expect(Array.from(surf.array)).toEqual(before);
    for (let r = 0; r < n; r++) {
      for (let a = 0; a < tube.sides; a++) {
        const k = r * tube.sides + a;
        // Distance along the chromatid, then around it at the condensed radius (no seam).
        expect(surf.getX(k)).toBeCloseTo(tube.stations[r]!, 6);
        expect(Math.hypot(surf.getY(k), surf.getZ(k))).toBeCloseTo(SHAPE.radius, 6);
      }
    }
    tube.dispose();
  });
  it('a seam makes the colour change sharp: two rings 8 thousandths apart around it', () => {
    const plain = new ChromosomeTube(SHAPE);
    const tube = new ChromosomeTube({ ...SHAPE, seams: [0.3] });
    expect(tube.rings).toBe(plain.rings + 2);
    const at = 0.3 * (SHAPE.armA + SHAPE.armB) - SHAPE.armA;
    const s = Array.from(tube.stations);
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThan(s[i - 1]!);
    const before = s.filter((x) => x < at).pop()!;
    const after = s.find((x) => x > at)!;
    expect(after - before).toBeLessThan(0.01);
    // The centromere ring is still the waist (s = 0).
    expect(tube.stations[tube.centromereRing]).toBeCloseTo(0, 9);
    const a = new THREE.Color('#d55e00');
    const b = new THREE.Color('#0072b2');
    tube.setColours([
      { from: 0, to: 0.3, color: a },
      { from: 0.3, to: 1, color: b },
    ]);
    const i = s.indexOf(before);
    expect(tube.colourAt(i)[0]).toBeCloseTo(a.r, 6);
    expect(tube.colourAt(i + 1)[2]).toBeCloseTo(b.b, 6);
    plain.dispose();
    tube.dispose();
  });

  it('contact shade: darker towards the sister near the centromere, colours exact, cleared after', () => {
    const tube = new ChromosomeTube(SHAPE);
    const n = tube.rings;
    const centre = new Float32Array(n * 3);
    const radii = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      centre[3 * i] = tube.stations[i]!;
      radii[i] = rodRadius(tube.stations[i]!, SHAPE.armA, SHAPE.armB, SHAPE.radius);
    }
    const c = new THREE.Color('#0072b2');
    tube.setColours([{ from: 0, to: 1, color: c }]);
    tube.write(centre, radii, { towards: [0, 1, 0], strength: 0.2, reach: 0.5 });
    const pos = tube.geometry.getAttribute('position');
    const col = tube.geometry.getAttribute(TUBE_SHADE_ATTRIBUTE);
    const w = tube.centromereRing;
    let towards = 1;
    let away = 0;
    for (let k = 0; k < tube.sides; k++) {
      const v = w * tube.sides + k;
      const y = pos.getY(v);
      const shade = col.getX(v);
      expect(shade).toBeGreaterThanOrEqual(0.8 - 1e-6);
      expect(shade).toBeLessThanOrEqual(1 + 1e-6);
      if (y > 0) towards = Math.min(towards, shade);
      else away = Math.max(away, shade);
    }
    expect(towards).toBeLessThan(0.85);
    expect(away).toBeCloseTo(1, 6);
    // Far along the arm the sisters have diverged: barely shaded.
    for (let k = 0; k < tube.sides; k++) expect(col.getX(k)).toBeGreaterThan(0.95);
    // The painted colours stay exact on every vertex; a write without contact clears the shade.
    const colour = tube.geometry.getAttribute('color');
    for (let v = 0; v < colour.count; v++) expect(colour.getZ(v)).toBeCloseTo(c.b, 6);
    tube.write(centre, radii);
    for (let k = 0; k < tube.sides; k++) expect(col.getX(w * tube.sides + k)).toBe(1);
    tube.dispose();
  });
});
