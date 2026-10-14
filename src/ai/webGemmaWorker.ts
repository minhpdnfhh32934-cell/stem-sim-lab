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
  InterruptableStoppingCriteria,
  LogitsProcessor,
  LogitsProcessorList,
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
      /** Pinned commit of the repo (audit SEC-06). */
      revision: string;
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
      /** Repetition rules; default 'app' (see `Decoding`). */
      decoding?: Decoding;
    }
  /** "Dừng": ends generation `id` after the current token (its partial reply is still sent). */
  | { kind: 'stop'; id: number }
  | { kind: 'unload' };

/**
 * How repetition is held back while the answer is generated.
 * - 'app' (default): `ANSWER_RULES`, which look only at the answer being written.
 * - 'legacy': the PR #20 (f527f18) settings, Transformers.js' built-in `repetition_penalty: 1.2` and
 *   `no_repeat_ngram_size: 3`. Those count the PROMPT too (see `generate()` in
 *   node_modules/@huggingface/transformers/src/models/modeling_utils.js: every processor gets
 *   prompt + answer ids), so the answer could not reuse the wording of its own context
 *   (eval report 2026-10-14 §4: "nhiễm sắc thể" written as "nhiễm sắc tố"). It exists only so
 *   scripts/teaching/eval-gemma.mjs can reproduce the PR #20 (f527f18) decoding; the app never
 *   sends it.
 */
export type Decoding = 'app' | 'legacy';

/** Repetition rules that only count the answer's own tokens (never the prompt). */
export interface AnswerRules {
  /** No n-gram of this many tokens may occur twice in the answer; 0 turns the rule off. */
  ngram: number;
  /** Divides (positive) or multiplies (negative) the logit of a token the answer used; 1 = off. */
  penalty: number;
  /** The penalty only counts the answer's last `window` tokens. */
  window: number;
}

/**
 * The app's rules, chosen for Gemma 3 1B (the smallest model that teaches) answering in
 * Vietnamese:
 * - `ngram: 10`: only a loop guard. Natural Vietnamese repeats short spans all the time: in
 *   answer-sized pieces (170 syllables or punctuation marks) of the repo's Vietnamese docs, 55%
 *   repeat a 4-unit span, 11% a 6-unit span and 1% an 8-unit span. A Gemma token is about one
 *   such unit (inferred from the mangled words in the eval; the tokenizer was not loaded), so a
 *   4-token rule would still cut the second "nhiễm sắc thể" or a restated formula. A real loop
 *   repeats whole clauses and is still cut after 10 tokens.
 * - `penalty: 1.1` over the last `window: 64` answer tokens: the usual mild setting for small
 *   local models (Ollama's defaults `repeat_penalty` 1.1, `repeat_last_n` 64). It discourages
 *   stutter without pushing a long answer, word after word, towards rare or foreign tokens; 1.2
 *   over the whole prompt likely fed the drift into other scripts (26 of 60 eval answers).
 */
export const ANSWER_RULES: AnswerRules = { ngram: 10, penalty: 1.1, window: 64 };

/**
 * Tokens that would complete an n-gram the answer already contains. Only the ids after
 * `promptLength` (the answer) are read, so the answer may copy the prompt word for word.
 */
export function bannedAnswerTokens(
  ids: readonly bigint[],
  promptLength: number,
  n: number,
): number[] {
  if (n <= 0) return [];
  const answer = ids.slice(promptLength).map(Number);
  const prefix = n - 1;
  const tail = answer.length - prefix;
  const banned = new Set<number>();
  // Every complete n-gram j..j+n-1 of the answer whose first n-1 tokens equal the last n-1.
  for (let j = 0; j + n <= answer.length; j++) {
    let same = true;
    for (let k = 0; k < prefix && same; k++) same = answer[j + k] === answer[tail + k];
    const next = answer[j + prefix];
    if (same && next !== undefined) banned.add(next);
  }
  return [...banned];
}

/**
 * Applies the repetition penalty (Transformers.js semantics: once per distinct token) to the
 * tokens of the answer's last `window` tokens. Prompt tokens are never penalized.
 */
export function penalizeAnswerTokens(
  row: Float32Array,
  ids: readonly bigint[],
  promptLength: number,
  penalty: number,
  window: number,
): void {
  if (penalty === 1) return;
  const seen = new Set<number>();
  for (let i = Math.max(promptLength, ids.length - window); i < ids.length; i++) {
    const id = Number(ids[i]);
    const logit = row[id];
    if (seen.has(id) || logit === undefined) continue;
    seen.add(id);
    row[id] = logit < 0 ? logit * penalty : logit / penalty;
  }
}

