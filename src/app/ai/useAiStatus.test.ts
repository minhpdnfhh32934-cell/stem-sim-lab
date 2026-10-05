import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';
import type { KeyStatus } from '@/ai/keyTest';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { setSafetyBackendForTests, BrowserSafety } from '@/safety/safety';
import { checkAiStatus } from './useAiStatus';

function transport(hasKey: boolean, result: KeyStatus, seen: string[] = []): LlmTransport {
  return {
    chat: () => Promise.reject(new Error('not used')),
    models: () => Promise.resolve([]),
    setKey: () => Promise.resolve(),
    hasKey: () => Promise.resolve(hasKey),
    deleteKey: () => Promise.resolve(),
    testKey: (_p, model) => {
      seen.push(model);
      return Promise.resolve({ status: result, detail: result === 'error' ? '500' : '' });
    },
  };
}

describe('AI status / "Kiểm tra key"', () => {
  afterEach(() => {
    setTransportForTests(null);
  });

  it('without probing only checks that a key is stored (no network)', async () => {
    const seen: string[] = [];
    useAiStore.setState({ provider: 'gemini', models: { gemini: '', claude: '' } });
    setTransportForTests(transport(true, 'badKey', seen));
    expect(await checkAiStatus()).toBe('ok');
    expect(seen).toEqual([]);
    setTransportForTests(transport(false, 'ok', seen));
    expect(await checkAiStatus()).toBe('noKey');
  });

  it.each(['ok', 'badKey', 'quota', 'offline', 'badModel', 'error'] as const)(
    'probe result %s becomes the status',
    async (result) => {
      const seen: string[] = [];
      useAiStore.setState({ provider: 'gemini', models: { gemini: '', claude: '' } });
      setTransportForTests(transport(true, result, seen));
      expect(await checkAiStatus(true)).toBe(result);
      // The empty model field means the default model is tested.
      expect(seen).toEqual([DEFAULT_MODELS.gemini]);
      expect(useWorkspaceStore.getState().aiStatus).toBe(result === 'ok' ? 'cloud' : 'offline');
      expect(useAiStore.getState().statusDetail).toBe(result === 'error' ? '500' : '');
    },
  );

  it('stays "notAllowed" without the age confirmation, before any key check', async () => {
    const seen: string[] = [];
    useAiStore.setState({ provider: 'gemini', models: { gemini: '', claude: '' } });
    setSafetyBackendForTests(new BrowserSafety(false));
    setTransportForTests(transport(true, 'ok', seen));
    expect(await checkAiStatus(true)).toBe('notAllowed');
    expect(seen).toEqual([]);
    expect(useWorkspaceStore.getState().aiStatus).toBe('offline');
  });
});
