import { describe, expect, it } from 'vitest';
import { meanSpacing, orbPairs } from './neighbors';
import { INNER_RADII, INNER_SHARE, ORB_BUDGET, SURFACE_JITTER, orbPoints } from './points';
import {
  MAX_PULSE_HZ,
  ORB_STATES,
  TRANSITION_MS,
  orbPicture,
  orbStateOf,
  paramsAt,
  still,
  type OrbParams,
  type OrbState,
} from './states';

const at = (p: Float32Array, i: number) =>
  [p[3 * i] ?? NaN, p[3 * i + 1] ?? NaN, p[3 * i + 2] ?? NaN] as const;
const norm = ([x, y, z]: readonly [number, number, number]) => Math.hypot(x, y, z);
const dist = (p: Float32Array, i: number, j: number) => {
  const [a, b, c] = at(p, i);
  const [d, e, f] = at(p, j);
  return Math.hypot(a - d, b - e, c - f);
};

describe('orb points (#234)', () => {
  it('the same seed gives the same orb; another seed another one', () => {
    expect(orbPoints(300, 7)).toEqual(orbPoints(300, 7));
    expect(orbPoints(300, 7)).not.toEqual(orbPoints(300, 8));
  });

  it('surface points lie on the unit sphere (± 2 %), the inner ones between 0.35 and 0.85', () => {
    const n = 600;
    const p = orbPoints(n, 3);
    expect(p.length).toBe(3 * n);
    const inner = Math.round(n * INNER_SHARE);
    for (let i = 0; i < n - inner; i++)
      expect(Math.abs(norm(at(p, i)) - 1)).toBeLessThanOrEqual(SURFACE_JITTER + 1e-6);
    for (let i = n - inner; i < n; i++) {
      const r = norm(at(p, i));
      expect(r).toBeGreaterThanOrEqual(INNER_RADII[0] - 1e-6);
      expect(r).toBeLessThanOrEqual(INNER_RADII[1] + 1e-6);
    }
  });

  it('the surface is evenly covered: no clumps, balanced halves', () => {
    const n = 300;
    const p = orbPoints(n, 1);
    const surface = n - Math.round(n * INNER_SHARE);
    const spacing = meanSpacing(surface);
    let closest = Infinity;
    for (let i = 0; i < surface; i++)
      for (let j = i + 1; j < surface; j++) closest = Math.min(closest, dist(p, i, j));
    // An even spread keeps every pair apart by a good share of the mean spacing.
    expect(closest).toBeGreaterThan(0.4 * spacing);
    for (const axis of [0, 1, 2]) {
      let sum = 0;
      for (let i = 0; i < surface; i++) sum += p[3 * i + axis] ?? 0;
      expect(Math.abs(sum / surface)).toBeLessThan(0.05);
    }
  });
});

describe('orb lines (#234)', () => {
  it('six points on the axes: each links to its four nearest (the opposite pole is too far)', () => {
    // ±x, ±y, ±z on the unit sphere: neighbours at √2, the opposite pole at 2.
    const p = new Float32Array([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1]);
    const pairs = orbPairs(p, 4, 1.5, 100);
    const set = new Set<string>();
    for (let i = 0; i < pairs.length; i += 2)
      set.add(`${String(pairs[i])}-${String(pairs[i + 1])}`);
    // 12 edges of the octahedron, never a pole with its opposite (0-1, 2-3, 4-5).
    expect(set.size).toBe(12);
    for (const opposite of ['0-1', '2-3', '4-5']) expect(set.has(opposite)).toBe(false);
  });

  it('the cap keeps the shortest pairs', () => {
    const p = new Float32Array([0, 0, 0, 0.1, 0, 0, 0.3, 0, 0, 0.6, 0, 0]);
    expect([...orbPairs(p, 3, 1, 2)]).toEqual([0, 1, 1, 2]);
  });

  for (const tier of ['medium', 'high'] as const) {
    it(`${tier}: within its budget, each pair once (a < b), every line short`, () => {
      const { points, pairs } = ORB_BUDGET[tier];
      const p = orbPoints(points, 1);
      const maxDist = 2 * meanSpacing(points);
      const lines = orbPairs(p, 3, maxDist, pairs);
      expect(lines.length / 2).toBeLessThanOrEqual(pairs);
      expect(lines.length / 2).toBeGreaterThan(pairs / 2);
      const seen = new Set<number>();
      for (let i = 0; i < lines.length; i += 2) {
        const a = lines[i] ?? -1;
        const b = lines[i + 1] ?? -1;
        expect(a).toBeLessThan(b);
        expect(seen.has(a * points + b)).toBe(false);
        seen.add(a * points + b);
        expect(dist(p, a, b)).toBeLessThanOrEqual(maxDist + 1e-6);
      }
      expect(orbPairs(p, 3, maxDist, pairs)).toEqual(lines);
    });
  }
});

