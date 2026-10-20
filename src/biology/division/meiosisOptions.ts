/**
 * The random choices of one meiosis run, from the lesson's seed: which pole each homologous pair's
 * maternal chromosome faces in metaphase I (independent assortment) and, when crossing over is on,
 * where pair 1 crosses over. Pure and deterministic: the 2D picture, the 3D view and the counts
 * table all read the same run for the same (2n, crossover, seed).
 */
import { rng } from '../genetics/stats';
import type { MeiosisOptions } from './division';

export function meiosisOptions(
  pairs: number,
  crossover: boolean,
  seed: number,
): Required<MeiosisOptions> {
  const rand = rng(seed);
  const orientation = Array.from({ length: pairs }, () => rand() < 0.5);
  const crossovers = crossover ? [{ pair: 0, point: 0.35 + 0.3 * rand() }] : [];
  return { orientation, crossovers };
}
