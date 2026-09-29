import { z } from 'zod';
import raw from '@data/elements.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';

export const CATEGORIES = [
  'alkaliMetal',
  'alkalineEarthMetal',
  'transitionMetal',
  'postTransitionMetal',
  'metalloid',
  'nonmetal',
  'halogen',
  'nobleGas',
  'lanthanide',
  'actinide',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type SubshellLetter = 's' | 'p' | 'd' | 'f';

const ElementSchema = z.object({
  z: z.number().int().min(1).max(118),
  symbol: z.string().min(1).max(3),
  name: z.string().min(1),
  aliases_vi: z.array(z.string()),
  period: z.number().int().min(1).max(7),
  group: z.number().int().min(1).max(18).nullable(),
  block: z.enum(['s', 'p', 'd', 'f']),
  category: z.enum(CATEGORIES),
  atomic_weight: z.number().positive(),
  mass_number_only: z.boolean(),
  en_pauling: z.number().positive().nullable(),
  covalent_radius_pm: z.number().positive().nullable(),
  ionization_energy_ev: z.number().positive().nullable(),
  configuration: z.array(
    z.tuple([z.number().int().min(1), z.enum(['s', 'p', 'd', 'f']), z.number().int().min(1)]),
  ),
  noble_core: z.string().nullable(),
  cpk_color: z.string().nullable(),
  jmol_color: z.string().nullable(),
  review_status: ReviewStatusSchema,
});
export type ElementData = z.infer<typeof ElementSchema>;

const dataset = loadDataset('elements', ElementSchema, raw);

export const ELEMENTS: readonly ElementData[] = dataset.items;
export const ELEMENTS_SOURCE: Source = dataset.source;

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export function elementByZ(z: number): ElementData | undefined {
  return ELEMENTS[z - 1];
}

export function elementBySymbol(symbol: string): ElementData | undefined {
  return BY_SYMBOL.get(symbol);
}

const L_OF: Record<SubshellLetter, number> = { s: 0, p: 1, d: 2, f: 3 };
export const SUBSHELL_CAPACITY: Record<SubshellLetter, number> = { s: 2, p: 6, d: 10, f: 14 };

export type Subshell = [n: number, l: SubshellLetter, electrons: number];

/** Madelung (n + l, then n) order: the order electrons are usually written when filling. */
export function energyOrder(conf: readonly Subshell[]): Subshell[] {
  return [...conf].sort((a, b) => a[0] + L_OF[a[1]] - (b[0] + L_OF[b[1]]) || a[0] - b[0]);
}

/** Grouped by shell (n, then l): the order used for the final answer in Vietnamese textbooks. */
export function shellOrder(conf: readonly Subshell[]): Subshell[] {
  return [...conf].sort((a, b) => a[0] - b[0] || L_OF[a[1]] - L_OF[b[1]]);
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const superscript = (n: number) =>
  String(n)
    .split('')
    .map((d) => SUP[Number(d)] ?? d)
    .join('');

export function configString(conf: readonly Subshell[]): string {
  return conf.map(([n, l, k]) => `${n}${l}${superscript(k)}`).join(' ');
}

/** "[Ar] 3d⁵ 4s¹": the noble-gas core followed by the remaining subshells (shell order). */
export function shorthand(e: ElementData): string {
  const core = e.noble_core ? elementBySymbol(e.noble_core) : undefined;
  if (!core) return configString(shellOrder(e.configuration));
  const coreKeys = new Set(core.configuration.map(([n, l]) => `${n}${l}`));
  const rest = e.configuration.filter(([n, l, k]) => {
    const inCore = core.configuration.find(([cn, cl]) => cn === n && cl === l);
    return !(coreKeys.has(`${n}${l}`) && inCore?.[2] === k);
  });
  return `[${core.symbol}] ${configString(shellOrder(rest))}`.trim();
}

/** Electrons per shell n = 1, 2, 3… (from the data table). */
export function electronsPerShell(e: ElementData): number[] {
  const shells: number[] = [];
  for (const [n, , k] of e.configuration) shells[n - 1] = (shells[n - 1] ?? 0) + k;
  return shells;
}

/**
 * Ground-state configuration predicted by the Madelung (Aufbau) rule. Used ONLY to show
 * where the real configuration (data table) differs — never as the displayed answer.
 */
export function aufbauPrediction(z: number): Subshell[] {
  const order: [number, SubshellLetter][] = [];
  for (let sum = 1; sum <= 8; sum++) {
    for (let n = 1; n <= sum; n++) {
      const l = sum - n;
      const letter = (['s', 'p', 'd', 'f'] as const)[l];
      if (l < n && letter) order.push([n, letter]);
    }
  }
  const out: Subshell[] = [];
  let left = z;
  for (const [n, l] of order) {
    if (left <= 0) break;
    const k = Math.min(left, SUBSHELL_CAPACITY[l]);
    out.push([n, l, k]);
    left -= k;
  }
  return out;
}

/** True when the element's real configuration differs from the Aufbau prediction. */
export function isAufbauException(e: ElementData): boolean {
  const key = (c: readonly Subshell[]) =>
    shellOrder(c)
      .map(([n, l, k]) => `${n}${l}${k}`)
      .join(' ');
  return key(e.configuration) !== key(aufbauPrediction(e.z));
}

/** Hund's rule box diagram for one subshell: each box holds 0, 1 (↑) or 2 (↑↓) electrons. */
export function hundBoxes(l: SubshellLetter, electrons: number): number[] {
  const boxes = SUBSHELL_CAPACITY[l] / 2;
  return Array.from(
    { length: boxes },
    (_, i) => (electrons > i ? 1 : 0) + (electrons > boxes + i ? 1 : 0),
  );
}

export function unpairedElectrons(e: ElementData): number {
  return e.configuration.reduce(
    (sum, [, l, k]) => sum + hundBoxes(l, k).filter((b) => b === 1).length,
    0,
  );
}

/** Atomic weight as IUPAC prints it: a value, or [mass number] when there is no standard weight. */
export function formatAtomicWeight(e: ElementData, locale: 'vi' | 'en'): string {
  if (e.mass_number_only) return `[${Math.round(e.atomic_weight)}]`;
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 5,
  }).format(e.atomic_weight);
}