describe('orb states (#234)', () => {
  const STATES = Object.keys(ORB_STATES) as OrbState[];
  const KEYS = Object.keys(ORB_STATES.idle) as (keyof OrbParams)[];

  it('no state, and no moment of a change between two, pulses more than three times a second', () => {
    for (const s of STATES) expect(ORB_STATES[s].pulseHz).toBeLessThanOrEqual(MAX_PULSE_HZ);
    for (const a of STATES)
      for (const b of STATES)
        for (let ms = 0; ms <= TRANSITION_MS; ms += 50)
          expect(paramsAt(ORB_STATES[a], ORB_STATES[b], ms).pulseHz).toBeLessThanOrEqual(
            MAX_PULSE_HZ,
          );
  });

  it('a change starts at the old state, ends at the new one, and moves only between them', () => {
    const from = ORB_STATES.idle;
    const to = ORB_STATES.thinking;
    expect(paramsAt(from, to, 0)).toEqual(from);
    expect(paramsAt(from, to, TRANSITION_MS)).toEqual(to);
    expect(paramsAt(from, to, 10 * TRANSITION_MS)).toEqual(to);
    let last = from.spin;
    for (let ms = 0; ms <= TRANSITION_MS; ms += 25) {
      const p = paramsAt(from, to, ms);
      for (const k of KEYS) {
        expect(p[k]).toBeGreaterThanOrEqual(Math.min(from[k], to[k]) - 1e-12);
        expect(p[k]).toBeLessThanOrEqual(Math.max(from[k], to[k]) + 1e-12);
      }
      expect(p.spin).toBeGreaterThanOrEqual(last - 1e-12);
      last = p.spin;
    }
    // Half way (smoothstep at ½ is ½).
    expect(paramsAt(from, to, TRANSITION_MS / 2).spin).toBeCloseTo((from.spin + to.spin) / 2, 12);
  });

  it('reduced motion: nothing turns, sweeps, pulses or swells; brightness still tells the state', () => {
    for (const s of STATES) {
      const p = still(ORB_STATES[s]);
      expect([p.spin, p.band, p.pulseHz, p.voice]).toEqual([0, 0, 0, 0]);
      expect(p.glow).toBe(ORB_STATES[s].glow);
    }
  });

  it('the state follows the page: boot, then speaking, thinking, listening, done, idle', () => {
    const none = {
      booting: false,
      speaking: false,
      answering: false,
      typing: false,
      justAnswered: false,
    };
    expect(orbStateOf({ ...none, booting: true, speaking: true })).toBe('boot');
    expect(orbStateOf({ ...none, speaking: true, answering: true })).toBe('speaking');
    expect(orbStateOf({ ...none, answering: true, typing: true })).toBe('thinking');
    expect(orbStateOf({ ...none, typing: true, justAnswered: true })).toBe('listening');
    expect(orbStateOf({ ...none, justAnswered: true })).toBe('done');
    expect(orbStateOf(none)).toBe('idle');
  });

  it('the picture: rings on Low, without WebGL 2 or after a lost context; drawn once with reduced motion', () => {
    const ok = { tier: 'medium', webgl2: true, contextLost: false, reducedMotion: false } as const;
    expect(orbPicture(ok)).toBe('orb');
    expect(orbPicture({ ...ok, tier: 'high' })).toBe('orb');
    expect(orbPicture({ ...ok, tier: 'low' })).toBe('rings');
    expect(orbPicture({ ...ok, webgl2: false })).toBe('rings');
    expect(orbPicture({ ...ok, contextLost: true })).toBe('rings');
    expect(orbPicture({ ...ok, reducedMotion: true })).toBe('still');
    expect(orbPicture({ ...ok, tier: 'low', reducedMotion: true })).toBe('rings');
  });
});
