import { create } from 'zustand';
import { ENVELOPE_PARTS, STAGES, type VirusPart } from './parts';

export interface VirusState {
  /** With an envelope (and its glycoprotein spikes), as some animal viruses. */
  enveloped: boolean;
  selected: VirusPart | null;
  /** Index of the multiplication stage shown (0 … 4). */
  stage: number;
  /** "Hiện tên": the learner's choice; null = the mode's default (on in Basic). */
  labels: boolean | null;
}

export const useVirus = create<VirusState>()(() => ({
  enveloped: true,
  selected: null,
  stage: 0,
  labels: null,
}));

/** Adds or removes the envelope; a picked envelope part cannot stay picked without it. */
export function setEnveloped(enveloped: boolean): void {
  useVirus.setState((s) => ({
    enveloped,
    selected: !enveloped && s.selected && ENVELOPE_PARTS.has(s.selected) ? null : s.selected,
  }));
}

/** Moves to stage i, kept within the five stages. */
export function setStage(i: number): void {
  useVirus.setState({ stage: Math.min(STAGES.length - 1, Math.max(0, Math.round(i))) });
}

/** Restores a file's (untrusted) inputs. */
export function restoreVirus(patch: { enveloped?: unknown; stage?: unknown }): void {
  if (typeof patch.enveloped === 'boolean') setEnveloped(patch.enveloped);
  if (typeof patch.stage === 'number' && Number.isInteger(patch.stage)) setStage(patch.stage);
}
