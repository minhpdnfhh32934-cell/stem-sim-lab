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
  noteGpuFault,
  type GpuFault,
} from '@/ai/gpuSafety';
import { deleteRepo, opfsAvailable, repoStored } from '@/ai/modelStore';
import { ortPaths, webGPUStatus } from '@/ai/webGemma';
import { isSilent, type Pcm } from './audio';
import { VITS_CONTROLS, clampProsody, type VitsControl, type VitsProsody } from './vitsControls';

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

/** How a card fault's message starts (voiceErrors.ts maps it to "moved to the CPU"). */
export const CARD_FAULT = 'voice-model-card-fault';

/**
 * A phrase or a load that failed because the graphics card failed: "voice-model-card-fault: <the
 * fault as recorded>". It does not last (speak.ts): the next load runs on the CPU. A later CPU
 * failure never carries the prefix, so Settings never mistakes it for the card's.
 */
export class VoiceCardFault extends Error {
  override name = 'VoiceCardFault';
}

/** Deletions of the model so far: a phrase that started before one must not load it again. */
let deletions = 0;

/** The voice's own GPU worker failed in this session: the CPU from then on. */
let gpuFailedHere = false;
/** The failure that moved the voice off the card (as the page received it), for Settings. */
let gpuFaultMessage: string | null = null;

/** Why the voice left the graphics card in this session, or null (Settings explains it). */
export function localVoiceGpuFault(): string | null {
  return gpuFaultMessage;
}

/**
 * Where the voice model runs. The graphics card only when WebGPU exists, nothing forces the CPU,
 * no GPU fault is recorded (here or by Gemma) and the card is known to be a discrete one: long
 * WebGPU work made an integrated card's driver reset until Windows crashed (0x119, audit
 * GPU-01). A card that cannot be told (a browser, a failed adapter list, an unknown kind) is
 * treated as integrated. Otherwise the CPU (WebAssembly): slower, never a risk for the computer.
 */
export async function localVoiceDevice(): Promise<LocalVoiceDevice> {
  if (localVoiceDevicePreference() === 'wasm' || webGPUStatus() !== 'webgpu') return 'wasm';
  if (gpuFailedHere || gemmaBlockedByGpuFault() || lastGpuFault()) return 'wasm';
  const gpu = useGpuStore.getState();
  // The desktop app lists the cards at start-up; if it has not yet, ask rather than guess.
  const status = gpu.status ?? (await loadGpuStatus().catch(() => null));
  return gemmaOnIntegrated(status, gpu.gemmaInfo) === false ? 'webgpu' : 'wasm';
}

type WorkerOut =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'loaded' }
  | { kind: 'started'; id: number }
  | {
      kind: 'audio';
      id: number;
      samples: Float32Array;
      sampleRate: number;
      applied?: VitsControl[];
    }
  | { kind: 'error'; id: number; message: string };

/** A phrase's samples and the prosody controls the model applied itself (the page does the rest). */
export interface LocalPcm extends Pcm {
  applied: readonly VitsControl[];
}

let worker: Worker | null = null;
let loaded = false;
let loadedDevice: LocalVoiceDevice | null = null;
/** The device a load in progress puts the model on: a failure during the load is that device's. */
let loadingDevice: LocalVoiceDevice | null = null;
let nextId = 1;
const waiting = new Map<number, (out: WorkerOut) => void>();
let onLoad: ((out: WorkerOut) => void) | null = null;
let onProgress: ((loaded: number, total: number | null) => void) | null = null;

/**
 * What a failure means when the voice runs on the graphics card, or null when it is not the
 * card's: a lost device or a crashed worker, and also a phrase or a load that hangs and audio made
 * of NaN (how a failing card shows in this model).
 */
function gpuFaultReason(message: string): GpuFault['reason'] | null {
  if (/worker-crashed/.test(message)) return 'worker-crashed';
  if (/gpu-lost|device (?:was )?lost|device_removed|device_hung|dxgi_error/i.test(message))
    return 'device-lost';
  if (isGpuFailure(message) || /^voice-model-(?:timeout|load-timeout|nan)\b/.test(message))
    return 'runtime-gpu-error';
  return null;
}

