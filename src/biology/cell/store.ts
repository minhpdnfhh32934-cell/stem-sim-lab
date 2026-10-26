import { create } from 'zustand';
import { isCellKind, type CellKind, type PartId } from './parts';

export interface CellState {
  /** The cell shown (saved in .stemsim files). */
  kind: CellKind;
  /** The part whose card is open (from the parts list). */
  selected: PartId | null;
  /** "Hiện tên": the learner's choice; null = the mode's default (on in Basic). */
  labels: boolean | null;
}

export const useCell = create<CellState>()(() => ({
  kind: 'animal',
  selected: null,
  labels: null,
}));

/** Switches the cell; a part card of the previous cell cannot stay open. */
export function setCellKind(kind: CellKind): void {
  useCell.setState((s) => (s.kind === kind ? s : { kind, selected: null }));
}

/** Restores a file's (untrusted) `kind`: anything but the three cells is ignored. */
export function restoreCell(patch: { kind?: unknown }): void {
  if (isCellKind(patch.kind)) setCellKind(patch.kind);
}
