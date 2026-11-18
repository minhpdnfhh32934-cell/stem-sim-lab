/**
 * Which molecule the 3D view of "Alkane, alkene, alkyne, arene" shows (pure; tested): the
 * straight-chain member of the chosen series with n carbons (the book's table), drawn from the
 * app's own 3D coordinates (`data/molecules.json`, RDKit MMFF94) when the same compound is there
 * — found by its name, checked by its formula. Otherwise none: no coordinates are made up.
 */
import { MOLECULES, type Molecule } from '../data/molecules';
import { MEMBERS, type ClassId, type Member } from './model';

const norm = (s: string) => s.trim().toLowerCase();

/** The book's straight-chain member of a series with n carbons (benzene, toluene for arenes). */
export const memberAt = (cls: ClassId, n: number): Member | undefined =>
  MEMBERS.find((m) => m.class === cls && m.carbons === n && m.straight);

export function moleculeFor(member: Member | undefined): Molecule | undefined {
  if (!member) return undefined;
  const m = MOLECULES.find((x) => norm(x.name.en) === norm(member.name));
  return m && m.formula === member.formula ? m : undefined;
}
