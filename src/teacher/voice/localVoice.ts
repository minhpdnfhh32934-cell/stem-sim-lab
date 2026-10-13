/**
 * The on-device Vietnamese voice (page side): download / delete with real progress, and
 * synthesis through `localVoiceWorker.ts`. The model is Meta's MMS-TTS for Vietnamese, licensed
 * CC BY-NC 4.0 (non-commercial use, with attribution) — see docs/THIRD_PARTY.md. Piper's
 * Vietnamese voices were not used: they are fine-tuned from a research-only voice and need the
 * GPL espeak-ng phonemizer.
 */
import { deleteRepo, opfsAvailable, repoStored } from '@/ai/modelStore';
import { ortPaths, webGPUStatus } from '@/ai/webGemma';
import type { Pcm } from './audio';

export const LOCAL_VOICE = {
  repo: 'Xenova/mms-tts-vie',
  pageId: 'mms-tts-vie',
  /** Full-precision weights: the 8-bit file is smaller but audibly rougher. */
  dtype: 'fp32' as const,
  /** model.onnx (114 302 582 bytes, HuggingFace API 2026-10-12) + tokenizer files. */
  bytes: 114_400_000,
  sizeLabel: '≈ 115 MB',
  licence: 'CC BY-NC 4.0',
};

const FLAG = 'stemsim.voice-model';

export type LocalVoiceStatus = 'ready' | 'missing';

/** Ready = the download finished (flag) and the weights are still stored. */
export async function localVoiceStatus(): Promise<LocalVoiceStatus> {
  let flagged = false;
  try {
    flagged = localStorage.getItem(FLAG) === LOCAL_VOICE.repo;
  } catch {
    /* storage blocked */
  }
  if (!flagged) return 'missing';
  if (opfsAvailable() && !(await repoStored(LOCAL_VOICE.repo))) return 'missing';
  return 'ready';
}

type WorkerOut =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'loaded' }
  | { kind: 'audio'; id: number; samples: Float32Array; sampleRate: number }
  | { kind: 'error'; id: number; message: string };

let worker: Worker | null = null;
let loaded = false;
let nextId = 1;
const waiting = new Map<number, (out: WorkerOut) => void>();
let onLoad: ((out: WorkerOut) => void) | null = null;
let onProgress: ((loaded: number, total: number | null) => void) | null = null;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./localVoiceWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerOut>) => {
    const out = event.data;
    if (out.kind === 'progress') onProgress?.(out.loaded, out.total);
    else if (out.kind === 'loaded' || (out.kind === 'error' && out.id === -1)) {
      const resolve = onLoad;
      onLoad = null;
      resolve?.(out);
    } else {
      const resolve = waiting.get(out.id);
      waiting.delete(out.id);
      resolve?.(out);
    }
  };
  // A crashed worker (out of memory…) must fail everything that waits on it.
  worker.onerror = (event) => {
    event.preventDefault();
    const pending = [...waiting.entries()];
    waiting.clear();
    const load = onLoad;
    onLoad = null;
    resetWorker();
    load?.({ kind: 'error', id: -1, message: 'worker-crashed' });
    for (const [id, resolve] of pending) resolve({ kind: 'error', id, message: 'worker-crashed' });
  };
  return worker;
}

function resetWorker(): void {
  try {
    worker?.terminate();
  } catch {
    /* already gone */
  }
  worker = null;
  loaded = false;
}

async function load(
  progress: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (loaded) return;
  const w = ensureWorker();
  onProgress = progress;
  const done = new Promise<WorkerOut>((resolve, reject) => {
    onLoad = resolve;
    signal?.addEventListener(
      'abort',
      () => {
        resetWorker();
        reject(new Error('cancelled'));
      },
      { once: true },
    );
  });
  // The graphics card when WebGPU exists (measured 2026-10-12: ~0.6 s of work per second of
  // speech), else the CPU (~1.7 s per second: phrases then wait for each other).
  w.postMessage({
    kind: 'load',
    repo: LOCAL_VOICE.repo,
    dtype: LOCAL_VOICE.dtype,
    device: webGPUStatus() === 'webgpu' ? 'webgpu' : 'wasm',
    ort: ortPaths(),
  });
  try {
    const out = await done;
    if (out.kind === 'error') throw new Error(out.message);
    loaded = true;
  } finally {
    onProgress = null;
  }
}

/** Downloads the model once (real progress) and keeps it ready on this computer. */
export async function downloadLocalVoice(
  progress: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  await load(progress, signal);
  // Never report "ready" for weights that would have to be downloaded again.
  if (opfsAvailable() && !(await repoStored(LOCAL_VOICE.repo))) {
    throw new Error('storage: the voice model could not be saved on this computer');
  }
  localStorage.setItem(FLAG, LOCAL_VOICE.repo);
}

export async function deleteLocalVoice(): Promise<void> {
  resetWorker();
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* storage blocked */
  }
  await deleteRepo(LOCAL_VOICE.repo);
}

/**
 * The model knows only lowercase Vietnamese letters (no f, j, w, z, no digits or punctuation):
 * map the few foreign letters to how they sound and drop the rest. Numbers are words already.
 */
export function textForModel(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/f/g, 'ph')
    .replace(/j/g, 'gi')
    .replace(/w/g, 'qu')
    .replace(/z/g, 'd')
    .replace(/[-–]/g, ' ')
    .replace(/[^a-zàáâãèéêìíòóôõùúýăđĩũơưạ-ỹ' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Speaks one phrase into samples (loads the stored model first if needed). */
export async function synthesizeLocal(text: string, signal: AbortSignal): Promise<Pcm> {
  const words = textForModel(text);
  if (!words) return { samples: new Float32Array(0), sampleRate: 16000 };
  if (!loaded) {
    if ((await localVoiceStatus()) !== 'ready') throw new Error('voice-model-missing');
    await load(() => undefined, signal);
  }
  const w = ensureWorker();
  const id = nextId++;
  const result = new Promise<WorkerOut>((resolve) => {
    waiting.set(id, resolve);
  });
  w.postMessage({ kind: 'speak', id, text: words });
  const out = await result;
  if (out.kind === 'error') throw new Error(out.message);
  if (out.kind !== 'audio') throw new Error('no audio');
  return { samples: out.samples, sampleRate: out.sampleRate };
}

/** Frees the model's memory (the files stay on disk). */
export function unloadLocalVoice(): void {
  resetWorker();
}
