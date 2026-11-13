import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMBLEM } from './emblemShape';

// The emblem's numbers hang together as the design says: the strobes and the ball are images of
// one flight, the flight runs from the tape to the tape, the dial has 60 ticks, the satellite
// rides the outer ring. The menu and the hub's 3D emblem both rely on it.

const { flight, tape, ticks, ball, satellite, outer, size } = EMBLEM;

/** The flight's point at t (a quadratic Bézier curve, view-box units, y down). */
const at = (t: number) =>
  [0, 1].map(
    (k) =>
      (1 - t) ** 2 * (flight.from[k] ?? 0) +
      2 * t * (1 - t) * (flight.control[k] ?? 0) +
      t ** 2 * (flight.to[k] ?? 0),
  );

describe('the SimLab emblem shape', () => {
  it('puts every strobe image on the flight, at its own time, to 0.05 unit', () => {
    const times = [0.15, 0.3, 0.7, 0.85];
    EMBLEM.strobes.forEach((strobe, i) => {
      const [x = 0, y = 0] = at(times[i] ?? 0);
      expect(Math.abs(strobe.x - x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(strobe.y - y)).toBeLessThanOrEqual(0.05);
    });
  });

  it('puts the ball at the top of the flight, on the dial axis', () => {
    expect(at(0.5)).toEqual([ball.x, ball.y]);
    expect(ball.x).toBe(size / 2);
    // The control point is midway in x, so the curve's top is at t = 0.5.
    expect(flight.control[0]).toBe((flight.from[0] + flight.to[0]) / 2);
  });

  it('launches and lands on the tape', () => {
    for (const [x, y] of [flight.from, flight.to]) {
      expect(y).toBe(tape.y);
      expect(x).toBeGreaterThan(tape.from);
      expect(x).toBeLessThan(tape.to);
    }
    for (const [x] of tape.marks) expect(x > tape.from && x < tape.to).toBe(true);
  });

  it('closes the dial with 60 tick dashes', () => {
    const count = (2 * Math.PI * ticks.r) / (ticks.dash + ticks.gap);
    expect(Math.abs(count - 60)).toBeLessThan(0.001);
  });

  it('keeps the satellite on the outer ring, everything inside the view box', () => {
    expect(Math.hypot(satellite.x - size / 2, satellite.y - size / 2)).toBe(outer.r);
    expect(outer.r + satellite.glow).toBeLessThanOrEqual(size / 2);
  });

  it('is plain data: it imports nothing (it is in the menu bundle, without three.js)', () => {
    const source = readFileSync(new URL('./emblemShape.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^\s*import\b/m);
  });
});
