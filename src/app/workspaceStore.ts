import { create } from 'zustand';

export type Subject = 'physics' | 'chemistry' | 'biology';
export const SUBJECTS: readonly Subject[] = ['physics', 'chemistry', 'biology'];

export type StageTool =
  'select' | 'drag' | 'ruler' | 'protractor' | 'stopwatch' | 'vectors' | 'trail' | 'fitView';

/** Allowed playback speeds (§7.1: ×0.1 – ×4). */
export const PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export type AiStatus = 'offline' | 'local' | 'cloud';

/**
 * Session state of the workspace (not persisted).
 * Phase 0: only UI state. From Phase 1 the simulation clock is driven by the engine worker;
 * this store will then mirror the worker's state instead of owning it.
 */
export interface WorkspaceState {
  subject: Subject;
  problemText: string;
  activeTool: StageTool;
  /** True when a simulation is loaded. Phase 0: always false. */
  hasSimulation: boolean;
  playing: boolean;
  speed: PlaybackSpeed;
  /** Simulation time in seconds (SI). */
  simTime: number;
  aiStatus: AiStatus;

  setSubject: (subject: Subject) => void;
  setProblemText: (text: string) => void;
  setActiveTool: (tool: StageTool) => void;
  togglePlaying: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  resetSimulation: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  subject: 'physics',
  problemText: '',
  activeTool: 'select',
  hasSimulation: false,
  playing: false,
  speed: 1,
  simTime: 0,
  aiStatus: 'offline',

  setSubject: (subject) => {
    set({ subject });
  },
  setProblemText: (problemText) => {
    set({ problemText });
  },
  setActiveTool: (activeTool) => {
    set({ activeTool });
  },
  togglePlaying: () => {
    // Nothing to play until a simulation exists.
    set((s) => (s.hasSimulation ? { playing: !s.playing } : {}));
  },
  setSpeed: (speed) => {
    set({ speed });
  },
  resetSimulation: () => {
    set({ playing: false, simTime: 0 });
  },
}));
