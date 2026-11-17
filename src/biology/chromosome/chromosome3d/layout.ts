/**
 * What the 3D view of "Đột biến nhiễm sắc thể" (structure tab) draws (pure, no three.js; tested
 * against the model): the chromosomes before and after (the gene letters of Hình 12.1, from
 * `structureChange`), each gene a bead along x, and a link from each gene before to where the same
 * gene is after — none for a deleted gene, two for a duplicated one, crossing for an inversion,
 * across chromosomes for a translocation. Genes marked new follow the 2D picture's rule.
 */
import { structureChange, type Structure } from '../model';

export type Vec3 = [number, number, number];

export const GENE_W = 1;
export const CHROM_GAP = 1.6;
export const ROW_BEFORE = 2.6;
export const ROW_AFTER = -2.6;

export interface Bead {
  gene: string;
  at: Vec3;
  /** Which chromosome of the row (0, 1). */
  chrom: number;
  /** Not on the chromosome it is compared with (the 2D picture's mark). */
  isNew: boolean;
}

function row(chroms: readonly string[], y: number, against: (i: number) => string): Bead[] {
  const width = chroms.reduce((s, c) => s + c.length * GENE_W, 0) + CHROM_GAP * (chroms.length - 1);
  let x = -width / 2 + GENE_W / 2;
  const out: Bead[] = [];
  chroms.forEach((c, i) => {
    for (const g of c) {
      out.push({ gene: g, at: [x, y, 0], chrom: i, isNew: !against(i).includes(g) });
      x += GENE_W;
    }
    x += CHROM_GAP;
  });
  return out;
}

export function structure3d(s: Structure) {
  const { before, after } = structureChange(s);
  const all = before.join('');
  const top = row(before, ROW_BEFORE, (i) => before[i] ?? '');
  const bottom = row(after, ROW_AFTER, (i) => (s === 'translocation' ? (before[i] ?? '') : all));
  // Each gene before links to every bead with its letter after (the letters are unique before).
  const links = top.flatMap((b) =>
    bottom.filter((a) => a.gene === b.gene).map((a) => ({ gene: b.gene, from: b.at, to: a.at })),
  );
  return { before, after, top, bottom, links };
}
