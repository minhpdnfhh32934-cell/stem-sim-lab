import type { Division } from './division';
import { useDivisionStore, type DivisionState } from './state';

/**
 * The division the stored stage `index` belongs to. Mitosis and meiosis share the division
 * store, so a 2D stage view resets the index only when it was written for the other kind.
 * Every writer of `index` goes through `setDivisionState`: the 2D views, the 3D / 2D switch
 * and the file / undo bindings.
 */
let indexKind: Division | null = null;

/** Writes division inputs; when the patch has `index`, records which division it is for. */
export function setDivisionState(kind: Division, patch: Partial<DivisionState>): void {
  if ('index' in patch) indexKind = kind;
  useDivisionStore.setState(patch);
}

/** The kind the stored index was written for (null: never written, still the default). */
export function stageIndexKind(): Division | null {
  return indexKind;
}

/** A stage view of `kind` is shown: keeps the index if it is this kind's, else starts at 0. */
export function claimStageIndex(kind: Division): void {
  if (indexKind !== null && indexKind !== kind) useDivisionStore.setState({ index: 0 });
  indexKind = kind;
}
