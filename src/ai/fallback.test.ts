import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from './aiStore';
import { fallbackFor, isQuotaError } from './fallback';
import { getTransport, groqBody } from './transport';
import { AiError, type ChatRequest } from './types';

const http = (m: string) => new AiError('http', m);

describe('fallback when the chosen provider runs out of quota', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = undefined;
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = undefined;
  });

  it('switches only on quota or credit errors (same rule as Rust)', () => {
    expect(isQuotaError(http('429: {"error":"PerDay"}'))).toBe(true);
    expect(isQuotaError(http('402: payment required'))).toBe(true);
    expect(isQuotaError(http('400: Your credit balance is too low'))).toBe(true);
    expect(isQuotaError(http('400: RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isQuotaError(http('401: invalid key'))).toBe(false);
    expect(isQuotaError(http('404: model'))).toBe(false);
    expect(isQuotaError(new AiError('network', 'down'))).toBe(false);
    expect(isQuotaError(new AiError('dailyLimit', '100'))).toBe(false);
  });

  it('uses the configured fallback with its model, never the same provider', () => {
    useAiStore.setState({ fallback: 'groq', models: { gemini: '', claude: '', groq: '' } });
    expect(fallbackFor('gemini')).toEqual({ provider: 'groq', model: 'qwen/qwen3.8-27b' });
    expect(fallbackFor('groq')).toBeUndefined();
    useAiStore.setState({ fallback: 'off' });
    expect(fallbackFor('gemini')).toBeUndefined();
  });

  it('builds the Groq request like the Rust gateway', () => {
    const req: ChatRequest = {
      requestId: 'r',
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      jsonSchema: { type: 'object' },
      schemaName: 'scene_spec',
    };
    const b = groqBody(req);
    expect(b.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
    expect(b.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'scene_spec', strict: true, schema: { type: 'object' } },
    });
    expect(b.reasoning_format).toBeUndefined();
    const plain: ChatRequest = { ...req };
    delete plain.jsonSchema;
    expect(groqBody(plain).reasoning_format).toBe('hidden');
  });

  it('answers with Groq when Gemini reports its daily quota is used up', async () => {
    useAiStore.setState({ fallback: 'groq', models: { gemini: '', claude: '', groq: '' } });
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    globalThis.__STEMSIM_TEST_GROQ_KEY__ = 'q';
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      calls.push(url);
      if (url.includes('generativelanguage')) {
        return Promise.resolve(new Response('{"error":"GenerateRequestsPerDay"}', { status: 429 }));
      }
      return Promise.resolve(
        Response.json({
          choices: [{ message: { content: 'Giải thích' } }],
          model: 'qwen/qwen3.8-27b',
        }),
      );
    });
    const r = await getTransport().chat({
      requestId: 'r',
      provider: 'gemini',
      model: 'gemini-x',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r).toMatchObject({ content: 'Giải thích', provider: 'groq', fallback: true });
    expect(calls.map((u) => new URL(u).host)).toEqual([
      'generativelanguage.googleapis.com',
      'api.groq.com',
    ]);
  });
});
