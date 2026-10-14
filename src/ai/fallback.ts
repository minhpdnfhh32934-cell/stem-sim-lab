import { modelFor, useAiStore } from './aiStore';
import { isQuotaMessage } from './errorKind';
import { AiError, type Fallback, type Provider } from './types';

/**
 * Errors after which the fallback provider may answer (same rule as `is_quota_error` in
 * src-tauri/src/ai/mod.rs): out of quota or credit — HTTP 429 after the retries, 402, Claude's
 * "credit balance is too low", Gemini's RESOURCE_EXHAUSTED. A wrong key, an unknown model or a
 * network problem never switches provider.
 */
export function isQuotaError(e: unknown): boolean {
  return e instanceof AiError && e.code === 'http' && isQuotaMessage(e.message);
}

/** The fallback configured in Settings for `provider`, or undefined (off / same provider). */
export function fallbackFor(provider: Provider): Fallback | undefined {
  const { fallback, models } = useAiStore.getState();
  if (fallback === 'off' || fallback === provider) return undefined;
  return { provider: fallback, model: modelFor(models, fallback) };
}
