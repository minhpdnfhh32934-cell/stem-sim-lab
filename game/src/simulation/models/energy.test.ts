import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { energyTrackModel as model, trackPoint } from './energy';

const at = (name: string) => model.variables.indexOf(name);
const G = 9.81;
const DEG = Math.PI / 180;

const inputsOf = (change: Record<string, number> = {}): Record<string, number> => ({
  releaseHeight: 0.2,
  mass: 0.5,
  sailArea: 0,
  gravity: G,
  rampAngle: 30,
  arcRadius: 0.3,
  flatLength: 0.3,
  rampLength: 0.72,
  flagWidth: 0.025,
  gateHeight: 0.06,
  rollingResistance: 0.003,
  cartDragArea: 0.005,
  sailDragCoefficient: 1.17,
  airDensity: 1.2,
  ...change,
});

/** No rolling resistance and no air: mechanical energy is conserved exactly. */
const LOSSLESS = { rollingResistance: 0, airDensity: 0 };

/** The model alone, stepped by `dt` until the cart turns; `each` sees the state after each step. */
function release(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  let time = 0;
  for (let i = 0; i < 1e6 && !model.isComplete!(state, inputs); i++) {
    const advanced = model.step(state, dt, inputs);
    expect(advanced).toBeGreaterThan(0);
    expect(advanced).toBeLessThanOrEqual(dt);
    time += advanced;
    each?.(state);
  }
  return { state, time };
}

/**
 * An independent reference: v² integrated along the track by classical RK4 in arc length σ (not
 * time), piece by piece, from d(v²)/dσ = −2g·sin φ − 2μ(g·cos φ + κ·v²) − 2k·v² with φ = φ₀ + κσ,
 * k = ½ρ(C_d·A)/m; with `timed`, also t = ∫dσ/v. The geometry is written out here from the track's
 * description (straight ramp, arc of radius R, flat, arc, ramp), not taken from the model.
 */
function reference(p: Record<string, number>) {
  const alpha = p.rampAngle! * DEG;
  const r = p.arcRadius!;
  const mu = p.rollingResistance!;
  const k =
    (0.5 * p.airDensity! * (p.cartDragArea! + p.sailDragCoefficient! * p.sailArea!)) / p.mass!;
  const w = p.flagWidth!;
  const halfFlat = p.flatLength! / 2;
  const arcTop = r - r * Math.cos(alpha);
  const piece = (u0: number, phi0: number, kappa: number, length: number, timed = false) => {
    const du = (sigma: number, u: number) => {
      const phi = phi0 + kappa * sigma;
      return -2 * G * Math.sin(phi) - 2 * mu * (G * Math.cos(phi) + kappa * u) - 2 * k * u;
    };
    const n = 2000;
    const h = length / n;
    let u = u0;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const s = i * h;
      const a1 = du(s, u);
      const a2 = du(s + h / 2, u + (h / 2) * a1);
      const a3 = du(s + h / 2, u + (h / 2) * a2);
      const a4 = du(s + h, u + h * a3);
      if (timed) {
        const b1 = 1 / Math.sqrt(u);
        const b2 = 1 / Math.sqrt(u + (h / 2) * a1);
        const b3 = 1 / Math.sqrt(u + (h / 2) * a2);
        const b4 = 1 / Math.sqrt(u + h * a3);
        t += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
      }
      u += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    }
    return { u, t };
  };
  let u = piece(0, -alpha, 0, (p.releaseHeight! - arcTop) / Math.sin(alpha)).u;
  u = piece(u, -alpha, 1 / r, r * alpha).u;
  u = piece(u, 0, 0, halfFlat - w / 2).u;
  const gateA = piece(u, 0, 0, w, true);
  u = piece(gateA.u, 0, 0, halfFlat - w / 2).u;
  const foot = piece(u, 0, 1 / r, r * alpha).u;
  const toB = (p.gateHeight! - arcTop) / Math.sin(alpha) - w / 2;
  const gateB = piece(piece(foot, alpha, 0, toB).u, alpha, 0, w, true);
  // The turn: bisect on the distance climbed up the far ramp until v² = 0.
  let low = 0;
  let high = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (piece(foot, alpha, 0, mid).u > 0) low = mid;
    else high = mid;
  }
  return {
    gateTimeA: gateA.t,
    gateTimeB: gateB.t,
    turnHeight: arcTop + low * Math.sin(alpha),
  };
}

