import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiErrorKind } from '../errorKind';
import { schemaInSystem } from '../prompts';
import type { ChatRequest } from '../types';
import { setLocalClientForTests } from './client';
import { useLocalAiStore } from './localAiStore';
import { keyTestOf, LocalTransport } from './localTransport';
import {
  UNVERIFIED,
  type LocalChatOptions,
  type LocalChatRequest,
  type LocalRuntimeClient,
  type LocalSelection,
} from './types';

/** "Phân tích đề" with a local runtime: the pipeline's transport over a fake client. */
const sent: { req: LocalChatRequest; opts: LocalChatOptions | undefined }[] = [];
const testModel = vi.fn(() =>
  Promise.resolve({ status: 'ok' as const, firstPieceMs: 5, streamed: false, detail: '' }),
);
const client: LocalRuntimeClient = {
  detect: vi.fn(),
  probe: vi.fn(),
  models: vi.fn(() =>
    Promise.resolve({
      models: [
        {
          id: 'qwen3:8b',
          sizeBytes: null,
          family: null,
          parameterSize: null,
          quantization: null,
          contextLength: null,
          vision: 'unverified' as const,
          loaded: null,
          remote: false,
        },
        {
          id: 'gpt-oss:120b-cloud',
          sizeBytes: null,
          family: null,
          parameterSize: null,
          quantization: null,
          contextLength: null,
          vision: 'unverified' as const,
          loaded: null,
          remote: true,
        },
      ],
      more: false,
    }),
  ),
  modelInfo: vi.fn(),
  test: testModel,
  chat: (req, opts) => {
    sent.push({ req, opts });
    opts?.onPartial?.('{"topic"');
    opts?.onPartial?.('{"topic":"freeFall"}');
    return Promise.resolve({
      content: '{"topic":"freeFall"}',
      model: 'qwen3:8b',
      runtime: 'ollama',
      durationMs: 12,
      firstPieceMs: 3,
      truncated: false,
      streamed: true,
    });
  },
};

const selection: LocalSelection = {
  kind: 'ollama',
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3:8b',
  label: 'Ollama · qwen3:8b',
};

const request: ChatRequest = {
  requestId: 'req-1',
  // The cloud choice in Settings: ignored, the local model answers.
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  system: 'Phân loại đề.',
  messages: [{ role: 'user', content: 'Một vật rơi tự do từ độ cao 20 m.' }],
  jsonSchema: { type: 'object' },
  temperature: 0,
  maxTokens: 512,
  timeoutSecs: 30,
};

beforeEach(() => {
  sent.length = 0;
  setLocalClientForTests(client);
  useLocalAiStore.setState({ selected: selection, checks: {} });
});

describe('local runtime transport for the analysis', () => {
  it('asks the chosen local model, with the schema in the prompt when not checked', async () => {
    const r = await new LocalTransport().chat(request);
    expect(r).toEqual({
      content: '{"topic":"freeFall"}',
      model: 'qwen3:8b',
      durationMs: 12,
      truncated: false,
    });
    const { req, opts } = sent[0] ?? {};
    expect(req).toEqual({
      requestId: 'req-1',
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:8b',
      system: schemaInSystem('Phân loại đề.', { type: 'object' }),
      messages: request.messages,
      temperature: 0,
      maxTokens: 512,
    });
    // No cloud time limit: local runtimes have their own stall timers.
    expect(req).not.toHaveProperty('timeoutSecs');
    expect(opts).toEqual({});
  });

  it('asks for structured output only when the check on this computer said yes', async () => {
    useLocalAiStore.getState().recordCheck('ollama', selection.baseUrl, {
      model: 'qwen3:8b',
      contextLength: 40960,
      vision: 'no',
      thinking: 'yes',
      loaded: null,
      remote: false,
      capabilities: { ...UNVERIFIED, jsonSchema: 'yes' },
      declared: UNVERIFIED,
    });
    await new LocalTransport().chat(request);
    expect(sent[0]?.req).toMatchObject({ system: 'Phân loại đề.', jsonSchema: { type: 'object' } });
  });

  it('streams text answers; a schema answer comes whole; a stop reaches the client', async () => {
    const shown: string[] = [];
    const ctl = new AbortController();
    const text = { ...request };
    delete text.jsonSchema;
    await new LocalTransport().chatStream(text, (t) => shown.push(t), ctl.signal);
    expect(shown).toEqual(['{"topic"', '{"topic":"freeFall"}']);
    expect(sent[0]?.req.system).toBe('Phân loại đề.');
    expect(sent[0]?.opts?.signal).toBe(ctl.signal);
    shown.length = 0;
    await new LocalTransport().chatStream(request, (t) => shown.push(t));
    expect(shown).toEqual([]);
  });

  it('without a chosen runtime it sends nothing and says so', async () => {
    useLocalAiStore.setState({ selected: null });
    const t = new LocalTransport();
    const e: unknown = await t.chat(request).catch((err: unknown) => err);
    expect(aiErrorKind(e)).toBe('localNotSelected');
    expect(sent).toEqual([]);
    expect(await t.hasKey()).toBe(false);
    expect(await t.models()).toEqual([]);
    expect(await t.testKey()).toEqual({ status: 'noKey', detail: '' });
    await expect(t.setKey()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('lists only models that run on this computer and tests the chosen one', async () => {
    const t = new LocalTransport();
    expect(await t.hasKey()).toBe(true);
    expect(await t.models()).toEqual(['qwen3:8b']);
    expect(await t.testKey()).toEqual({ status: 'ok', detail: '' });
    expect(testModel).toHaveBeenCalledWith('ollama', 'http://127.0.0.1:11434', 'qwen3:8b');
    const base = { firstPieceMs: null, streamed: false, detail: '' };
    expect(keyTestOf({ ...base, status: 'unreachable' }).status).toBe('offline');
    expect(keyTestOf({ ...base, status: 'modelMissing' }).status).toBe('badModel');
    expect(keyTestOf({ ...base, status: 'needsAuth' }).status).toBe('badKey');
    expect(keyTestOf({ ...base, status: 'notAllowed' }).status).toBe('notAllowed');
    expect(keyTestOf({ ...base, status: 'loading' })).toEqual({
      status: 'error',
      detail: 'loading',
    });
    expect(keyTestOf({ ...base, status: 'error', detail: 'boom' })).toEqual({
      status: 'error',
      detail: 'boom',
    });
  });
});
