import { describe, expect, it, vi } from 'vitest';
import { abortable } from './webGemma';

/**
 * "Dừng" in the AI Teacher chat interrupts the on-device generation (no model and no GPU here:
 * Transformers.js is replaced by a fake whose `generate` runs until its stopping criteria say so,
 * yielding between tokens like the real one does while it waits for the GPU).
 */
const fake = vi.hoisted(() => {
  class InterruptableStoppingCriteria {
    interrupted = false;
    interrupt() {
      this.interrupted = true;
    }
  }
  const run = { tokens: 0 };
  const tokenizer = Object.assign(() => ({ input_ids: { dims: [1, 4] } }), {
    apply_chat_template: () => 'prompt',
    batch_decode: () => ['Câu trả lời dở dang'],
  });
  const model = {
    dispose: () => Promise.resolve(),
    generate: async ({
      stopping_criteria,
    }: {
      stopping_criteria: InterruptableStoppingCriteria;
    }) => {
      run.tokens = 0;
      while (!stopping_criteria.interrupted && run.tokens < 50) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        run.tokens += 1;
      }
      return { dims: [1, 4 + run.tokens], slice: () => ({}) };
    },
  };
  return { InterruptableStoppingCriteria, model, run, tokenizer };
});

vi.mock('./modelStore', () => ({ modelStore: {}, opfsAvailable: () => false }));
vi.mock('@huggingface/transformers', () => ({
  env: {
    backends: { onnx: { wasm: {}, webgpu: {} } },
    useBrowserCache: false,
    useCustomCache: false,
    useWasmCache: true,
    customCache: null,
  },
  AutoTokenizer: { from_pretrained: () => Promise.resolve(fake.tokenizer) },
  AutoProcessor: { from_pretrained: () => Promise.resolve({}) },
  AutoModelForCausalLM: { from_pretrained: () => Promise.resolve(fake.model) },
  Gemma4ForConditionalGeneration: { from_pretrained: () => Promise.resolve(fake.model) },
  InterruptableStoppingCriteria: fake.InterruptableStoppingCriteria,
  // The answer-only repetition rules (src/ai/webGemmaWorker.test.ts tests them).
  LogitsProcessor: class {},
  LogitsProcessorList: class {
    push() {
      /* the fake model applies no rules */
    }
  },
  RawImage: {},
  TextStreamer: vi.fn(),
}));

const posted: { kind: string; id?: number; text?: string; message?: string }[] = [];
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
await import('./webGemmaWorker');

const send = (data: unknown) => workerSelf.onmessage?.({ data }) ?? Promise.resolve();
const chat = (id: number) =>
  send({
    kind: 'chat',
    id,
    system: 'Bạn là AI Teacher',
    messages: [{ role: 'user', content: 'Lực là gì?' }],
    images: [],
    temperature: 0,
    maxTokens: 50,
  });

describe('Gemma worker: "Dừng"', () => {
  it('ends the generation after the current token and still answers on its id', async () => {
    await send({
      kind: 'load',
      modelId: 'gemma3-1b',
      repo: 'onnx-community/gemma3-1b',
      revision: 'main',
      modality: 'text',
      dtype: 'q4',
      device: 'webgpu',
    });
    posted.length = 0;
    const running = chat(7);
    await vi.waitFor(() => {
      expect(fake.run.tokens).toBeGreaterThan(3);
    });
    await send({ kind: 'stop', id: 7 });
    await running;
    expect(fake.run.tokens).toBeLessThan(50);
    expect(posted).toContainEqual({
      kind: 'reply',
      id: 7,
      text: 'Câu trả lời dở dang',
      truncated: false,
    });
  });

  it('a stop for an answer that is not running changes nothing', async () => {
    posted.length = 0;
    await send({ kind: 'stop', id: 99 });
    expect(posted).toEqual([]);
    await chat(8);
    expect(fake.run.tokens).toBe(50);
  });
});

describe('page side: a stopped answer is released at once', () => {
  it('rejects with "cancelled" on abort while the work goes on', async () => {
    const controller = new AbortController();
    let finish: (v: string) => void = () => undefined;
    const work = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const waiting = abortable(work, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow('cancelled');
    finish('late');
    await expect(work).resolves.toBe('late');
  });

  it('passes results and errors through without a signal or before an abort', async () => {
    await expect(abortable(Promise.resolve(1))).resolves.toBe(1);
    await expect(abortable(Promise.resolve(2), new AbortController().signal)).resolves.toBe(2);
    await expect(
      abortable(Promise.reject(new Error('gemma-stalled')), new AbortController().signal),
    ).rejects.toThrow('gemma-stalled');
  });
});
