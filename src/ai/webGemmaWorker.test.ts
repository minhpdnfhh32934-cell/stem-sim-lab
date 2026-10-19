import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Gemma worker reports a lost GPU device only when it is a real fault (audit GPU-01
 * follow-up). No model and no GPU are used: Transformers.js is replaced by fakes that behave like
 * ONNX Runtime — every load creates a WebGPU device, and disposing the last session destroys it
 * (`device.lost` resolves with reason 'destroyed').
 *
 * It also checks how answers are decoded: the repetition rules look only at the answer, never at
 * the prompt (eval report 2026-10-14 §4), on both the text and the photo path.
 */
interface LostInfo {
  reason: 'destroyed' | 'unknown';
  message: string;
}
interface FakeDevice {
  lost: Promise<LostInfo>;
  lose: (info: LostInfo) => void;
}

const fake = vi.hoisted(() => {
  const devices: FakeDevice[] = [];
  const env = {
    backends: { onnx: { wasm: {}, webgpu: { device: undefined as unknown } } },
    useBrowserCache: false,
    useCustomCache: false,
    useWasmCache: true,
    customCache: null as unknown,
  };
  function newDevice(): FakeDevice {
    let lose: (info: LostInfo) => void = () => undefined;
    const lost = new Promise<LostInfo>((resolve) => {
      lose = resolve;
    });
    const device = { lost, lose };
    devices.push(device);
    env.backends.onnx.webgpu.device = device;
    return device;
  }
  const modelLoads = { count: 0 };
  /** False: the device outlives `dispose` (to send it a late real loss). */
  const behaviour = { destroyOnDispose: true };
  /** The options of every `generate()` call (the fake answer is three tokens). */
  const generated: Record<string, unknown>[] = [];
  function model() {
    modelLoads.count += 1;
    const device = newDevice();
    return {
      dispose: () => {
        if (behaviour.destroyOnDispose) {
          device.lose({ reason: 'destroyed', message: 'Device was destroyed.' });
        }
        return Promise.resolve();
      },
      generate: (options: Record<string, unknown>) => {
        generated.push(options);
        const prompt = (options.input_ids as { dims: number[] }).dims[1] ?? 0;
        return Promise.resolve({ dims: [1, prompt + 3], slice: () => ({}) });
      },
    };
  }
  /** Prompt lengths in tokens: a text prompt, and a photo prompt (image tokens included). */
  const promptTokens = { text: 6, vision: 9 };
  // Callable like the real tokenizer and processor.
  const tokenizer = Object.assign(() => ({ input_ids: { dims: [1, promptTokens.text] } }), {
    apply_chat_template: () => 'prompt',
    batch_decode: () => ['Trả lời.'],
  });
  const processor = Object.assign(
    () => Promise.resolve({ input_ids: { dims: [1, promptTokens.vision] } }),
    { apply_chat_template: () => 'prompt', batch_decode: () => ['Trả lời.'], tokenizer: {} },
  );
  return {
    behaviour,
    devices,
    env,
    generated,
    model,
    modelLoads,
    processor,
    promptTokens,
    tokenizer,
  };
});

vi.mock('./modelStore', () => ({ modelStore: {}, opfsAvailable: () => false }));
vi.mock('@huggingface/transformers', () => ({
  env: fake.env,
  AutoTokenizer: { from_pretrained: () => Promise.resolve(fake.tokenizer) },
  AutoProcessor: { from_pretrained: () => Promise.resolve(fake.processor) },
  AutoModelForCausalLM: { from_pretrained: () => Promise.resolve(fake.model()) },
  Gemma4ForConditionalGeneration: { from_pretrained: () => Promise.resolve(fake.model()) },
  RawImage: {},
  // The stop button's criteria (src/ai/webGemmaStop.test.ts tests them); never interrupted here.
  InterruptableStoppingCriteria: class {
    interrupt() {
      /* not used by the decoding tests */
    }
  },
  // The real classes are callable objects; the tests call `_call` directly.
  LogitsProcessor: class {
    _call(): never {
      throw new Error('subclasses implement _call');
    }
  },
  LogitsProcessorList: class {
    processors: unknown[] = [];
    push(item: unknown) {
      this.processors.push(item);
    }
  },
  TextStreamer: class {
    end() {
      /* the fake model streams nothing */
    }
  },
}));

const posted: { kind: string; id?: number; message?: string }[] = [];
const workerSelf: {
  postMessage: (out: { kind: string }) => void;
  onmessage: ((event: { data: unknown }) => Promise<void>) | null;
} = {
  postMessage: (out) => {
    posted.push(out);
  },
  onmessage: null,
};
vi.stubGlobal('self', workerSelf);
afterAll(() => {
  vi.unstubAllGlobals();
});
const { ANSWER_RULES, applyAnswerRules, bannedAnswerTokens, penalizeAnswerTokens } =
  await import('./webGemmaWorker');

