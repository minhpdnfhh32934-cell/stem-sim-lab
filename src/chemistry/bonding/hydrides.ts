import { toSI } from '@/core/units';
import { elementBySymbol } from '../data/elements';
import { HYDRIDES, type BoilingPoint, type Hydride } from '../data/hydrides';

export const HYDRIDE_GROUPS = [14, 15, 16, 17] as const;
export type HydrideGroup = (typeof HYDRIDE_GROUPS)[number];
export const PERIODS = [2, 3, 4, 5] as const;

/** Normal boiling point in kelvin (°C values: + 273,15), or null when no source gives one. */
export function boilingPointK(h: Hydride): number | null {
  const bp = h.boiling_point;
  return bp ? toSI(bp.value, bp.unit) : null;
}

/**
 * Decimals the source printed ("111." → 0, "-33.35 °C" → 2, the book's "−161,58" → 2): a
 * converted value keeps them.
 */
export function decimalsOf(bp: BoilingPoint): number {
  return /^[-−+]?\d+[.,]?(\d*)/.exec(bp.as_given)?.[1]?.length ?? 0;
}

export function sourceDecimals(h: Hydride): number {
  return h.boiling_point ? decimalsOf(h.boiling_point) : 0;
}

/** A value in K or °C, rounded to the decimals its source printed. */
export function valueIn(bp: BoilingPoint, unit: 'K' | 'C'): number {
  const k = toSI(bp.value, bp.unit);
  const f = 10 ** decimalsOf(bp);
  return Math.round((unit === 'K' ? k : k - 273.15) * f) / f;
}

/** The shown boiling point in K or °C (see `valueIn`); null when missing. */
export function boilingPointIn(h: Hydride, unit: 'K' | 'C'): number | null {
  return h.boiling_point ? valueIn(h.boiling_point, unit) : null;
}

export interface HydridePoint {
  period: number;
  hydride: Hydride;
  kelvin: number | null;
}

/** The hydrides of one group in period order, group and period from data/elements.json. */
export function hydrideSeries(group: HydrideGroup): HydridePoint[] {
  return HYDRIDES.map((hydride) => ({ hydride, e: elementBySymbol(hydride.element) }))
    .filter((p) => p.e?.group === group)
    .map((p) => ({
      period: p.e?.period ?? 0,
      hydride: p.hydride,
      kelvin: boilingPointK(p.hydride),
    }))
    .sort((a, b) => a.period - b.period);
}

/**
 * The period-2 hydride boils higher than the period-3 one: against the trend of the heavier
 * hydrides (boiling point rising with the period). Null when a value is missing.
 */
export function period2Anomaly(group: HydrideGroup): boolean | null {
  const s = hydrideSeries(group);
  const p2 = s.find((p) => p.period === 2)?.kelvin ?? null;
  const p3 = s.find((p) => p.period === 3)?.kelvin ?? null;
  return p2 === null || p3 === null ? null : p2 > p3;
}

/** From period 3 on, every known value is higher than the one before (van der Waals trend). */
export function risesFromPeriod3(group: HydrideGroup): boolean {
  const k = hydrideSeries(group)
    .filter((p) => p.period >= 3 && p.kelvin !== null)
    .map((p) => p.kelvin ?? 0);
  return k.every((v, i) => i === 0 || v > (k[i - 1] ?? Infinity));
}
