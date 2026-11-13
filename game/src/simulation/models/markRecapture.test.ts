import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { chapman, chapmanError, lincolnPetersen, markRecaptureModel } from './markRecapture';

const slot = (variable: string) => markRecaptureModel.variables.indexOf(variable);
const CAUGHT = slot('caught');
const RECAPTURED = slot('recaptured');
const ELAPSED = slot('elapsed');

const T = 10;

const inputsOf = (change: Record<string, number> = {}) => ({
  populationSize: 400,
  marked: 50,
  caught: 60,
  sample: 1,
  drawTime: T,
  ...change,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state after each step. */
function draw(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(markRecaptureModel.variables.length);
  markRecaptureModel.init(inputs, state);
  let runTime = 0;
  for (let i = 0; i < 1e7 && !markRecaptureModel.isComplete!(state, inputs); i++) {
    runTime += markRecaptureModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, runTime };
}

/** ln C(n, k), by summing logs: independent of the model. */
function lnChoose(n: number, k: number): number {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

/** The hypergeometric pmf of R: C(M, r)·C(N − M, C − r)/C(N, C), for r = 0…min(M, C). */
function hypergeometric(n: number, m: number, c: number): number[] {
  const out: number[] = [];
  for (let r = 0; r <= Math.min(m, c); r++) {
    out.push(
      c - r > n - m ? 0 : Math.exp(lnChoose(m, r) + lnChoose(n - m, c - r) - lnChoose(n, c)),
    );
  }
  return out;
}

describe('mark–recapture estimates: worked by hand', () => {
  it('gives Lincoln–Petersen M·C/R and none while R = 0', () => {
    expect(lincolnPetersen(50, 40, 8)).toBe(250);
    expect(lincolnPetersen(50, 40, 0)).toBe(0);
  });

  it('gives Chapman’s (M + 1)(C + 1)/(R + 1) − 1 and Seber’s standard error', () => {
    expect(chapman(50, 40, 8)).toBeCloseTo((51 * 41) / 9 - 1, 12); // 231.333…
    expect(chapman(50, 40, 0)).toBe(51 * 41 - 1); // finite with no recapture
    // √(51·41·42·32/(81·10)) = √(2 810 304/810) = 58.9030…
    expect(chapmanError(50, 40, 8)).toBeCloseTo(Math.sqrt(2810304 / 810), 12);
    expect(chapmanError(50, 40, 40)).toBe(0); // every bean caught was marked
  });

  it('makes Chapman’s estimate exactly unbiased when M + C ≥ N (over the exact distribution of R)', () => {
    for (const [n, m, c] of [
      [50, 30, 25],
      [40, 12, 28],
      [400, 150, 250],
    ] as const) {
      const pmf = hypergeometric(n, m, c);
      const mean = pmf.reduce((s, p, r) => s + p * chapman(m, c, r), 0);
      expect(pmf.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 12);
      expect(mean).toBeCloseTo(n, 6);
    }
    // … and Lincoln–Petersen's, given R > 0, runs high in a small sample.
    const pmf = hypergeometric(400, 50, 60);
    const given = pmf.slice(1).reduce((s, p) => s + p, 0);
    const lp = pmf.reduce((s, p, r) => s + (r > 0 ? p * lincolnPetersen(50, 60, r) : 0), 0);
    expect(lp / given).toBeGreaterThan(400);
  });
});

describe('mark–recapture theory: the hypergeometric mean and variance', () => {
  it('matches the exact distribution’s moments', () => {
    for (const [populationSize, marked, caught] of [
      [400, 50, 60],
      [437, 80, 100],
      [40, 12, 15],
    ] as const) {
      const pmf = hypergeometric(populationSize, marked, caught);
      const mean = pmf.reduce((s, p, r) => s + p * r, 0);
      const variance = pmf.reduce((s, p, r) => s + p * (r - mean) ** 2, 0);
      const t = markRecaptureModel.predict!(inputsOf({ populationSize, marked, caught }));
      expect(t.expectedRecaptured).toBeCloseTo(mean, 9);
      expect(t.recapturedVariance).toBeCloseTo(variance, 9);
    }
  });
});

describe('mark–recapture drawing: a seeded draw without replacement', () => {
  it('draws R from the hypergeometric distribution (χ² over 4000 samples)', () => {
    const [n, m, c] = [40, 12, 15];
    const pmf = hypergeometric(n, m, c);
    const tally = pmf.map(() => 0);
    const samples = 4000;
    for (let sample = 1; sample <= samples; sample++) {
      const { state } = draw(inputsOf({ populationSize: n, marked: m, caught: c, sample }), T);
      tally[state[RECAPTURED]!]! += 1;
    }
    // Pearson's χ² over the bins expecting at least 5, the rest pooled into the last.
    let chi = 0;
    let bins = 0;
    let restObserved = 0;
    let restExpected = 0;
    pmf.forEach((p, r) => {
      const expected = samples * p;
      if (expected >= 5) {
        chi += (tally[r]! - expected) ** 2 / expected;
        bins++;
      } else {
        restObserved += tally[r]!;
        restExpected += expected;
      }
    });
    if (restExpected > 0) {
      chi += (restObserved - restExpected) ** 2 / restExpected;
      bins++;
    }
    expect(bins).toBeGreaterThanOrEqual(7);
    expect(chi).toBeLessThan(29.6); // χ² for ν ≤ 10 at p = 0.001
  });

  it('catches every marked bean when the whole jar is drawn: R = M and M·C/R = N', () => {
    const { state } = draw(inputsOf({ populationSize: 80, marked: 30, caught: 80 }), 0.02);
    expect(state[RECAPTURED]).toBe(30);
    expect(state[slot('lincolnPetersen')]).toBe(80);
    expect(state[slot('chapman')]).toBeCloseTo(80, 12); // M + C ≥ N: Chapman is exact here too
  });

  it('is the same bean k whatever C, the step or the frame', () => {
    let at40: number | null = null;
    draw(inputsOf({ sample: 3, caught: 100 }), 0.001, (s) => {
      if (s[CAUGHT] === 40 && at40 === null) at40 = s[RECAPTURED]!;
    });
    const { state } = draw(inputsOf({ sample: 3, caught: 40 }), 0.3);
    expect(state[RECAPTURED]).toBe(at40);
  });

  it('is deterministic, and another sample gives another catch', () => {
    const a = draw(inputsOf({ caught: 100 }), 0.02).state;
    const b = draw(inputsOf({ caught: 100 }), 0.02).state;
    expect(Array.from(a)).toEqual(Array.from(b));
    const others = [2, 3, 4, 5].map((sample) => {
      const { state } = draw(inputsOf({ caught: 100, sample }), 0.02);
      return state[RECAPTURED];
    });
    expect(others.some((r) => r !== a[RECAPTURED])).toBe(true);
  });
});

describe('mark–recapture estimates over many catches (the station’s jar and dials)', () => {
  it('holds N within Chapman’s N̂_C ± 2·SE in about 95 % of catches when R is not small', () => {
    // 437 beans (the station's jar), 80 marked, catches of 100: E[R] = 18.3.
    let held = 0;
    const catches = 2000;
    for (let sample = 1; sample <= catches; sample++) {
      const { state } = draw(inputsOf({ populationSize: 437, marked: 80, caught: 100, sample }), T);
      const estimate = state[slot('chapman')]!;
      const error = state[slot('chapmanError')]!;
      if (Math.abs(estimate - 437) <= 2 * error) held++;
    }
    expect(held / catches).toBeGreaterThan(0.92);
    expect(held / catches).toBeLessThan(0.985);
  });
});

describe('mark–recapture run: beans drawn one by one, then stopped at T', () => {
  it('draws the first bean at once, every value finite before it (no bean: −1)', () => {
    const inputs = inputsOf();
    const state = new Float64Array(markRecaptureModel.variables.length);
    markRecaptureModel.init(inputs, state);
    expect(Array.from(state).every(Number.isFinite)).toBe(true);
    expect([state[CAUGHT], state[slot('lastMarked')], state[slot('lincolnPetersen')]]).toEqual([
      0, -1, 0,
    ]);
    markRecaptureModel.step(state, 0.02, inputs);
    expect(state[CAUGHT]).toBe(1);
    expect([0, 1]).toContain(state[slot('lastMarked')]);
  });

  it('ends at T with the same counts whatever the step', () => {
    const inputs = inputsOf({ caught: 100, sample: 5 });
    const finals = [0.001, 0.02, 0.07, 0.3, 7, 20].map((dt) => {
      const { state, runTime } = draw(inputs, dt);
      expect(state[ELAPSED]).toBe(T);
      expect(runTime).toBeCloseTo(T, 9);
      return Array.from(state);
    });
    for (const f of finals) expect(f).toEqual(finals[0]);
    const { state } = draw(inputs, 0.02);
    expect(markRecaptureModel.step(state, 0.02, inputs)).toBe(0); // nothing after T
  });

  it('keeps its derived values true to its own counts at every step', () => {
    const inputs = inputsOf({ caught: 100, sample: 7 });
    draw(inputs, 0.05, (s) => {
      const n = s[CAUGHT]!;
      const r = s[RECAPTURED]!;
      expect(r).toBeLessThanOrEqual(Math.min(n, 50));
      expect(s[slot('unmarked')]).toBe(n - r);
      expect(s[slot('markedShare')]).toBe((100 * r) / n);
      expect(s[slot('lincolnPetersen')]).toBe(lincolnPetersen(50, n, r));
      expect(s[slot('chapman')]).toBe(chapman(50, n, r));
      expect(s[slot('chapmanError')]).toBe(chapmanError(50, n, r));
      expect(Array.from(s).every(Number.isFinite)).toBe(true);
    });
  });
});

describe('mark–recapture inputs: refused with a reason, never clamped, never naming N', () => {
  it('refuses missing, impossible and non-finite inputs', () => {
    const state = new Float64Array(markRecaptureModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.sample;
    expect(() => markRecaptureModel.init(missing, state)).toThrow(/"sample" is missing/);
    for (const marked of [0, 2.5, NaN]) {
      expect(() => markRecaptureModel.init(inputsOf({ marked }), state)).toThrow(/"marked"/);
    }
    expect(() => markRecaptureModel.init(inputsOf({ caught: 0 }), state)).toThrow(/"caught"/);
    expect(() => markRecaptureModel.init(inputsOf({ drawTime: 0 }), state)).toThrow(/drawTime/);
    expect(() => markRecaptureModel.init(inputsOf({ sample: -1 }), state)).toThrow(/"sample"/);
  });

  it('refuses marking or catching more beans than the jar holds, without saying how many', () => {
    expect(() => markRecaptureModel.predict!(inputsOf({ marked: 400 }))).toThrow(/mark fewer/);
    expect(() => markRecaptureModel.predict!(inputsOf({ caught: 401 }))).toThrow(/catch fewer/);
    try {
      markRecaptureModel.predict!(inputsOf({ caught: 401 }));
    } catch (error) {
      expect(String(error)).not.toMatch(/400/);
    }
  });
});

describe('mark–recapture in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'mark-recapture-test',
    name: 'Mark and recapture',
    category: 'biology',
    model: 'biology.mark-recapture',
    parameters: [
      { id: 'marked', label: 'M', unit: '', default: 50, min: 30, max: 80 },
      { id: 'caught', label: 'C', unit: '', default: 50, min: 30, max: 100 },
      { id: 'sample', label: 's', unit: '', default: 1, min: 1, max: 6 },
    ],
    initialConditions: { populationSize: 437, drawTime: T },
    inputs: { populationSize: { symbol: 'N', unit: '', hidden: true } },
    simulation: { timeStep: 0.02, maxDuration: 12, sampleInterval: 0.1 },
    measurements: [{ id: 'r', label: 'R', unit: '', variable: 'recaptured' }],
    results: [{ id: 'r', label: 'R', unit: '', variable: 'recaptured', reduce: 'final' }],
  });

  it('ends by itself at T with all C beans drawn, at every corner of the dials', () => {
    for (const marked of [30, 80]) {
      for (const caught of [30, 100]) {
        for (const sample of [1, 6]) {
          const r = new ExperimentRuntime('t', definition, markRecaptureModel, {
            marked,
            caught,
            sample,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeCloseTo(T, 9);
          expect(r.value('caught')).toBe(caught);
        }
      }
    }
  });
});
