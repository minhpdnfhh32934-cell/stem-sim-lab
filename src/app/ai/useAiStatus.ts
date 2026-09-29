import { useEffect } from 'react';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { getTransport } from '@/ai/transport';

const POLL_MS = 20_000;

/** Checks the AI connection once: LM Studio is asked for its models, cloud needs a stored key. */
export async function checkAiStatus(): Promise<void> {
  const { provider, baseUrl } = useAiStore.getState();
  const setWs = (aiStatus: 'offline' | 'local' | 'cloud') => {
    useWorkspaceStore.setState({ aiStatus });
  };
  if (provider === 'off') {
    useAiStore.setState({ status: 'offline', availableModels: [] });
    setWs('offline');
    return;
  }
  const transport = getTransport();
  try {
    if (provider === 'lmstudio') {
      const models = await transport.models('lmstudio', baseUrl);
      // Settings may have changed while waiting.
      if (useAiStore.getState().provider !== provider) return;
      useAiStore.setState({ status: 'ok', availableModels: models });
      setWs('local');
    } else {
      const has = await transport.hasKey(provider);
      if (useAiStore.getState().provider !== provider) return;
      useAiStore.setState({ status: has ? 'ok' : 'noKey' });
      setWs(has ? 'cloud' : 'offline');
    }
  } catch {
    if (useAiStore.getState().provider !== provider) return;
    useAiStore.setState({ status: 'offline', availableModels: [] });
    setWs('offline');
  }
}

/**
 * Keeps the AI status pill current. Only LM Studio is polled (a local HTTP call);
 * cloud providers are never contacted in the background.
 */
export function useAiStatusPolling(): void {
  const provider = useAiStore((s) => s.provider);
  const baseUrl = useAiStore((s) => s.baseUrl);
  useEffect(() => {
    void checkAiStatus();
    if (provider !== 'lmstudio') return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkAiStatus();
    }, POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [provider, baseUrl]);
}
