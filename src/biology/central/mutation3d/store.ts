/**
 * Transient state of the 3D view of "Đột biến điểm" (not saved, not tracked by undo): the picked
 * part, the camera mode and the name labels. Saved inputs (the DNA, the mutation, 3D on/off) live
 * in the dogma store, shared with "ADN → mARN → Protein".
 */
import type { Mutation } from '../dogma';
import { createLesson3DStore } from '../../view3d/lessonStore';
import { mutationOf, parseInput, useDogmaStore, type DogmaState } from '../state';
import { mutationModel3d, type MutationModel3D } from './binding';
import type { MutationSelection } from './components';

export type MutationCameraMode = 'overview' | 'site';

export const useMutation3D = createLesson3DStore<MutationSelection, MutationCameraMode, object>(
  'overview',
  {},
);

let last: { key: string; model: MutationModel3D } | null = null;
/** The 3D model of a mutation of a coding strand (the last one is kept). */
export function mutation3dFor(coding: string, m: Mutation): MutationModel3D {
  const key = JSON.stringify([coding, m]);
  if (last?.key !== key) last = { key, model: mutationModel3d(coding, m) };
  return last.model;
}

/** The lesson's coding strand and mutation now (null when either cannot be read). */
export function currentMutation(
  st: Pick<DogmaState, 'input' | 'strand' | 'kind' | 'pos' | 'bases' | 'count'>,
): { ok: true; coding: string; m: Mutation | null } | { ok: false; error: string } {
  const p = parseInput(st.input, st.strand);
  if (!p.ok) return p;
  return { ok: true, coding: p.coding, m: mutationOf(st, p.coding.length) };
}

/**
 * Picking a base pair of the normal DNA moves the mutation there: the panel's "Vị trí" input
 * (1-based, saved in files, undoable like any input).
 */
export function setSitePos(index: number): void {
  const s = useDogmaStore.getState();
  const p = parseInput(s.input, s.strand);
  if (!p.ok || p.coding.length === 0) return;
  const pos = Math.max(1, Math.min(p.coding.length, Math.round(index) + 1));
  if (s.pos !== pos) useDogmaStore.setState({ pos });
}

/**
 * A pick in the picture: a base pair of the normal DNA also moves the mutation there (the panel's
 * "Vị trí", saved and undoable); anything else is only selected.
 */
export function applyPick(sel: MutationSelection | null): void {
  if (sel?.kind === 'pair' && sel.helix === 'normal') setSitePos(sel.index);
  useMutation3D.setState({ selected: sel });
}
