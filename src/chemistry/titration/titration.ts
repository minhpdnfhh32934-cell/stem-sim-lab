import { z } from 'zod';
import raw from '@data/titration.json';
import {
  loadDataset,
  LocalizedTextSchema,
  ReviewStatusSchema,
  SourceSchema,
  type Source,
} from '@/core/data/dataset';

/**
 * Strong acid (HCl) in the flask titrated with a strong base (NaOH) from the burette, dilute ideal
 * solution at 25 °C. Concentrations in mol/L, volumes in mL (pH depends only on their ratios).
 */

const ColourSchema = z.object({ name: LocalizedTextSchema, css: z.string().min(1) });

const IndicatorSchema = z.object({
  id: z.string().min(1),
  name: LocalizedTextSchema,
  range: z.tuple([z.number(), z.number()]).refine(([lo, hi]) => lo < hi),
  acid: ColourSchema,
  base: ColourSchema,
  source: SourceSchema,
  display_source: SourceSchema,
  review_status: ReviewStatusSchema,
});
export type Indicator = z.infer<typeof IndicatorSchema>;

const WaterSchema = z.object({
  T_K: z.number(),
  pKw: z.number().positive(),
  uncertainty_pK: z.number().positive(),
  source: SourceSchema,
  density_source: SourceSchema,
  review_status: ReviewStatusSchema,
});

const dataset = loadDataset('titration', IndicatorSchema, raw);
const water = WaterSchema.parse((raw as { water: unknown }).water);

export const INDICATORS: readonly Indicator[] = dataset.items;
export const PKW = water.pKw;
export const KW = 10 ** -water.pKw;
export const PKW_UNCERTAINTY = water.uncertainty_pK;
export const TITRATION_SOURCES: Source[] = [
  water.source,
  water.density_source,
  ...new Map(
    INDICATORS.flatMap((i) => [i.source, i.display_source]).map((s) => [s.id, s]),
  ).values(),
];

export function indicatorOf(id: string): Indicator {
  return INDICATORS.find((i) => i.id === id) ?? (INDICATORS[0] as Indicator);
}

export interface Titration {
  /** Acid concentration C_a (mol/L) and volume V_a (mL) in the flask. */
  ca: number;
  va: number;
  /** Base concentration C_b (mol/L) in the burette. */
  cb: number;
}

/** V_eq = C_a·V_a / C_b (mL). */
export function equivalenceVolume(t: Titration): number {
  return (t.ca * t.va) / t.cb;
}

/**
 * [H⁺] (mol/L) after adding vb mL of base: the positive root of the charge balance
 * [H⁺] + [Na⁺] = [OH⁻] + [Cl⁻] with [OH⁻] = Kw/[H⁺], i.e. h² − D·h − Kw = 0 with
 * D = [Cl⁻] − [Na⁺]. Each sign of D uses the form without cancellation.
 */
export function hydrogenIon(t: Titration, vb: number, kw = KW): number {
  const d = (t.ca * t.va - t.cb * vb) / (t.va + vb);
  const root = Math.sqrt(d * d + 4 * kw);
  return d >= 0 ? (d + root) / 2 : (2 * kw) / (root - d);
}

export function pH(t: Titration, vb: number, kw = KW): number {
  return -Math.log10(hydrogenIon(t, vb, kw));
}

/**
 * Curve samples from 0 to vMax: an even grid plus points crowded around V_eq, where pH jumps
 * by several units within a few hundredths of a millilitre.
 */
export function curve(t: Titration, vMax: number, n = 400): { v: number[]; pH: number[] } {
  const veq = equivalenceVolume(t);
  const vs = new Set<number>();
  for (let i = 0; i <= n; i++) vs.add((vMax * i) / n);
  vs.add(veq);
  for (let k = 1; k <= 6; k += 0.25) {
    const dv = veq * 10 ** -k;
    vs.add(veq - dv);
    vs.add(veq + dv);
  }
  const v = [...vs].filter((x) => x >= 0 && x <= vMax).sort((a, b) => a - b);
  return { v, pH: v.map((x) => pH(t, x)) };
}

export type IndicatorPhase = 'acid' | 'transition' | 'base';

/**
 * Where a pH lies against an indicator's range, and the share of the base colour for the
 * illustrative mix (0 below the range, 1 above, linear inside it).
 */
export function indicatorAt(ind: Indicator, value: number): { phase: IndicatorPhase; mix: number } {
  const [lo, hi] = ind.range;
  if (value < lo) return { phase: 'acid', mix: 0 };
  if (value > hi) return { phase: 'base', mix: 1 };
  return { phase: 'transition', mix: (value - lo) / (hi - lo) };
}
