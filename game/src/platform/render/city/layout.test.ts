import { describe, expect, it } from 'vitest';
import { BLOCK, BUILDINGS, cityPlan, lampPlan, lanePlan, PERIOD, STREET } from './layout';

// The city under the hub: the same every time, an intersection under the glass, buildings only on
// blocks (never on a street), four per block, the inner rings in full detail.

describe('the city plan', () => {
  it('is the same every time', () => {
    expect(cityPlan(3, 1)).toEqual(cityPlan(3, 1));
  });

  it('has an intersection straight under the glass, and four buildings a block', () => {
    const plan = cityPlan(2, 1);
    expect(plan).toContainEqual({
      kind: 'Street_4WayIntersection',
      x: 0,
      z: 0,
      turn: 0,
      full: true,
    });
    const buildings = plan.filter((p) => (BUILDINGS as readonly string[]).includes(p.kind));
    expect(buildings).toHaveLength(4 * 4 * 4); // 2 rings: 4 × 4 blocks
    expect(buildings.filter((b) => b.full)).toHaveLength(4 * 4); // ring 0: the 2 × 2 blocks round the origin
    expect(new Set(buildings.map((b) => b.kind)).size).toBe(BUILDINGS.length);
  });

  it('stands every building on a block, its front on the sidewalk line', () => {
    for (const b of cityPlan(3, 1)) {
      if (!(BUILDINGS as readonly string[]).includes(b.kind)) continue;
      // Its front line: a block's north or south edge, half a street off a street's centre line.
      const off = ((b.z % PERIOD) + PERIOD) % PERIOD;
      expect([STREET / 2, PERIOD - STREET / 2].some((e) => Math.abs(off - e) < 1e-6)).toBe(true);
      // Along the street, inside the block (not on a cross street).
      const along = (((b.x % PERIOD) + PERIOD) % PERIOD) - PERIOD / 2;
      expect(Math.abs(along)).toBeLessThanOrEqual(BLOCK / 4 + 1e-6);
    }
  });
});

describe('street lights and lanes', () => {
  it('stands lamps on the sidewalks, never on a road or a block', () => {
    for (const lamp of lampPlan(2, 3)) {
      const [ax, az] = [lamp.x, lamp.z].map((v) => Math.abs(v - Math.round(v / PERIOD) * PERIOD));
      // One coordinate on a sidewalk (9 … 12.3 m off a street's centre line), along a block.
      const onWalk = (d: number) => d > 9 && d < STREET / 2;
      expect(onWalk(ax!) || onWalk(az!)).toBe(true);
    }
    expect(lampPlan(2, 3)).toHaveLength(5 * 4 * 3 * 2 * 2);
  });

  it('gives each street four lanes, two each way, inside the road', () => {
    const lanes = lanePlan(1);
    expect(lanes).toHaveLength(3 * 2 * 4);
    for (const lane of lanes) {
      const off = Math.abs(lane.offset - Math.round(lane.offset / PERIOD) * PERIOD);
      expect(off).toBeLessThan(9);
    }
    expect(lanes.filter((l) => l.direction > 0)).toHaveLength(lanes.length / 2);
  });
});
