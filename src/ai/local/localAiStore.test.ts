import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../types';
import { setLocalClientForTests } from './client';
import {
  MAX_CHECKS,
  MAX_USER_ENDPOINTS,
  checkFor,
  checkKey,
  sanitizeLocalAi,
  useLocalAiStore,
} from './localAiStore';
import { UNVERIFIED, type LocalRuntimeClient, type ModelDetails, type RuntimeProbe } from './types';

const client = {
  detect: vi.fn<LocalRuntimeClient['detect']>(),
  probe: vi.fn<LocalRuntimeClient['probe']>(),
  models: vi.fn<LocalRuntimeClient['models']>(),
  modelInfo: vi.fn<LocalRuntimeClient['modelInfo']>(),
  test: vi.fn<LocalRuntimeClient['test']>(),
  chat: vi.fn<LocalRuntimeClient['chat']>(),
};

const KEY = 'stemsim.local-ai';

const selection = {
  kind: 'ollama' as const,
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3:8b',
  label: 'Ollama · qwen3:8b',
};

const details = (model: string): ModelDetails => ({
  model,
  contextLength: 40960,
  vision: 'no',
  thinking: 'yes',
  loaded: null,
  remote: false,
  capabilities: { ...UNVERIFIED, listModels: 'yes', contextLength: 'yes', vision: 'no' },
  declared: UNVERIFIED,
});

function saved(): { state: Record<string, unknown>; version: number } {
  return JSON.parse(localStorage.getItem(KEY) ?? '{}') as {
    state: Record<string, unknown>;
    version: number;
  };
}

async function load(state: unknown, version = 1): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify({ state, version }));
  await useLocalAiStore.persist.rehydrate();
}

beforeEach(() => {
  useLocalAiStore.setState({
    userEndpoints: [],
    selected: null,
    checks: {},
    status: { phase: 'idle', probes: [], error: null },
  });
  localStorage.clear();
  vi.clearAllMocks();
  setLocalClientForTests(client);
});

