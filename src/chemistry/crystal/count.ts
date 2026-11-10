import { countInCell, countTerms, unitCell, type CrystalId, type SiteKind } from './lattice';

/** A share as a fraction (1/8, 1/6, 1/2…); 1 as "1". */
export function shareText(share: number): string {
  if (Math.abs(share - 1) < 1e-9) return '1';
  for (let d = 2; d <= 12; d++) {
    const n = share * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${String(Math.round(n))}/${String(d)}`;
  }
  return String(share);
}

/** "8 × 1/8 + 1 = 2" for one kind of particle. */
export function countLine(id: CrystalId, kind: SiteKind): string {
  const cell = unitCell(id);
  const terms = countTerms(cell)
    .filter((t) => t.kind === kind)
    .map((t) => (t.share === 1 ? String(t.sites) : `${String(t.sites)} × ${shareText(t.share)}`));
  const total = Math.round(countInCell(cell)[kind] ?? 0);
  return `${terms.join(' + ')} = ${String(total)}`;
}
