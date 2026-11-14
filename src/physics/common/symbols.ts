import type { Locale } from '@/app/i18n/types';
import type { LocalizedText } from '@/core/data/dataset';

/**
 * Physics symbols written differently in the Vietnamese textbook (SGK, kept as is) and in English
 * textbooks (Halliday): user decision 14/11/2026, #258. KaTeX source, [vi, en]. A symbol not
 * listed here is the same in both languages.
 */
const TABLE = {
  kinetic: ['W_{\\text{đ}}', 'K'],
  potential: ['W_t', 'U'],
  mechanical: ['W', 'E'],
  work: ['A', 'W'],
  workPull: ['A_F', 'W_F'],
  workWeight: ['A_P', 'W_g'],
  workFriction: ['A_{ms}', 'W_f'],
  workNormal: ['A_N', 'W_N'],
  weight: ['P', 'F_g'],
  weightVec: ['\\vec{P}', '\\vec{F}_g'],
  power: ['\\mathscr{P}', 'P'],
  efficiency: ['H', '\\eta'],
  friction: ['F_{ms}', 'f'],
  kineticFriction: ['F_{ms,t}', 'f_k'],
  staticFriction: ['F_{ms,n}', 'f_s'],
  muKinetic: ['\\mu_t', '\\mu_k'],
  muStatic: ['\\mu_n', '\\mu_s'],
  netForceVec: ['\\vec{F}_{hl}', '\\vec{F}_{net}'],
  drive: ['F_{\\text{kéo}}', 'F_{drive}'],
  springForce: ['F_{\\text{đh}}', 'F_s'],
  centripetalForce: ['F_{ht}', 'F_c'],
  centripetalAccel: ['a_{ht}', 'a_c'],
  angle0: ['\\alpha_{\\text{bđ}}', '\\alpha_i'],
  omega0: ['\\omega_{\\text{bđ}}', '\\omega_i'],
  angleApprox: ['\\alpha_{\\text{gđ}}', '\\alpha_{\\text{approx}}'],
  seriesR: ['R_{nt}', 'R_s'],
  parallelR: ['R_{ss}', 'R_p'],
  sourcePower: ['P_{ng}', 'P_{emf}'],
} as const satisfies Record<string, readonly [string, string]>;

export type SymbolId = keyof typeof TABLE;
export type Symbols = Record<SymbolId, string>;

const side = (i: 0 | 1): Symbols =>
  Object.fromEntries(Object.entries(TABLE).map(([id, pair]) => [id, pair[i]])) as Symbols;
const BY_LOCALE: Record<Locale, Symbols> = { vi: side(0), en: side(1) };

/** The symbols of one language, for KaTeX written with that language at hand (`solve`). */
export const sym = (locale: Locale): Symbols => BY_LOCALE[locale];

/** One symbol in both languages (a parameter or an Inspector property). */
export const SYM = Object.fromEntries(
  Object.keys(TABLE).map((id) => [id, both((s) => s[id as SymbolId])]),
) as Record<SymbolId, LocalizedText>;

/** A formula written once for both languages: `both((s) => `${s.work} = F s\\cos\\alpha`)`. */
export function both(write: (s: Symbols) => string): LocalizedText {
  return { vi: write(BY_LOCALE.vi), en: write(BY_LOCALE.en) };
}

const GREEK: Record<string, string> = { alpha: 'α', omega: 'ω', eta: 'η', mu: 'μ', theta: 'θ' };

/**
 * A KaTeX symbol as a canvas label ("_x" parts become subscripts there):
 * `W_{\text{đ}}` → `W_đ`, `\mathscr{P}` → `𝒫`, `F_{g1}` → `F_g1`.
 */
export function plain(tex: string): string {
  return tex
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathscr\{P\}/g, '𝒫')
    .replace(/\\([a-z]+)/g, (m, name: string) => GREEK[name] ?? m)
    .replace(/[{}]/g, '');
}
