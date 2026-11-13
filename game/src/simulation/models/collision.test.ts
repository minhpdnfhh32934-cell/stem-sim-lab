import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { collisionModel } from './collision';

const slot = (name: string) => collisionModel.variables.indexOf(name);
const XA = slot('positionA');
const XB = slot('positionB');
const VA = slot('velocityA');
const VB = slot('velocityB');
const P = slot('momentum');
const K = slot('kinetic');
const KEPT = slot('kineticPercent');
const GATE_A = slot('gateTimeA');
const GATE_B = slot('gateTimeB');
const COLLIDED = slot('collided');

// The draft layout: glider centres and gates along a 1.5 m track, from the launcher end.
const LAYOUT = {
  massB: 0.3,
  gliderLength: 0.2,
  flagLength: 0.1,
  startA: 0.15,
  startB: 0.8,
  gate1: 0.35,
  gate2: 1,
  trackLength: 1.5,
};
const inputsOf = (change: Record<string, number> = {}) => ({
  massA: 0.2,
  speed: 0.4,
  restitution: 0.5,
  ...LAYOUT,
  ...change,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state and the time reached. */
function run(
  inputs: Record<string, number>,
  dt: number,
  each?: (s: Float64Array, t: number) => void,
) {
  const state = new Float64Array(collisionModel.variables.length);
  collisionModel.init(inputs, state);
  let time = 0;
  let steps = 0;
  while (!collisionModel.isComplete!(state, inputs)) {
    const h = collisionModel.step(state, dt, inputs);
    expect(h).toBeGreaterThan(0); // never stalls: the runtime fails a step of 0 before the end
    expect(h).toBeLessThanOrEqual(dt);
    time += h;
    each?.(state, time);
    if (++steps > 1e7) throw new Error('no end');
  }
  return { state, time };
}

/**
 * Two gliders meeting through a linear spring–dashpot bumper (stiffness k, damping c), integrated
 * by classical RK4 from first contact until the bumper is no longer compressed. For such a contact
 * the relative motion is a damped oscillator and the speed of separation over the speed of
 * approach is e = exp(−ζπ/√(1 − ζ²)), ζ = c/(2√(k·μ)), μ = m_A·m_B/(m_A + m_B): an impact of
 * restitution e that takes time, against which the model's instantaneous one is checked.
 */
function bumper(mA: number, mB: number, u: number, e: number, k = 2000, h = 1e-6) {
  const mu = (mA * mB) / (mA + mB);
  const zeta = e === 1 ? 0 : -Math.log(e) / Math.sqrt(Math.PI ** 2 + Math.log(e) ** 2);
  const c = 2 * zeta * Math.sqrt(k * mu);
  // y = [overlap δ, vA, vB]; the force on B is k·δ + c·δ′ (δ′ = vA − vB), on A the opposite.
  const rate = ([d, a, b]: number[]) => {
    const force = k * d! + c * (a! - b!);
    return [a! - b!, -force / mA, force / mB];
  };
  let y = [0, u, 0];
  for (let i = 0; i < 1e7; i++) {
    const k1 = rate(y);
    const k2 = rate(y.map((v, j) => v + (h / 2) * k1[j]!));
    const k3 = rate(y.map((v, j) => v + (h / 2) * k2[j]!));
    const k4 = rate(y.map((v, j) => v + h * k3[j]!));
    y = y.map((v, j) => v + (h / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!));
    if (y[0]! <= 0) return { vA: y[1]!, vB: y[2]! };
  }
  throw new Error('the bumper never let go');
}

describe('collision theory: momentum conserved, restitution sets the rest', () => {
  it('gives the textbook elastic result for a target at rest (e = 1)', () => {
    // Halliday, Resnick & Walker, ch. 9: v1f = (m1 − m2)/(m1 + m2)·v1i, v2f = 2m1/(m1 + m2)·v1i.
    for (const [mA, u] of [
      [0.2, 0.4],
      [0.4, 0.3],
      [0.5, 0.5],
    ] as const) {
      const t = collisionModel.predict!(inputsOf({ massA: mA, speed: u, restitution: 1 }));
      expect(t.velocityA).toBeCloseTo(((mA - 0.3) / (mA + 0.3)) * u, 14);
      expect(t.velocityB).toBeCloseTo(((2 * mA) / (mA + 0.3)) * u, 14);
      expect(t.kineticAfter).toBeCloseTo(t.kineticBefore!, 14); // kinetic energy kept
      expect(t.kineticPercent).toBe(100);
    }
  });

  it('exchanges the velocities of equal gliders at e = 1: A stops dead', () => {
    const t = collisionModel.predict!(inputsOf({ massA: 0.3, speed: 0.4, restitution: 1 }));
    expect(Object.is(t.velocityA, 0)).toBe(true); // exactly 0, so "Stops", never −0
    expect(t.velocityB).toBe(0.4);
  });

  it('moves the stuck pair on at m_A·u/(m_A + m_B) when e = 0, keeping m_A/(m_A + m_B) of E_k', () => {
    const t = collisionModel.predict!(inputsOf({ massA: 0.2, speed: 0.5, restitution: 0 }));
    expect(t.velocityA).toBeCloseTo((0.2 * 0.5) / 0.5, 15); // 0.2 m/s
    expect(t.velocityB).toBe(t.velocityA);
    expect(t.kineticPercent).toBeCloseTo(40, 12); // 0.2/(0.2 + 0.3)
  });

  it('matches a case worked by hand (m_A 0.2 kg, m_B 0.3 kg, u 0.4 m/s, e 0.5)', () => {
    // vA′ = 0.4·(0.2 − 0.15)/0.5 = 0.04 m/s; vB′ = 0.4·0.2·1.5/0.5 = 0.24 m/s;
    // p = 0.2·0.4 = 0.08 = 0.2·0.04 + 0.3·0.24; E_k = ½·0.2·0.16 = 0.016 J,
    // E_k′ = ½·0.2·0.0016 + ½·0.3·0.0576 = 0.0088 J, 55 %; Δt₁ = 0.1/0.4 = 0.25 s,
    // Δt₂ = 0.1/0.24 s; impact at (0.8 − 0.2 − 0.15)/0.4 = 1.125 s.
    const t = collisionModel.predict!(inputsOf());
    expect(t.velocityA).toBeCloseTo(0.04, 15);
    expect(t.velocityB).toBeCloseTo(0.24, 15);
    expect(t.momentumBefore).toBeCloseTo(0.08, 15);
    expect(t.momentumAfter).toBeCloseTo(0.2 * 0.04 + 0.3 * 0.24, 15);
    expect(t.kineticBefore).toBeCloseTo(0.016, 15);
    expect(t.kineticAfter).toBeCloseTo(0.0088, 15);
    expect(t.kineticPercent).toBeCloseTo(55, 12);
    expect(t.kineticSlope).toBeCloseTo(0.55, 14);
    expect(t.momentumSlope).toBe(1);
    expect(t.gateTimeA).toBeCloseTo(0.25, 15);
    expect(t.gateTimeB).toBeCloseTo(0.1 / 0.24, 14);
    expect(t.collisionTime).toBeCloseTo(1.125, 14);
  });

  it('agrees with a spring–dashpot bumper of the same restitution, integrated through contact', () => {
    for (const [mA, e] of [
      [0.2, 1],
      [0.5, 1],
      [0.2, 0.5],
      [0.4, 0.9],
    ] as const) {
      const real = bumper(mA, 0.3, 0.4, e);
      const t = collisionModel.predict!(inputsOf({ massA: mA, restitution: e }));
      expect(t.velocityA).toBeCloseTo(real.vA, 4);
      expect(t.velocityB).toBeCloseTo(real.vB, 4);
    }
  });
});

describe('collision run: uniform motion, one impact, stepped exactly onto every event', () => {
  it('moves each glider at constant velocity before and after the impact, whatever the step', () => {
    const inputs = inputsOf();
    const tc = 1.125;
    let checked = 0;
    for (const dt of [0.001, 0.0137, 0.25]) {
      // A step may end a rounding error short of the impact; a step of ~1e-16 s then reaches it.
      run(inputs, dt, (s, t) => {
        if (s[COLLIDED] === 0) {
          expect(t).toBeLessThan(tc + 1e-12);
          expect(s[XA]!).toBeCloseTo(0.15 + 0.4 * t, 10);
          expect(s[XB]).toBe(0.8);
        } else {
          expect(t).toBeGreaterThan(tc - 1e-12);
          expect(s[XA]!).toBeCloseTo(0.6 + 0.04 * (t - tc), 10);
          expect(s[XB]!).toBeCloseTo(0.8 + 0.24 * (t - tc), 10);
        }
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it('keeps the total momentum at every step and loses kinetic energy only at the impact', () => {
    const inputs = inputsOf({ massA: 0.4, speed: 0.3, restitution: 0 });
    let lastK = NaN;
    let drops = 0;
    run(inputs, 0.001, (s) => {
      expect(s[P]!).toBeCloseTo(0.12, 14);
      if (s[K]! < lastK - 1e-15) drops++;
      lastK = s[K]!;
    });
    expect(drops).toBe(1);
  });

  it('ends when B meets the far buffer, at t_c + (x_end − x_B0)/vB′, with the theory’s results', () => {
    const inputs = inputsOf();
    const theory = collisionModel.predict!(inputs);
    for (const dt of [0.0001, 0.001, 0.0137, 0.3, 7]) {
      const { state, time } = run(inputs, dt);
      expect(time).toBeCloseTo(1.125 + 0.6 / 0.24, 9); // 3.625 s
      expect(state[XB]).toBe(1.5 - 0.2 / 2); // the buffer face less half a glider
      expect(state[VA]!).toBeCloseTo(theory.velocityA!, 14);
      expect(state[VB]!).toBeCloseTo(theory.velocityB!, 14);
      expect(state[P]!).toBeCloseTo(theory.momentumAfter!, 14);
      expect(state[K]!).toBeCloseTo(theory.kineticAfter!, 14);
      expect(state[KEPT]!).toBeCloseTo(theory.kineticPercent!, 11);
      expect(state[GATE_A]!).toBeCloseTo(theory.gateTimeA!, 10);
      expect(state[GATE_B]!).toBeCloseTo(theory.gateTimeB!, 10);
      expect(collisionModel.step(state, dt, inputs)).toBe(0); // nothing after the end
    }
  });

  it('times each card as long as it really blocks the beam (brute-force count every 10 µs)', () => {
    // Kinematics written out: A at 0.15 + 0.4t until 1.125 s; B at 0.8 + 0.24(t − 1.125) after.
    const grid = 1e-5;
    let blockedA = 0;
    let blockedB = 0;
    for (let t = grid / 2; t < 3.625; t += grid) {
      if (t < 1.125 && Math.abs(0.15 + 0.4 * t - 0.35) < 0.05) blockedA += grid;
      if (t > 1.125 && Math.abs(0.8 + 0.24 * (t - 1.125) - 1) < 0.05) blockedB += grid;
    }
    const { state } = run(inputsOf(), 0.001);
    expect(Math.abs(state[GATE_A]! - blockedA)).toBeLessThan(2 * grid);
    expect(Math.abs(state[GATE_B]! - blockedB)).toBeLessThan(2 * grid);
  });

  it('starts the gate timers at 0 and counts only while a card is in the beam', () => {
    const state = new Float64Array(collisionModel.variables.length);
    const inputs = inputsOf();
    collisionModel.init(inputs, state);
    expect([state[GATE_A], state[GATE_B], state[COLLIDED], state[KEPT]]).toEqual([0, 0, 0, 100]);
    // At 0.4 m/s A's card reaches gate 1 after (0.35 − 0.05 − 0.15)/0.4 = 0.375 s.
    let t = 0;
    while (t < 0.375 - 1e-12) t += collisionModel.step(state, 0.01, inputs);
    expect(state[GATE_A]).toBe(0);
    expect(collisionModel.step(state, 0.01, inputs)).toBe(0.01); // the card is in the beam
    expect(state[GATE_A]!).toBeCloseTo(0.01, 12);
  });

  it('lets a light glider bounce back, a heavy one follow, an equal one stop (e = 1)', () => {
    const final = (massA: number) => run(inputsOf({ massA, restitution: 1 }), 0.001).state[VA]!;
    expect(final(0.2)).toBeLessThan(0);
    expect(final(0.3)).toBe(0);
    expect(final(0.5)).toBeGreaterThan(0);
  });

  it('carries the stuck pair on together at e = 0, A’s front against B’s back', () => {
    run(inputsOf({ restitution: 0 }), 0.001, (s) => {
      if (s[COLLIDED] === 1) expect(s[XB]! - s[XA]!).toBeCloseTo(0.2, 12);
    });
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = run(inputsOf(), 0.001).state;
    const b = run(inputsOf(), 0.001).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('collision inputs: refused with a reason, never clamped', () => {
  const init = (change: Record<string, number>) => () =>
    collisionModel.init(inputsOf(change), new Float64Array(collisionModel.variables.length));

  it('refuses missing, out-of-range and non-finite inputs', () => {
    const missing: Record<string, number> = inputsOf();
    delete missing.restitution;
    expect(() => collisionModel.predict!(missing)).toThrow(/"restitution" is missing/);
    expect(init({ restitution: 1.1 })).toThrow(/from 0 .* to 1/);
    expect(init({ restitution: -0.1 })).toThrow(/restitution/);
    expect(init({ massA: 0 })).toThrow(/"massA" must be above 0 kg/);
    expect(init({ speed: -0.3 })).toThrow(/"speed"/);
    expect(init({ speed: NaN })).toThrow(/"speed"/);
    expect(init({ gate2: Infinity })).toThrow(/"gate2"/);
  });

  it('refuses a layout in which a gate would not time one whole card', () => {
    expect(init({ flagLength: 0.3 })).toThrow(/card must not be longer/);
    expect(init({ startA: 0.05 })).toThrow(/A must start on the track/);
    expect(init({ gate1: 0.18 })).toThrow(/start before light gate 1/);
    expect(init({ gate1: 0.58 })).toThrow(/clear light gate 1 before A reaches/);
    expect(init({ gate2: 0.82 })).toThrow(/start clear of light gate 2/);
    expect(init({ gate2: 1.38 })).toThrow(/clear light gate 2 before B reaches the far end/);
  });

  it('refuses a glider A that would rebound into the launcher end before the run ends', () => {
    // 0.05 kg at e = 1: vA′ = −u·0.25/0.35, vB′ = u·0.1/0.35, so while B covers 0.6 m, A goes
    // back 1.5 m from 0.6 m.
    expect(init({ massA: 0.05, restitution: 1 })).toThrow(/bounce back into the launcher end/);
    // Lightest dial preset, most elastic: A ends at 0.6 − 0.2·0.6/0.8 = 0.45 m, back end 0.35 m.
    expect(init({ massA: 0.2, restitution: 1 })).not.toThrow();
  });
});

describe('collision in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'collision-test',
    name: 'Collision',
    category: 'physics',
    model: 'mechanics.collision',
    parameters: [
      { id: 'massA', label: 'm_A', unit: 'kg', default: 0.2, min: 0.2, max: 0.5 },
      { id: 'speed', label: 'u', unit: 'm/s', default: 0.3, min: 0.2, max: 0.5 },
      { id: 'restitution', label: 'e', unit: '', default: 1, min: 0, max: 1 },
    ],
    initialConditions: LAYOUT,
    simulation: { timeStep: 0.001, maxDuration: 15, sampleInterval: 0.01 },
    measurements: [{ id: 'momentum', label: 'p', unit: 'kg·m/s', variable: 'momentum' }],
    results: [
      ['momentumBefore', 'momentumBefore', 'momentumBefore'],
      ['momentumAfter', 'momentum', 'momentumAfter'],
      ['kineticBefore', 'kineticBefore', 'kineticBefore'],
      ['kineticAfter', 'kinetic', 'kineticAfter'],
      ['kineticPercent', 'kineticPercent', 'kineticPercent'],
      ['velocityA', 'velocityA', 'velocityA'],
      ['velocityB', 'velocityB', 'velocityB'],
      ['gateTimeA', 'gateTimeA', 'gateTimeA'],
      ['gateTimeB', 'gateTimeB', 'gateTimeB'],
    ].map(([id, variable, theory]) => ({
      id,
      label: id,
      unit: '',
      variable,
      reduce: 'final',
      theory,
    })),
  });
  const presets = {
    massA: [0.2, 0.3, 0.4, 0.5],
    speed: [0.2, 0.3, 0.4, 0.5],
    restitution: [1, 0.9, 0.5, 0],
  };
  const complete = (overrides: Record<string, number>) => {
    const r = new ExperimentRuntime('t', definition, collisionModel, overrides);
    r.runToCompletion();
    return r;
  };

  it('ends by the model within 15 s for every dial preset, every result on its theory', () => {
    let longest = 0;
    for (const massA of presets.massA) {
      for (const speed of presets.speed) {
        for (const restitution of presets.restitution) {
          const r = complete({ massA, speed, restitution });
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          const theory = r.theory()!;
          for (const [id, value] of Object.entries(r.results!)) {
            expect(value, `${id} at ${massA} kg, ${speed} m/s, e ${restitution}`).toBeCloseTo(
              theory[id]!,
              10,
            );
          }
          longest = Math.max(longest, r.time);
        }
      }
    }
    // The slowest pair: 0.2 kg at 0.2 m/s, stuck: 0.45/0.2 + 0.6/0.08 = 9.75 s.
    expect(longest).toBeCloseTo(9.75, 9);
  });

  it('fits p′ against p with slope 1 through 0, and E_k′ against E_k with the fraction kept', () => {
    const rows = presets.massA.flatMap((massA) =>
      presets.speed.map((speed) => complete({ massA, speed, restitution: 0.5 }).results!),
    );
    const momentum = fitLine(rows.map((r) => ({ x: r.momentumBefore!, y: r.momentumAfter! })));
    if (momentum.status !== 'fitted') throw new Error('no line');
    expect(momentum.slope).toBeCloseTo(1, 12);
    expect(momentum.intercept).toBeCloseTo(0, 12);

    const energyRows = presets.speed.map((speed) =>
      complete({ massA: 0.2, speed, restitution: 0.5 }),
    );
    const energy = fitLine(
      energyRows.map((r) => ({ x: r.results!.kineticBefore!, y: r.results!.kineticAfter! })),
    );
    if (energy.status !== 'fitted') throw new Error('no line');
    expect(energy.slope).toBeCloseTo(1 - (0.75 * 0.3) / 0.5, 12); // 0.55
    expect(energy.slope).toBeCloseTo(energyRows[0]!.theory()!.kineticSlope!, 12);
    expect(energy.intercept).toBeCloseTo(0, 12);
  });
});
