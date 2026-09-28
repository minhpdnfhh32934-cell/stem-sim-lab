import type { EngineInput } from '@/core/sim/engine';
import type { Frame, RunnerError } from '@/core/sim/runner';

/** Messages from the UI thread to the simulation worker. */
export type ToWorker =
  | { type: 'load'; requestId: number; engineId: string; params: unknown }
  | { type: 'frame'; seq: number; frameSeconds: number; speed: number; paused: boolean }
  | { type: 'reset'; params: unknown }
  | { type: 'input'; msg: EngineInput }
  | { type: 'budget'; ms: number };

/** Messages from the simulation worker to the UI thread. */
export type FromWorker =
  | { type: 'loaded'; requestId: number; stateSize: number; dt: number }
  | { type: 'frame'; seq: number; frame: Frame }
  | { type: 'error'; error: RunnerError | { code: 'load'; message: string } };
