import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const VOLUME = 0;
const PH = 1;
const INFERRED = 2;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞). The upper limits only keep the arithmetic
 * finite — no acid or base comes near 100 mol/L, even undiluted — Kw spans liquid water from 0 to
 * 100 °C, and the endpoints are those of the indicators for a strong acid and a strong base, from
 * methyl red (4.4–6.2) to phenolphthalein (8.2–10).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['acidConcentration', (c) => c > 0 && c <= 100, 'above 0 and at most 100 mol/L'],
  ['acidVolume', (v) => v > 0 && v <= 1e6, 'above 0 and at most 1e6 mL'],
  ['baseConcentration', (c) => c > 0 && c <= 100, 'above 0 and at most 100 mol/L'],
  ['kw', (k) => k >= 1e-16 && k <= 1e-12, 'from 1e-16 to 1e-12 (mol/L)²'],
  ['flowRate', (q) => Number.isFinite(q) && q >= 0, 'finite and at least 0 mL/s'],
  ['endpointPH', (p) => p >= 4 && p <= 10, 'from 4 to 10'],
];

/** The pH for an excess of acid D = [Cl⁻] − [Na⁺] (mol/L): the root [H⁺] of h² − D·h − Kw = 0. */
function pHOf(excess: number, kw: number): number {
  const s = Math.sqrt(excess * excess + 4 * kw);
  // One root in two forms, as (D + s)(s − D) = 4Kw: each adds positive numbers, so neither
  // cancels, where (D + s)/2 alone loses its digits in excess base.
  return -Math.log10(excess >= 0 ? (excess + s) / 2 : (2 * kw) / (s - excess));
}

/**
 * The pH after `volume` mL of base, from the charge balance [H⁺] + [Na⁺] = [Cl⁻] + [OH⁻] with
 * [Cl⁻] = Ca·Va/(Va + V), [Na⁺] = Cb·V/(Va + V) and [OH⁻] = Kw/[H⁺]. A missing input reads as
 * NaN, never as a plausible default: init and predict refuse incomplete inputs first.
 */
export function titrationPH(inputs: Inputs, volume: number): number {
  const ca = inputs.acidConcentration ?? NaN;
  const va = inputs.acidVolume ?? NaN;
  const cb = inputs.baseConcentration ?? NaN;
  return pHOf((ca * va - cb * volume) / (va + volume), inputs.kw ?? NaN);
}

/**
 * The volume (mL) at which the pH reaches `endpointPH`: where the excess D(V) equals [H⁺] − [OH⁻]
 * at that pH, Va·(Ca − D)/(Cb + D). It is finite and positive exactly when the endpoint lies
 * between the starting pH and the pH that excess base tends to.
 */
