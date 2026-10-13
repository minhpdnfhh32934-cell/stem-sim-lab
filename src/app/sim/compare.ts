import { create } from 'zustand';
import type { ParamDef, Params, PhysicsScene } from '@/physics/types';
import type { History } from './history';
import { useSimStore } from './simStore';

/**
 * Before / after (gallery pattern 060): the learner pins the current run, changes a parameter and
 * sees the new path over the pinned one (dashed). Nothing is computed for the ghost: it is a copy
 * of the trail the engine already recorded, so it carries the same accuracy as the run itself.
 */

type Pt = { x: number; y: number };

export interface Ghost {
  sceneId: string;
  tracks: Pt[][];
  params: Params;
}

/** Trail points of a recorded run, one track per body (at most 601 points each). */
export function recordedTracks(
  history: Pick<History, 'states' | 'length'>,
  scene: Pick<PhysicsScene, 'trail'>,
  params: Params,
): Pt[][] {
  const tracks: Pt[][] = [];
  if (!scene.trail) return tracks;
  const end = history.length;
  const stride = Math.max(1, Math.ceil(end / 600));
  for (let i = 0; i < end; i += stride) {
    const s = history.states[i];
    if (!s) continue;
    scene.trail(s, params).forEach((pt, k) => {
      (tracks[k] ??= []).push(pt);
    });
  }
  // Always end on the last recorded state (the landing point matters for a comparison).
  const last = history.states[end - 1];
  if (last && (end - 1) % stride !== 0) {
    scene.trail(last, params).forEach((pt, k) => {
      (tracks[k] ??= []).push(pt);
    });
  }
  return tracks;
}

/** Parameters whose value differs between the pinned run and now (shown under the legend). */
export function changedParams(defs: readonly ParamDef[], before: Params, now: Params): ParamDef[] {
  return defs.filter((d) => {
    const a = before[d.key];
    const b = now[d.key];
    if (a === undefined || b === undefined) return a !== b;
    return Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  });
}

interface CompareState {
  ghost: Ghost | null;
  pin: (ghost: Ghost) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()((set) => ({
  ghost: null,
  pin: (ghost) => {
    set({ ghost });
  },
  clear: () => {
    set({ ghost: null });
  },
}));

// A pinned run belongs to its topic: opening another one drops it.
useSimStore.subscribe((s, prev) => {
  if (s.scene?.id !== prev.scene?.id && useCompareStore.getState().ghost) {
    useCompareStore.getState().clear();
  }
});
