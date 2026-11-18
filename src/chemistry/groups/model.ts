import { z } from 'zod';
import raw from '@data/metal_groups_kntt.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';

/**
 * Hóa học 12 KNTT Bài 24 "Nguyên tố nhóm IA", Bài 25 "Nguyên tố nhóm IIA" and Bài 27 "Đại cương
 * về kim loại chuyển tiếp dãy thứ nhất": the books' tables (24.1–24.3, 25.1–25.4, 27.1–27.4),
 * trends down a group, solubility classes (tr. 120), the FeSO₄ titration (tr. 132) and the
 * configurations of transition-metal ions (4s electrons leave first, tr. 131). Data:
 * data/metal_groups_kntt.json (scripts/data/gen_metal_groups_kntt.py; review pending,
 * DATA_REVIEW HH12-GRP-1).
 */
const Text = z.object({ vi: z.string(), en: z.string() });
const SBlockSchema = z.object({
  id: z.string().min(1),
  group: z.enum(['IA', 'IIA']),
  Z: z.number().int(),
  name: z.string(),
  configuration: z.string(),
  radius_pm: z.number(),
  E_V: z.number(),
  mp_C: z.number(),
  bp_C: z.number(),
  density: z.number(),
  hardness: z.number().nullable(),
  water: Text.nullable(),
  flame: Text.nullable(),
  review_status: ReviewStatusSchema,
});
const Metals4 = z.record(z.string(), z.number());
const ExtraSchema = z.object({
  hydroxide_solubility: Metals4,
  salt_solubility: z.record(z.string(), Metals4),
  solubility_at_30C: z.array(z.tuple([z.string(), z.string()])),
  insoluble_max: z.number(),
  slightly_soluble_max: z.number(),
  table_25_4: z.record(z.string(), z.string()),
  carbonate_dH_kJ: Metals4,
  nitrate_dH_kJ: Metals4,
  transition: z.array(
    z.object({
      id: z.string(),
      Z: z.number().int(),
      configuration: z.string(),
      mp_C: z.number(),
      density: z.number(),
      conductivity: z.number(),
      thermal: z.number(),
      hardness: z.number().nullable(),
      oxidation_states: z.array(z.number().int()),
      review_status: ReviewStatusSchema,
    }),
  ),
  s_block_compare: z.record(
    z.string(),
    z.object({ conductivity: z.number(), hardness: z.number() }),
  ),
  be_melting_point_C: z.number(),
  heavy_metal_min_density: z.number(),
  titration: z.object({
    kmno4_M: z.number(),
    feso4_mL: z.number(),
    feso4_approx_M: z.number(),
    ratio_fe_per_mno4: z.number(),
    equation: z.string(),
  }),
});

const dataset = loadDataset('metal_groups_kntt', SBlockSchema, raw);
const extra = ExtraSchema.parse(raw);

export type SBlockMetal = z.infer<typeof SBlockSchema>;
export type TransitionMetal = (typeof extra.transition)[number];
export const GROUPS_SOURCE: Source = dataset.source;
export const GROUP_IA: readonly SBlockMetal[] = dataset.items.filter((m) => m.group === 'IA');
export const GROUP_IIA: readonly SBlockMetal[] = dataset.items.filter((m) => m.group === 'IIA');
export const TRANSITION: readonly TransitionMetal[] = extra.transition;
export const HYDROXIDE_SOLUBILITY = extra.hydroxide_solubility;
export const SALT_SOLUBILITY = extra.salt_solubility;
export const SOLUBILITY_AT_30C = extra.solubility_at_30C;
export const INSOLUBLE_MAX = extra.insoluble_max;
export const SLIGHTLY_SOLUBLE_MAX = extra.slightly_soluble_max;
export const TABLE_25_4 = extra.table_25_4;
export const CARBONATE_DH = extra.carbonate_dH_kJ;
export const NITRATE_DH = extra.nitrate_dH_kJ;
export const S_BLOCK_COMPARE = extra.s_block_compare;
export const BE_MELTING_POINT = extra.be_melting_point_C;
export const HEAVY_METAL_MIN_DENSITY = extra.heavy_metal_min_density;
export const TITRATION = extra.titration;

/* ───────── Trends ───────── */

export type Trend = 'up' | 'down' | 'uneven';

/** How a property changes down the list: always growing, always falling, or neither. */
export function trend(values: readonly number[]): Trend {
  const steps = values.slice(1).map((v, i) => v - (values[i] ?? v));
  if (steps.every((d) => d > 0)) return 'up';
  if (steps.every((d) => d < 0)) return 'down';
  return 'uneven';
}

/* ───────── Solubility (tr. 120) ───────── */

export type SolubilityClass = 'T' | 'I' | 'K';

/** "Chất không tan" up to 0,01, "ít tan" up to 1, "dễ tan" above (g/100 g water). */
export function solubilityClass(s: number): SolubilityClass {
  return s <= INSOLUBLE_MAX ? 'K' : s <= SLIGHTLY_SOLUBLE_MAX ? 'I' : 'T';
}

export const IIA_SALT_METALS = ['Mg', 'Ca', 'Sr', 'Ba'] as const;
export const ANIONS = ['CO3', 'SO4', 'NO3', 'OH'] as const;
export type Anion = (typeof ANIONS)[number];

/** Solubility of M with the anion (g/100 g water), from the book's two tables. */
export function solubility(metal: string, anion: Anion): number | undefined {
  return anion === 'OH' ? HYDROXIDE_SOLUBILITY[metal] : SALT_SOLUBILITY[anion]?.[metal];
}

/** The compound's formula as text the formula reader reads ("CaSO4", "Mg(OH)2", "Ba(NO3)2"). */
export function compoundFormula(metal: string, anion: Anion): string {
  if (anion === 'CO3' || anion === 'SO4') return `${metal}${anion}`;
  return `${metal}(${anion})2`;
}

/* ───────── Transition metals ───────── */

/**
 * The configuration of Mⁿ⁺ from the atom's (Bảng 27.1): the 4s electrons leave first, then 3d
 * (tr. 131: Fe → Fe²⁺ [Ar]3d⁶, Fe³⁺ [Ar]3d⁵). Null when the atom has fewer electrons to give.
 */
export function ionConfiguration(configuration: string, charge: number): string | null {
  const m = /^\[Ar\]3d(\d+)4s(\d+)$/.exec(configuration);
  if (!m) return null;
  let d = Number(m[1]);
  let s = Number(m[2]);
  let left = charge;
  const fromS = Math.min(s, left);
  s -= fromS;
  left -= fromS;
  if (left > d) return null;
  d -= left;
  return `[Ar]3d${d}${s > 0 ? `4s${s}` : ''}`;
}

/** tr. 132: C(FeSO₄) = 5·C(KMnO₄)·V(KMnO₄)/V(FeSO₄), from 10FeSO₄ + 2KMnO₄ + 8H₂SO₄ → … */
export function feso4Concentration(vKmno4_mL: number): number {
  const t = TITRATION;
  return (t.ratio_fe_per_mno4 * t.kmno4_M * vKmno4_mL) / t.feso4_mL;
}