describe('energy track theory: closed form against an independent integration', () => {
  it('without losses gives √(2gh) at A, w/√(2gh) for its gate and h′ = h (hand-worked)', () => {
    const t = model.predict!(inputsOf(LOSSLESS));
    // h = 0.2 m: v = √(2 × 9.81 × 0.2) = √3.924 = 1.980909 m/s; Δt = 0.025/1.980909 = 12.6205 ms.
    expect(t.idealSpeedA).toBeCloseTo(1.980909, 6);
    expect(t.speedA).toBeCloseTo(Math.sqrt(3.924), 12);
    expect(t.gateTimeA).toBeCloseTo(0.025 / Math.sqrt(3.924), 14);
    expect(t.gateTimeA).toBeCloseTo(0.0126205, 7);
    expect(model.predict!(inputsOf()).idealSpeedA).toBe(t.idealSpeedA); // losses never change it
    expect(t.startEnergy).toBeCloseTo(0.981, 12); // 0.5 × 9.81 × 0.2 J
    expect(t.kineticA).toBeCloseTo(0.981, 12);
    expect(t.turnHeight).toBeCloseTo(0.2, 12);
    expect(t.energyLost).toBeCloseTo(0, 12);
    expect(t.retained).toBeCloseTo(100, 10);
    // Gate B (h_B = 0.06 m) on the 30° ramp decelerates the cart uniformly across the flag, so
    // Δt = w/v̄ with v̄ the mean of the speeds where its edges cut the beam, at h_B ± (w/2)·sin 30°.
    const edge = (sign: number) =>
      Math.sqrt(2 * G * (0.2 - 0.06 - sign * 0.0125 * Math.sin(30 * DEG)));
    const mean = (edge(1) + edge(-1)) / 2;
    expect(t.gateTimeB).toBeCloseTo(0.025 / mean, 12);
    // E at B from the gate's mean speed falls short of m·g·h by ½m·((v₁ − v₂)/2)², 0.34 mJ here:
    // a timer's w/Δt is not the speed at the beam on a slope, even without losses.
    expect(t.energyB).toBeCloseTo(0.5 * (G * 0.06 + 0.5 * mean * mean), 12);
    expect(0.981 - t.energyB!).toBeCloseTo(0.5 * 0.5 * ((edge(-1) - edge(1)) / 2) ** 2, 12);
    expect(0.981 - t.energyB!).toBeCloseTo(0.000342, 6);
  });

  it('matches the arc-length integration for every loss, mass and release height', () => {
    let checked = 0;
    for (const change of [
      {},
      { rollingResistance: 0, cartDragArea: 0 }, // nothing at all: mechanical energy conserved
      { airDensity: 0 }, // rolling resistance only, with the arcs' centripetal load
      { rollingResistance: 0 }, // air drag only
      { sailArea: 0.04, mass: 0.25, releaseHeight: 0.1 }, // the most lossy preset
      { sailArea: 0.0225, mass: 1, releaseHeight: 0.3 },
      {
        rampAngle: 40,
        arcRadius: 0.2,
        rollingResistance: 0.02,
        releaseHeight: 0.4,
        gateHeight: 0.1,
      },
    ]) {
      const inputs = inputsOf(change);
      const t = model.predict!(inputs);
      const ref = reference(inputs);
      expect(t.gateTimeA).toBeCloseTo(ref.gateTimeA, 11);
      expect(t.gateTimeB).toBeCloseTo(ref.gateTimeB, 11);
      expect(t.turnHeight).toBeCloseTo(ref.turnHeight, 10);
      expect(t.energyLost).toBeCloseTo(
        inputs.mass! * G * (inputs.releaseHeight! - ref.turnHeight),
        9,
      );
      checked++;
    }
    expect(checked).toBe(7);
  });

  it('loses energy only to the stated forces: more with a sail, a smaller share for a heavy cart', () => {
    const kept = (change: Record<string, number>) => model.predict!(inputsOf(change)).retained!;
    expect(kept({ sailArea: 0.04 })).toBeLessThan(kept({ sailArea: 0.01 }));
    expect(kept({ sailArea: 0.01 })).toBeLessThan(kept({}));
    expect(kept({ sailArea: 0.04, mass: 1 })).toBeGreaterThan(kept({ sailArea: 0.04, mass: 0.25 }));
    // Without air, rolling resistance takes the same share of any mass (μ_r·N ∝ m).
    expect(kept({ airDensity: 0, mass: 1 })).toBeCloseTo(kept({ airDensity: 0, mass: 0.25 }), 12);
    // Without losses, the speed at A does not depend on the mass at all.
    const speed = (mass: number) => model.predict!(inputsOf({ ...LOSSLESS, mass })).speedA;
    expect(speed(1)).toBeCloseTo(speed(0.25)!, 12);
  });

  it('puts Eₖ at A against Eₚ at the release on the line of slope 1 only without losses', () => {
    const line = (change: Record<string, number>) => {
      const points = [0.1, 0.15, 0.2, 0.25, 0.3].map((releaseHeight) => {
        const t = model.predict!(inputsOf({ ...change, releaseHeight }));
        return { x: t.startEnergy!, y: t.kineticA! };
      });
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error('no line');
      return fit;
    };
    const ideal = line(LOSSLESS);
    expect(ideal.slope).toBeCloseTo(model.predict!(inputsOf()).energySlope!, 9);
    expect(ideal.intercept).toBeCloseTo(0, 9);
    expect(line({}).slope).toBeLessThan(1);
    expect(line({}).slope).toBeGreaterThan(0.97);
    expect(line({ sailArea: 0.04, mass: 0.25 }).slope).toBeLessThan(0.9);
  });
});

