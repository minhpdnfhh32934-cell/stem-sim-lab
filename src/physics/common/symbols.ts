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
  // SGK Vật lí 10 KNTT (26.1), tr. 102 writes the mechanical energy W_c.
  mechanical: ['W_c', 'E'],
  // The energy of an oscillator, W in SGK Vật lí 11 (the spring lessons).
  oscillationEnergy: ['W', 'E'],
  work: ['A', 'W'],
  workPull: ['A_F', 'W_F'],
  workWeight: ['A_P', 'W_g'],
  workFriction: ['A_{ms}', 'W_f'],
  workNormal: ['A_N', 'W_N'],
  weight: ['P', 'F_g'],
  weightVec: ['\\vec{P}', '\\vec{F}_g'],
  power: ['\\mathscr{P}', 'P'],
  // SGK Vật lí 10 KNTT (24.1)–(24.3), tr. 96–97: average power 𝒫 = A/t, power at an instant 𝒫_t = F·v_t.
  powerAvg: ['\\mathscr{P}', '\\bar{P}'],
  powerNow: ['\\mathscr{P}_t', 'P'],
  speedNow: ['v_t', 'v'],
  efficiency: ['H', '\\eta'],
  // SGK Vật lí 10 KNTT (27.1), tr. 106: H = W_ci / W_tp.
  usefulEnergy: ['W_{ci}', 'E_{useful}'],
  totalEnergy: ['W_{tp}', 'E_{in}'],
  friction: ['F_{ms}', 'f'],
  // SGK Vật lí 10 KNTT Bài 18, tr. 75: F_mst = μN (the book names no static coefficient).
  kineticFriction: ['F_{mst}', 'f_k'],
  staticFriction: ['F_{msn}', 'f_s'],
  muKinetic: ['\\mu_t', '\\mu_k'],
  muStatic: ['\\mu_n', '\\mu_s'],
  // SGK Vật lí 10 KNTT Bài 13, tr. 57–59: the resultant is F (F⃗ = F⃗₁ + F⃗₂), its components F_x, F_y.
  resultant: ['F', 'F_{net}'],
  resultantVec: ['\\vec{F}', '\\vec{F}_{net}'],
  resultantX: ['F_x', 'F_{net,x}'],
  resultantY: ['F_y', 'F_{net,y}'],
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
