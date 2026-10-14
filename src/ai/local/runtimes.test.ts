import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adapter,
  cleanId,
  cleanLabel,
  isCloudName,
  ollamaBody,
  openaiBody,
  parseOpenaiEvent,
  positive,
  statusError,
  streamError,
} from './runtimes';
import { Lines, sseLine } from './stream';
import * as types from './types';
import type { LocalChatRequest } from './types';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const fixture = (name: string) => read(`src-tauri/tests/fixtures/local-ai/${name}`);
const json = (name: string): unknown => JSON.parse(fixture(name));
const enc = new TextEncoder();

const ollama = adapter('ollama');
const lmStudio = adapter('lmStudio');
const llamaCpp = adapter('llamaCpp');
const compat = adapter('openAiCompatible');

describe('local runtime adapters (same fixtures as the Rust adapters)', () => {
  it('uses the error tags and limits of src-tauri/src/ai/local/mod.rs', () => {
    const rust = read('src-tauri/src/ai/local/mod.rs');
    const tags: [string, string][] = [
      ['UNREACHABLE', types.UNREACHABLE],
      ['MODEL_MISSING', types.MODEL_MISSING],
      ['LOADING', types.LOADING],
      ['NEEDS_AUTH', types.NEEDS_AUTH],
      ['STALLED', types.STALLED],
      ['REMOTE_MODEL', types.REMOTE_MODEL],
      ['NOT_RUNTIME', types.NOT_RUNTIME],
      ['IS_OLLAMA', types.IS_OLLAMA],
      ['NOT_LOOPBACK', types.NOT_LOOPBACK],
      ['TOO_LARGE', types.TOO_LARGE],
      ['FAILED', types.FAILED],
      ['NO_VISION', types.NO_VISION],
      ['VISION_UNVERIFIED', types.VISION_UNVERIFIED],
      ['BAD_IMAGE', types.BAD_IMAGE],
    ];
    for (const [name, value] of tags) {
      expect(rust, name).toContain(`pub const ${name}: &str = "${value}";`);
    }
    // The picture limits of src-tauri/src/ai/local/vision.rs.
    const vision = read('src-tauri/src/ai/local/vision.rs');
    expect(vision).toContain(`pub const MAX_IMAGES: usize = ${types.MAX_IMAGES};`);
    expect(types.MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
    expect(vision).toContain('pub const MAX_IMAGE_BYTES: usize = 2 * 1024 * 1024;');
    expect(rust).toContain('pub const FIRST_PIECE: Duration = Duration::from_secs(120);');
    expect(rust).toContain('pub const PIECE_GAP: Duration = Duration::from_secs(45);');
    expect(types.PROBE_ORDER).toEqual(['ollama', 'lmStudio', 'llamaCpp', 'openAiCompatible']);
  });

  it('identifies Ollama by its version answer and nothing else', () => {
    expect(ollama.parseFingerprint(200, fixture('ollama-version.json'))).toEqual({
      kind: 'match',
      version: '0.12.6',
      loading: false,
    });
    expect(ollama.parseFingerprint(200, fixture('html-page.html')).kind).toBe('notThis');
    expect(ollama.parseFingerprint(200, '{"error":"Unexpected endpoint"}').kind).toBe('notThis');
    expect(ollama.parseFingerprint(404, '404 page not found').kind).toBe('notThis');
    expect(ollama.parseFingerprint(401, '').kind).toBe('needsAuth');
  });

  it('lists Ollama models and flags cloud ones', () => {
    const models = ollama.parseModels(json('ollama-tags.json'));
    expect(models.map((m) => m.id)).toEqual([
      'qwen3:8b',
      'gemma3:4b',
      'gpt-oss:120b-cloud',
      'deepseek-v3.1:671b-cloud',
    ]);
    expect(models[0]).toMatchObject({
      remote: false,
      sizeBytes: 5_225_376_047,
      parameterSize: '8.2B',
      quantization: 'Q4_K_M',
      vision: 'unverified',
    });
    expect(models[2]?.remote).toBe(true);
    expect(models[3]?.remote).toBe(true);
    expect(ollama.parseModels({ other: 1 })).toEqual([]);
  });

  it('reads Ollama details: context, capabilities when present, remote models', () => {
    const d = ollama.parseInfo(json('ollama-show.json'), 'qwen3:8b');
    expect(d).toMatchObject({ contextLength: 40960, vision: 'no', thinking: 'yes', remote: false });
    expect(d.capabilities.contextLength).toBe('yes');
    expect(d.capabilities.jsonSchema).toBe('unverified');
    // Older Ollama: no capabilities list, so vision and thinking stay unverified.
    const old = ollama.parseInfo(json('ollama-show-vision-old.json'), 'llava:7b');
    expect(old).toMatchObject({
      contextLength: 32768,
      vision: 'unverified',
      thinking: 'unverified',
    });
    expect(ollama.parseInfo(json('ollama-show-remote.json'), 'gpt-oss:120b').remote).toBe(true);
    expect(isCloudName('x:cloud') && isCloudName('a:7b-CLOUD')).toBe(true);
    expect(isCloudName('cloudy:7b') || isCloudName('qwen3')).toBe(false);
  });

  const chatReq: LocalChatRequest = {
    requestId: 'r',
    kind: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: ' qwen3:8b ',
    system: 'sys',
    messages: [
      { role: 'user', content: 'hỏi' },
      { role: 'assistant', content: 'đáp' },
    ],
    temperature: 0.2,
  };

  it('always sends num_ctx to Ollama; think and format only when asked', () => {
    const opts = { maxTokens: 512, contextLength: 8192, think: null };
    const b = ollamaBody(chatReq, opts);
    expect(b).toMatchObject({
      model: 'qwen3:8b',
      stream: true,
      options: { num_ctx: 8192, num_predict: 512, temperature: 0.2 },
    });
    expect((b.messages as { role: string }[]).map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
    ]);
    expect(b).not.toHaveProperty('think');
    expect(b).not.toHaveProperty('format');
    const s = ollamaBody({ ...chatReq, jsonSchema: { type: 'object' } }, { ...opts, think: false });
    expect(s).toMatchObject({ format: { type: 'object' }, think: false });
  });

  it('puts a picture in the images of its turn for Ollama', () => {
    const png = btoa('\x89PNG\r\n\x1a\n\0\0\0\rIHDR picture');
    const b = ollamaBody(
      {
        ...chatReq,
        vision: true,
        messages: [
          { role: 'assistant', content: 'Bảng có hình vẽ.' },
          { role: 'user', content: 'Chỗ em khoanh là gì?', images: [png] },
        ],
      },
      { maxTokens: 512, contextLength: 8192, think: null },
    );
    const messages = b.messages as Record<string, unknown>[];
    expect(messages[2]).toEqual({ role: 'user', content: 'Chỗ em khoanh là gì?', images: [png] });
    expect(messages[1]).not.toHaveProperty('images');
    expect(messages[0]).not.toHaveProperty('images');
    // Turns without a picture have no `images` field.
    for (const m of ollamaBody(chatReq, { maxTokens: 8, contextLength: 8192, think: null })
      .messages as Record<string, unknown>[]) {
      expect(m).not.toHaveProperty('images');
    }
  });

  it('reads the Ollama stream: text only (never the thinking field), then done', () => {
    const lines = new Lines().push(enc.encode(fixture('ollama-chat.ndjson')));
    let answer = '';
    let done: boolean | null = null;
    for (const line of lines) {
      if (line === '') continue;
      const p = ollama.parseEvent(line);
      answer += p.text ?? '';
      if (p.done !== null) done = p.done;
      expect(p.model).toBe('qwen3:8b');
    }
    expect(answer).toBe('Gia tốc a = 2 m/s², lớn dần.');
    expect(done).toBe(false);
    expect(
      ollama.parseEvent('{"message":{"content":""},"done":true,"done_reason":"length"}').done,
    ).toBe(true);
    expect(() => ollama.parseEvent('{"error":"model \'x\' not found"}')).toThrow(/^model-missing/);
    expect(() => ollama.parseEvent('not json')).toThrow('local-failed: unreadable stream line');
  });

  it('identifies an OpenAI-compatible server by its model list', () => {
    expect(compat.parseFingerprint(200, fixture('openai-models.json')).kind).toBe('match');
    expect(compat.parseFingerprint(200, fixture('html-page.html')).kind).toBe('notThis');
    expect(compat.parseFingerprint(200, '{"data":[{"name":"x"}]}').kind).toBe('notThis');
    expect(compat.parseFingerprint(403, '').kind).toBe('needsAuth');
    const models = compat.parseModels(json('openai-models.json'));
    expect(models.map((m) => [m.id, m.vision, m.remote])).toEqual([
      ['qwen2.5-7b-instruct', 'unverified', false],
      ['phi-4-mini', 'unverified', false],
    ]);
    // Ollama's own /v1/models lists its cloud models next to the local ones.
    const named = compat.parseModels({
      data: [{ id: 'gpt-oss:120b-cloud' }, { id: 'kimi-k2:cloud' }, { id: 'qwen3:8b' }],
    });
    expect(named.map((m) => m.remote)).toEqual([true, true, false]);
    expect(compat.parseInfo({}, 'gpt-oss:120b-cloud').remote).toBe(true);
  });

  it('reads the SSE stream (reasoning fields left out) and its errors', () => {
    let answer = '';
    let done: boolean | null = null;
    let ended = false;
    for (const line of fixture('openai-chat.sse').split('\n')) {
      const s = sseLine(line);
      if (s.kind === 'data') {
        const p = parseOpenaiEvent(s.data);
        answer += p.text ?? '';
        if (p.done !== null) done = p.done;
      } else if (s.kind === 'done') ended = true;
    }
    expect(answer).toBe('Lực là đại lượng vectơ.');
    expect(done).toBe(false);
    expect(ended).toBe(true);
    expect(parseOpenaiEvent('{"choices":[{"delta":{},"finish_reason":"length"}]}').done).toBe(true);
    expect(() =>
      parseOpenaiEvent(
        '{"error":{"message":"Loading model","type":"unavailable_error","code":503}}',
      ),
    ).toThrow(/^loading/);
    const b = openaiBody(
      { ...chatReq, kind: 'openAiCompatible', jsonSchema: { type: 'object' } },
      { maxTokens: 8, contextLength: 4096, think: false },
    );
    expect(b).toMatchObject({
      stream: true,
      max_tokens: 8,
      response_format: { type: 'json_schema', json_schema: { name: 'result' } },
    });
    expect(b).not.toHaveProperty('think');
    expect(b).not.toHaveProperty('num_ctx');
  });

  it('sends a picture as an image_url part after the text of its turn (OpenAI-compatible)', () => {
    const png = btoa('\x89PNG\r\n\x1a\n\0\0\0\rIHDR picture');
    const jpeg = btoa('\xff\xd8\xff\xe0\0\x10JFIF\0 picture');
    for (const [image, mime] of [
      [png, 'image/png'],
      [jpeg, 'image/jpeg'],
    ] as const) {
      const b = openaiBody(
        {
          ...chatReq,
          kind: 'lmStudio',
          vision: true,
          messages: [
            { role: 'user', content: 'Bảng này nói gì?' },
            { role: 'assistant', content: 'Về lực.' },
            { role: 'user', content: 'Chỗ em khoanh là gì?', images: [image] },
          ],
        },
        { maxTokens: 64, contextLength: 4096, think: null },
      );
      const messages = b.messages as Record<string, unknown>[];
      expect(messages[1]).toEqual({ role: 'user', content: 'Bảng này nói gì?' });
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Về lực.' });
      expect(messages[3]).toEqual({
        role: 'user',
        content: [
          { type: 'text', text: 'Chỗ em khoanh là gì?' },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${image}` } },
        ],
      });
    }
  });

  it('reads LM Studio models: vision, load state and context, no embedding models', () => {
    expect(lmStudio.parseFingerprint(200, fixture('lmstudio-models.json')).kind).toBe('match');
    expect(lmStudio.parseFingerprint(200, fixture('html-page.html')).kind).toBe('notThis');
    expect(lmStudio.parseFingerprint(404, '{}').kind).toBe('notThis');
    const models = lmStudio.parseModels(json('lmstudio-models.json'));
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'qwen2.5-7b-instruct',
      vision: 'no',
      loaded: true,
      contextLength: 8192,
    });
    expect(models[1]).toMatchObject({
      vision: 'yes',
      loaded: false,
      contextLength: 32768,
      quantization: '4bit',
    });
    expect(lmStudio.modelsFallback).toBe('openAiCompatible');
    expect(
      lmStudio.parseModels({ object: 'list', data: [{ id: 'gpt-oss:120b-cloud', type: 'llm' }] })[0]
        ?.remote,
    ).toBe(true);
  });

  it('identifies llama-server by its own fields only, also while it loads', () => {
    expect(llamaCpp.parseFingerprint(200, fixture('llamacpp-props.json'))).toEqual({
      kind: 'match',
      version: 'b6700-1a2b3c4d',
      loading: false,
    });
    expect(llamaCpp.parseFingerprint(503, fixture('llamacpp-loading.json'))).toEqual({
      kind: 'match',
      version: null,
      loading: true,
    });
    expect(llamaCpp.parseFingerprint(200, fixture('html-page.html')).kind).toBe('notThis');
    expect(llamaCpp.parseFingerprint(200, '{"status":"ok"}').kind).toBe('notThis');
    expect(llamaCpp.parseFingerprint(503, 'busy').kind).toBe('notThis');
    expect(llamaCpp.parseFingerprint(401, '').kind).toBe('needsAuth');
    const d = llamaCpp.parseInfo(json('llamacpp-props.json'), 'gemma.gguf');
    expect(d).toMatchObject({ contextLength: 4096, vision: 'no', loaded: true, remote: false });
    expect(llamaCpp.parseInfo({ n_ctx: 2048 }, 'm')).toMatchObject({
      contextLength: 2048,
      vision: 'unverified',
    });
    // A name in Ollama's cloud form is remote in the details too, as in every list.
    expect(llamaCpp.parseInfo({}, 'gpt-oss:120b-cloud').remote).toBe(true);
    expect(llamaCpp.parseHealth?.(200, '{"status":"ok"}')).toBe(true);
    expect(llamaCpp.parseHealth?.(503, fixture('llamacpp-loading.json'))).toBe(false);
    expect(llamaCpp.parseHealth?.(404, 'nope')).toBeNull();
    expect(llamaCpp.parseModels(json('llamacpp-models.json'))[0]?.id).toBe(
      'gemma-3-4b-it-Q4_K_M.gguf',
    );
  });

  it('bounds untrusted names and maps runtime errors to tags', () => {
    expect(cleanId(' qwen3:8b ')).toBe('qwen3:8b');
    expect(cleanId('')).toBeNull();
    expect(cleanId('..')).toBeNull();
    expect(cleanId('a\u0000b')).toBeNull();
    expect(cleanId('x'.repeat(257))).toBeNull();
    expect(cleanLabel('Q4_K_M')).toBe('Q4_K_M');
    expect(cleanLabel('x'.repeat(65))).toBeNull();
    expect(cleanLabel(4)).toBeNull();
    expect(positive(0)).toBeNull();
    expect(positive(4096)).toBe(4096);
    const tag = (e: Error) => e.message.split(':', 1)[0];
    expect(tag(statusError(404, '{"error":"model \'x\' not found"}'))).toBe('model-missing');
    expect(tag(statusError(503, 'Loading model'))).toBe('loading');
    expect(statusError(401, 'secret').message).toBe('needs-auth: 401');
    expect(statusError(307, '').message).toBe('local-failed: 307: redirect not followed');
    expect(tag(statusError(400, '{"error":{"message":"model \\"x\\" not found"}}'))).toBe(
      'model-missing',
    );
    expect(tag(statusError(500, 'boom'))).toBe('local-failed');
    expect(statusError(503, '')).toMatchObject({ code: 'http', message: 'loading: 503: ' });
    expect(tag(streamError('Loading model'))).toBe('loading');
  });
});
