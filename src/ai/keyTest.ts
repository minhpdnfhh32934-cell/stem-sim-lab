/**
 * "Kiểm tra key" (PROMPT_PHAN_2 A2). Mirrors `KeyStatus`/`classify_key_test` in
 * src-tauri/src/ai/mod.rs; the browser transport (tests) uses the same rules.
 */
export type KeyStatus = 'ok' | 'noKey' | 'badKey' | 'quota' | 'badModel' | 'offline' | 'error';

export interface KeyTest {
  status: KeyStatus;
  /** Short server message for `error` (never contains the key). */
  detail: string;
}

/**
 * Gemini: wrong key = HTTP 400 `API_KEY_INVALID`; Claude: 401. Unknown model 404, quota 429.
 * Claude reports an empty prepaid balance as 400 "credit balance is too low" (a quota problem).
 */
export function classifyKeyTest(status: number, body: string): KeyStatus {
  const b = body.toLowerCase();
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401 || status === 403) return 'badKey';
  if (status === 404) return 'badModel';
  if (status === 402 || status === 429) return 'quota';
  if (status === 400) {
    if (b.includes('api_key_invalid') || b.includes('api key not valid')) return 'badKey';
    if (b.includes('credit balance')) return 'quota';
    if (b.includes('model') && (b.includes('not found') || b.includes('not_found'))) {
      return 'badModel';
    }
  }
  return 'error';
}

/** "••••••••abcd": only the last 4 characters of a key are ever shown (same as `mask_key`). */
export function maskKey(key: string): string {
  // API keys are ASCII, so code units are characters.
  const k = key.trim();
  if (k.length <= 8) return '••••••••';
  return `••••••••${k.slice(-4)}`;
}
