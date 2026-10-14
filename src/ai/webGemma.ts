/**
 * Gemma running fully inside the app (Transformers.js + WebGPU, no server).
 * Models come from public onnx-community repos, so downloading needs no token.
 * Files live in OPFS (src/ai/modelStore.ts); a tiny IndexedDB flag records which models
 * finished downloading. Which card runs it is chosen by the desktop app at start-up (gpu.ts);
 * when the model leaves the GPU memory comes from gemmaPrefs.ts.
 */
import { useGemmaPrefs } from './gemmaPrefs';
import { useGpuStore, type WebGpuInfo } from './gpu';
import { gemmaBlockedByGpuFault, isGpuFailure, noteGpuFault } from './gpuSafety';
import { deleteRepo, opfsAvailable, repoStored } from './modelStore';
import { GEMMA_FIRST_PIECE_MS, GEMMA_PIECE_GAP_MS, watchStall } from './stallWatch';
import { webGemmaModel } from './webGemmaModels';

export type WebGemmaStatus = 'missing' | 'ready';
export type EngineKind = 'webgpu' | 'none';

const DB_NAME = 'stemsim-gemma-done';

export function webGPUStatus(): EngineKind {
  try {
    const nav = navigator as Navigator & { gpu?: unknown };
    if (typeof navigator !== 'undefined' && typeof nav.gpu !== 'undefined') {
      return 'webgpu';
    }
  } catch {
    /* non-browser contexts fall through */
  }
  return 'none';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('done', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('cannot open model storage'));
    };
  });
}

async function doneGet(id: string): Promise<boolean> {
  try {
    const db = await openDb();
    try {
      const row = (await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('done', 'readonly');
        const get = tx.objectStore('done').get(id);
        get.onsuccess = () => {
          resolve(get.result);
        };
        get.onerror = () => {
          reject(get.error ?? new Error('cannot read model storage'));
        };
      })) as { id: string } | undefined;
      return !!row;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

async function donePut(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('done', 'readwrite');
      tx.objectStore('done').put({ id, at: Date.now() });
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(
          tx.error instanceof Error
            ? tx.error
            : new Error('cannot write model storage', { cause: tx.error }),
        );
      };
    });
  } finally {
    db.close();
  }
}

async function doneDelete(id: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('done', 'readwrite');
        tx.objectStore('done').delete(id);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error ?? new Error('cannot write model storage'));
        };
      });
    } finally {
      db.close();
    }
  } catch {
    /* storage blocked: nothing to forget */
  }
}

/**
 * Ready = the download finished (flag) AND the files are still stored (the browser may evict
 * storage, or an older version may have failed to keep the weights).
 */
export async function webGemmaStatus(modelId: string): Promise<WebGemmaStatus> {
  if (!(await doneGet(modelId))) return 'missing';
  const meta = webGemmaModel(modelId);
  if (meta && opfsAvailable() && !(await repoStored(meta.repo))) return 'missing';
  return 'ready';
}

export async function webGemmaReady(modelId: string): Promise<boolean> {
  return webGPUStatus() === 'webgpu' && (await webGemmaStatus(modelId)) === 'ready';
}

export interface DownloadProgress {
  loaded: number;
  /** Null while the total size is still unknown. */
  total: number | null;
}

/** Removes every cached file of a model repo (Transformers.js Cache Storage). */
async function deleteCachedRepo(repo: string): Promise<void> {
  try {
    const names = await caches.keys();
    await Promise.all(
      names.map(async (name) => {
        try {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          await Promise.all(
            keys.map((request) =>
              request.url.includes(repo) ? cache.delete(request) : Promise.resolve(false),
            ),
          );
        } catch {
          /* keep going */
        }
      }),
    );
  } catch {
    /* Cache API unavailable */
  }
}

export async function deleteWebGemma(modelId: string): Promise<void> {
  const meta = webGemmaModel(modelId);
  unloadWebGemma();
  if (meta) {
    await deleteRepo(meta.repo);
    // Also frees what older versions left in Cache Storage.
    await deleteCachedRepo(meta.repo);
  }
  await doneDelete(modelId);
}

type WorkerOut =
  | { kind: 'inited' }
  | { kind: 'loaded'; modelId: string; gpu: WebGpuInfo | null }
  | { kind: 'load-progress'; modelId: string; loaded: number; total: number | null }
  | { kind: 'reply'; id: number; text: string; truncated: boolean }
  | { kind: 'partial'; id: number; text: string }
  | { kind: 'device-lost'; message: string }
  | { kind: 'error'; id: number; message: string };

