/**
 * Runs Gemma inside a Web Worker with Transformers.js (WebGPU, no server).
 * Models come from public onnx-community repos, so downloading needs no token.
 * Text models use AutoModelForCausalLM; the E2B model uses its multimodal class
 * and also reads photos.
 */
/// <reference lib="webworker" />
import { modelStore, opfsAvailable } from './modelStore';
import {
  AutoModelForCausalLM,
  AutoProcessor,
  AutoTokenizer,
  Gemma4ForConditionalGeneration,
  RawImage,
  env,
  type Tensor,
} from '@huggingface/transformers';

// Model files go to OPFS (src/ai/modelStore.ts): Cache Storage refuses ~300 MB entries, so the
// weights would be downloaded again on every start. Cache Storage stays as the fallback.
if (opfsAvailable()) {
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = modelStore;
} else {
  env.useBrowserCache = true;
}
// Load ONNX Runtime's loader straight from /ort/ (same origin) instead of turning it into a
// blob: URL, which the desktop app's strict CSP (script-src 'self') would refuse.
env.useWasmCache = false;

interface TextMessage {
  role: string;
  content: string;
}

interface ProgressInfo {
  status?: string;
  name?: string;
  file?: string;
  loaded?: number;
  total?: number;
}

type InMessage =
  | {
      kind: 'init';
      ort: { wasm: string; mjs: string };
      power?: 'high-performance' | 'low-power';
    }
  | {
      kind: 'load';
      modelId: string;
      repo: string;
      modality: 'text' | 'vision';
      dtype: 'q4' | 'q4f16';
      device: 'webgpu' | 'cpu';
    }
  | {
      kind: 'chat';
      id: number;
      system: string;
      messages: TextMessage[];
      images: ArrayBuffer[];
      temperature: number;
      maxTokens: number;
    }
  | { kind: 'unload' };

type OutMessage =
  | { kind: 'inited' }
  | { kind: 'loaded'; modelId: string }
  | { kind: 'load-progress'; modelId: string; loaded: number; total: number | null }
  | { kind: 'reply'; id: number; text: string }
  | { kind: 'error'; id: number; message: string };

interface TextEngine {
  modality: 'text';
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
  model: Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>>;
}

interface VisionEngine {
  modality: 'vision';
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
  model: Awaited<ReturnType<typeof Gemma4ForConditionalGeneration.from_pretrained>>;
}

let engine: TextEngine | VisionEngine | null = null;
let loadedModel = '';

function progressFor(modelId: string, post: (out: OutMessage) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (info: ProgressInfo) => {
    const file = info.file ?? info.name ?? '';
    if (!file) return;
    if (info.status === 'progress') {
      files.set(file, { loaded: info.loaded ?? 0, total: info.total ?? 0 });
    } else if (info.status === 'done') {
      files.set(file, { loaded: info.total ?? 0, total: info.total ?? 0 });
    } else {
      return;
    }
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    post({ kind: 'load-progress', modelId, loaded, total: total > 0 ? total : null });
  };
}

async function loadText(
  repo: string,
  dtype: 'q4' | 'q4f16',
  device: 'webgpu' | 'cpu',
  onProgress: (info: ProgressInfo) => void,
) {
  const tokenizer = await AutoTokenizer.from_pretrained(repo, { progress_callback: onProgress });
  const model = await AutoModelForCausalLM.from_pretrained(repo, {
    dtype,
    device,
    progress_callback: onProgress,
  });
  return { modality: 'text', tokenizer, model } as TextEngine;
}

async function loadVision(
  repo: string,
  dtype: 'q4' | 'q4f16',
  device: 'webgpu' | 'cpu',
  onProgress: (info: ProgressInfo) => void,
) {
  const processor = await AutoProcessor.from_pretrained(repo, { progress_callback: onProgress });
  const model = await Gemma4ForConditionalGeneration.from_pretrained(repo, {
    dtype,
    device,
    progress_callback: onProgress,
  });
  return { modality: 'vision', processor, model } as VisionEngine;
}

