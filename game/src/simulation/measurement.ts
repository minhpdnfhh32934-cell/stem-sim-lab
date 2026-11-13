import type { ExperimentDefinition } from './experiment';
import type { RunData } from './RunRecord';

/*
 * How an instrument reads a simulated quantity. Four things are kept apart: the theory (the
 * model's closed form), the simulated value (the run's result: the true value of the measured
 * quantity here, never rounded or overwritten), the reading (that value as an instrument of
 * resolution d shows it) and the reading's standard uncertainty from that resolution alone.
 * A reading's rounding error lies within ±d/2; with nothing known about where, it is taken as
 * uniformly distributed (a rectangular distribution), whose standard deviation is u = d/√12.
 * That needs a linear scale, the same step d everywhere on it: every unit instruments read
 * (READING_UNITS) is one — pH too, a logarithm of the concentration but read on a meter that
 * steps in pH, and °C, whose steps are temperature differences.
 * The bound d/2 is a different quantity and is reported as such. Everything else a real
 * measurement adds (calibration, alignment, reaction time, …) is outside this model; each
 * instrument names what it leaves out.
 */

function checkResolution(d: number): void {
  if (!Number.isFinite(d) || d <= 0) {
    throw new RangeError(`A resolution must be a finite number above 0, not ${d}`);
  }
}

/** Decimal places of a resolution as written: 0.01 → 2, 0.25 → 2, 5 → 0, 1e-7 → 7. */
export function decimals(d: number): number {
  checkResolution(d);
  const [mantissa = '', exponent = '0'] = String(d).split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

/**
 * What an instrument of resolution d reads for a value: the nearest multiple of d. A value
 * half-way between two goes away from zero, so −x reads as minus the reading of x. The result
 * is the double nearest the decimal shown (0.3, not 0.30000000000000004), and never −0.
 */
export function quantize(value: number, d: number): number {
  checkResolution(d);
  if (!Number.isFinite(value)) throw new RangeError(`An instrument cannot read ${value}`);
  // Within a billionth of a step of half-way counts as half-way: binary rounding must not move
  // a decimal tie (1.005 is stored as 1.00499…, which a 0.01 scale still reads as 1.01).
  const steps = Math.floor(Math.abs(value) / d + 0.5 + 1e-9);
  if (!Number.isSafeInteger(steps)) {
    throw new RangeError(`${value} is too large to read in steps of ${d}`);
  }
  const reading = Number((steps * d).toFixed(decimals(d)));
  return value < 0 && reading !== 0 ? -reading : reading;
}

/** The standard uncertainty of a reading from the resolution alone: d/√12. */
export function resolutionUncertainty(d: number): number {
  checkResolution(d);
  return d / Math.sqrt(12);
}

/** The most a reading's rounding can be off by: d/2 (a bound, not a standard uncertainty). */
export function resolutionBound(d: number): number {
  checkResolution(d);
  return d / 2;
}

/** An uncertainty to two significant digits, as uncertainties are reported: 0.0028868 → "0.0029". */
export function formatUncertainty(u: number): string {
  if (!Number.isFinite(u) || u <= 0) throw new RangeError(`Not an uncertainty: ${u}`);
  const rounded = Number(u.toPrecision(2));
  return rounded.toFixed(Math.max(0, 1 - Math.floor(Math.log10(rounded))));
}

/** One instrument's reading of a completed run. */
export interface Reading {
  /** The result read; its simulated value is the true value of the measured quantity. */
  readonly result: string;
  /** "Range R". */
  readonly quantity: string;
  /** "Tape measure". */
  readonly instrument: string;
  readonly unit: string;
  /** Resolution d, from the run's own recorded inputs. */
  readonly resolution: number;
  /** The run's result, unrounded. */
  readonly simulated: number;
  readonly reading: number;
  /** The reading as the instrument shows it, in d's decimal places: "6.50". */
  readonly text: string;
  /** Standard uncertainty from the resolution: d/√12. */
  readonly uncertainty: number;
  /** The largest rounding error: d/2. */
  readonly bound: number;
  /** What a real measurement would add that this leaves out. */
  readonly excludes: string;
}

/**
 * The instruments' readings of a run, from the run's own results and recorded resolution, never
 * the current dials. None unless the run completed: an incomplete run measured nothing.
 */
export function readings(definition: ExperimentDefinition, run: RunData): Reading[] {
  const results = run.status === 'completed' ? run.results : null;
  if (!results) return [];
  return definition.instruments.map((instrument) => {
    const d = run.inputs[instrument.resolution] ?? NaN;
    const simulated = results[instrument.result] ?? NaN;
    const reading = quantize(simulated, d);
    return {
      result: instrument.result,
      quantity: instrument.quantity,
      instrument: instrument.name,
      unit: definition.results.find((r) => r.id === instrument.result)?.unit ?? '',
      resolution: d,
      simulated,
      reading,
      text: reading.toFixed(decimals(d)),
      uncertainty: resolutionUncertainty(d),
      bound: resolutionBound(d),
      excludes: instrument.excludes,
    };
  });
}

/** What "Check my answer" says: no completed run or no number yet, right, or not. */
export type AnswerCheck = 'incomplete' | 'correct' | 'incorrect';

/**
 * Checks a student's answer `text` for the answer result `resultId` of a completed run
 * (docs/experiments.md): correct when |x − truth| ≤ |x|·(d/2)/R, truth being the run's simulated
 * value, R and d the run's reading of the instrument on the result the answer is proportional to
 * and its resolution: x carries the share (d/2)/R of R's rounding. An x worked out from R lands
 * inside always (x − truth = x·(R − V)/R, |R − V| ≤ d/2); the brief's truth·(d/2)/R missed it
 * when R rounds up past V. A comma may stand for the decimal point. Pure: no expected value or
 * window leaves it.
 */
export function checkAnswer(
  definition: ExperimentDefinition,
  run: RunData,
  resultId: string,
  text: string,
): AnswerCheck {
  const answer = definition.results.find((r) => r.id === resultId)?.answer;
  const reading = readings(definition, run).find((r) => r.result === answer?.proportionalTo);
  const truth = run.results?.[resultId];
  const written = text.trim().replace(',', '.');
  const x = Number(written);
  if (!reading || truth === undefined || written === '' || !Number.isFinite(x)) {
    return 'incomplete';
  }
  // Multiplied out (no division by R), so a reading of 0 bounds nothing rather than giving NaN.
  return Math.abs(x - truth) * Math.abs(reading.reading) <= Math.abs(x) * reading.bound
    ? 'correct'
    : 'incorrect';
}
