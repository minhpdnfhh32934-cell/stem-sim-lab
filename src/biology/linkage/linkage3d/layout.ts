/**
 * What the 3D view of "Liên kết gene và hoán vị gene" (testcross tab) draws (pure, no three.js;
 * tested against the model): a bivalent of BV/bv — four chromatids, the B/b and V/v loci — with a
 * crossover between two non-sister chromatids when the recombination frequency is above 0 (one
 * meiotic cell, an illustration of Hình 11.3), and four columns whose heights are the model's
 * gamete shares (`gameteShares`), which are also the testcross's Fa shares.
 */
import { GAMETES, gameteShares, type Gamete } from '../model';

export type Vec3 = [number, number, number];
export type Origin = 'maternal' | 'paternal';

/** A chromatid: the origin of its upper part (B/b locus) and of its lower part (V/v locus). */
export interface Chromatid {
  x: number;
  top: Origin;
  bottom: Origin;
}

/** Heights: a column of share 1 would be COLUMN_MAX tall. */
export const COLUMN_MAX = 10;
export const COLUMN_X: Record<Gamete, number> = { BV: 0, bv: 2.2, Bv: 4.4, bV: 6.6 };
/** Chromatid x positions (the BV homologue left, bv right) and loci heights. */
export const CHROMATID_X = [-7.4, -6.7, -5.5, -4.8] as const;
export const LOCUS_B = 2.4;
export const LOCUS_V = -1.4;
export const CROSS_Y = 0.5;

export function chromatids(f: number): Chromatid[] {
  const cross = f > 0;
  const [a, b, c, d] = CHROMATID_X;
  return [
    { x: a, top: 'maternal', bottom: 'maternal' },
    // The two inner, non-sister chromatids exchange their parts below the crossover.
    { x: b, top: 'maternal', bottom: cross ? 'paternal' : 'maternal' },
    { x: c, top: 'paternal', bottom: cross ? 'maternal' : 'paternal' },
    { x: d, top: 'paternal', bottom: 'paternal' },
  ];
}

/** A gamete's two loci: upper (B or b) maternal when it carries B (the BV homologue's). */
export const gameteOrigin = (g: Gamete): { top: Origin; bottom: Origin } => ({
  top: g[0] === 'B' ? 'maternal' : 'paternal',
  bottom: g[1] === 'V' ? 'maternal' : 'paternal',
});

export function columns(f: number) {
  const shares = gameteShares(f);
  return GAMETES.map((g) => ({
    gamete: g,
    share: shares[g],
    height: shares[g] * COLUMN_MAX,
    x: COLUMN_X[g],
  }));
}
