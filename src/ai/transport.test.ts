// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTransport } from './transport';

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = undefined;
  globalThis.__STEMSIM_TEST_GEMINI_KEY__ = undefined;
});

const req = {
  requestId: 'r',
  model: ' claude-test ',
  system: 'sys',
  messages: [{ role: 'user' as const, content: 'đề' }],
  jsonSchema: { type: 'object' },
  schemaName: 'scene_spec',
  temperature: 0,
};

describe('transport without the desktop app (golden runs from Node)', () => {
  it('calls Claude with a forced tool and returns the tool input', async () => {
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'k';
    const fetch = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(
        Response.json({ content: [{ type: 'tool_use', name: 'scene_spec', input: { a: 1 } }] }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const r = await getTransport().chat({ ...req, provider: 'claude' });
    expect(r.content).toBe('{"a":1}');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'claude-test',
      tool_choice: { type: 'tool', name: 'scene_spec' },
      system: [{ text: 'sys', cache_control: { type: 'ephemeral' } }],
    });
    expect(body).not.toHaveProperty('temperature');
  });

  it('reports HTTP errors with their status and refuses without a key', async () => {
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = 'k';
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 429 })));
    await expect(getTransport().chat({ ...req, provider: 'claude' })).rejects.toMatchObject({
      code: 'http',
      message: expect.stringMatching(/^429\b/) as string,
    });
    globalThis.__STEMSIM_TEST_CLAUDE_KEY__ = undefined;
    await expect(getTransport().chat({ ...req, provider: 'claude' })).rejects.toMatchObject({
      code: 'missingKey',
    });
  });
});

describe('Gemini voice (text-to-speech) without the desktop app', () => {
  it('asks for audio with the voice and style, and returns the audio part', async () => {
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    const fetch = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(
        Response.json({
          candidates: [
            { content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } }] } },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const transport = getTransport();
    if (!transport.tts) throw new Error('tts missing');
    const audio = await transport.tts({
      requestId: 'v1',
      model: 'gemini-3.8-flash-tts',
      voice: 'Achird',
      style: 'vui vẻ',
      text: 'ép bằng mờ nhân a',
    });
    expect(audio).toEqual({ audio: 'UklGRg==', mimeType: 'audio/wav' });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'ép bằng mờ nhân a', speech_metadata: { style: 'vui vẻ' } }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { voice: 'Achird' } },
      },
    });
  });

  it('refuses without a Gemini key and reports an answer without audio', async () => {
    const t = getTransport();
    const call = () =>
      t.tts!.call(t, {
        requestId: 'v2',
        model: 'gemini-3.8-flash-tts',
        voice: 'Kore',
        style: '',
        text: 'a',
      });
    await expect(call()).rejects.toMatchObject({ code: 'missingKey' });
    globalThis.__STEMSIM_TEST_GEMINI_KEY__ = 'g';
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ candidates: [] })));
    await expect(call()).rejects.toMatchObject({ code: 'badResponse' });
  });
});
