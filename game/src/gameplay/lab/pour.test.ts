import { describe, expect, it } from 'vitest';
import type { Quat, Vec3 } from '../../core/math';
import { tiltOf } from '../interaction/hold';
import type { ContainerDefinition } from '../item';
import { overMouth, PourMeter, pointOf, pourRate } from './pour';

const DEG = Math.PI / 180;
type Pour = NonNullable<ContainerDefinition['pour']>;
const TILT: Pour = {
  spout: [0, 0.07, 0.006],
  trigger: 'tilt',
  minTiltDeg: 70,
  fullTiltDeg: 115,
  rateMlPerS: 8,
};
const SQUEEZE: Pour = { ...TILT, trigger: 'squeeze' };
/** A turn by `angle` about +x. */
const aboutX = (angle: number): Quat => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];

describe('pour geometry', () => {
  it('measures the tilt from a quaternion (the item’s +y against the world’s)', () => {
    expect(tiltOf([0, 0, 0, 1])).toBeCloseTo(0, 12);
    expect(tiltOf(aboutX(115 * DEG))).toBeCloseTo(115 * DEG, 9);
    // A turn about +y alone leaves it upright.
    expect(tiltOf([0, Math.sin(0.6), 0, Math.cos(0.6)])).toBeCloseTo(0, 9);
  });

  it('puts the spout in the world: position + rotation · spout', () => {
    const out: Vec3 = [0, 0, 0];
    expect(pointOf([1, 2, 3], [0, 0, 0, 1], [0, 0.07, 0.006], out)).toBe(out);
    expect(out[0]).toBeCloseTo(1, 12);
    expect(out[1]).toBeCloseTo(2.07, 12);
    expect(out[2]).toBeCloseTo(3.006, 12);
    pointOf([0, 0, 0], aboutX(Math.PI / 2), [0, 0.07, 0], out); // +y turned onto +z
    expect(out[1]).toBeCloseTo(0, 12);
    expect(out[2]).toBeCloseTo(0.07, 12);
  });

  it('accepts a spout within the capture radius of the mouth, horizontally', () => {
    const mouth = { center: [0, 0, 0] as Vec3, radius: 0.006 };
    expect(overMouth([0.005, 1, 0], [0, 0, 0], mouth)).toBe(true);
    expect(overMouth([0.007, 1, 0], [0, 0, 0], mouth)).toBe(false);
    expect(overMouth([0.015, -3, 0], [0, 0, 0], { ...mouth, captureRadius: 0.015 })).toBe(true);
    expect(overMouth([0.012, 0, 0.012], [0, 0, 0], { ...mouth, captureRadius: 0.015 })).toBe(false);
  });

  it('pours from nothing at the least tilt to the full rate, monotonic, never above it', () => {
    expect(pourRate(TILT, 0, true)).toBe(0);
    expect(pourRate(TILT, 70 * DEG, true)).toBe(0);
    expect(pourRate(TILT, 115 * DEG, false)).toBeCloseTo(8, 12);
    expect(pourRate(TILT, 170 * DEG, false)).toBe(8);
    let last = 0;
    for (let deg = 0; deg <= 180; deg += 0.5) {
      const rate = pourRate(TILT, deg * DEG, false);
      expect(rate).toBeGreaterThanOrEqual(last);
      expect(rate).toBeLessThanOrEqual(8);
      last = rate;
    }
    // A wash bottle: only while squeezed, whatever its tilt.
    expect(pourRate(SQUEEZE, 0, true)).toBe(8);
    expect(pourRate(SQUEEZE, 120 * DEG, false)).toBe(0);
  });
});

describe('PourMeter', () => {
  it('asks whole µL whose sum over N steps is floor(R·N·h·1000), whatever the rate', () => {
    for (const rate of [8, 3.3, 0.7, 19.999]) {
      for (const h of [1 / 60, 1 / 120]) {
        const meter = new PourMeter();
        let asked = 0;
        for (let i = 1; i <= 600; i++) {
          const want = meter.take(rate, h);
          expect(Number.isInteger(want)).toBe(true);
          asked += want;
          // ±1 µL of the exact volume at every step: nothing drifts.
          expect(Math.abs(asked - rate * i * h * 1000)).toBeLessThan(1 + 1e-6);
        }
      }
    }
  });

  it('owes nothing after a reset (less moved than asked)', () => {
    const meter = new PourMeter();
    expect(meter.take(1, 1 / 60)).toBe(16); // 16.67 µL: 0.67 carried
    expect(meter.take(1, 1 / 60)).toBe(17); // 17.33: 0.33 carried
    meter.reset();
    expect(meter.take(1, 1 / 60)).toBe(16);
  });
});
