/**
 * The playback clock of a 3D division timeline: the stages one after the other, each with an
 * illustrative duration (real stages take minutes to hours), and the moment where each stage
 * shows its characteristic arrangement (stage stepping). Pure: no three.js, no DOM.
 */
import { clamp01 } from './math';

export interface StageWindow<S extends string = string> {
  id: S;
  start: number;
  end: number;
}

export interface StageClock<S extends string> {
  stages: StageWindow<S>[];
  total: number;
  /** Stage at time t (clamped to the timeline), its index and the progress inside it (0…1). */
  stageAt: (t: number) => { stage: S; index: number; u: number };
  /** Time at which a stage shows its characteristic arrangement. */
  keyTime: (stage: S) => number;
  /** Time at progress u inside a stage (u = 1 is the stage's own end). */
  timeAt: (stage: S, u: number) => number;
}

/**
 * Builds the clock of `order` (stage ids in playing order) with each stage's duration in seconds
 * at 1× speed and its key moment (local progress 0…1).
 */
export function stageClock<S extends string>(
  order: readonly S[],
  seconds: Record<S, number>,
  keyU: Record<S, number>,
): StageClock<S> {
  const stages: StageWindow<S>[] = [];
  let acc = 0;
  for (const id of order) {
    stages.push({ id, start: acc, end: acc + seconds[id] });
    acc += seconds[id];
  }
  const total = acc;
  const last = order[order.length - 1];
  if (last === undefined) throw new Error('a stage clock needs at least one stage');

  const stageAt = (t: number) => {
    const tc = Math.min(total, Math.max(0, t));
    for (let k = 0; k < stages.length; k++) {
      const w = stages[k];
      if (!w) continue;
      if (tc < w.end || k === stages.length - 1) {
        return { stage: w.id, index: k, u: clamp01((tc - w.start) / (w.end - w.start)) };
      }
    }
    return { stage: last, index: stages.length - 1, u: 1 };
  };
  const timeAt = (stage: S, u: number) => {
    const w = stages.find((s) => s.id === stage);
    return w ? w.start + u * (w.end - w.start) : 0;
  };
  const keyTime = (stage: S) => timeAt(stage, keyU[stage]);
  return { stages, total, stageAt, keyTime, timeAt };
}