/** Both rules on the logits of one sequence (`row`), in place. */
export function applyAnswerRules(
  row: Float32Array,
  ids: readonly bigint[],
  promptLength: number,
  rules: AnswerRules = ANSWER_RULES,
): void {
  penalizeAnswerTokens(row, ids, promptLength, rules.penalty, rules.window);
  for (const token of bannedAnswerTokens(ids, promptLength, rules.ngram)) {
    if (token < row.length) row[token] = Number.NEGATIVE_INFINITY;
  }
}

/** `applyAnswerRules` as a Transformers.js logits processor (`generate({ logits_processor })`). */
class AnswerOnlyRules extends LogitsProcessor {
  private readonly promptLength: number;
  private readonly rules: AnswerRules;

  /** `promptLength`: prompt tokens (image tokens included); the same for every row (batch 1). */
  constructor(promptLength: number, rules: AnswerRules) {
    super();
    this.promptLength = promptLength;
    this.rules = rules;
  }

  override _call(inputIds: bigint[][], logits: Tensor): Tensor {
    // `logits` is [batch, vocab] (float32): rule each row in place.
    const vocab = logits.dims.at(-1) ?? 0;
    const data = logits.data as Float32Array;
    inputIds.forEach((ids, i) => {
      applyAnswerRules(
        data.subarray(i * vocab, (i + 1) * vocab),
        ids,
        this.promptLength,
        this.rules,
      );
    });
    return logits;
  }
}

/**
 * The repetition options of `generate()`. 'app' turns the built-in prompt-wide rules off
 * explicitly (a model's generation_config.json could otherwise turn them on).
 */
function repetitionOptions(decoding: Decoding, promptLength: number) {
  if (decoding === 'legacy') return { repetition_penalty: 1.2, no_repeat_ngram_size: 3 };
  const logits_processor = new LogitsProcessorList();
  logits_processor.push(new AnswerOnlyRules(promptLength, ANSWER_RULES));
  return { repetition_penalty: 1, no_repeat_ngram_size: 0, logits_processor };
}

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
  /** The GPU device was lost (driver reset, out of memory): the page restarts the worker. */
  | { kind: 'device-lost'; message: string }
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

type Engine = TextEngine | VisionEngine;

let engine: Engine | null = null;
let loadedModel = '';
/** Running generations by request id, so "stop" can interrupt them. */
const running = new Map<number, InterruptableStoppingCriteria>();
/** True while a model is released on purpose: losing its device then is expected. */
let disposing = false;

/**
 * Releases the current model. ONNX Runtime then destroys its own WebGPU device (the last session
 * is gone, `preserve_device` defaults to false), which resolves `device.lost` with 'destroyed'.
 */
async function disposeEngine(): Promise<void> {
  const old = engine;
  engine = null;
  loadedModel = '';
  if (!old) return;
  disposing = true;
  try {
    await old.model.dispose();
  } catch {
    /* already gone */
  } finally {
    disposing = false;
  }
}

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
  revision: string,
  dtype: 'q4' | 'q4f16',
  device: 'webgpu' | 'cpu',
  onProgress: (info: ProgressInfo) => void,
) {
  const tokenizer = await AutoTokenizer.from_pretrained(repo, {
    revision,
    progress_callback: onProgress,
  });
  const model = await AutoModelForCausalLM.from_pretrained(repo, {
    revision,
    dtype,
    device,
    progress_callback: onProgress,
  });
  return { modality: 'text', tokenizer, model } as TextEngine;
}