let worker: Worker | null = null;
/** Listeners for the pieces of an answer that is still being generated, by request id. */
const partials = new Map<number, (piece: string) => void>();
let inited = false;
let loadedId: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
/** The worker runs one generation at a time: serialize every request. */
let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<number, (out: WorkerOut) => void>();
let progressListener: ((p: { loaded: number; total: number | null }) => void) | null = null;

/**
 * ONNX Runtime needs BOTH files of its WebGPU-capable "asyncify" build: the `.wasm` binary and
 * the `.mjs` loader. Both are copied into public/ort by scripts/copy-ort-wasm.mjs (no CDN).
 */
export function ortPaths(): { wasm: string; mjs: string } {
  const base = `${(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')}ort/`;
  return {
    wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
    mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`,
  };
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./webGemmaWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const out = event.data;
      if (out.kind === 'partial') {
        partials.get(out.id)?.(out.text);
        return;
      }
      if (out.kind === 'device-lost') {
        // The model is gone with its GPU device: fail what waits and keep Gemma off for this
        // session, so it is never reloaded onto a card that just failed (audit GPU-01).
        noteGpuFault('device-lost', useGpuStore.getState().gemmaInfo);
        failAll('gpu-lost');
        return;
      }
      if (out.kind === 'reply' || out.kind === 'error') {
        const resolve = pending.get(out.id);
        if (resolve) {
          pending.delete(out.id);
          resolve(out);
        }
      } else if (out.kind === 'inited') {
        inited = true;
        const resolve = pending.get(-2);
        if (resolve) {
          pending.delete(-2);
          resolve(out);
        }
      } else if (out.kind === 'load-progress') {
        if (progressListener) progressListener({ loaded: out.loaded, total: out.total });
      } else {
        loadedId = out.modelId;
        // The card the model really runs on (Settings → GPU shows it).
        useGpuStore.getState().setGemmaInfo(out.gpu);
        const resolve = pending.get(-3);
        if (resolve) {
          pending.delete(-3);
          resolve(out);
        }
      }
    };
    // A crashed worker (e.g. out of GPU memory while loading) must fail every waiting
    // call — init, load and chat — instead of leaving "downloading…" spinning forever.
    worker.onerror = (event) => {
      event.preventDefault();
      noteGpuFault('worker-crashed', useGpuStore.getState().gemmaInfo);
      failAll('worker-crashed');
    };
  }
  return worker;
}

/** Answers every waiting call with `message` and starts a fresh worker next time. */
function failAll(message: string): void {
  const failed = [...pending.entries()];
  pending.clear();
  resetWorker();
  for (const [id, resolve] of failed) {
    resolve({ kind: 'error', id, message });
  }
}

function waitFor(id: number): Promise<WorkerOut> {
  return new Promise((resolve) => {
    pending.set(id, resolve);
  });
}

function resetWorker(): void {
  try {
    worker?.terminate();
  } catch {
    /* already gone */
  }
  worker = null;
  inited = false;
  loadedId = null;
  progressListener = null;
  memoryChanged();
}

async function ensureInited(signal?: AbortSignal): Promise<void> {
  if (inited) return;
  const w = ensureWorker();
  const waiting = waitFor(-2);
  w.postMessage({ kind: 'init', ort: ortPaths() });
  if (signal?.aborted) throw new Error('cancelled');
  const done = new Promise<WorkerOut>((resolve, reject) => {
    void waiting.then(resolve, reject);
    signal?.addEventListener(
      'abort',
      () => {
        reject(new Error('cancelled'));
      },
      { once: true },
    );
  });
  const out = await done;
  if (out.kind === 'error') throw new Error(out.message);
}

async function loadIntoWorker(
  modelId: string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const meta = webGemmaModel(modelId);
  if (!meta) throw new Error(`unknown model ${modelId}`);
  if (webGPUStatus() !== 'webgpu') throw new Error('webgpu-missing');
  // After a GPU fault the model is not loaded again by itself (audit GPU-01).
  if (gemmaBlockedByGpuFault()) throw new Error('gpu-blocked');
  await ensureInited(signal);
  if (loadedId === modelId) return;
  const w = ensureWorker();
  const waiting = waitFor(-3);
  progressListener = (p) => {
    onProgress({ loaded: p.loaded, total: p.total });
  };
  // `device` is explicit: without it Transformers.js falls back to the CPU (wasm) backend.
  w.postMessage({
    kind: 'load',
    modelId,
    repo: meta.repo,
    revision: meta.revision,
    modality: meta.kind,
    dtype: meta.dtype,
    device: 'webgpu',
  });
  const done = new Promise<WorkerOut>((resolve, reject) => {
    void waiting.then(resolve, reject);
    signal?.addEventListener(
      'abort',
      () => {
        resetWorker();
        reject(new Error('cancelled'));
      },
      { once: true },
    );
  });
  try {
    const out = await done;
    if (out.kind === 'error') throw new Error(out.message);
  } finally {
    progressListener = null;
  }
}

/**
 * Refuses up front when the browser's storage quota cannot hold the model (instead of failing
 * after hundreds of MB), and asks the browser to keep the files (persistent storage).
 */
async function checkFreeSpace(bytes: number): Promise<void> {
  try {
    const storage = navigator.storage as StorageManager & { persist?: () => Promise<boolean> };
    if (typeof storage.persist === 'function') void storage.persist().catch(() => false);
    const { quota, usage } = await navigator.storage.estimate();
    if (quota !== undefined && quota - (usage ?? 0) < bytes * 1.05) {
      throw new Error('storage: not enough free space for this model');
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('storage:')) throw e;
    /* estimate unavailable: try anyway, errors are still reported */
  }
}

/**
 * Downloads (first time) and loads a model, with live progress. Files come from
 * the public model repo — no token, no login.
 */
export async function downloadWebGemma(
  modelId: string,
  onProgress: (p: DownloadProgress) => void,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  const meta = webGemmaModel(modelId);
  if (meta) await checkFreeSpace(meta.bytes);
  await loadIntoWorker(modelId, onProgress, opts.signal);
  // Never report "ready" for a model that would have to be downloaded again next time.
  if (meta && opfsAvailable() && !(await repoStored(meta.repo))) {
    throw new Error('storage: the model files could not be saved on this computer');
  }
  await donePut(modelId);
  // Older versions kept (part of) the files in Cache Storage: free that duplicate space.
  if (meta && opfsAvailable()) await deleteCachedRepo(meta.repo);
  // Free the card memory: chatting reloads from the warm cache on demand.
  unloadWebGemma();
}

function unloadWebGemma(): void {
  clearIdleTimer();
  const wasLoaded = loadedId !== null;
  loadedId = null;
  try {
    worker?.postMessage({ kind: 'unload' });
  } catch {
    /* the worker may already be gone */
  }
  if (wasLoaded) memoryChanged();
}

/** Tells Settings that the model in GPU memory changed (loaded, freed). */
function memoryChanged(): void {
  try {
    window.dispatchEvent(new Event('stemsim:gemma-memory'));
  } catch {
    /* no window (worker or test) */
  }
}

function clearIdleTimer(): void {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = null;
}

/** Frees the GPU memory after the chosen idle time ("AI local → GPU"); 0 keeps the model. */
function scheduleIdleUnload(): void {
  clearIdleTimer();
  const minutes = useGemmaPrefs.getState().unloadAfterMin;
  if (minutes > 0) idleTimer = setTimeout(unloadWebGemma, minutes * 60_000);
}

/** The model now held in GPU memory, if any. */
export function loadedGemma(): string | null {
  return loadedId;
}

/** "Giải phóng bộ nhớ GPU ngay": the next question loads the model again from disk. */
export function freeGemmaMemory(): void {
  unloadWebGemma();
}

export interface WebGemmaReply {
  content: string;
  model: string;
  /** The answer stopped at the maxTokens limit. */
  truncated: boolean;
}

export interface WebChatMessage {
  role: string;
  content: string;
}

/**
 * The Gemma-3 chat template rejects anything but strict user/assistant
 * alternation starting with the user (an unanswered question leaves two user
 * turns in a row). Merge same-role neighbours so any real history stays valid.
 */
function normalizeHistory(messages: WebChatMessage[]): WebChatMessage[] {
  const merged: WebChatMessage[] = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      merged.push({ role, content: m.content });
    }
  }
  while (merged.length > 0 && merged[0]?.role !== 'user') merged.shift();
  return merged;
}

/**
 * The answer without the question that small models often repeat first. While the echo is still
 * arriving (the text so far is a prefix of the question) there is nothing to show yet.
 */
export function withoutEcho(text: string, echo: string): string {
  const t = text.trimStart();
  if (!echo) return t.trim() ? t : '';
  if (t.startsWith(echo)) return t.slice(echo.length).trim();
  if (echo.startsWith(t.trim())) return '';
  return t;
}

/** Asks the in-browser model. Serialized: one generation at a time. */
export function webGemmaChat(args: {
  model: string;
  system: string;
  messages: WebChatMessage[];
  images?: ArrayBuffer[];
  temperature?: number;
  maxTokens?: number;
  /** Most prompt tokens; the worker drops the oldest turns above it (exact count). */
  inputBudget?: number;
  /**
   * Repetition rules (webGemmaWorker.ts `Decoding`); the worker defaults to 'app'. 'legacy'
   * reproduces the shipped 0.6.0 decoding for scripts/teaching/eval-gemma.mjs only: the app
   * never sets it.
   */
  decoding?: 'app' | 'legacy';
  /** Called with the answer so far while it is being generated (echoed question removed). */
  onPartial?: (textSoFar: string) => void;
  /**
   * Stops the answer ("Dừng" in the chat): a request still waiting never starts, a running one is
   * interrupted in the worker (InterruptableStoppingCriteria) and its partial text is dropped.
   * The call rejects with "cancelled" at once; the queue moves on when the worker has stopped.
   */
  signal?: AbortSignal;
  /** The question a small model may repeat first (default: the last user message). */
  echo?: string;
}): Promise<WebGemmaReply> {
  const signal = args.signal;
  const task = async (): Promise<WebGemmaReply> => {
    if (signal?.aborted) throw new Error('cancelled');
    const meta = webGemmaModel(args.model);
    if (!meta) throw new Error(`unknown model ${args.model}`);
    // Photos need the vision model: switch automatically when it is ready.
    let id = args.model;
    if ((args.images ?? []).length > 0 && meta.kind !== 'vision') {
      if ((await webGemmaStatus('gemma4-e2b')) === 'ready') {
        id = 'gemma4-e2b';
      } else {
        throw new Error('needs-vision-model');
      }
    }
    if ((await webGemmaStatus(id)) !== 'ready') throw new Error('model-missing');
    if (signal?.aborted) throw new Error('cancelled');
    clearIdleTimer();
    const wasLoaded = loadedId;
    try {
      await loadIntoWorker(id, () => undefined);
    } catch (e) {
      // A model still in GPU memory must leave it after the idle time, whatever went wrong.
      if (loadedId !== null) scheduleIdleUnload();
      throw e;
    }
    if (wasLoaded !== loadedId) memoryChanged();
    if (signal?.aborted) {
      // Stopped while the model was loading: it still leaves the GPU memory after the idle time.
      scheduleIdleUnload();
      throw new Error('cancelled');
    }
    const w = ensureWorker();
    const chatId = nextId++;
    const waiting = waitFor(chatId);
    const lastUser = [...args.messages].reverse().find((m) => m.role !== 'assistant');
    const echo = (args.echo ?? lastUser?.content ?? '').trim();
    const stop = () => {
      try {
        w.postMessage({ kind: 'stop', id: chatId });
      } catch {
        /* the worker is already gone */
      }
    };
    signal?.addEventListener('abort', stop, { once: true });
    const onPartial = args.onPartial;
    // An answer that stops coming is ended with a clear error and a fresh worker (audit AI-01).
    const watch = watchStall({
      firstMs: GEMMA_FIRST_PIECE_MS,
      gapMs: GEMMA_PIECE_GAP_MS,
      onStall: () => {
        failAll('gemma-stalled');
      },
    });
    let soFar = '';
    partials.set(chatId, (piece) => {
      watch.touch();
      if (!onPartial) return;
      soFar += piece;
      const shown = withoutEcho(soFar, echo);
      if (shown) onPartial(shown);
    });
    w.postMessage({
      kind: 'chat',
      id: chatId,
      system: args.system,
      messages: normalizeHistory(args.messages),
      images: args.images ?? [],
      temperature: args.temperature ?? 0.2,
      maxTokens: args.maxTokens ?? 1024,
      ...(args.inputBudget !== undefined ? { inputBudget: args.inputBudget } : {}),
      ...(args.decoding !== undefined ? { decoding: args.decoding } : {}),
    });
    const out = await waiting.finally(() => {
      watch.stop();
      partials.delete(chatId);
      signal?.removeEventListener('abort', stop);
    });
    scheduleIdleUnload();
    // A GPU error is handled even after "Dừng": a driver reset while the answer was being stopped
    // must still turn Gemma off and replace the worker (audit GPU-01).
    if (out.kind === 'error' && isGpuFailure(out.message) && !gemmaBlockedByGpuFault()) {
      noteGpuFault('runtime-gpu-error', useGpuStore.getState().gemmaInfo);
      resetWorker();
    }
    if (signal?.aborted) throw new Error('cancelled');
    if (out.kind === 'error') throw new Error(out.message);
    let text = out.kind === 'reply' ? out.text.trim() : '';
    if (!text) throw new Error('empty reply');
    // Small models often echo the question first: drop that prefix for readability.
    if (echo && text.startsWith(echo)) text = text.slice(echo.length).trim();
    if (!text) throw new Error('empty reply');
    return { content: text, model: id, truncated: out.kind === 'reply' && out.truncated };
  };
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return abortable(run, signal);
}

/** Rejects with "cancelled" as soon as `signal` aborts (the work itself may still finish). */
export function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const cancel = () => {
      reject(new Error('cancelled'));
    };
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener('abort', cancel, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', cancel);
        resolve(value);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', cancel);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
