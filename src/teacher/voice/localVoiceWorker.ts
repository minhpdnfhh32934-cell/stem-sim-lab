/**
 * AI Teacher's on-device Vietnamese voice: Meta's MMS-TTS model for Vietnamese (VITS,
 * `Xenova/mms-tts-vie`, CC BY-NC 4.0) run with Transformers.js on the graphics card (WebGPU) or the CPU (WebAssembly), in
 * its own worker so the page never stalls. Text in, 16 kHz float samples out; nothing leaves
 * the computer after the one-time download.
 */
/// <reference lib="webworker" />
import { AutoTokenizer, Tensor, VitsModel, env } from '@huggingface/transformers';
import { isGpuFailure } from '@/ai/gpuSafety';
import { modelStore, opfsAvailable } from '@/ai/modelStore';
import {
  controlFeeds,
  runWithControls,
  sessionInputNames,
  supportedControls,
  type VitsControl,
  type VitsProsody,
} from './vitsControls';

// Same storage as Gemma: OPFS (Cache Storage refuses large entries), Cache Storage as fallback.
if (opfsAvailable()) {
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = modelStore;
} else {
  env.useBrowserCache = true;
}
// ONNX Runtime loads its loader from /ort/ (same origin), never as a blob: URL (strict CSP).
env.useWasmCache = false;

type InMessage =
  | {
      kind: 'load';
      repo: string;
      /** Pinned commit of the repo (audit SEC-06). */
      revision: string;
      dtype: 'fp32' | 'q8';
      device: 'wasm' | 'webgpu';
      ort: { wasm: string; mjs: string };
    }
  /** `prosody` is applied only where the model's graph accepts it (vitsControls.ts). */
  | { kind: 'speak'; id: number; text: string; prosody?: VitsProsody }
  /** The page stopped waiting for this phrase: dropped if it has not started yet. */
  | { kind: 'cancel'; id: number }
  | { kind: 'unload' };

type Job = Exclude<InMessage, { kind: 'cancel' }>;

type OutMessage =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'loaded' }
  /** Work on this phrase begins now: the page's time budget for it starts here. */
  | { kind: 'started'; id: number }
  /** `applied`: the prosody controls the model used for this phrase (the page does the rest). */
  | {
      kind: 'audio';
      id: number;
      samples: Float32Array;
      sampleRate: number;
      applied: VitsControl[];
    }
  | { kind: 'error'; id: number; message: string };

interface ProgressInfo {
  status?: string;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
}

let engine: {
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
  model: Awaited<ReturnType<typeof VitsModel.from_pretrained>>;
  sampleRate: number;
  /** Prosody inputs the graph names (none for the MMS export in use). */
  controls: VitsControl[];
} | null = null;

function post(out: OutMessage, transfer: Transferable[] = []) {
  self.postMessage(out, transfer);
}

/** Phrases the page no longer waits for (ids only grow: older ones are already done). */
const cancelled = new Set<number>();
let lastSpoken = 0;
/**
 * One job at a time, in order: an `await` inside a job would otherwise let the next message start
 * a second synthesis beside it, and the page could not tell when a phrase really started.
 */
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  if (msg.kind === 'cancel') {
    if (msg.id > lastSpoken) cancelled.add(msg.id);
    return;
  }
  queue = queue.then(() => run(msg));
};

/** Never throws: an error is answered on the id the page waits for (-1 for a load). */
async function run(msg: Job): Promise<void> {
  try {
    if (msg.kind === 'load') {
      const wasm = env.backends.onnx.wasm as { wasmPaths?: unknown } | undefined;
      if (wasm) wasm.wasmPaths = { wasm: msg.ort.wasm, mjs: msg.ort.mjs };
      if (!engine) {
        const files = new Map<string, { loaded: number; total: number }>();
        const progress = (info: ProgressInfo) => {
          const file = info.file ?? info.name ?? '';
          if (!file || (info.status !== 'progress' && info.status !== 'done')) return;
          const total = info.total ?? 0;
          files.set(file, { loaded: info.status === 'done' ? total : (info.loaded ?? 0), total });
          let loaded = 0;
          let sum = 0;
          for (const f of files.values()) {
            loaded += f.loaded;
            sum += f.total;
          }
          post({ kind: 'progress', loaded, total: sum > 0 ? sum : null });
        };
        const tokenizer = await AutoTokenizer.from_pretrained(msg.repo, {
          revision: msg.revision,
          progress_callback: progress,
        });
        const model = await VitsModel.from_pretrained(msg.repo, {
          revision: msg.revision,
          dtype: msg.dtype,
          device: msg.device,
          progress_callback: progress,
        });
        const config = model.config as { sampling_rate?: number };
        engine = {
          tokenizer,
          model,
          sampleRate: config.sampling_rate ?? 16000,
          controls: supportedControls(sessionInputNames(model)),
        };
      }
      post({ kind: 'loaded' });
    } else if (msg.kind === 'speak') {
      lastSpoken = msg.id;
      if (cancelled.delete(msg.id)) {
        post({ kind: 'error', id: msg.id, message: 'cancelled' });
        return;
      }
      if (!engine) throw new Error('voice model not loaded');
      post({ kind: 'started', id: msg.id });
      const inputs = engine.tokenizer(msg.text) as Record<string, unknown>;
      const feeds = controlFeeds(engine.controls, msg.prosody);
      let applied = Object.keys(feeds) as VitsControl[];
      const controls = Object.fromEntries(
        Object.entries(feeds).map(([name, v]) => [
          name,
          new Tensor('float32', Float32Array.from([v]), [1]),
        ]),
      );
      const { model } = engine;
      // A graph that names a control but refuses our value: speak without, and stop asking. A
      // graphics-card failure is never retried (it must reach the page).
      const { output, withControls } = await runWithControls(
        async (all) => (await model(all)) as { waveform: Tensor },
        inputs,
        controls,
        isGpuFailure,
      );
      if (!withControls && applied.length > 0) {
        engine.controls = [];
        applied = [];
      }
      const samples = new Float32Array(output.waveform.data as Float32Array);
      post({ kind: 'audio', id: msg.id, samples, sampleRate: engine.sampleRate, applied }, [
        samples.buffer,
      ]);
    } else {
      try {
        if (engine) await engine.model.dispose();
      } catch {
        /* already gone */
      }
      engine = null;
    }
  } catch (e) {
    post({ kind: 'error', id: msg.kind === 'speak' ? msg.id : -1, message: String(e) });
  }
}
