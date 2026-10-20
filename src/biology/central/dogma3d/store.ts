/**
 * Transient state of the 3D view of "ADN → mARN → Protein" (not saved, not tracked by undo):
 * playback time, speed, the picked part, the camera mode and the name labels. Saved inputs (the
 * DNA, which strand it is, 3D on/off) live in the dogma store; the codon being translated is the
 * dogma store's `step`, shared with the 2D page.
 */
import { createLesson3DStore, type Lesson3DUi } from '../../view3d/lessonStore';
import { parseInput, useDogmaStore } from '../state';
import { dogmaClock, dogmaModel3d, type DogmaClock, type DogmaModel3D } from './binding';
import type { DogmaCameraMode } from './camera';
import type { DogmaSelection } from './components';

export type Dogma3DUi = Lesson3DUi<DogmaSelection, DogmaCameraMode> & { speed: number };

/** Playback speeds (× the illustrative pace). */
export const DOGMA_SPEEDS = [0.5, 1, 2, 4] as const;

export const useDogma3D = createLesson3DStore<DogmaSelection, DogmaCameraMode, { speed: number }>(
  'follow',
  { speed: 1 },
);

let last: { coding: string; model: DogmaModel3D; clock: DogmaClock } | null = null;
/** The 3D model and clock of a coding strand (the last one is kept: every frame reads it). */
export function dogma3dFor(coding: string): { model: DogmaModel3D; clock: DogmaClock } {
  if (last?.coding !== coding) {
    const model = dogmaModel3d(coding);
    last = { coding, model, clock: dogmaClock(model) };
  }
  return { model: last.model, clock: last.clock };
}

/** The lesson's coding strand now, or null when the sequence cannot be read. */
export function currentCoding(): string | null {
  const s = useDogmaStore.getState();
  const p = parseInput(s.input, s.strand);
  return p.ok ? p.coding : null;
}
