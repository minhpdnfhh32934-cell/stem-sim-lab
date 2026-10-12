/**
 * AI Teacher's on-device Vietnamese voice: Meta's MMS-TTS model for Vietnamese (VITS,
 * `Xenova/mms-tts-vie`, CC BY-NC 4.0) run with Transformers.js on the graphics card (WebGPU) or the CPU (WebAssembly), in
 * its own worker so the page never stalls. Text in, 16 kHz float samples out; nothing leaves
 * the computer after the one-time download.
 */
/// <reference lib="webworker" />
import { AutoTokenizer, VitsModel, env, type Tensor } from '@huggingface/transformers';
import { modelStore, opfsAvailable } from '@/ai/modelStore';

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
      dtype: 'fp32' | 'q8';
      device: 'wasm' | 'webgpu';
      ort: { wasm: string; mjs: string };
    }
  | { kind: 'speak'; id: number; text: string }
  | { kind: 'unload' };

type OutMessage =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'loaded' }
  | { kind: 'audio'; id: number; samples: Float32Array; sampleRate: number }
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
} | null = null;

function post(out: OutMessage, transfer: Transferable[] = []) {
  self.postMessage(out, transfer);
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
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
          progress_callback: progress,
        });
        const model = await VitsModel.from_pretrained(msg.repo, {
          dtype: msg.dtype,
          device: msg.device,
          progress_callback: progress,
        });
        const config = model.config as { sampling_rate?: number };
        engine = { tokenizer, model, sampleRate: config.sampling_rate ?? 16000 };
      }
      post({ kind: 'loaded' });
    } else if (msg.kind === 'speak') {
      if (!engine) throw new Error('voice model not loaded');
      const inputs = engine.tokenizer(msg.text);
      const { waveform } = (await engine.model(inputs)) as { waveform: Tensor };
      const samples = new Float32Array(waveform.data as Float32Array);
      post({ kind: 'audio', id: msg.id, samples, sampleRate: engine.sampleRate }, [samples.buffer]);
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
};
