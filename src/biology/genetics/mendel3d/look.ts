/**
 * Colour and shape of each phenotype class in the 3D Mendel view (pure). The first five colours
 * are the 2D table's (bio.css `.punnett-cell--n`), so a class looks the same in both views; past
 * them the other chart tokens follow. Every class also has its own shape cue, and the pair
 * (colour, shape) never repeats within the nine classes two incompletely dominant genes give —
 * colour alone never tells two classes apart. Colours only tell classes apart: they are not the
 * real colour of any trait (COLOUR_NOTE). Theme tokens only.
 */
import { CLASS_SHAPES, ROLES, type Shape } from '../../view3d/palette';

export const MENDEL_CLASS_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-5',
  '--chart-6',
  '--chart-7',
  '--chart-4',
] as const;

/** Looks of the allele beads (dominant, recessive): no phenotype class may take one of them. */
const ALLELE_LOOKS = new Set([ROLES.alleleA, ROLES.allelea].map((r) => `${r.token}|${r.shape}`));

export function classLook(i: number): { token: string; shape: Shape } {
  const n = MENDEL_CLASS_TOKENS.length;
  const k = Math.max(0, Math.floor(i));
  const token = MENDEL_CLASS_TOKENS[k % n] ?? '--chart-1';
  let s = (k + Math.floor(k / n)) % CLASS_SHAPES.length;
  // The eighth class would be a cube in --chart-1, like a dominant allele bead: next shape.
  for (
    let t = 0;
    t < CLASS_SHAPES.length && ALLELE_LOOKS.has(`${token}|${CLASS_SHAPES[s] ?? ''}`);
    t++
  ) {
    s = (s + 1) % CLASS_SHAPES.length;
  }
  return { token, shape: CLASS_SHAPES[s] ?? 'sphere' };
}
