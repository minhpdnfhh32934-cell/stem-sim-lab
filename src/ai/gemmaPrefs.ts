import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * How the on-device Gemma runs (Settings → GPU cho Gemma). Which graphics card it uses is
 * chosen by the desktop app at start-up (`gpu.ts`, `src-tauri/src/gpu.rs`): WebView2 ignores a
 * page's `powerPreference`, so there is no such option here.
 */

/** Longest Gemma answer. A small on-device model is slow per word and drifts in long answers. */
export type AnswerLength = 'short' | 'medium' | 'long';
/** Minutes without a question before Gemma leaves the GPU memory (0 = keep it loaded). */
export type UnloadAfter = 0 | 5 | 15;

export const ANSWER_LENGTHS: readonly AnswerLength[] = ['short', 'medium', 'long'];
export const UNLOAD_CHOICES: readonly UnloadAfter[] = [0, 5, 15];

/** New tokens per answer: "medium" is the default output budget (`GEMMA_OUTPUT_TOKENS`). */
export const ANSWER_TOKENS: Record<AnswerLength, number> = { short: 512, medium: 1024, long: 2048 };

interface GemmaPrefsState {
  answerLength: AnswerLength;
  unloadAfterMin: UnloadAfter;
  setAnswerLength: (answerLength: AnswerLength) => void;
  setUnloadAfterMin: (unloadAfterMin: UnloadAfter) => void;
}

export const useGemmaPrefs = create<GemmaPrefsState>()(
  persist(
    (set) => ({
      answerLength: 'medium',
      unloadAfterMin: 0,
      setAnswerLength: (answerLength) => {
        set({ answerLength });
      },
      setUnloadAfterMin: (unloadAfterMin) => {
        set({ unloadAfterMin });
      },
    }),
    {
      name: 'stemsim.gemma-prefs',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ answerLength, unloadAfterMin }) => ({ answerLength, unloadAfterMin }),
    },
  ),
);