async function send(data: unknown): Promise<void> {
  await workerSelf.onmessage?.({ data });
}
const load = (modelId: string) =>
  send({
    kind: 'load',
    modelId,
    repo: `onnx-community/${modelId}`,
    revision: 'main',
    modality: 'text',
    dtype: 'q4',
    device: 'webgpu',
  });
/** Lets the `device.lost` listeners run. */
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
const deviceLost = () => posted.filter((o) => o.kind === 'device-lost');

describe('Gemma worker: GPU device loss', () => {
  beforeEach(async () => {
    fake.behaviour.destroyOnDispose = true;
    await send({ kind: 'unload' });
    await settle();
    posted.length = 0;
  });

  it('a device destroyed by unloading the model is not a fault', async () => {
    await load('gemma3-1b');
    expect(posted.map((o) => o.kind)).toContain('loaded');
    await send({ kind: 'unload' });
    await settle();
    expect(fake.devices.at(-1)).toBeDefined();
    expect(deviceLost()).toEqual([]);
  });

  it('switching models (e.g. to the photo model) is not a fault and keeps the new model', async () => {
    await load('gemma3-1b');
    await load('gemma4-e2b');
    await settle();
    expect(deviceLost()).toEqual([]);
    // The new model is still loaded: asking for it again does not load it a second time.
    const loads = fake.modelLoads.count;
    await load('gemma4-e2b');
    expect(fake.modelLoads.count).toBe(loads);
  });

  it('a late real loss of a replaced model never drops the new one', async () => {
    fake.behaviour.destroyOnDispose = false;
    await load('gemma3-1b');
    const oldDevice = fake.devices.at(-1);
    await load('gemma3-270m');
    await settle();
    oldDevice?.lose({ reason: 'unknown', message: 'stale' });
    await settle();
    expect(deviceLost()).toEqual([]);
    const loads = fake.modelLoads.count;
    await load('gemma3-270m');
    expect(fake.modelLoads.count).toBe(loads);
  });

  it('a real loss of the current model is reported', async () => {
    await load('gemma3-1b');
    await settle();
    fake.devices.at(-1)?.lose({ reason: 'unknown', message: 'DXGI_ERROR_DEVICE_HUNG' });
    await settle();
    expect(deviceLost()).toEqual([{ kind: 'device-lost', message: 'DXGI_ERROR_DEVICE_HUNG' }]);
    // The model went with its device: the next load really loads it again.
    const loads = fake.modelLoads.count;
    await load('gemma3-1b');
    expect(fake.modelLoads.count).toBe(loads + 1);
  });
});

const ids = (...tokens: number[]) => tokens.map((t) => BigInt(t));

describe('Gemma decoding rules: only the answer counts (eval report §4)', () => {
  it('lets the answer copy the prompt word for word', () => {
    // Prompt 10 11 12 13; the answer has written 10 11 12 so far: 13 stays allowed.
    expect(bannedAnswerTokens(ids(10, 11, 12, 13, 10, 11, 12), 4, 4)).toEqual([]);
  });

  it('forbids repeating an n-gram the answer already wrote', () => {
    // Answer 1 2 3 4 (5) 1 2 3: writing 4 now would repeat "1 2 3 4".
    expect(bannedAnswerTokens(ids(9, 9, 1, 2, 3, 4, 1, 2, 3), 2, 4)).toEqual([4]);
    expect(bannedAnswerTokens(ids(9, 9, 1, 2, 3, 4, 5, 1, 2, 3), 2, 4)).toEqual([4]);
    // Every token that followed the same n-1 tokens is banned.
    expect(bannedAnswerTokens(ids(1, 2, 3, 1, 2, 4, 1, 2), 0, 3).sort()).toEqual([3, 4]);
  });

  it('ignores n-grams that start in the prompt', () => {
    // Prompt 7, answer 1 2 5 7 1: "7 1 2" crosses the boundary, so 2 stays allowed
    // (a rule over prompt + answer would ban it).
    expect(bannedAnswerTokens(ids(7, 1, 2, 5, 7, 1), 1, 3)).toEqual([]);
  });

  it('bans nothing before the answer has n tokens, or when n is 0', () => {
    expect(bannedAnswerTokens(ids(1, 2, 3, 1, 2), 3, 4)).toEqual([]);
    expect(bannedAnswerTokens(ids(1, 1, 1, 1), 0, 0)).toEqual([]);
  });

  it('penalizes only tokens the answer used, once each', () => {
    const row = new Float32Array([2, -2, 2, 2, 2]);
    // Prompt 0 0 3, answer 1 2 2: 0 and 3 (prompt only) keep their logits.
    penalizeAnswerTokens(row, ids(0, 0, 3, 1, 2, 2), 3, 2, 64);
    expect([...row]).toEqual([2, -4, 1, 2, 2]);
  });

  it('forgets answer tokens older than the window', () => {
    const row = new Float32Array([2, 2, 2]);
    penalizeAnswerTokens(row, ids(0, 1, 2), 0, 2, 2);
    expect([...row]).toEqual([2, 1, 1]);
  });

  it('app rules: a prompt that repeats a phrase changes nothing, a repeated answer phrase is cut', () => {
    const n = ANSWER_RULES.ngram;
    const phrase = Array.from({ length: n }, (_, i) => 100 + i);
    const prompt = [...phrase, ...phrase];
    const row = new Float32Array(200).fill(1);
    // The answer starts by copying the prompt's phrase (minus its last token): allowed.
    applyAnswerRules(row, ids(...prompt, ...phrase.slice(0, n - 1)), prompt.length);
    expect(row[100 + n - 1]).toBe(1);
    // Writing the whole phrase a second time is not.
    row.fill(1);
    applyAnswerRules(row, ids(...prompt, ...phrase, ...phrase.slice(0, n - 1)), prompt.length);
    expect(row[100 + n - 1]).toBe(-Infinity);
    expect(row[100]).toBeCloseTo(1 / ANSWER_RULES.penalty);
    expect(row[99]).toBe(1);
  });
});

