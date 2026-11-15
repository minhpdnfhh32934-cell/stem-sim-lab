import { create } from 'zustand';
import { biomolecule, isGroup, moleculesOf, type GroupId, type PartId } from './data';

export interface BiomoleculeState {
  group: GroupId;
  /** The molecule shown (one of the group's). */
  molecule: string;
  /** The part of the monomer picked (list or 3D tap), or null. */
  part: PartId | null;
  /** "Hiện tên": the learner's choice; null = the mode's default (on in Basic). */
  labels: boolean | null;
}

export const useBiomolecules = create<BiomoleculeState>()(() => ({
  group: 'protein',
  molecule: 'alanine',
  part: null,
  labels: null,
}));

/** Switches the group and shows its first molecule. */
export function setGroup(group: GroupId): void {
  const first = moleculesOf(group)[0];
  if (!first) return;
  useBiomolecules.setState((s) =>
    s.group === group ? s : { group, molecule: first.id, part: null },
  );
}

/** Shows one of the group's molecules (a part of the previous one cannot stay picked). */
export function setMolecule(id: string): void {
  const m = biomolecule(id);
  if (m) useBiomolecules.setState({ group: m.group, molecule: m.id, part: null });
}

/** Restores a file's (untrusted) group and molecule; a molecule wins when both are valid. */
export function restoreBiomolecules(patch: { group?: unknown; molecule?: unknown }): void {
  if (isGroup(patch.group)) setGroup(patch.group);
  if (typeof patch.molecule === 'string') setMolecule(patch.molecule);
}