async function loadVision(
  repo: string,
  revision: string,
  dtype: 'q4' | 'q4f16',
  device: 'webgpu' | 'cpu',
  onProgress: (info: ProgressInfo) => void,
) {
  const processor = await AutoProcessor.from_pretrained(repo, {
    revision,
    progress_callback: onProgress,
  });
  const model = await Gemma4ForConditionalGeneration.from_pretrained(repo, {
    revision,
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
  decoding: Decoding,
  onText: (text: string) => void,
  stop: InterruptableStoppingCriteria,
): Promise<Reply> {
  const inputs = promptWithin(eng, system, messages, inputBudget);
  const start = lastDim(inputs.input_ids);
  const output = (await eng.model.generate({
    ...inputs,
    stopping_criteria: stop,
    streamer: streamerFor(eng.tokenizer, onText),
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: Math.max(temperature, 0.01),
    top_k: 40,
    ...repetitionOptions(decoding, start),
  })) as Tensor;
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
  decoding: Decoding,
  onText: (text: string) => void,
  stop: InterruptableStoppingCriteria,
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
  // Image tokens included: the processor expands each image in input_ids.
  const promptTokens = inputs.input_ids ? lastDim(inputs.input_ids) : 0;
  const output = (await eng.model.generate({
    ...inputs,
    stopping_criteria: stop,
    streamer: streamerFor(
      eng.processor.tokenizer as ConstructorParameters<typeof TextStreamer>[0],
      onText,
    ),
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature: Math.max(temperature, 0.01),
    top_k: 40,
    ...repetitionOptions(decoding, promptTokens),
  })) as Tensor;
  const decoded = eng.processor.batch_decode(output, { skip_special_tokens: true });
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

/**
 * Reports a lost GPU device (driver reset, out of memory, window hidden too long) so the page can
 * restart the worker instead of waiting for an answer that never comes (audit AI-01). ONNX Runtime
 * exposes its WebGPU device after the first session; older builds may not, then nothing happens.
 *
 * Only a real fault of the device `owner` runs on counts: not a device ONNX Runtime destroyed
 * itself (reason 'destroyed', every unload), not one lost while a model is disposed on purpose,
 * and not one of a model already replaced (that listener must never drop the new model).
 */
function watchDevice(owner: Engine, post: (out: OutMessage) => void): void {
  try {
    const onnx = env.backends.onnx as { webgpu?: { device?: unknown } };
    void Promise.resolve(onnx.webgpu?.device)
      .then((device) => {
        const lost = (device as { lost?: Promise<{ reason?: string; message?: string }> } | null)
          ?.lost;
        if (!lost) return;
        void lost.then(
          (info) => {
            if (info.reason === 'destroyed' || disposing || engine !== owner) return;
            engine = null;
            loadedModel = '';
            post({ kind: 'device-lost', message: info.message ?? '' });
          },
          () => undefined,
        );
      })
      .catch(() => undefined);
  } catch {
    /* no WebGPU device to watch */
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
      if (engine && loadedModel !== msg.modelId) await disposeEngine();
      if (!engine) {
        const loaded =
          msg.modality === 'vision'
            ? await loadVision(
                msg.repo,
                msg.revision,
                msg.dtype,
                msg.device,
                progressFor(msg.modelId, post),
              )
            : await loadText(
                msg.repo,
                msg.revision,
                msg.dtype,
                msg.device,
                progressFor(msg.modelId, post),
              );
        engine = loaded;
        loadedModel = msg.modelId;
        watchDevice(loaded, post);
      }
      post({ kind: 'loaded', modelId: msg.modelId, gpu: await gpuInfo() });
    } else if (msg.kind === 'stop') {
      // Handled while `generate` awaits the GPU: the criteria end it after the current token.
      running.get(msg.id)?.interrupt();
    } else if (msg.kind === 'chat') {
      // Registered before any await, so a "stop" sent right after "chat" always finds it.
      const stop = new InterruptableStoppingCriteria();
      running.set(msg.id, stop);
      try {
        if (!engine || !loadedModel) throw new Error('no model loaded');
        const history = msg.messages.map((m) => ({ role: m.role, content: m.content }));
        const onText = (text: string) => {
          post({ kind: 'partial', id: msg.id, text });
        };
        const decoding = msg.decoding ?? 'app';
        let reply: Reply;
        if (engine.modality === 'vision') {
          reply = await chatVision(
            engine,
            msg.system,
            history,
            msg.images,
            msg.temperature,
            msg.maxTokens,
            decoding,
            onText,
            stop,
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
            decoding,
            onText,
            stop,
          );
        }
        post({ kind: 'reply', id: msg.id, text: reply.text, truncated: reply.truncated });
      } finally {
        running.delete(msg.id);
      }
    } else {
      await disposeEngine();
    }
  } catch (e) {
    // The page waits on fixed ids for init (-2) and load (-3): answer on the same id, or a
    // failed load would leave "Đang tải…" spinning forever.
    const id =
      msg.kind === 'chat' ? msg.id : msg.kind === 'load' ? -3 : msg.kind === 'init' ? -2 : -1;
    post({ kind: 'error', id, message: String(e) });
  }
};
