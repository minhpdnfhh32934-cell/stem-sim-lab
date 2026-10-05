import { useEffect } from 'react';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { getTransport } from '@/ai/transport';
import { toAiError } from '@/ai/types';

/**
 * Updates the AI status. By default only checks that a key is stored (no network call:
 * the cloud is never contacted in the background). With `probe` (the "Kiểm tra kết nối"
 * button) it also asks the provider for its models, which tells whether the key works.
 */
export async function checkAiStatus(probe = false): Promise<void> {
  const { provider } = useAiStore.getState();
  const setWs = (aiStatus: 'offline' | 'cloud') => {
    useWorkspaceStore.setState({ aiStatus });
  };
  if (provider === 'off') {
    useAiStore.setState({ status: 'offline' });
    setWs('offline');
    return;
  }
  const transport = getTransport();
  const stillCurrent = () => useAiStore.getState().provider === provider;
  try {
    const has = await transport.hasKey(provider);
    if (!stillCurrent()) return;
    if (!has) {
      useAiStore.setState({ status: 'noKey' });
      setWs('offline');
      return;
    }
    if (probe) await transport.models(provider);
    if (!stillCurrent()) return;
    useAiStore.setState({ status: 'ok' });
    setWs('cloud');
  } catch (e) {
    if (!stillCurrent()) return;
    const err = toAiError(e);
    // 400/401/403: the provider refused the key (wrong, disabled or not allowed).
    const refused = err.code === 'http' && /\b(400|401|403)\b/.test(err.message);
    useAiStore.setState({ status: refused ? 'badKey' : 'offline' });
    setWs('offline');
  }
}

/** Keeps the AI status pill current when the provider changes (no polling, no network). */
export function useAiStatusPolling(): void {
  const provider = useAiStore((s) => s.provider);
  useEffect(() => {
    void checkAiStatus();
  }, [provider]);
}
