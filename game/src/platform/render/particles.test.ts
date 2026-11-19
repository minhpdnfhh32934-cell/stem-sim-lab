import { describe, expect, it } from 'vitest';
import { airClouds, Particles } from './particles';

describe('Particles', () => {
  it('an empty pool is drawn once (its program compiled), then only while a particle lives', () => {
    const pool = new Particles(8, '#ffffff', false, { opacity: 1, grow: 0, lift: 0, drag: 0 });
    /** A frame's draw: three calls onAfterRender on what it drew. */
    const drawn = () => {
      if (pool.points.visible) (pool.points.onAfterRender as () => void)();
      return pool.points.visible;
    };
    expect(pool.points.visible).toBe(true); // the first frame draws it
    expect(drawn()).toBe(false);
    pool.update(0.1);
    expect(pool.points.visible).toBe(false);
    pool.emit(0, 0, 0, 0, 1, 0, 0.1, 0.5);
    pool.update(0.1);
    expect(drawn()).toBe(true);
    pool.update(1); // to the end of its life (drawn faded out)
    pool.update(0.1); // gone
    expect(pool.points.visible).toBe(false);
  });
});

describe('airClouds', () => {
  const blank = () => ({ x: 0, y: 0, z: 0, radius: 0, thickness: 0 });
  const still = { opacity: 1, grow: 0, lift: 0, drag: 0 };

  it('a hazing pool is a cloud where its particles hang, gone with them', () => {
    const pool = new Particles(4, '#ffffff', false, { ...still, air: 1 });
    pool.emit(-1, 2, 0, 0, 0, 0, 0.5, 10);
    pool.emit(1, 2, 0, 0, 0, 0, 0.5, 10);
    pool.update(1);
    const out = [blank()];
    expect(airClouds(out)).toBe(1);
    const [cloud] = out;
    expect(cloud?.x).toBeCloseTo(0);
    expect(cloud?.y).toBeCloseTo(2);
    expect(cloud?.radius).toBeCloseTo(1.25); // their spread, and half a particle
    expect(cloud?.thickness).toBeGreaterThan(0);
    pool.update(10); // to the end of their life
    pool.update(0.1); // gone
    expect(airClouds([blank()])).toBe(0);
  });

  it('only pools that haze the air, the thickest when there are more than places', () => {
    new Particles(4, '#ffffff', true, still).emit(0, 0, 0, 0, 0, 0, 1, 10); // a flame's: none
    const thin = new Particles(4, '#ffffff', false, { ...still, air: 0.1 });
    const mid = new Particles(4, '#ffffff', false, { ...still, air: 1 });
    const thick = new Particles(4, '#ffffff', false, { ...still, air: 5 });
    for (const [pool, x] of [
      [thin, 10],
      [mid, 20],
      [thick, 30],
    ] as const) {
      pool.emit(x, 0, 0, 0, 0, 0, 1, 10);
      pool.update(1);
    }
    const out = [blank(), blank()];
    expect(airClouds(out)).toBe(2);
    expect(out.map((c) => c.x).sort((a, b) => a - b)).toEqual([20, 30]);
  });
});
