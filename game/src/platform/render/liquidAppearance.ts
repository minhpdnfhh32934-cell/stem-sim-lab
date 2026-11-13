import type { Contents } from '../../simulation/liquid';
import {
  CRYSTAL_VIOLET,
  hexToLinear,
  INDICATORS,
  indicatorFor,
  indicatorTint,
  type Rgb,
} from '../labVisuals/chemistry';

/**
 * How the liquid in a container looks, by the model of its station (a registry like the bench
 * models: a lookup by key, never by entity or content id). The colour comes from the model's own
 * state, never from a number worked out here from the contents: a mixture is drawn from the run's
 * `sample`; a solution that is only a stock is drawn from the stock material's preset (its label
 * value, `sets`), as the 2D bench does. Without a run a mixture has no model state to read: it is
 * drawn clear ("no reading", as `violetDepth(NaN)` does), never guessed. A drawing of the model's
 * absorbance, not a colour measurement.
 */

/** What a look reads, all of it live and read-only. */
export interface LiquidInput {
  /** The container's contents (integer µL by material id). */
  contents: Readonly<Contents>;
  /** The station's model variables now: NaN without a run. */
  sample: Readonly<Record<string, number>>;
  /** The settings drawn: the run's own inputs while a run exists, else the dials. */
  parameters: Readonly<Record<string, number>>;
  /** A material's preset (the parameter it sets and its value), or undefined. */
  readonly sets: (
    material: string,
  ) => { readonly parameter: string; readonly value: number } | undefined;
}

export interface LiquidAppearance {
  /** The light left (linear, per channel) through a fully absorbing path: the dye's colour. */
  readonly dye: Rgb;
  /**
   * The absorbance seen across `width` m of the liquid (0 for a clear one, NaN if the model has
   * nothing to say). Allocation-free.
   */
  absorbance(input: LiquidInput, width: number): number;
  /**
   * For a liquid whose colour is not one dye's depth (an indicator, acid form to base form): the
   * light left through the whole path, per channel (linear), written to `out`; returns what the
   * colour was made from (NaN: no reading, drawn clear), so a view redraws only when it moves.
   * Used instead of `absorbance` where present. Allocation-free.
   */
  transmittance?(input: LiquidInput, out: [number, number, number]): number;
}

/** L/(mol·m): the dilution definition's own value, used when a run's inputs do not carry it. */
// shortcut: as the 2D dilution bench's default; read the definition if a station ever changes it.
const DEFAULT_ABSORPTIVITY = 1e7;

const DYE: [number, number, number] = [1, 1, 1];
hexToLinear(CRYSTAL_VIOLET, DYE);

/** `chemistry.dilution`: crystal violet at 590 nm, A = ε·C·w (Beer–Lambert). */
const dilution: LiquidAppearance = {
  dye: DYE,
  absorbance({ contents, sample, parameters, sets }, width) {
    let stock: number | undefined;
    let materials = 0;
    for (const id in contents) {
      materials++;
      const preset = sets(id);
      if (preset?.parameter === 'stockConcentration') stock = preset.value;
    }
    if (stock === undefined) return 0; // water: no dye
    // Only the stock: its labelled concentration. Anything else in with it: the run's (the model's).
    const c = materials > 1 ? (sample.concentration ?? NaN) : stock;
    return (parameters.absorptivity ?? DEFAULT_ABSORPTIVITY) * c * width;
  },
};

/**
 * `acid-base.titration`: the indicator in the flask (the material that sets `endpointPH`), at the
 * run's pH: its acid form to its base form by the fraction the 2D rig draws (`indicatorTint`).
 * Without a run the acid sample alone has the acid form; anything with base in it but no run has
 * no reading (drawn clear, as a mixture with no model state). An indicator on its own, the acid,
 * the base: clear.
 */
const titration: LiquidAppearance = {
  dye: [1, 1, 1],
  absorbance: () => 0,
  transmittance({ contents, sample, sets }, out) {
    out[0] = out[1] = out[2] = 1;
    let endpoint: number | undefined;
    let base = false;
    let others = 0;
    for (const id in contents) {
      const preset = sets(id);
      if (preset?.parameter === 'endpointPH') endpoint = preset.value;
      else others++;
      if (preset?.parameter === 'baseConcentration') base = true;
    }
    if (endpoint === undefined || others === 0) return 0;
    const pH = sample.pH ?? NaN;
    if (base && Number.isNaN(pH)) return NaN;
    const indicator = indicatorFor(endpoint);
    indicatorTint(indicator, pH, out);
    // What the colour is made from: the indicator and its pH (the acid form without a run).
    return INDICATORS.indexOf(indicator) * 100 + (Number.isNaN(pH) ? -1 : pH);
  },
};

const LOOKS: Readonly<Record<string, LiquidAppearance>> = {
  'chemistry.dilution': dilution,
  'acid-base.titration': titration,
};

/** The appearance registered for a model id, or undefined (its liquid is then drawn clear). */
export const appearanceOf = (model: string): LiquidAppearance | undefined =>
  Object.hasOwn(LOOKS, model) ? LOOKS[model] : undefined;

/**
 * The filter's colour for an absorbance: the light behind it times 1 − depth + depth·dye, with
 * depth = 1 − 10^−A (the 2D bench's mapping, `violetDepth`); none for no reading. The filter is
 * drawn on both faces of a closed shell, so each face takes the square root: a path through it
 * is the whole.
 */
export function tintOf(
  appearance: LiquidAppearance | undefined,
  absorbance: number,
  out: [number, number, number],
): void {
  const depth = appearance && Number.isFinite(absorbance) ? 1 - 10 ** -Math.max(absorbance, 0) : 0;
  const dye = appearance?.dye ?? DYE;
  for (let i = 0; i < 3; i++) out[i] = Math.sqrt(1 + depth * ((dye[i] ?? 1) - 1));
}
