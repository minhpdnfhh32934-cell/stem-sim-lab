import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Learning progress, kept on this computer only (`stemsim.progress`). Healthy motivation
 * (PROMPT_PHAN_2 A4.1): progress per topic and badges — no streaks, no rankings, no pressure.
 */
export interface ProgressState {
  /** Topics opened at least once. */
  visited: Record<string, true>;
  /** Challenges completed (id → time, ms). */
  challenges: Record<string, number>;
  /** Predictions made (id → whether the prediction matched the observation). */
  predictions: Record<string, boolean>;
  markVisited: (topic: string) => void;
  completeChallenge: (id: string) => void;
  recordPrediction: (id: string, correct: boolean) => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      visited: {},
      challenges: {},
      predictions: {},
      markVisited: (topic) => {
        set((s) => (s.visited[topic] ? s : { visited: { ...s.visited, [topic]: true } }));
      },
      completeChallenge: (id) => {
        set((s) =>
          s.challenges[id] !== undefined
            ? s
            : { challenges: { ...s.challenges, [id]: Date.now() } },
        );
      },
      recordPrediction: (id, correct) => {
        // The first prediction counts; trying again later does not overwrite it.
        set((s) =>
          s.predictions[id] !== undefined
            ? s
            : { predictions: { ...s.predictions, [id]: correct } },
        );
      },
      reset: () => {
        set({ visited: {}, challenges: {}, predictions: {} });
      },
    }),
    {
      name: 'stemsim.progress',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ visited, challenges, predictions }) => ({ visited, challenges, predictions }),
    },
  ),
);