interface FakeProcessor {
  _call: (inputIds: bigint[][], logits: { dims: number[]; data: Float32Array }) => unknown;
}
const lastOptions = () => fake.generated.at(-1) ?? {};
const rulesOf = (options: Record<string, unknown>) =>
  (options.logits_processor as { processors: FakeProcessor[] } | undefined)?.processors ?? [];
const chat = (extra: Record<string, unknown> = {}) =>
  send({
    kind: 'chat',
    id: 7,
    system: 'Trả lời ngắn.',
    messages: [{ role: 'user', content: 'Rơi tự do là gì?' }],
    images: [],
    temperature: 0.2,
    maxTokens: 64,
    ...extra,
  });
const loadVision = () =>
  send({
    kind: 'load',
    modelId: 'gemma4-e2b',
    repo: 'onnx-community/gemma4-e2b',
    revision: 'main',
    modality: 'vision',
    dtype: 'q4f16',
    device: 'webgpu',
  });
/** Runs the answer-only rules on a prompt of `promptTokens` copies of token 5. */
function promptOnlyRow(rules: FakeProcessor | undefined, promptTokens: number, answer: number[]) {
  const row = new Float32Array(8).fill(1);
  rules?._call([ids(...Array<number>(promptTokens).fill(5), ...answer)], {
    dims: [1, 8],
    data: row,
  });
  return [...row];
}

describe('Gemma worker: decoding options', () => {
  beforeEach(async () => {
    await send({ kind: 'unload' });
    await settle();
    posted.length = 0;
    fake.generated.length = 0;
  });

  it('text answers: the prompt-wide built-in rules are off, the answer-only rules are on', async () => {
    await load('gemma3-1b');
    await chat();
    expect(posted.at(-1)).toMatchObject({ kind: 'reply', id: 7, text: 'Trả lời.' });
    expect(lastOptions()).toMatchObject({
      repetition_penalty: 1,
      no_repeat_ngram_size: 0,
      do_sample: true,
      temperature: 0.2,
      top_k: 40,
      max_new_tokens: 64,
    });
    const rules = rulesOf(lastOptions());
    expect(rules).toHaveLength(1);
    // A prompt full of token 5 (6 tokens) does not touch the first answer token.
    expect(promptOnlyRow(rules[0], fake.promptTokens.text, [])).toEqual(Array(8).fill(1));
    // Once the answer itself writes 5, it is penalized.
    expect(promptOnlyRow(rules[0], fake.promptTokens.text, [5])[5]).toBeCloseTo(
      1 / ANSWER_RULES.penalty,
    );
  });

  it('photo answers: the image tokens of the prompt never count', async () => {
    await loadVision();
    await chat();
    expect(lastOptions()).toMatchObject({ repetition_penalty: 1, no_repeat_ngram_size: 0 });
    const rules = rulesOf(lastOptions());
    expect(rules).toHaveLength(1);
    expect(promptOnlyRow(rules[0], fake.promptTokens.vision, [])).toEqual(Array(8).fill(1));
  });

  it("'legacy' reproduces the PR #20 (f527f18) / 0.5.2 settings exactly, text and photo (evaluation only)", async () => {
    const legacy = {
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 3,
      do_sample: true,
      temperature: 0.2,
      top_k: 40,
    };
    await load('gemma3-1b');
    await chat({ decoding: 'legacy' });
    expect(lastOptions()).toMatchObject(legacy);
    expect(lastOptions()).not.toHaveProperty('logits_processor');
    await loadVision();
    await chat({ decoding: 'legacy' });
    expect(lastOptions()).toMatchObject(legacy);
    expect(lastOptions()).not.toHaveProperty('logits_processor');
  });

  it('temperature 0 decodes greedily', async () => {
    await load('gemma3-1b');
    await chat({ temperature: 0 });
    expect(lastOptions()).toMatchObject({ do_sample: false });
  });
});
