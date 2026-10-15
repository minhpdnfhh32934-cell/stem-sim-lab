/**
 * Which AI may get a picture of what the learner circled on the board (item 2, user decision G8:
 * crop only when the model reads pictures, otherwise say so and ask the learner to type).
 *
 * Text, LaTeX and drawing labels are always sent as text; a picture is made only when the circled
 * part has no text (a drawing without labels, the learner's own handwriting), and it NEVER goes
 * online. It goes only to:
 * - the in-app Gemma when the learner's chosen model reads pictures (kind `vision`, E2B) and runs
 *   on a card that is known not to be integrated (an integrated AMD card crashed the computer with
 *   Gemma, 2026-10-13), Gemma not paused by a GPU fault. A text model is never switched to E2B
 *   behind the learner's back (webGemma would do so when given a picture);
 * - a runtime on this computer whose chosen model was seen reading pictures on this computer
 *   (vision "Có"); "Chưa xác minh" is not enough.
 */
import { useAnalysisEngine, type AnalysisEngine } from '@/app/ai/engineChoice';
import { useGpuStore, type GpuStatus, type WebGpuInfo } from '@/ai/gpu';
import { gemmaBlockedByGpuFault, gemmaOnIntegrated } from '@/ai/gpuSafety';
import { checkFor, useLocalAiStore } from '@/ai/local/localAiStore';
import type { Cap } from '@/ai/local/types';
import { webGPUStatus } from '@/ai/webGemma';
import { webGemmaModel } from '@/ai/webGemmaModels';
import { useChatStore } from './chatStore';

export type PictureReader = 'gemma' | 'local' | null;

export interface PictureFacts {
  /** The engine that really answers (engineChoice). */
  engine: AnalysisEngine;
  gemmaModel: string;
  webgpu: boolean;
  gemmaBlocked: boolean;
  gpuStatus: GpuStatus | null;
  gemmaInfo: WebGpuInfo | null;
  /** What was seen on this computer about the chosen local model (null: never checked). */
  localVision: Cap | null;
}

/** The engine that may get the picture, or null (then nothing but text is ever sent). */
export function pictureReaderFor(f: PictureFacts): PictureReader {
  if (f.engine === 'gemma') {
    const vision = webGemmaModel(f.gemmaModel)?.kind === 'vision';
    const discrete = gemmaOnIntegrated(f.gpuStatus, f.gemmaInfo) === false;
    return vision && f.webgpu && !f.gemmaBlocked && discrete ? 'gemma' : null;
  }
  if (f.engine === 'local') return f.localVision === 'yes' ? 'local' : null;
  return null;
}

function localVision(): Cap | null {
  const local = useLocalAiStore.getState();
  return checkFor(local, local.selected)?.capabilities.vision ?? null;
}

/** The same, from the stores now, for the engine `engine` (askTeacher checks it again). */
export function pictureReaderNow(engine: AnalysisEngine): PictureReader {
  const gpu = useGpuStore.getState();
  return pictureReaderFor({
    engine,
    gemmaModel: useChatStore.getState().gemmaModel,
    webgpu: webGPUStatus() === 'webgpu',
    gemmaBlocked: gemmaBlockedByGpuFault(),
    gpuStatus: gpu.status,
    gemmaInfo: gpu.gemmaInfo,
    localVision: localVision(),
  });
}

/**
 * For the chat: the reader for `engine` (the panel's `useAnalysisEngine`), re-read when the
 * model, the card or the local model's check changes.
 */
export function usePictureReader(engine: AnalysisEngine): PictureReader {
  // Subscriptions only: the rule reads the stores again below.
  useChatStore((s) => s.gemmaModel);
  useGpuStore((s) => s.status);
  useGpuStore((s) => s.gemmaInfo);
  useLocalAiStore((s) => checkFor(s, s.selected)?.capabilities.vision ?? null);
  return pictureReaderNow(engine);
}

/** For the board's bar: the engine that answers, then its reader. */
export function useBoardPictureReader(): PictureReader {
  return usePictureReader(useAnalysisEngine());
}
