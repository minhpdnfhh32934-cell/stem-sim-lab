import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest, Provider } from '@/ai/types';
import { askTeacher, contextPrompt } from './chatService';
import { useChatStore } from './chatStore';
import { downloadErrorKey } from './downloadErrors';

function transport(keys: Provider[], calls: ChatRequest[]): LlmTransport {
  return {
    chat: (req) => {
      calls.push(req);
      return Promise.resolve({
        content: `${req.provider} answer`,
        model: `${req.provider}-model`,
        durationMs: 1,
      });
    },
    models: () => Promise.resolve([]),
    setKey: () => Promise.resolve(),
    hasKey: (p) => Promise.resolve(keys.includes(p)),
    deleteKey: () => Promise.resolve(),
  };
}

describe('AI Teacher chat service', () => {
  let calls: ChatRequest[];
  beforeEach(() => {
    calls = [];
    useAiStore.setState({ provider: 'gemini', fallback: 'groq' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      verifierProvider: 'groq',
      verifierModel: '',
      webLookup: false,
    });
  });
  afterEach(() => {
    setTransportForTests(null);
    vi.unstubAllGlobals();
  });

  it('sends screen context only when the toggle is on', async () => {
    const off = await contextPrompt('lực là gì', 'vi', false);
    expect(off.system).not.toContain('Ngữ cảnh màn hình');
    const on = await contextPrompt('lực là gì', 'vi', true);
    expect(on.system).toContain('Ngữ cảnh màn hình');
  });

  it('never asks Wikipedia unless the learner turned the lookup on', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 404 })));
    vi.stubGlobal('fetch', fetchSpy);
    await contextPrompt('gia tốc trọng trường', 'vi', false);
    expect(fetchSpy).not.toHaveBeenCalled();
    await contextPrompt('gia tốc trọng trường', 'vi', false, true);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('cloud answer without a key says so instead of answering', async () => {
    setTransportForTests(transport([], calls));
    await expect(
      askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: false }),
    ).rejects.toThrow(/Chưa có khóa API/);
    expect(calls).toHaveLength(0);
  });

  it('provider turned off → clear message', async () => {
    useAiStore.setState({ provider: 'off' });
    setTransportForTests(transport(['gemini'], calls));
    await expect(
      askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: false }),
    ).rejects.toThrow(/AI trực tuyến đang tắt/);
  });

  it('the screen-context system prompt reaches the provider only when enabled', async () => {
    setTransportForTests(transport(['gemini'], calls));
    await askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: false });
    await askTeacher('lực là gì', 'vi', [], { includeScreen: true, think: false });
    expect(calls[0]?.system).not.toContain('Ngữ cảnh màn hình');
    expect(calls[1]?.system).toContain('Ngữ cảnh màn hình');
  });

  it('Think without the second key stops before any call', async () => {
    setTransportForTests(transport(['gemini'], calls));
    await expect(
      askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: true }),
    ).rejects.toThrow(/API thứ hai/);
    expect(calls).toHaveLength(0);
  });

  it('Think refuses the same provider for answer and review', async () => {
    useChatStore.setState({ verifierProvider: 'gemini' });
    setTransportForTests(transport(['gemini'], calls));
    await expect(
      askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: true }),
    ).rejects.toThrow(/nhà cung cấp khác/);
  });

  it('Think: draft from the main provider without fallback, then an independent review', async () => {
    setTransportForTests(transport(['gemini', 'groq'], calls));
    const reply = await askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: true });
    expect(calls.map((c) => c.provider)).toEqual(['gemini', 'groq']);
    // The Groq fallback must not answer the draft that Groq then reviews.
    expect(calls[0]?.noFallback).toBe(true);
    expect(calls[1]?.messages[0]?.content).toContain('gemini answer');
    expect(reply.content).toBe('groq answer');
    expect(reply.metadata).toMatchObject({ model: 'gemini-model', checkedBy: 'groq · groq-model' });
  });

  it('without Think the normal quota fallback stays available', async () => {
    setTransportForTests(transport(['gemini', 'groq'], calls));
    await askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: false });
    expect(calls[0]?.noFallback).toBeUndefined();
  });

  it('the pre-selected Gemma engine without a model uses the connected API', async () => {
    useChatStore.setState({ engine: 'gemma', engineChosen: false });
    setTransportForTests(transport(['gemini'], calls));
    const reply = await askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: false });
    expect(calls.map((c) => c.provider)).toEqual(['gemini']);
    expect(reply.content).toBe('gemini answer');
  });

  it('Gemma chosen by the learner without WebGPU explains it (nothing goes online)', async () => {
    useChatStore.setState({ engine: 'gemma', engineChosen: true });
    setTransportForTests(transport(['gemini'], calls));
    await expect(
      askTeacher('lực là gì', 'vi', [], { includeScreen: false, think: false }),
    ).rejects.toThrow(/WebGPU/);
    expect(calls).toHaveLength(0);
  });
});

describe('Gemma download errors', () => {
  it.each([
    ['cancelled', 'chatSettings.downloadCancelled'],
    ['webgpu-missing', 'chatSettings.webgpuRequired'],
    ['QuotaExceededError: storage full', 'chatSettings.downloadNoSpace'],
    ['TypeError: Failed to fetch', 'chatSettings.downloadNetwork'],
    ['worker-crashed', 'chatSettings.downloadMemory'],
  ])('%s → %s', (message, key) => {
    expect(downloadErrorKey(message)).toBe(key);
  });

  it('unknown errors keep their detail (no made-up reason)', () => {
    expect(downloadErrorKey('something odd')).toBeNull();
  });
});
