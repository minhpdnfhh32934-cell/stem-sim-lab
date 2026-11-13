import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { buoyancyModel } from './buoyancy';

const v = (name: string) => buoyancyModel.variables.indexOf(name);
const DEPTH = v('depth');
const VOLUME = v('submergedVolume');
const BUOYANCY = v('buoyantForce');
const READING = v('reading');
const DENSITY = v('density');
const SINK = v('sinkOrFloat');

const WATER = 998.2;
const BRINE = 1197.2;
const ETHANOL = 789.3;
const SPEED = 0.01;
const CLEARANCE = 0.02;

const inputsOf = (change: Record<string, number> = {}) => ({
  objectDensity: 2700,
  fluidDensity: WATER,
  edgeLength: 0.03,
  gravity: 9.81,
  loweringSpeed: SPEED,
  clearance: CLEARANCE,
  ...change,
});

/** The model alone, stepped by `dt` run seconds until it stops; `each` sees the state. */
function lower(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(buoyancyModel.variables.length);
  buoyancyModel.init(inputs, state);
  each?.(state);
  let runTime = 0;
  for (let i = 0; i < 1e7 && !buoyancyModel.isComplete!(state, inputs); i++) {
    runTime += buoyancyModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, runTime };
}

/**
 * The buoyant force found another way: the net pressure force of the liquid on the cube's
 * faces. Gauge pressure ρ_f·g·z at depth z pushes up on the bottom (at depth h) and down on the
 * top (at h − a) once that is under; the side faces' forces cancel; nothing acts above the liquid.
 */
function pressureForce(rhoF: number, g: number, a: number, h: number): number {
  if (h <= 0) return 0;
  const bottom = rhoF * g * h * a * a;
  const top = h > a ? rhoF * g * (h - a) * a * a : 0;
  return bottom - top;
}

describe('buoyancy theory: Archimedes for a cube held fully under', () => {
  it('matches hand-worked values for an aluminium 3 cm cube in water', () => {
    const t = buoyancyModel.predict!(inputsOf());
    expect(t.volume).toBeCloseTo(2.7e-5, 15); // 0.03³ m³
    expect(t.mass).toBeCloseTo(0.0729, 12); // 2700 × 2.7e-5 kg
    expect(t.weight).toBeCloseTo(0.715149, 12); // 0.0729 × 9.81 N
    expect(t.buoyantForce).toBeCloseTo(0.264393234, 12); // 998.2 × 2.7e-5 × 9.81 N
    expect(t.apparentWeight).toBeCloseTo(0.450755766, 12); // W − F_b
    expect(t.fluidWeightDensity).toBeCloseTo(9792.342, 9); // 998.2 × 9.81 N/m³
    expect([t.density, t.sinkOrFloat, t.fullDepth]).toEqual([2700, 1, 0.03]);
  });

  it('matches hand-worked values for a copper 4 cm cube in salt water', () => {
    const t = buoyancyModel.predict!(
      inputsOf({ objectDensity: 8960, fluidDensity: BRINE, edgeLength: 0.04 }),
    );
    expect(t.mass).toBeCloseTo(0.57344, 12); // 8960 × 6.4e-5 kg
    expect(t.weight).toBeCloseTo(5.6254464, 12);
    expect(t.buoyantForce).toBeCloseTo(0.751650048, 12); // 1197.2 × 6.4e-5 × 9.81 N
    expect(t.apparentWeight).toBeCloseTo(4.873796352, 12);
  });

  it('reproduces the textbook crown: 7.84 N in air, 6.84 N in water, 7.84e3 kg/m³', () => {
    // Serway & Jewett, Physics for Scientists and Engineers, ch. 14, Example "Eureka!": g = 9.80,
    // water 1000 kg/m³; F_b = 1.00 N gives V = 1.00/(1000 × 9.80) m³ and ρ = 7.84/(9.80·V).
    const volume = 1 / (1000 * 9.8);
    const t = buoyancyModel.predict!(
      inputsOf({
        objectDensity: 7840,
        fluidDensity: 1000,
        gravity: 9.8,
        edgeLength: Math.cbrt(volume),
      }),
    );
    expect(t.weight).toBeCloseTo(7.84, 12);
    expect(t.apparentWeight).toBeCloseTo(6.84, 12);
    expect(t.buoyantForce).toBeCloseTo(1, 12);
    expect(t.weight! / 9.8 / t.volume!).toBeCloseTo(7840, 6); // m/V
  });

  it('sinks or floats by the densities alone, whatever the size', () => {
    const sign = (objectDensity: number, fluidDensity: number, edgeLength = 0.03) =>
      buoyancyModel.predict!(inputsOf({ objectDensity, fluidDensity, edgeLength })).sinkOrFloat;
    expect(sign(905, WATER)).toBe(-1); // polypropylene floats in water…
    expect(sign(905, ETHANOL)).toBe(1); // …and sinks in ethanol
    expect(sign(1140, WATER, 0.02)).toBe(1); // nylon sinks in water…
    expect(sign(1140, BRINE, 0.04)).toBe(-1); // …and floats in salt water
    expect(sign(1000, 1000)).toBe(0); // neither: W = F_b exactly
    const neutral = buoyancyModel.predict!(inputsOf({ objectDensity: 1000, fluidDensity: 1000 }));
    expect(Object.is(neutral.apparentWeight, 0)).toBe(true);
  });

  it('gives F_b against V a slope ρ_f·g over blocks of any material in one liquid', () => {
    const points = [905, 1140, 2700, 8960].flatMap((objectDensity) =>
      [0.02, 0.03, 0.04].map((edgeLength) => {
        const t = buoyancyModel.predict!(
          inputsOf({ objectDensity, edgeLength, fluidDensity: BRINE }),
        );
        return { x: t.volume!, y: t.buoyantForce! };
      }),
    );
    const fit = fitLine(points);
    if (fit.status !== 'fitted') throw new Error('no line');
    expect(fit.slope).toBeCloseTo(1197.2 * 9.81, 6); // 11744.532 N/m³
    expect(fit.intercept).toBeCloseTo(0, 12);
  });
});

