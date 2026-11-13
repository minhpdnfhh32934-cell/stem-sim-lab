import { describe, expect, it } from 'vitest';
import {
  type Contents,
  containerOf,
  heldBelow,
  levelIn,
  type Profile,
  toUl,
  totalUl,
  transfer,
} from './liquid';

const sumOf = (containers: Contents[], material: string) =>
  containers.reduce((sum, c) => sum + (c[material] ?? 0), 0);

describe('liquid bookkeeping (integer µL)', () => {
  it('moves one material exactly: the source loses what the receiver gains', () => {
    const src: Contents = { water: 500_000 };
    const dst: Contents = { 'stock-20': 5000 };
    const moved = transfer(src, dst, 1234, 50_000);
    expect(moved).toBe(1234);
    expect(src).toEqual({ water: 500_000 - 1234 });
    expect(dst).toEqual({ 'stock-20': 5000, water: 1234 });
    expect(totalUl(src) + totalUl(dst)).toBe(505_000);
  });

  it('stops at the limit, moves nothing from an empty source or into a full receiver', () => {
    const src: Contents = { water: 100_000 };
    const dst: Contents = { water: 49_000 };
    expect(transfer(src, dst, 5000, 50_000)).toBe(1000); // only up to the mark
    expect(totalUl(dst)).toBe(50_000);
    expect(transfer(src, dst, 5000, 50_000)).toBe(0);
    expect(transfer({}, dst, 10, 60_000)).toBe(0);
    const emptied: Contents = { water: 3 };
    expect(transfer(emptied, {}, 10, 100)).toBe(3);
    expect(emptied).toEqual({}); // a material with nothing left is not listed
  });

  it('refuses a volume that is not a whole number of µL ≥ 0', () => {
    for (const bad of [Number.NaN, -1, 0.5, Infinity]) {
      expect(() => transfer({ water: 10 }, {}, bad, 100)).toThrow();
      expect(() => transfer({ water: 10 }, {}, 1, bad)).toThrow();
    }
    expect(() => toUl(0.0005)).toThrow();
    expect(() => toUl(-1)).toThrow();
    expect(toUl(50)).toBe(50_000);
    expect(toUl(0.001)).toBe(1);
  });

  it('splits several materials in proportion, each conserved, the same way every time', () => {
    const make = () => ({ src: { a: 1, b: 1, c: 1 } as Contents, dst: {} as Contents });
    const first = make();
    expect(transfer(first.src, first.dst, 2, 10)).toBe(2);
    // 2/3 each: floors 0, remainders equal: the ties go to the smaller ids.
    expect(first.dst).toEqual({ a: 1, b: 1 });
    const again = make();
    transfer(again.src, again.dst, 2, 10);
    expect(again).toEqual(first);
    const src: Contents = { 'stock-20': 5000, water: 45_000 };
    const dst: Contents = {};
    expect(transfer(src, dst, 3001, 3000)).toBe(3000);
    expect(dst).toEqual({ 'stock-20': 300, water: 2700 });
    expect(src).toEqual({ 'stock-20': 4700, water: 42_300 });
  });

  it('keeps every material and the grand total over a 10,000-transfer random walk', () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const containers: Contents[] = [
      { water: 400_000 },
      { 'stock-20': 125_000 },
      { 'stock-5': 60_000, water: 1 },
      {},
      {},
    ];
    const materials = ['water', 'stock-20', 'stock-5'];
    const before = materials.map((m) => sumOf(containers, m));
    for (let i = 0; i < 10_000; i++) {
      const s = Math.floor(random() * 5);
      const d = (s + 1 + Math.floor(random() * 4)) % 5;
      const src = containers[s] ?? {};
      const dst = containers[d] ?? {};
      const total = totalUl(src);
      const dstBefore = totalUl(dst);
      const moved = transfer(src, dst, Math.floor(random() * 30_000), 300_000);
      expect(totalUl(src)).toBe(total - moved);
      expect(totalUl(dst)).toBe(dstBefore + moved);
    }
    expect(materials.map((m) => sumOf(containers, m))).toEqual(before);
    for (const c of containers)
      for (const v of Object.values(c)) expect(Number.isInteger(v)).toBe(true);
  });

  it('holds no rule: a container’s flags change nothing about a transfer', () => {
    const closed = { ...containerOf('water', 10_000), closed: true, mixed: false };
    expect(transfer(closed.contents, {}, 100, 1000)).toBe(100);
  });

  it('makes a container from its placement: room temperature, open, unmixed, no concentration', () => {
    expect(containerOf('stock-20', 125_000)).toEqual({
      contents: { 'stock-20': 125_000 },
      temperatureC: 20,
      closed: false,
      mixed: false,
    });
    expect(containerOf('water', 0).contents).toEqual({});
    expect(containerOf(null, 0).contents).toEqual({});
  });
});

describe('vessel levels', () => {
  // A cylinder of radius 2 cm, 10 cm tall: 125.66 mL; then a 1 cm neck (a frustum to r = 1 cm).
  const profile: Profile = [
    [0.02, 0],
    [0.02, 0.1],
    [0.01, 0.11],
  ];
  const held = heldBelow(profile);
  const out = { y: 0, r: 0 };

  it('holds the frusta’s volumes below each point', () => {
    const cylinder = Math.PI * 0.02 ** 2 * 0.1 * 1e6;
    expect(held[1]).toBeCloseTo(cylinder, 9);
    const neck = ((Math.PI * 0.01) / 3) * (0.02 ** 2 + 0.02 * 0.01 + 0.01 ** 2) * 1e6;
    expect(held[2]).toBeCloseTo(cylinder + neck, 9);
  });

  it('puts the level where the inside holds the volume, upright, and clamps at the top', () => {
    levelIn(profile, held, 50, out);
    expect(Math.PI * 0.02 ** 2 * out.y * 1e6).toBeCloseTo(50, 9);
    expect(out.r).toBeCloseTo(0.02, 12);
    const inNeck = (held[1] ?? 0) + 2;
    levelIn(profile, held, inNeck, out);
    // The volume of the frustum from 0.1 to out.y with radius narrowing linearly.
    const h = out.y - 0.1;
    const r1 = out.r;
    expect(((Math.PI * h) / 3) * (0.02 ** 2 + 0.02 * r1 + r1 * r1) * 1e6).toBeCloseTo(2, 9);
    levelIn(profile, held, 1e6, out);
    expect(out).toEqual({ y: 0.11, r: 0.01 });
  });
});
