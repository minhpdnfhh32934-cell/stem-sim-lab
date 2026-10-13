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
  TextStreamer,
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
  | { kind: 'init'; ort: { wasm: string; mjs: string } }
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
      /** Most prompt tokens (exact count); the oldest turns are dropped above it. */
      inputBudget?: number;
    }
  | { kind: 'unload' };

interface Reply {
  text: string;
  /** Generation stopped at `maxTokens`. */
  truncated: boolean;
}

interface GpuInfo {
  vendor: string;
  architecture: string;
}

type OutMessage =
  | { kind: 'inited' }
  | { kind: 'loaded'; modelId: string; gpu: GpuInfo | null }
  | { kind: 'load-progress'; modelId: string; loaded: number; total: number | null }
  | { kind: 'reply'; id: number; text: string; truncated: boolean }
  /** A new piece of the answer while it is being generated (the page shows it as it comes). */
  | { kind: 'partial'; id: number; text: string }
  | { kind: 'error'; id: number; message: string };

/** Streams decoded text pieces of the answer (not the prompt) to `onText`. */
function streamerFor(
  tokenizer: ConstructorParameters<typeof TextStreamer>[0],
  onText: (text: string) => void,
) {
  return new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text: string) => {
      if (text) onText(text);
    },
  });
}

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

const lastDim = (t: Tensor) => t.dims[t.dims.length - 1] ?? 0;

/**
 * Tokenizes the prompt; while it is longer than `budget` tokens, drops the oldest turns (the
 * page estimates the budget from characters, this is the exact safety net). The history must
 * still start with the learner (Gemma's chat template requires it).
 */
function promptWithin(
  eng: TextEngine,
  system: string,
  messages: TextMessage[],
  budget: number | undefined,
) {
  let kept = messages;
  for (;;) {
    const prompt = eng.tokenizer.apply_chat_template(
      [{ role: 'system', content: system }, ...kept],
      { add_generation_prompt: true, tokenize: false },
    );
    const inputs = eng.tokenizer(prompt);
    if (!budget || kept.length <= 1 || lastDim(inputs.input_ids) <= budget) return inputs;
    kept = kept.slice(1);
    while (kept.length > 1 && kept[0]?.role !== 'user') kept = kept.slice(1);
  }
}

async function chatText(
  eng: TextEngine,
  system: string,
  messages: TextMessage[],
  temperature: number,
  maxTokens: number,
  inputBudget: number | undefined,
  onText: (text: string) => void,
): Promise<Reply> {
  const inputs = promptWithin(eng, system, messages, inputBudget);
  const output = (await eng.model.generate({
    ...inputs,
    streamer: streamerFor(eng.tokenizer, onText),
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: Math.max(temperature, 0.01),
    top_k: 40,
    repetition_penalty: 1.2,
    no_repeat_ngram_size: 3,
  })) as Tensor;
  const start = lastDim(inputs.input_ids);
  const decoded = eng.tokenizer.batch_decode(
    output.slice(null, [start, null] as unknown as number[]),
    {
      skip_special_tokens: true,
    },
  );
  return {
    text: (decoded[0] ?? '').trim(),
    truncated: lastDim(output) - start >= maxTokens,
  };
}

async function chatVision(
  eng: VisionEngine,
  system: string,
  messages: TextMessage[],
  images: ArrayBuffer[],
  temperature: number,
  maxTokens: number,
  onText: (text: string) => void,
): Promise<Reply> {
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
    streamer: streamerFor(
      eng.processor.tokenizer as ConstructorParameters<typeof TextStreamer>[0],
      onText,
    ),
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: Math.max(temperature, 0.01),
    top_k: 40,
    repetition_penalty: 1.2,
    no_repeat_ngram_size: 3,
  })) as Tensor;
  const decoded = eng.processor.batch_decode(output, { skip_special_tokens: true });
  const promptTokens = inputs.input_ids ? lastDim(inputs.input_ids) : 0;
  return {
    text: (decoded[0] ?? '').trim(),
    truncated: lastDim(output) - promptTokens >= maxTokens,
  };
}

/**
 * The adapter the model really runs on (shown in Settings). ONNX Runtime keeps the adapter of its
 * WebGPU session; otherwise ask WebGPU (the desktop app pins one adapter for the whole process).
 */
async function gpuInfo(): Promise<GpuInfo | null> {
  type Info = { vendor?: string; architecture?: string };
  try {
    const onnx = env.backends.onnx as { webgpu?: { adapter?: { info?: Info } } };
    let info = onnx.webgpu?.adapter?.info;
    if (!info) {
      const gpu = (navigator as { gpu?: GPU }).gpu;
      info = gpu ? (await gpu.requestAdapter())?.info : undefined;
    }
    return info ? { vendor: info.vendor ?? '', architecture: info.architecture ?? '' } : null;
  } catch {
    return null;
  }
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
      post({ kind: 'loaded', modelId: msg.modelId, gpu: await gpuInfo() });
    } else if (msg.kind === 'chat') {
      if (!engine || !loadedModel) throw new Error('no model loaded');
      const history = msg.messages.map((m) => ({ role: m.role, content: m.content }));
      const onText = (text: string) => {
        post({ kind: 'partial', id: msg.id, text });
      };
      let reply: Reply;
      if (engine.modality === 'vision') {
        reply = await chatVision(
          engine,
          msg.system,
          history,
          msg.images,
          msg.temperature,
          msg.maxTokens,
          onText,
        );
      } else {
        if (msg.images.length > 0) throw new Error('needs-vision-model');
        reply = await chatText(
          engine,
          msg.system,
          history,
          msg.temperature,
          msg.maxTokens,
          msg.inputBudget,
          onText,
        );
      }
      post({ kind: 'reply', id: msg.id, text: reply.text, truncated: reply.truncated });
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
