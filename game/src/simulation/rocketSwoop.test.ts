import { describe, expect, it } from 'vitest';
import { G0 } from './rocketBurn';
import { angleBetween, Swoop, SWOOP_PAST_ROOF, type SwoopSpec } from './rocketSwoop';

const DEG = Math.PI / 180;
const SPEC: SwoopSpec = SWOOP_PAST_ROOF;
const JOINS = [SPEC.ignite.t, 0];
const nearJoin = (t: number) => JOINS.some((j) => Math.abs(t - j) < 0.04);

describe('the opening rocket’s swoop past the roof', () => {
  const swoop = new Swoop(SPEC);
  const times: number[] = [];
  for (let t = SPEC.dive.t; t <= SPEC.end; t += 0.05) times.push(t);

  it('obeys Newton’s second law everywhere: its acceleration is net force over mass', () => {
    const h = 0.02;
    for (const t of times) {
      // Where the engines light the acceleration jumps: no derivative across it.
      if (nearJoin(t)) continue;
      if (t - h < SPEC.dive.t || t + h > SPEC.end) continue;
      const s = swoop.stateAt(t);
      const before = swoop.stateAt(s.t - h).v;
      const after = swoop.stateAt(s.t + h).v;
      for (const i of [0, 1, 2] as const) {
        const fd = (after[i] - before[i]) / (swoop.stateAt(s.t + h).t - swoop.stateAt(s.t - h).t);
        expect(Math.abs(fd - s.accel[i])).toBeLessThan(0.1);
        expect(s.net[i]).toBeCloseTo(s.thrust[i] + s.weight[i] + s.drag[i], 6);
      }
    }
  });

  it('falls freely in the dive (engines off: weight and drag only)', () => {
    const s = swoop.stateAt(-6);
    expect(s.phase).toBe('dive');
    expect(Math.hypot(...s.thrust)).toBe(0);
    // With so little drag, near the free fall: v_y = −g·Δt.
    expect(s.v[1]).toBeCloseTo(-G0 * (s.t - SPEC.dive.t), 0);
  });

  it('passes the release point as asked, with no jump where the phases join', () => {
    const at0 = swoop.stateAt(0);
    expect(Math.hypot(...at0.at)).toBeLessThan(0.05);
    for (const i of [0, 1, 2] as const) {
      expect(at0.v[i]).toBeCloseTo(SPEC.release.v[i], 1);
      expect(Math.abs(at0.thrust[i] - SPEC.release.thrust[i])).toBeLessThan(0.01 * 1.6e6);
    }
    for (const join of [SPEC.ignite.t, 0]) {
      const a = swoop.stateAt(join - 0.006);
      const b = swoop.stateAt(join + 0.006);
      // Across 12 ms: the position moves by v·Δt and the velocity by a·Δt, no more.
      const dt = b.t - a.t;
      for (const i of [0, 1, 2] as const) {
        expect(Math.abs(b.at[i] - a.at[i] - a.v[i] * dt)).toBeLessThan(0.02);
        expect(Math.abs(b.v[i] - a.v[i])).toBeLessThan(40 * dt);
      }
    }
  });

  it('asks its engines only for thrust they have, and burns mass at |T| / (Isp·g0)', () => {
    let burned = 0;
    let last = swoop.stateAt(SPEC.ignite.t);
    for (const t of times) {
      const s = swoop.stateAt(t);
      const thrust = Math.hypot(...s.thrust);
      if (s.phase === 'dive') expect(thrust).toBe(0);
      else {
        expect(thrust).toBeGreaterThanOrEqual(SPEC.rocket.thrustMin);
        expect(thrust).toBeLessThanOrEqual(SPEC.rocket.thrustMax);
      }
      if (s.t > last.t) {
        const mean = (Math.hypot(...s.thrust) + Math.hypot(...last.thrust)) / 2;
        burned += (mean * (s.t - last.t)) / (SPEC.rocket.isp * G0);
        last = s;
      }
    }
    const lost = SPEC.rocket.m0 - swoop.stateAt(SPEC.end).mass;
    expect(Math.abs(lost - burned) / lost).toBeLessThan(0.01);
  });

  it('turns its nose smoothly: never faster than 120° a second', () => {
    let worst = 0;
    for (let t = SPEC.dive.t; t < SPEC.end - 0.02; t += 0.01) {
      const a = swoop.stateAt(t).axis;
      const b = swoop.stateAt(t + 0.01).axis;
      worst = Math.max(worst, angleBetween(a, b) / 0.01);
    }
    expect(worst / DEG).toBeLessThan(120);
  });

  it('pulls out: the net force points up through the flare, bending the path', () => {
    const s = swoop.stateAt(-3);
    expect(s.phase).toBe('pull');
    expect(s.net[1]).toBeGreaterThan(0);
    expect(s.v[1]).toBeLessThan(0);
    expect(s.felt).toBeGreaterThan(1);
    // Never more than the crew can stand in a seat for a few seconds.
    let most = 0;
    for (const t of times) most = Math.max(most, swoop.stateAt(t).felt);
    expect(most).toBeLessThan(3.5);
  });
});