describe('energy track run: Runge–Kutta in time against the closed form', () => {
  it('lands on the theory for every result, whatever the step', () => {
    // [step, digits]: RK4's error falls as h⁴ — measured at most 1.5e-12 at 1 ms (the
    // definition's step), 2.3e-11 at 2 ms, 7.8e-10 at 5 ms and 7.3e-8 at a 60 Hz step.
    const steps = [
      [0.0005, 11],
      [0.001, 11],
      [0.002, 10],
      [0.005, 8],
      [1 / 60, 6],
    ] as const;
    for (const change of [{}, { sailArea: 0.04, mass: 0.25, releaseHeight: 0.1 }, LOSSLESS]) {
      const inputs = inputsOf(change);
      const t = model.predict!(inputs);
      for (const [dt, digits] of steps) {
        const { state } = release(inputs, dt);
        for (const id of ['gateTimeA', 'speedA', 'kineticA', 'gateTimeB', 'speedB', 'energyB']) {
          expect(state[at(id)]!).toBeCloseTo(t[id]!, digits);
        }
        expect(state[at('idealSpeedA')]).toBe(t.idealSpeedA);
        expect(state[at('height')]!).toBeCloseTo(t.turnHeight!, digits);
        expect(state[at('energyLost')]!).toBeCloseTo(t.energyLost!, digits);
        expect(state[at('retained')]!).toBeCloseTo(t.retained!, digits - 3); // 100·h′/h
        expect([
          state[at('speed')],
          state[at('stopped')],
          state[at('beamA')],
          state[at('beamB')],
        ]).toEqual([0, 1, 0, 0]);
      }
    }
  });

  it('keeps Eₖ + Eₚ + the work against the losses at m·g·h, and never gains energy', () => {
    const inputs = inputsOf({ sailArea: 0.0225 });
    const start = model.predict!(inputs).startEnergy!;
    let last = Infinity;
    let steps = 0;
    release(inputs, 0.001, (s) => {
      const mechanical = s[at('kineticEnergy')]! + s[at('potentialEnergy')]!;
      expect(mechanical + s[at('dragLoss')]! + s[at('rollingLoss')]!).toBeCloseTo(start, 10);
      expect(s[at('mechanicalEnergy')]).toBe(mechanical);
      expect(mechanical).toBeLessThanOrEqual(last + 1e-12);
      expect(s[at('dragLoss')]).toBeGreaterThan(0);
      last = mechanical;
      steps++;
    });
    expect(steps).toBeGreaterThan(1000); // about 1.2 s of 1 ms steps
  });

  it('without losses keeps mechanical energy constant to the integration’s rounding', () => {
    const inputs = inputsOf({ ...LOSSLESS, releaseHeight: 0.3, mass: 0.75 });
    const start = 0.75 * G * 0.3;
    release(inputs, 0.001, (s) => {
      expect(s[at('mechanicalEnergy')]!).toBeCloseTo(start, 10); // 2.2 J: RK4 drifts ~3e-12 J at 1 ms
      expect(s[at('energyLost')]).toBe(0);
    });
  });

  it('blocks each beam exactly while the flag is across it, and follows the track', () => {
    const inputs = inputsOf();
    const half = 0.0125;
    expect(trackPoint(inputs, 0)).toMatchObject({ x: 0, y: 0, slope: 0 }); // gate A's beam
    let blockedA = 0;
    let blockedB = 0;
    release(inputs, 0.0005, (s) => {
      const p = s[at('position')]!;
      const point = trackPoint(inputs, p);
      expect([s[at('x')], s[at('height')], s[at('trackAngle')]]).toEqual([
        point.x,
        point.y,
        point.slope,
      ]);
      if (s[at('beamA')] === 1) {
        blockedA++;
        expect(Math.abs(p)).toBeLessThanOrEqual(half);
      }
      if (s[at('beamB')] === 1) {
        blockedB++;
        // Gate B's beam is where the track is 0.06 m up the far ramp.
        const off = Math.abs(point.y - 0.06);
        expect(off).toBeLessThanOrEqual(half * Math.sin(30 * DEG) + 1e-12);
      }
    });
    expect(blockedA).toBeGreaterThan(20); // 12.7 ms of 0.5 ms steps
    expect(blockedB).toBeGreaterThan(20);
  });

  it('starts from rest at the release height on the near ramp', () => {
    const inputs = inputsOf({ releaseHeight: 0.25 });
    const state = new Float64Array(model.variables.length);
    model.init(inputs, state);
    expect(state[at('height')]!).toBeCloseTo(0.25, 14);
    expect(state[at('x')]!).toBeLessThan(-0.15 - 0.3 * Math.sin(30 * DEG)); // on the ramp
    expect(state[at('trackAngle')]!).toBeCloseTo(-30 * DEG, 14);
    expect(state[at('position')]).toBe(trackPoint(inputs, 0).release);
    expect([state[at('speed')], state[at('kineticEnergy')], state[at('gateTimeA')]]).toEqual([
      0, 0, 0,
    ]);
    expect(state[at('potentialEnergy')]!).toBeCloseTo(0.5 * G * 0.25, 14);
    expect(state[at('retained')]!).toBeCloseTo(100, 12);
  });

  it('draws a continuous track: x, y and slope meet at every joint', () => {
    const inputs = inputsOf();
    const a = 0.15;
    const b = a + 0.3 * 30 * DEG;
    for (const joint of [-b, -a, a, b]) {
      const before = trackPoint(inputs, joint - 1e-9);
      const after = trackPoint(inputs, joint + 1e-9);
      expect(after.x - before.x).toBeCloseTo(2e-9 * Math.cos(before.slope), 12);
      expect(after.y).toBeCloseTo(before.y, 8);
      expect(after.slope).toBeCloseTo(before.slope, 7);
    }
    // The arc's top: R(1 − cos 30°) = 0.3 × 0.1339746 = 0.0401924 m above the flat.
    expect(trackPoint(inputs, b).y).toBeCloseTo(0.0401924, 7);
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = release(inputsOf({ sailArea: 0.01 }), 0.001).state;
    const b = release(inputsOf({ sailArea: 0.01 }), 0.001).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('does nothing once the cart has turned', () => {
    const inputs = inputsOf();
    const { state } = release(inputs, 0.001);
    const before = Array.from(state);
    expect(model.step(state, 0.001, inputs)).toBe(0);
    expect(Array.from(state)).toEqual(before);
  });
});

describe('energy track inputs: refused with a reason, never clamped', () => {
  const refuses = (change: Record<string, number>, reason: RegExp) => {
    const state = new Float64Array(model.variables.length);
    expect(() => model.init(inputsOf(change), state)).toThrow(reason);
    expect(() => model.predict!(inputsOf(change))).toThrow(reason);
  };

  it('refuses missing, out-of-range and non-finite inputs', () => {
    const missing = inputsOf();
    delete missing.mass;
    expect(() => model.predict!(missing)).toThrow(/"mass" is missing/);
    refuses({ mass: 0 }, /"mass" must be above 0/);
    refuses({ sailArea: -0.01 }, /"sailArea"/);
    refuses({ rollingResistance: NaN }, /"rollingResistance"/);
    refuses({ rampAngle: 90 }, /"rampAngle"/);
  });

  it('refuses a release off the straight ramp', () => {
    refuses({ releaseHeight: 0.03 }, /straight ramp, above 0.0402 m/); // on the arc
    refuses({ releaseHeight: 0.41 }, /at most 0.4002 m/); // 0.0402 + 0.72 × sin 30°
  });

  it('refuses a track the cart cannot run or the gates cannot time', () => {
    refuses({ flagWidth: 0.5 }, /shorter than the flat/);
    refuses({ rollingResistance: 0.6 }, /would not start rolling/); // tan 30° = 0.577
    refuses({ gateHeight: 0.045 }, /gate B's flag must pass on the straight far ramp/);
  });

  it('refuses a run in which the cart would stop before clearing gate B', () => {
    refuses({ releaseHeight: 0.07, sailArea: 0.04, mass: 0.25 }, /stop before its flag clears/);
    // Just high enough without losses: the flag's back edge clears the beam at h_B + (w/2)·sin α.
    const clear = 0.06 + 0.0125 * Math.sin(30 * DEG);
    expect(() =>
      model.predict!(inputsOf({ ...LOSSLESS, releaseHeight: clear + 1e-6 })),
    ).not.toThrow();
    refuses({ ...LOSSLESS, releaseHeight: clear - 1e-6 }, /stop before its flag clears/);
  });
});

describe('energy track in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'energy-test',
    name: 'Energy track',
    category: 'physics',
    model: 'mechanics.energy-track',
    parameters: [
      { id: 'releaseHeight', label: 'h', unit: 'm', default: 0.2, min: 0.1, max: 0.3 },
      { id: 'mass', label: 'm', unit: 'kg', default: 0.5, min: 0.25, max: 1 },
      { id: 'sailArea', label: 'A', unit: 'm²', default: 0, min: 0, max: 0.04 },
    ],
    initialConditions: {
      gravity: G,
      rampAngle: 30,
      arcRadius: 0.3,
      flatLength: 0.3,
      rampLength: 0.72,
      flagWidth: 0.025,
      gateHeight: 0.06,
      rollingResistance: 0.003,
      cartDragArea: 0.005,
      sailDragCoefficient: 1.17,
      airDensity: 1.2,
    },
    simulation: { timeStep: 0.001, maxDuration: 10, sampleInterval: 0.01 },
    measurements: [{ id: 'speed', label: 'v', unit: 'm/s', variable: 'speed' }],
    results: [
      {
        id: 'startEnergy',
        label: 'Ep',
        unit: 'J',
        variable: 'potentialEnergy',
        reduce: 'max',
        theory: 'startEnergy',
      },
      {
        id: 'kineticA',
        label: 'Ek',
        unit: 'J',
        variable: 'kineticA',
        reduce: 'final',
        theory: 'kineticA',
      },
      {
        id: 'turnHeight',
        label: "h'",
        unit: 'm',
        variable: 'height',
        reduce: 'final',
        theory: 'turnHeight',
      },
      {
        id: 'retained',
        label: '%',
        unit: '%',
        variable: 'retained',
        reduce: 'final',
        theory: 'retained',
      },
    ],
  });

  it('ends by itself at the turn, every result on its theory, for every preset', () => {
    for (const releaseHeight of [0.1, 0.15, 0.2, 0.25, 0.3]) {
      for (const mass of [0.25, 0.5, 0.75, 1]) {
        for (const sailArea of [0, 0.01, 0.0225, 0.04]) {
          const r = new ExperimentRuntime('t', definition, model, {
            releaseHeight,
            mass,
            sailArea,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeGreaterThan(0.85);
          expect(r.time).toBeLessThan(1.2);
          const theory = r.theory()!;
          for (const [id, value] of Object.entries(r.results!)) {
            expect(value).toBeCloseTo(theory[id]!, 8);
          }
        }
      }
    }
  });
});
