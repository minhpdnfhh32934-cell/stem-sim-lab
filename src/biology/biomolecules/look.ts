/**
 * How the biomolecule pictures (3D and 2D) size and colour atoms, and where a part's name goes.
 * No three.js here: the 2D picture uses it too.
 */
import { elementBySymbol } from '@/chemistry/data/elements';
import type { Biomolecule, PartId } from './data';

/** Ball radius (Å): the covalent radius (Cordero) scaled as in the chemistry viewer. */
export function atomRadius(el: string): number {
  const r = elementBySymbol(el)?.covalent_radius_pm ?? 75;
  return Math.max(0.18, (r / 100) * 0.42);
}

/** The element's Jmol colour (data/elements.json), or null when the data has none. */
export function atomColor(el: string): string | null {
  return elementBySymbol(el)?.jmol_color ?? null;
}

/** Centre of the atoms of a part (where its name is written). */
export function partCentre(m: Biomolecule, part: PartId): [number, number, number] {
  const atoms = m.parts.find((p) => p.id === part)?.atoms ?? [];
  const sum: [number, number, number] = [0, 0, 0];
  for (const i of atoms) {
    const a = m.atoms[i];
    if (!a) continue;
    sum[0] += a.xyz[0];
    sum[1] += a.xyz[1];
    sum[2] += a.xyz[2];
  }
  const n = Math.max(1, atoms.length);
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}
