import { useEffect } from 'react';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { DEFAULT_MODELS, useAiStore, type AiStatus } from '@/ai/aiStore';
import { getTransport } from '@/ai/transport';
import { toAiError } from '@/ai/types';
import { currentSafety } from '@/safety/safetyStore';

/**
 * Updates the AI status. By default only checks that a key is stored (no network call:
 * the cloud is never contacted in the background). With `probe` ("Kiểm tra key") it sends one
 * tiny request with the chosen model, which tells whether the key, the model and the quota are
 * fine (PROMPT_PHAN_2 A2: thành công / key không hợp lệ / hết hạn mức / không có mạng).
 */
export async function checkAiStatus(probe = false): Promise<AiStatus> {
  const { provider, models } = useAiStore.getState();
  const set = (status: AiStatus, detail = '') => {
    useAiStore.setState({ status, statusDetail: detail });
    useWorkspaceStore.setState({ aiStatus: status === 'ok' ? 'cloud' : 'offline' });
    return status;
  };
  if (provider === 'off') return set('offline');
  const transport = getTransport();
  const stillCurrent = () => useAiStore.getState().provider === provider;
  try {
    // Safety gates first (the Rust gateway refuses too): no age confirmation, no AI.
    const safety = await currentSafety();
    if (!stillCurrent()) return useAiStore.getState().status;
    if (!safety.aiAllowed) return set('notAllowed');
    const has = await transport.hasKey(provider);
    if (!stillCurrent()) return useAiStore.getState().status;
    if (!has) return set('noKey');
    if (!probe) return set('ok');
    if (transport.testKey) {
      const model = models[provider].trim() || DEFAULT_MODELS[provider];
      const r = await transport.testKey(provider, model);
      if (!stillCurrent()) return useAiStore.getState().status;
      return set(r.status, r.detail);
    }
    await transport.models(provider);
    if (!stillCurrent()) return useAiStore.getState().status;
    return set('ok');
  } catch (e) {
    if (!stillCurrent()) return useAiStore.getState().status;
    const err = toAiError(e);
    if (err.code === 'notAllowed') return set('notAllowed');
    // 400/401/403: the provider refused the key (wrong, disabled or not allowed).
    const refused = err.code === 'http' && /\b(400|401|403)\b/.test(err.message);
    return set(refused ? 'badKey' : 'offline');
  }
}

/** Keeps the AI status pill current when the provider changes (no polling, no network). */
export function useAiStatusPolling(): void {
  const provider = useAiStore((s) => s.provider);
  useEffect(() => {
    void checkAiStatus();
  }, [provider]);
}