describe('local runtime settings', () => {
  it('saves the choice, the added addresses and the checks, never the detection status', () => {
    const s = useLocalAiStore.getState();
    s.select(selection);
    expect(s.addEndpoint(' http://LOCALHOST:11435/v1 ')).toBe('http://localhost:11435');
    s.recordCheck('ollama', 'http://127.0.0.1:11434/', details('qwen3:8b'), 1000);
    useLocalAiStore.setState({ status: { phase: 'done', probes: [], error: null } });
    const { state, version } = saved();
    expect(version).toBe(1);
    expect(state).toEqual({
      userEndpoints: ['http://localhost:11435'],
      selected: selection,
      checks: {
        [checkKey('ollama', 'http://127.0.0.1:11434', 'qwen3:8b')]: {
          capabilities: details('qwen3:8b').capabilities,
          contextLength: 40960,
          checkedAt: 1000,
        },
      },
    });
    expect(checkFor(useLocalAiStore.getState(), selection)?.contextLength).toBe(40960);
  });

  it('restores the saved choice on load without asking any runtime', async () => {
    await load({
      userEndpoints: ['http://127.0.0.1:11435'],
      selected: selection,
      checks: {},
      status: { phase: 'done', probes: [{ baseUrl: 'x' }], error: null },
    });
    const s = useLocalAiStore.getState();
    expect(s.selected).toEqual(selection);
    expect(s.userEndpoints).toEqual(['http://127.0.0.1:11435']);
    // The detection result is never restored: it is asked again when the user wants it.
    expect(s.status).toEqual({ phase: 'idle', probes: [], error: null });
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
  });

  it('checks stored data again on every load and drops what is not valid', async () => {
    await load({
      userEndpoints: [
        'http://192.168.1.5:11434',
        'http://127.0.0.1:1234/',
        'HTTP://127.0.0.1:1234/v1',
        'https://example.com',
        42,
      ],
      selected: { ...selection, baseUrl: 'http://evil.localhost:11434' },
      checks: {
        'ollama|http://127.0.0.1:11434|qwen3:8b': {
          capabilities: { ...UNVERIFIED, vision: 'maybe' },
          contextLength: 4096,
          checkedAt: 1,
        },
        'gemini|http://127.0.0.1:11434|m': {
          capabilities: UNVERIFIED,
          contextLength: null,
          checkedAt: 1,
        },
        'lmStudio|http://localhost:1234/v1|a|b': {
          capabilities: UNVERIFIED,
          contextLength: -5,
          checkedAt: 2,
        },
      },
    });
    const s = useLocalAiStore.getState();
    expect(s.userEndpoints).toEqual(['http://127.0.0.1:1234']);
    expect(s.selected).toBeNull();
    expect(s.checks).toEqual({
      'lmStudio|http://localhost:1234|a|b': {
        capabilities: UNVERIFIED,
        contextLength: null,
        checkedAt: 2,
      },
    });
    // A saved selection is kept only with a known runtime and a clean model name and label.
    expect(sanitizeLocalAi({ selected: { ...selection, kind: 'gemini' } }).selected).toBeNull();
    expect(sanitizeLocalAi({ selected: { ...selection, model: '..' } }).selected).toBeNull();
    expect(
      sanitizeLocalAi({ selected: { ...selection, label: 'Ollama\u0000 · x' } }).selected?.label,
    ).toBe('Ollama · x');
    expect(sanitizeLocalAi({ selected: { ...selection, label: 7 } }).selected?.label).toBe(
      'qwen3:8b',
    );
    expect(sanitizeLocalAi('garbage')).toEqual({ userEndpoints: [], selected: null, checks: {} });
  });

  it('writes the cleaned data back right after loading, and leaves clean data alone', async () => {
    await load({
      userEndpoints: ['http://192.168.1.5:11434', 'http://127.0.0.1:1234/'],
      selected: { ...selection, baseUrl: 'http://10.0.0.2:11434' },
      checks: {},
    });
    // No change was made after loading, yet the address off this computer is gone from storage.
    const raw = localStorage.getItem(KEY) ?? '';
    expect(raw).not.toContain('192.168.1.5');
    expect(raw).not.toContain('10.0.0.2');
    expect(saved()).toEqual({
      state: { userEndpoints: ['http://127.0.0.1:1234'], selected: null, checks: {} },
      version: 1,
    });
    // Once clean, loading again writes nothing.
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await useLocalAiStore.persist.rehydrate();
    expect(write).not.toHaveBeenCalled();
    // Clean stored data (key order aside) is not rewritten either.
    const clean = JSON.stringify({
      version: 1,
      state: { checks: {}, selected: selection, userEndpoints: ['http://127.0.0.1:11435'] },
    });
    localStorage.setItem(KEY, clean);
    write.mockClear();
    await useLocalAiStore.persist.rehydrate();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(clean);
    write.mockRestore();
  });

  it('refuses an address off this computer and keeps the list short', () => {
    const s = useLocalAiStore.getState();
    expect(() => s.addEndpoint('http://10.0.0.2:8080')).toThrow(
      expect.objectContaining({ code: 'notAllowed', message: 'not-loopback' }) as Error,
    );
    for (let p = 2000; p < 2000 + MAX_USER_ENDPOINTS + 3; p++) {
      s.addEndpoint(`http://127.0.0.1:${p}`);
    }
    // The newest first, the same address only once.
    s.addEndpoint('http://127.0.0.1:2005');
    const list = useLocalAiStore.getState().userEndpoints;
    expect(list).toHaveLength(MAX_USER_ENDPOINTS);
    expect(list[0]).toBe('http://127.0.0.1:2005');
    expect(new Set(list).size).toBe(list.length);
    s.removeEndpoint('http://127.0.0.1:2005');
    expect(useLocalAiStore.getState().userEndpoints).not.toContain('http://127.0.0.1:2005');
  });

  it('keeps only the newest checks', () => {
    const s = useLocalAiStore.getState();
    for (let i = 0; i < MAX_CHECKS + 5; i++) {
      s.recordCheck('ollama', 'http://127.0.0.1:11434', details(`m${i}`), i);
    }
    const keys = Object.keys(useLocalAiStore.getState().checks);
    expect(keys).toHaveLength(MAX_CHECKS);
    expect(keys).not.toContain(checkKey('ollama', 'http://127.0.0.1:11434', 'm0'));
    // A check for an address off this computer is not kept.
    s.recordCheck('ollama', 'http://example.com:1', details('x'), 1e9);
    expect(Object.keys(useLocalAiStore.getState().checks)).toHaveLength(MAX_CHECKS);
  });

  it('detects only when asked: the usual addresses plus the added ones', async () => {
    const usual: RuntimeProbe[] = [
      {
        expected: 'ollama',
        kind: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        status: 'found',
        version: '0.12.6',
      },
    ];
    const added: RuntimeProbe = {
      expected: null,
      kind: 'llamaCpp',
      baseUrl: 'http://127.0.0.1:8081',
      status: 'found',
      version: null,
    };
    client.detect.mockResolvedValue(usual);
    client.probe.mockResolvedValue(added);
    const s = useLocalAiStore.getState();
    s.addEndpoint('http://127.0.0.1:8081');
    s.addEndpoint('http://127.0.0.1:11434');
    expect(client.detect).not.toHaveBeenCalled();
    const probes = await s.detect();
    expect(probes).toEqual([...usual, added]);
    // An added address that detection already asked is not asked twice.
    expect(client.probe.mock.calls).toEqual([['http://127.0.0.1:8081']]);
    expect(useLocalAiStore.getState().status).toEqual({ phase: 'done', probes, error: null });
    expect(saved().state).not.toHaveProperty('status');
    client.detect.mockRejectedValue(new AiError('notAllowed', 'ageGate'));
    await expect(s.detect()).rejects.toMatchObject({ code: 'notAllowed' });
    expect(useLocalAiStore.getState().status).toEqual({
      phase: 'error',
      probes: [],
      error: 'notAllowed',
    });
  });
});
