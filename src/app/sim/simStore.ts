import { create } from 'zustand';
import type { LocalizedText } from '@/core/data/dataset';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';

/**
 * React-visible state of the open physics simulation. High-frequency data (every frame)
 * lives in the SimRuntime, not here; this store is updated at ~10 Hz.
 */
export interface SimStoreState {
  scene: PhysicsScene | null;
  loading: boolean;
  error: string | null;
  params: Params;
  sources: Record<string, ParamSource>;
  validation: LocalizedText[];
  intervened: boolean;
  finished: boolean;
  /** Longest recorded simulated time (s). */
  duration: number;
  /** Time shown while scrubbing a recorded run; null when live. */
  scrubTime: number | null;
  selected: string | null;
  /** Problem the simulation came from (AI mode): text and the answer ids it asks for. */
  problem: { text: string; questions: string[] } | null;
  vectors: boolean;
  trail: boolean;
  stopwatch: boolean;
  /** Increments whenever recorded data changes (graphs/table refresh). */
  dataVersion: number;
  /** Increments ~10 Hz while running (inspector live values). */
  tick: number;
  /** Increments when the camera should re-frame the scene. */
  fitRequest: number;
}

export const useSimStore = create<SimStoreState>()(() => ({
  scene: null,
  loading: false,
  error: null,
  params: {},
  sources: {},
  validation: [],
  intervened: false,
  finished: false,
  duration: 0,
  scrubTime: null,
  selected: null,
  problem: null,
  vectors: true,
  trail: true,
  stopwatch: false,
  dataVersion: 0,
  tick: 0,
  fitRequest: 0,
}));
