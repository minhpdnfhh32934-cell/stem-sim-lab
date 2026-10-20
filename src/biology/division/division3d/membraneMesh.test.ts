import { describe, expect, it } from 'vitest';
import { TwoSphereProfile } from './membraneMesh';

/** Distance of each vertex from the nearer of the two circle centres (±offset on x). */
function radii(p: TwoSphereProfile, offset: number): number[] {
  const pos = p.geometry.attributes.position!.array as Float32Array;
  const out: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]!;
    const y = pos[i + 1]!;
    const z = pos[i + 2]!;
    out.push(Math.min(Math.hypot(x + offset, y, z), Math.hypot(x - offset, y, z)));
  }
  return out;
}

describe('TwoSphereProfile (dividing animal membrane)', () => {
  it('smooth by default: every vertex on the circles', () => {
    const p = new TwoSphereProfile(16);
    p.write(1.5, 5);
    for (const r of radii(p, 1.5)) expect(r).toBeCloseTo(5, 4);
    p.dispose();
  });

  it('the undulation only goes inwards, by at most its amplitude, and really undulates', () => {
    for (const offset of [0, 2, 5.5]) {
      const p = new TwoSphereProfile(24, { amplitude: 0.015, seed: 3 });
      p.write(offset, 5);
      const r = radii(p, offset);
      expect(Math.max(...r)).toBeLessThanOrEqual(5 + 1e-4);
      expect(Math.min(...r)).toBeGreaterThanOrEqual(5 * (1 - 0.015) - 1e-4);
      // Not a uniformly smaller sphere: the radius varies over the surface.
      expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(0.2 * 0.015 * 5);
      // The bounding sphere still holds the whole membrane.
      expect(p.geometry.boundingSphere!.radius).toBeCloseTo(offset + 5, 6);
      p.dispose();
    }
  });

  it('seeded: the same seed gives the same surface, another seed another one', () => {
    const a = new TwoSphereProfile(12, { amplitude: 0.02, seed: 5 });
    const b = new TwoSphereProfile(12, { amplitude: 0.02, seed: 5 });
    const c = new TwoSphereProfile(12, { amplitude: 0.02, seed: 6 });
    for (const p of [a, b, c]) p.write(1, 5);
    const pa = Array.from(a.geometry.attributes.position!.array);
    expect(Array.from(b.geometry.attributes.position!.array)).toEqual(pa);
    expect(Array.from(c.geometry.attributes.position!.array)).not.toEqual(pa);
    for (const p of [a, b, c]) p.dispose();
  });

  it('normals stay unit-length and outward (close to the smooth sphere’s)', () => {
    const p = new TwoSphereProfile(20, { amplitude: 0.02, seed: 9 });
    p.write(0, 5);
    const pos = p.geometry.attributes.position!.array as Float32Array;
    const nor = p.geometry.attributes.normal!.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const l = Math.hypot(nor[i]!, nor[i + 1]!, nor[i + 2]!);
      expect(l).toBeGreaterThan(0.98);
      expect(l).toBeLessThan(1.02);
      const r = Math.hypot(pos[i]!, pos[i + 1]!, pos[i + 2]!);
      const cos = (nor[i]! * pos[i]! + nor[i + 1]! * pos[i + 1]! + nor[i + 2]! * pos[i + 2]!) / r;
      expect(cos).toBeGreaterThan(0.99);
    }
    p.dispose();
  });
});