/**
 * A failure of the worker on the graphics card keeps the voice off the card from then on, and is
 * recorded like Gemma's (src/ai/gpuSafety.ts): kept across restarts, and Gemma stops too. Never
 * reload onto a card that just failed (the reload loop behind the 0x119 crash). True when it was
 * a GPU failure.
 */
function noteFailure(message: string): boolean {
  if ((loadedDevice ?? loadingDevice) !== 'webgpu') return false;
  const reason = gpuFaultReason(message);
  if (!reason) return false;
  if (!gpuFailedHere) {
    gpuFailedHere = true;
    gpuFaultMessage = message;
    // Both workers ask WebGPU for the default adapter of the same page: the same card.
    noteGpuFault(reason, useGpuStore.getState().gemmaInfo);
  }
  return true;
}

// ------------------------------------------------------------ phrase watchdog

/** Phrases posted to the worker (id → characters) until it answers them. */
const posted = new Map<number, number>();
/** The phrase the worker is working on, with the timer that declares it hung. */
let running: {
  id: number;
  chars: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout>;
} | null = null;
/** Work per character measured on this computer (ms), for the device the model runs on. */
let measuredMsPerChar: number | null = null;
/** The device the speed was measured on (a new device starts a new measurement). */
let measuredOn: LocalVoiceDevice | null = null;

/** A phrase this short is mostly fixed cost: it says little about the speed per character. */
const MEASURE_MIN_CHARS = 20;

function noteSpeed(chars: number, ms: number): void {
  if (chars < MEASURE_MIN_CHARS) return;
  const perChar = ms / chars;
  // Slower phrases count at once, faster ones slowly: the budget is for hangs, not for speed.
  measuredMsPerChar =
    measuredMsPerChar === null
      ? perChar
      : Math.max(perChar, measuredMsPerChar * 0.7 + perChar * 0.3);
}

/** The worker started a phrase: its time budget runs from now, not from when it was asked for. */
function watchStarted(id: number): void {
  if (running) clearTimeout(running.timer);
  const chars = posted.get(id) ?? 0;
  running = {
    id,
    chars,
    startedAt: Date.now(),
    timer: setTimeout(() => {
      running = null;
      noteFailure('voice-model-timeout');
      failAll('voice-model-timeout');
    }, speakTimeoutMs(chars)),
  };
}

