/**
 * The on-device Vietnamese voice (page side): download / delete with real progress, and
 * synthesis through `localVoiceWorker.ts`. The model is Meta's MMS-TTS for Vietnamese, licensed
 * CC BY-NC 4.0 (non-commercial use, with attribution) — see docs/THIRD_PARTY.md. Piper's
 * Vietnamese voices were not used: they are fine-tuned from a research-only voice and need the
 * GPL espeak-ng phonemizer.
 */
import { loadGpuStatus, useGpuStore } from '@/ai/gpu';
import {
  gemmaBlockedByGpuFault,
  gemmaOnIntegrated,
  isGpuFailure,
  lastGpuFault,
} from '@/ai/gpuSafety';
import { deleteRepo, opfsAvailable, repoStored } from '@/ai/modelStore';
import { ortPaths, webGPUStatus } from '@/ai/webGemma';
import { isSilent, type Pcm } from './audio';

export const LOCAL_VOICE = {
  repo: 'Xenova/mms-tts-vie',
  /** Pinned commit (audit SEC-06, checked 2026-10-13). */
  revision: '7f40ca63bb6072ac57026210f2fea55242511214',
  pageId: 'mms-tts-vie',
  /** Full-precision weights: the 8-bit file is smaller but audibly rougher. */
  dtype: 'fp32' as const,
  /** model.onnx (114 302 582 bytes, HuggingFace API 2026-10-12) + tokenizer files. */
  bytes: 114_400_000,
  sizeLabel: '≈ 115 MB',
  licence: 'CC BY-NC 4.0',
};

const FLAG = 'stemsim.voice-model';
/** "wasm" forces the CPU (tests, the listening-pack tool); absent = the app decides. */
const DEVICE_KEY = 'stemsim.voice-device';

export type LocalVoiceStatus = 'ready' | 'missing';
export type LocalVoiceDevice = 'webgpu' | 'wasm';
export type LocalVoiceDevicePreference = 'auto' | 'wasm';

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

export function localVoiceDevicePreference(): LocalVoiceDevicePreference {
  try {
    return localStorage.getItem(DEVICE_KEY) === 'wasm' ? 'wasm' : 'auto';
  } catch {
    return 'auto';
  }
}

/** Forces the voice model onto the CPU ('wasm') or lets the app choose ('auto'). */
export function setLocalVoiceDevicePreference(preference: LocalVoiceDevicePreference): void {
  try {
    if (preference === 'wasm') localStorage.setItem(DEVICE_KEY, 'wasm');
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* storage blocked: the app keeps choosing */
  }
}

/** The voice's own GPU worker failed in this session: the CPU from then on. */
let gpuFailedHere = false;

/**
 * Where the voice model runs. The graphics card only when WebGPU exists, nothing forces the CPU,
 * no GPU fault is recorded (here or by Gemma) and the card is not known to be integrated: long
 * WebGPU work made an integrated card's driver reset until Windows crashed (0x119, audit
 * GPU-01). Otherwise the CPU (WebAssembly): slower, never a risk for the computer.
 */
export async function localVoiceDevice(): Promise<LocalVoiceDevice> {
  if (localVoiceDevicePreference() === 'wasm' || webGPUStatus() !== 'webgpu') return 'wasm';
  if (gpuFailedHere || gemmaBlockedByGpuFault() || lastGpuFault()) return 'wasm';
  const gpu = useGpuStore.getState();
  // The desktop app lists the cards at start-up; if it has not yet, ask rather than guess.
  const status = gpu.status ?? (await loadGpuStatus().catch(() => null));
  return gemmaOnIntegrated(status, gpu.gemmaInfo) === true ? 'wasm' : 'webgpu';
}

type WorkerOut =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'loaded' }
  | { kind: 'audio'; id: number; samples: Float32Array; sampleRate: number }
  | { kind: 'error'; id: number; message: string };

let worker: Worker | null = null;
let loaded = false;
let loadedDevice: LocalVoiceDevice | null = null;
let nextId = 1;
const waiting = new Map<number, (out: WorkerOut) => void>();
let onLoad: ((out: WorkerOut) => void) | null = null;
let onProgress: ((loaded: number, total: number | null) => void) | null = null;