describe('buoyancy run: lowered at a steady speed, the state a function of the depth', () => {
  it('has the buoyant force of the pressure on the faces at every depth', () => {
    let checked = 0;
    for (const a of [0.02, 0.04]) {
      lower(inputsOf({ edgeLength: a, fluidDensity: BRINE }), 0.01, (s) => {
        const h = s[DEPTH]!;
        expect(s[BUOYANCY]!).toBeCloseTo(pressureForce(BRINE, 9.81, a, h), 12);
        expect(s[VOLUME]!).toBeCloseTo(a * a * Math.min(Math.max(h, 0), a), 15);
        checked++;
      });
    }
    expect(checked).toBe(601 + 801); // (a + 2c)/v run seconds in 0.01 s steps, plus the start
  });

  it('reads W in air, then less as it goes in, then a constant W − F_b once under', () => {
    const inputs = inputsOf();
    const t = buoyancyModel.predict!(inputs);
    let previous = Infinity;
    lower(inputs, 0.01, (s) => {
      const h = s[DEPTH]!;
      expect(s[READING]!).toBeLessThanOrEqual(previous);
      previous = s[READING]!;
      if (h <= 0) expect(s[READING]).toBeCloseTo(t.weight!, 12);
      if (h >= 0.03) {
        expect(s[READING]).toBeCloseTo(t.apparentWeight!, 12);
        expect(s[VOLUME]).toBeCloseTo(2.7e-5, 15); // all of it, however deep
      }
    });
  });

  it('crosses 0 N where a floating block would float: at a·ρ/ρ_f', () => {
    // Polypropylene in water, and the textbook iceberg: ice 917 in sea water 1030 kg/m³ floats
    // 0.890 under (Serway & Jewett, ch. 14, Example "A Titanic Surprise").
    for (const [rho, rhoF, fraction] of [
      [905, WATER, 905 / 998.2],
      [917, 1030, 0.89029],
    ] as const) {
      let before: [number, number] | null = null;
      let crossing = NaN;
      lower(inputsOf({ objectDensity: rho, fluidDensity: rhoF, edgeLength: 0.04 }), 0.07, (s) => {
        const at: [number, number] = [s[DEPTH]!, s[READING]!];
        if (before && before[1] > 0 && at[1] <= 0) {
          // The reading is linear in h between contact and full immersion: interpolate.
          crossing = before[0] - (before[1] * (at[0] - before[0])) / (at[1] - before[1]);
        }
        before = at;
      });
      expect(crossing / 0.04).toBeCloseTo(fraction, 5);
    }
  });

  it('gives m/V: 0 in air, more than ρ while partly under, ρ once fully under', () => {
    lower(inputsOf(), 0.01, (s) => {
      const h = s[DEPTH]!;
      if (h <= 0) expect(s[DENSITY]).toBe(0);
      else if (h < 0.03) expect(s[DENSITY]!).toBeCloseTo((2700 * 0.03) / h, 6);
      else expect(s[DENSITY]!).toBeCloseTo(2700, 9);
    });
  });

  it('ends with the top c under, whatever the step, with the theory’s values', () => {
    const inputs = inputsOf({ objectDensity: 905 });
    const t = buoyancyModel.predict!(inputs);
    for (const dt of [0.001, 0.01, 0.07, 0.3, 7]) {
      const { state, runTime } = lower(inputs, dt);
      expect(state[DEPTH]).toBe(0.05); // a + c
      expect(runTime).toBeCloseTo(0.07 / SPEED, 9); // (a + 2c)/v = 7 s
      expect(state[READING]).toBeCloseTo(t.apparentWeight!, 12);
      expect(state[SINK]).toBe(-1);
      expect(buoyancyModel.step(state, dt, inputs)).toBe(0); // nothing after the end
    }
  });

  it('starts at depth 0, not −0, with no clearance', () => {
    const state = new Float64Array(buoyancyModel.variables.length);
    buoyancyModel.init(inputsOf({ clearance: 0 }), state);
    expect(Object.is(state[DEPTH], 0)).toBe(true);
    expect([state[VOLUME], state[BUOYANCY], state[DENSITY], state[SINK]]).toEqual([0, 0, 0, 1]);
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = lower(inputsOf({ fluidDensity: BRINE }), 0.01).state;
    const b = lower(inputsOf({ fluidDensity: BRINE }), 0.01).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('buoyancy inputs: refused with a reason, never clamped', () => {
  it('refuses missing, out-of-range and non-finite inputs', () => {
    const state = new Float64Array(buoyancyModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.fluidDensity;
    expect(() => buoyancyModel.init(missing, state)).toThrow(/"fluidDensity" is missing/);
    expect(() => buoyancyModel.predict!(inputsOf({ objectDensity: 0 }))).toThrow(/above 0/);
    expect(() => buoyancyModel.predict!(inputsOf({ objectDensity: 3e4 }))).toThrow(/osmium/);
    expect(() => buoyancyModel.init(inputsOf({ edgeLength: NaN }), state)).toThrow(/edgeLength/);
    expect(() => buoyancyModel.init(inputsOf({ gravity: Infinity }), state)).toThrow(/gravity/);
    expect(() => buoyancyModel.init(inputsOf({ clearance: -0.01 }), state)).toThrow(/clearance/);
  });

  it('refuses a gas for the liquid, and a lowering too fast to leave out drag', () => {
    expect(() => buoyancyModel.predict!(inputsOf({ fluidDensity: 1.2 }))).toThrow(/a liquid's/);
    expect(() => buoyancyModel.predict!(inputsOf({ loweringSpeed: 0.05 }))).toThrow(/drag/);
  });
});

describe('buoyancy in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'buoyancy-test',
    name: 'Buoyancy',
    category: 'physics',
    model: 'mechanics.buoyancy',
    parameters: [
      { id: 'objectDensity', label: 'ρ', unit: 'kg/m³', default: 2700, min: 905, max: 8960 },
      { id: 'fluidDensity', label: 'ρ_f', unit: 'kg/m³', default: WATER, min: ETHANOL, max: BRINE },
      { id: 'edgeLength', label: 'a', unit: 'm', default: 0.03, min: 0.02, max: 0.04 },
    ],
    initialConditions: { gravity: 9.81, loweringSpeed: SPEED, clearance: CLEARANCE },
    simulation: { timeStep: 0.01, maxDuration: 10, sampleInterval: 0.05 },
    measurements: [{ id: 'reading', label: 'F', unit: 'N', variable: 'reading' }],
    results: [
      ...(
        [
          ['weightInAir', 'reading', 'max', 'weight'],
          ['apparentWeight', 'reading', 'final', 'apparentWeight'],
          ['buoyantForce', 'buoyantForce', 'final', 'buoyantForce'],
          ['displacedVolume', 'submergedVolume', 'final', 'volume'],
          ['mass', 'mass', 'final', 'mass'],
          ['density', 'density', 'final', 'density'],
          ['sinkOrFloat', 'sinkOrFloat', 'final', 'sinkOrFloat'],
        ] as const
      ).map(([id, variable, reduce, theory]) => ({
        id,
        label: id,
        unit: '',
        variable,
        reduce,
        theory,
      })),
    ],
  });

  it('ends by itself after (a + 2c)/v with every result equal to its theory', () => {
    for (const objectDensity of [905, 1140, 2700, 8960]) {
      for (const fluidDensity of [ETHANOL, WATER, 1024.8, BRINE]) {
        for (const edgeLength of [0.02, 0.03, 0.04]) {
          const r = new ExperimentRuntime('t', definition, buoyancyModel, {
            objectDensity,
            fluidDensity,
            edgeLength,
          });
          r.runToCompletion();
          expect([r.status, r.endReason]).toEqual(['completed', 'model']);
          expect(r.time).toBeCloseTo((edgeLength + 2 * CLEARANCE) / SPEED, 9);
          const theory = r.theory()!;
          for (const result of definition.results) {
            expect(r.results![result.id]).toBeCloseTo(theory[result.theory!]!, 9);
          }
        }
      }
    }
  });
});