function endpointVolume(inputs: Inputs): number {
  const h = 10 ** -(inputs.endpointPH ?? NaN);
  const excess = h - (inputs.kw ?? NaN) / h;
  const ca = inputs.acidConcentration ?? NaN;
  const cb = inputs.baseConcentration ?? NaN;
  return ((inputs.acidVolume ?? NaN) * (ca - excess)) / (cb + excess);
}

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Titration input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Titration input "${id}" must be ${rule}, got ${value}`);
  }
  const end = endpointVolume(inputs);
  if (!(end > 0 && end < Infinity)) {
    const start = titrationPH(inputs, 0).toFixed(2);
    const limit = pHOf(-(inputs.baseConcentration ?? NaN), inputs.kw ?? NaN).toFixed(2);
    throw new Error(
      `Titration endpoint pH ${inputs.endpointPH ?? NaN} is never reached: it must lie above ` +
        `the starting pH (${start}) and below the pH excess base tends to (${limit})`,
    );
  }
}

/**
 * A strong acid titrated with a strong base: HCl in the flask, NaOH from a burette at a constant
 * flow, until the indicator's endpoint. Chemistry's units (CLAUDE.md): volumes in mL,
 * concentrations in mol/L, the flow in mL/s, Kw in (mol/L)², time in s. Both dissociate fully,
 * volumes add and activities are concentrations, so the pH at any volume comes in closed form from
 * the charge balance (`titrationPH`): the step size changes where samples fall, never the curve.
 * A simplified teaching model, not a lab-grade one: no activity coefficients, no CO₂ from the air,
 * no drop size; stepped, it stops on the endpoint (no overshoot), driven it goes where it is fed. Kw is an input; at 25 °C it is 1.0·10⁻¹⁴ (pKw = 14.00 to two
 * decimals; 13.995 in the CRC Handbook of Chemistry and Physics, "Ion product of water").
 *
 * Equivalence, Ca·Va/Cb, is as much base as acid: pH = pKw/2 (7 at 25 °C), as Na⁺ and Cl⁻ leave
 * water neutral. The endpoint is where the pH reaches `endpointPH`; phenolphthalein's 8.2 needs
 * an excess of base, [OH⁻] − [H⁺] = 1.6·10⁻⁶ mol/L, so it comes 7.9·10⁻⁴ mL after equivalence for
 * 25 mL of 0.1 mol/L acid and base (0.079 mL at 0.001 mol/L). The run stops there: the last step
 * adds only what reaches it and returns the time that took. Completion is by volume, not by pH,
 * which can miss `endpointPH` by ~1e-11 either way. With no flow nothing is added, and the run
 * ends at its time limit.
 *
 * Variables: `volume` V of base added (mL), `pH`, and `inferredAcidConcentration` Cb·V/Va
 * (mol/L), the acid concentration the burette reading gives; at the endpoint it is the
 * titration's result: above the true Ca for an endpoint above pKw/2 (+0.003 % for pH 8.2 at
 * 0.1 mol/L, +0.3 % at 0.001), below it for one under (−0.087 % with methyl orange's 4.4 for
 * 25 mL of 0.085 mol/L acid and 0.1 mol/L base).
 */
export const titrationModel: SimulationModel = {
  id: 'acid-base.titration',
  inputs: ['acidConcentration', 'acidVolume', 'baseConcentration', 'kw', 'flowRate', 'endpointPH'],
  variables: ['volume', 'pH', 'inferredAcidConcentration'],
  predictions: ['equivalenceVolume', 'endpointVolume', 'equivalencePH', 'acidConcentration'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state[VOLUME] = 0;
    state[PH] = titrationPH(inputs, 0);
    state[INFERRED] = 0;
  },

  step(state, dt, inputs) {
    const volume = state[VOLUME] ?? 0;
    const end = endpointVolume(inputs);
    if (!(volume < end)) return 0; // the endpoint is reached: nothing more is added
    const flow = inputs.flowRate ?? NaN;
    const added = flow * dt;
    // The last step stops on the endpoint and takes only the time it needs.
    const reached = added >= end - volume;
    const next = reached ? end : volume + added;
    state[VOLUME] = next;
    state[PH] = titrationPH(inputs, next);
    state[INFERRED] = ((inputs.baseConcentration ?? NaN) * next) / (inputs.acidVolume ?? NaN);
    return reached ? (end - volume) / flow : dt;
  },

  isComplete: (state, inputs) => (state[VOLUME] ?? 0) >= endpointVolume(inputs),

  /**
   * Driven by the volume V (mL) of base run in from the burette, as the player opens and closes
   * its tap in a physical lab: the same closed form as a step, at any V ≥ 0, before or past the
   * endpoint (overshooting is the player's, and the reading shows it). It never ends by itself: the
   * player closes the tap and records the reading. The flow rate is not used (the tap feeds V).
   */
  driven: {
    variable: 'volume',
    set(state, inputs, volume) {
      if (!(volume >= 0 && volume < Infinity)) {
        throw new Error(`Titration: V = ${volume} mL must be finite and at least 0`);
      }
      state[VOLUME] = volume;
      state[PH] = titrationPH(inputs, volume);
      state[INFERRED] = ((inputs.baseConcentration ?? NaN) * volume) / (inputs.acidVolume ?? NaN);
      return false;
    },
  },

  /**
   * The theory, in closed form: the equivalence volume Ca·Va/Cb, the endpoint volume, the pH at
   * equivalence (no excess either way, so pKw/2) and the acid's true concentration Ca, which the
   * burette's `inferredAcidConcentration` is compared with.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const ca = inputs.acidConcentration ?? NaN;
    const equivalenceVolume = (ca * (inputs.acidVolume ?? NaN)) / (inputs.baseConcentration ?? NaN);
    return {
      equivalenceVolume,
      endpointVolume: endpointVolume(inputs),
      equivalencePH: pHOf(0, inputs.kw ?? NaN),
      acidConcentration: ca,
    };
  },
};
