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
