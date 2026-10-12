import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Which graphics card WebGPU asks for (only matters on laptops with two GPUs). */
export type GpuPower = 'high-performance' | 'low-power';
/** Longest Gemma answer. A small on-device model is slow per word and drifts in long answers. */
export type AnswerLength = 'short' | 'medium' | 'long';
/** Minutes without a question before Gemma leaves the GPU memory (0 = keep it loaded). */
export type UnloadAfter = 0 | 5 | 15;

export const ANSWER_LENGTHS: readonly AnswerLength[] = ['short', 'medium', 'long'];
export const UNLOAD_CHOICES: readonly UnloadAfter[] = [0, 5, 15];
export const GPU_POWERS: readonly GpuPower[] = ['high-performance', 'low-power'];

/** New tokens per answer: "medium" is the 384 used before these settings existed. */
export const ANSWER_TOKENS: Record<AnswerLength, number> = { short: 256, medium: 384, long: 768 };

interface GemmaPrefsState {
  power: GpuPower;
  answerLength: AnswerLength;
  unloadAfterMin: UnloadAfter;
  setPower: (power: GpuPower) => void;
  setAnswerLength: (answerLength: AnswerLength) => void;
  setUnloadAfterMin: (unloadAfterMin: UnloadAfter) => void;
}

export const useGemmaPrefs = create<GemmaPrefsState>()(
  persist(
    (set) => ({
      power: 'high-performance',
      answerLength: 'medium',
      unloadAfterMin: 0,
      setPower: (power) => {
        set({ power });
      },
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
      partialize: ({ power, answerLength, unloadAfterMin }) => ({
        power,
        answerLength,
        unloadAfterMin,
      }),
    },
  ),
);

/** Facts about the graphics card WebGPU would use, read from the browser (nothing is sent). */
export interface GpuInfo {
  vendor: string;
  architecture: string;
  description: string;
  /** Half-precision shaders (faster, smaller models on some cards). */
  shaderF16: boolean;
  /** Largest single GPU buffer, bytes. */
  maxBufferSize: number;
  /** A software (CPU) adapter: works, but very slowly. */
  fallback: boolean;
}

/** Null when WebGPU is missing or no adapter is available for that power setting. */
export async function readGpuInfo(power: GpuPower): Promise<GpuInfo | null> {
  try {
    // Typed as optional: WebView2 and browsers without WebGPU have no `navigator.gpu`.
    const gpu = (navigator as { gpu?: GPU }).gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter({ powerPreference: power });
    if (!adapter) return null;
    // Older WebView2/Chromium builds lack some of these fields: treat each as optional.
    const info: Partial<GPUAdapterInfo> = adapter.info;
    return {
      vendor: info.vendor ?? '',
      architecture: info.architecture ?? '',
      description: info.description ?? '',
      shaderF16: adapter.features.has('shader-f16'),
      maxBufferSize: adapter.limits.maxBufferSize,
      fallback: info.isFallbackAdapter ?? false,
    };
  } catch {
    return null;
  }
}