/** The worker answered a phrase (audio, error, or dropped after a cancel). */
function watchFinished(id: number, measured: boolean): void {
  posted.delete(id);
  if (running?.id !== id) return;
  clearTimeout(running.timer);
  if (measured) noteSpeed(running.chars, Date.now() - running.startedAt);
  running = null;
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./localVoiceWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerOut>) => {
    const out = event.data;
    if (out.kind === 'progress') {
      onProgress?.(out.loaded, out.total);
      return;
    }
    if (out.kind === 'started') {
      watchStarted(out.id);
      return;
    }
    if (out.kind === 'audio' || (out.kind === 'error' && out.id !== -1)) {
      watchFinished(out.id, out.kind === 'audio');
    }
    // The card failed: the worker is unloaded at once and everything waiting on it fails.
    if (out.kind === 'error' && noteFailure(out.message)) {
      failAll(out.message);
      return;
    }
    if (out.kind === 'loaded' || (out.kind === 'error' && out.id === -1)) {
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

/**
 * Stops the worker and fails whatever still waits on it (a load, phrases, late audio a paused
 * lesson keeps) with `message`. The only way the worker is dropped: a render that never settles
 * holds the lesson for ever (the board's pen waits for its speech).
 */
function failAll(message: string): void {
  const pending = [...waiting.entries()];
  waiting.clear();
  const load = onLoad;
  onLoad = null;
  resetWorker();
  load?.({ kind: 'error', id: -1, message });
  for (const [id, resolve] of pending) resolve({ kind: 'error', id, message });
}

/** Only through `failAll`, which settles what waited on the worker. */
function resetWorker(): void {
  try {
    worker?.terminate();
  } catch {
    /* already gone */
  }
  worker = null;
  loaded = false;
  loadedDevice = null;
  loadingDevice = null;
  if (running) clearTimeout(running.timer);
  running = null;
  posted.clear();
}

/** A stored model loads in seconds: this long without progress means the load hung. */
export const LOAD_STALL_MS = 60_000;

async function load(
  progress: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
  stallMs?: number,
  stillWanted?: () => boolean,
): Promise<void> {
  const device = await localVoiceDevice();
  // The model was deleted while this phrase waited: never start a worker that would download it
  // again behind the learner's back.
  if (stillWanted && !stillWanted()) throw new Error('voice-model-missing');
  // Loaded on the CPU, or on the card that is still fine: nothing to do. A card that became
  // unsafe since (a GPU fault, here or Gemma's), or the CPU forced, means a reload on the CPU.
  if (loaded && (loadedDevice === 'wasm' || loadedDevice === device)) return;
  // So the switch is always card → CPU. A phrase still rendered on the card fails with a reason
  // that does not last (speak.ts): the Windows voice reads on from the first unheard chunk, the
  // next sentence is on-device again, and Settings says the voice moved to the CPU.
  if (loaded) failAll('voice-model-moved-to-cpu');
  if (signal?.aborted) throw new Error('cancelled');
  const w = ensureWorker();
  const stall: { timer?: ReturnType<typeof setTimeout> } = {};
  const arm = () => {
    if (stallMs === undefined) return;
    clearTimeout(stall.timer);
    stall.timer = setTimeout(() => {
      noteFailure('voice-model-load-timeout');
      failAll('voice-model-load-timeout');
    }, stallMs);
  };
  onProgress = (done, total) => {
    arm();
    progress(done, total);
  };
  let cancel: () => void = () => undefined;
  const done = new Promise<WorkerOut>((resolve, reject) => {
    onLoad = resolve;
    cancel = () => {
      failAll('cancelled');
      reject(new Error('cancelled'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
  });
  if (measuredMsPerChar !== null && device !== measuredOn) measuredMsPerChar = null;
  measuredOn = device;
  loadingDevice = device;
  arm();
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
    clearTimeout(stall.timer);
    loadingDevice = null;
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

/**
 * Deletes the model. A phrase still being rendered (a lesson speaking, or late audio a paused
 * lesson waits for) fails as a missing model: the lesson reads on with the Windows voice and
 * Settings says the voice is no longer on this computer.
 */
export async function deleteLocalVoice(): Promise<void> {
  deletions++;
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* storage blocked */
  }
  failAll('voice-model-missing');
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

/** Time the worker may take for a phrase whatever its length (loading a session, warming up). */
const PHRASE_BASE_MS = 15_000;
/** Never less per character than this (the first fixed budget, 2026-10-13). */
const MIN_MS_PER_CHAR = 200;
/**
 * Before anything is measured: the CPU needed ~1.7 s per second of speech, ~113 ms per character
 * (measured 2026-10-12); rounded up, then times three like a measured speed.
 */
const GUESS_MS_PER_CHAR = 120;

/**
 * Longest a phrase may run once the worker started it: past it the worker is taken as hung and
 * restarted, so a lesson never waits for ever. Three times the speed measured on this computer
 * (or the guess before the first phrase), so a slow CPU is not taken for a hung one.
 */
export function speakTimeoutMs(
  words: string | number,
  msPerChar: number | null = measuredMsPerChar,
): number {
  const chars = typeof words === 'number' ? words : words.length;
  const perChar = Math.max(MIN_MS_PER_CHAR, 3 * (msPerChar ?? GUESS_MS_PER_CHAR));
  return PHRASE_BASE_MS + chars * perChar;
}

/** Any sample that is not a number (NaN, ±∞): the model's maths failed. */
function hasNonFinite(samples: Float32Array): boolean {
  for (const v of samples) if (!Number.isFinite(v)) return true;
  return false;
}

/** A phrase's answer from the worker as samples; throws on an error, NaN or silence. */
function pcmFrom(out: WorkerOut): LocalPcm {
  if (out.kind === 'error') throw new Error(out.message);
  if (out.kind !== 'audio') throw new Error('no audio');
  const applied = (out.applied ?? []).filter((c) => VITS_CONTROLS.includes(c));
  const pcm: LocalPcm = { samples: out.samples, sampleRate: out.sampleRate, applied };
  // NaN audio from the graphics card is the card failing: off the card at once, and the phrase
  // fails with the fault as recorded (Settings then says the voice moved to the CPU).
  if (hasNonFinite(pcm.samples) && noteFailure('voice-model-nan')) {
    failAll('voice-model-nan');
    throw new Error('voice-model-nan');
  }
  // Silence is not speech: the system voice then reads the phrase instead.
  if (isSilent(pcm)) throw new Error('voice-model-silent');
  return pcm;
}

export interface SynthesizeOptions {
  /**
   * Called when `signal` stops a phrase the worker already started (it cannot be cut short) with
   * that phrase's audio still to come, so a lesson can keep it ("Tiếp tục" then needs no second
   * render behind the first). Without it, the late audio is dropped.
   */
  late?: (audio: Promise<LocalPcm>) => void;
}

/**
 * Speaks one phrase into samples (loads the stored model first if needed). `prosody` is asked of
 * the model, which applies what its graph accepts (`LocalPcm.applied`, vitsControls.ts).
 */
export async function synthesizeLocal(
  text: string,
  signal: AbortSignal,
  prosody?: Partial<VitsProsody>,
  options: SynthesizeOptions = {},
): Promise<LocalPcm> {
  const words = textForModel(text);
  if (!words) return { samples: new Float32Array(0), sampleRate: 16000, applied: [] };
  if (signal.aborted) throw new Error('cancelled');
  const generation = deletions;
  if ((await localVoiceStatus()) !== 'ready') throw new Error('voice-model-missing');
  // A graphics-card failure during this call, as recorded (localVoiceGpuFault): the phrase fails
  // with that same message (Settings: "moved to the CPU") and the next load runs on the CPU.
  const faultBefore = gpuFailedHere;
  const cardFault = (e: unknown): VoiceCardFault | null => {
    const message = e instanceof Error ? e.message : String(e);
    return !faultBefore && gpuFailedHere && message === gpuFaultMessage
      ? new VoiceCardFault(`${CARD_FAULT}: ${message}`, { cause: e })
      : null;
  };
  try {
    await load(
      () => undefined,
      signal,
      LOAD_STALL_MS,
      () => generation === deletions,
    );
  } catch (e) {
    const fault = cardFault(e);
    if (fault) throw fault;
    const message = e instanceof Error ? e.message : String(e);
    // Named, so a lesson knows the model will not load and stops asking for it (speak.ts).
    if (message === 'cancelled' || message.startsWith('voice-model-')) throw e;
    throw new Error(`voice-model-load-failed: ${message}`, { cause: e });
  }
  const w = ensureWorker();
  const id = nextId++;
  const out = await new Promise<WorkerOut>((resolve, reject) => {
    // Stopped while the model was being checked or loaded.
    if (signal.aborted) {
      reject(new Error('cancelled'));
      return;
    }
    const stop = () => {
      // A phrase not started yet is dropped; one already running cannot be cut short, and its
      // own time budget still guards the worker (watchStarted). Its audio goes to `late` when
      // the caller keeps it.
      const { late } = options;
      if (late && running?.id === id) {
        late(
          new Promise<LocalPcm>((keep, fail) => {
            waiting.set(id, (o) => {
              try {
                keep(pcmFrom(o));
              } catch (e) {
                fail(e instanceof Error ? e : new Error(String(e)));
              }
            });
          }),
        );
      } else {
        waiting.delete(id);
        try {
          worker?.postMessage({ kind: 'cancel', id });
        } catch {
          /* the worker is gone */
        }
      }
      reject(new Error('cancelled'));
    };
    signal.addEventListener('abort', stop, { once: true });
    waiting.set(id, (o) => {
      signal.removeEventListener('abort', stop);
      resolve(o);
    });
    posted.set(id, words.length);
    w.postMessage({
      kind: 'speak',
      id,
      text: words,
      ...(prosody ? { prosody: clampProsody(prosody) } : {}),
    });
  });
  try {
    return pcmFrom(out);
  } catch (e) {
    throw cardFault(e) ?? e;
  }
}

/**
 * Frees the model's memory (the files stay on disk). A phrase still being rendered fails with a
 * reason that does not last (not "missing": the next phrase loads the model again).
 */
export function unloadLocalVoice(): void {
  failAll('voice-model-unloaded');
}