async function chatText(
  eng: TextEngine,
  system: string,
  messages: TextMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const prompt = eng.tokenizer.apply_chat_template(
    [{ role: 'system', content: system }, ...messages],
    { add_generation_prompt: true, tokenize: false },
  );
  const inputs = eng.tokenizer(prompt);
  const output = (await eng.model.generate({
    ...inputs,
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: Math.max(temperature, 0.01),
    top_k: 40,
    repetition_penalty: 1.2,
    no_repeat_ngram_size: 3,
  })) as Tensor;
  const start = inputs.input_ids.dims[inputs.input_ids.dims.length - 1] ?? 0;
  const decoded = eng.tokenizer.batch_decode(
    output.slice(null, [start, null] as unknown as number[]),
    {
      skip_special_tokens: true,
    },
  );
  return (decoded[0] ?? '').trim();
}

async function chatVision(
  eng: VisionEngine,
  system: string,
  messages: TextMessage[],
  images: ArrayBuffer[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const turns = [
    { role: 'system', content: system },
    ...messages.map((m, i) => {
      if (i === messages.length - 1 && m.role === 'user' && images.length > 0) {
        const content: ({ type: 'text'; text: string } | { type: 'image' })[] = [];
        for (let k = 0; k < images.length; k++) content.push({ type: 'image' });
        content.push({ type: 'text', text: m.content });
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    }),
  ];
  const prompt = eng.processor.apply_chat_template(turns, {
    add_generation_prompt: true,
    tokenize: false,
  });
  const loaded = await Promise.all(
    images.map((ab) => RawImage.fromBlob(new Blob([ab], { type: 'image/jpeg' }))),
  );
  const inputs = (loaded.length === 0
    ? await eng.processor(prompt)
    : await eng.processor(prompt, loaded.length === 1 ? loaded[0] : loaded)) as unknown as Record<
    string,
    Tensor
  >;
  const output = (await eng.model.generate({
    ...inputs,
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: Math.max(temperature, 0.01),
    top_k: 40,
    repetition_penalty: 1.2,
    no_repeat_ngram_size: 3,
  })) as Tensor;
  const decoded = eng.processor.batch_decode(output, { skip_special_tokens: true });
  return (decoded[0] ?? '').trim();
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  const post = (out: OutMessage) => {
    self.postMessage(out);
  };
  try {
    if (msg.kind === 'init') {
      const wasm = env.backends.onnx.wasm as { wasmPaths?: unknown } | undefined;
      if (wasm) {
        // Both files, or ONNX Runtime looks for the loader next to the bundle and fails.
        wasm.wasmPaths = { wasm: msg.ort.wasm, mjs: msg.ort.mjs };
      }
      // Read once, when ONNX Runtime first opens the GPU (Transformers.js defaults to
      // high-performance); the page restarts the worker when the learner changes it.
      const webgpu = (env.backends.onnx as { webgpu?: { powerPreference?: string } }).webgpu;
      if (webgpu && msg.power) webgpu.powerPreference = msg.power;
      post({ kind: 'inited' });
    } else if (msg.kind === 'load') {
      if (engine && loadedModel !== msg.modelId) {
        try {
          await engine.model.dispose();
        } catch {
          /* keep going */
        }
        engine = null;
        loadedModel = '';
      }
      if (!engine) {
        engine =
          msg.modality === 'vision'
            ? await loadVision(msg.repo, msg.dtype, msg.device, progressFor(msg.modelId, post))
            : await loadText(msg.repo, msg.dtype, msg.device, progressFor(msg.modelId, post));
        loadedModel = msg.modelId;
      }
      post({ kind: 'loaded', modelId: msg.modelId });
    } else if (msg.kind === 'chat') {
      if (!engine || !loadedModel) throw new Error('no model loaded');
      const history = msg.messages.map((m) => ({ role: m.role, content: m.content }));
      let text: string;
      if (engine.modality === 'vision') {
        text = await chatVision(
          engine,
          msg.system,
          history,
          msg.images,
          msg.temperature,
          msg.maxTokens,
        );
      } else {
        if (msg.images.length > 0) throw new Error('needs-vision-model');
        text = await chatText(engine, msg.system, history, msg.temperature, msg.maxTokens);
      }
      post({ kind: 'reply', id: msg.id, text });
    } else {
      try {
        if (engine) await engine.model.dispose();
      } catch {
        /* already gone */
      }
      engine = null;
      loadedModel = '';
    }
  } catch (e) {
    // The page waits on fixed ids for init (-2) and load (-3): answer on the same id, or a
    // failed load would leave "Đang tải…" spinning forever.
    const id =
      msg.kind === 'chat' ? msg.id : msg.kind === 'load' ? -3 : msg.kind === 'init' ? -2 : -1;
    post({ kind: 'error', id, message: String(e) });
  }
};