/** A failure of the worker on the graphics card keeps the voice off the card from then on. */
function noteFailure(message: string): void {
  if (loadedDevice === 'webgpu' && isGpuFailure(message)) gpuFailedHere = true;
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./localVoiceWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerOut>) => {
    const out = event.data;
    if (out.kind === 'error') noteFailure(out.message);
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
  // A crashed worker (out of memory, a lost GPU…) must fail everything that waits on it.
  worker.onerror = (event) => {
    event.preventDefault();
    noteFailure('worker-crashed');
    failAll('worker-crashed');
  };
  return worker;
}

/** Stops the worker and fails whatever still waits on it. */
function failAll(message: string): void {
  const pending = [...waiting.entries()];
  waiting.clear();
  const load = onLoad;
  onLoad = null;
  resetWorker();
  load?.({ kind: 'error', id: -1, message });
  for (const [id, resolve] of pending) resolve({ kind: 'error', id, message });
}

function resetWorker(): void {
  try {
    worker?.terminate();
  } catch {
    /* already gone */
  }
  worker = null;
  loaded = false;
  loadedDevice = null;
}

async function load(
  progress: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  const device = await localVoiceDevice();
  // Loaded on the CPU, or on the card that is still fine: nothing to do. A card that became
  // unsafe since (a GPU fault) means a reload on the CPU.
  if (loaded && (loadedDevice === 'wasm' || loadedDevice === device)) return;
  if (loaded) resetWorker();
  if (signal?.aborted) throw new Error('cancelled');
  const w = ensureWorker();
  onProgress = progress;
  let cancel: () => void = () => undefined;
  const done = new Promise<WorkerOut>((resolve, reject) => {
    onLoad = resolve;
    cancel = () => {
      resetWorker();
      reject(new Error('cancelled'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
  });
  // The graphics card when it is safe (measured 2026-10-12: ~0.6 s of work per second of
  // speech), else the CPU (~1.7 s per second: phrases then wait for each other).
  w.postMessage({
    kind: 'load',
    repo: LOCAL_VOICE.repo,
    revision: LOCAL_VOICE.revision,
    dtype: LOCAL_VOICE.dtype,
    device,
    ort: ortPaths(),
  });
  try {
    const out = await done;
    if (out.kind === 'error') throw new Error(out.message);
    loaded = true;
    loadedDevice = device;
  } finally {
    onProgress = null;
    // Only the load listens: stopping a later phrase must never unload a loaded model.
    signal?.removeEventListener('abort', cancel);
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

/**
 * Longest wait for one phrase (the CPU needs ~1.7 s per second of speech, ~15 characters per
 * second): past it the worker is taken as hung and restarted, so a lesson never waits for ever.
 */
export function speakTimeoutMs(words: string): number {
  return 15_000 + words.length * 200;
}

/** Speaks one phrase into samples (loads the stored model first if needed). */
export async function synthesizeLocal(text: string, signal: AbortSignal): Promise<Pcm> {
  const words = textForModel(text);
  if (!words) return { samples: new Float32Array(0), sampleRate: 16000 };
  if (signal.aborted) throw new Error('cancelled');
  if ((await localVoiceStatus()) !== 'ready') throw new Error('voice-model-missing');
  await load(() => undefined, signal);
  const w = ensureWorker();
  const id = nextId++;
  const out = await new Promise<WorkerOut>((resolve, reject) => {
    // Stopped while the model was being checked or loaded.
    if (signal.aborted) {
      reject(new Error('cancelled'));
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      waiting.delete(id);
    };
    const stop = () => {
      finish();
      reject(new Error('cancelled'));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error('voice-model-timeout'));
      failAll('voice-model-timeout');
    }, speakTimeoutMs(words));
    signal.addEventListener('abort', stop, { once: true });
    waiting.set(id, (o) => {
      finish();
      resolve(o);
    });
    w.postMessage({ kind: 'speak', id, text: words });
  });
  if (out.kind === 'error') throw new Error(out.message);
  if (out.kind !== 'audio') throw new Error('no audio');
  const pcm = { samples: out.samples, sampleRate: out.sampleRate };
  // Silence is not speech: the system voice then reads the phrase instead.
  if (isSilent(pcm)) throw new Error('voice-model-silent');
  return pcm;
}

/** Frees the model's memory (the files stay on disk). */
export function unloadLocalVoice(): void {
  resetWorker();
}
