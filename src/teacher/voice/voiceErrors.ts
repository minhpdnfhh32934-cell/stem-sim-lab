import type { MessageKey } from '@/app/i18n';

/**
 * Friendly words for the reasons a voice could not speak (`useVoiceStore.lastError`, written by
 * `speak.ts` as "code: message" for AI errors, e.g. "timeout: 30s", "http: 429: …").
 */
export function voiceErrorKey(error: string): MessageKey {
  if (error.includes('no-key') || error.toLowerCase().includes('missingkey'))
    return 'voice.errors.noKey';
  if (error.includes('voice-model-missing')) return 'voice.errors.noModel';
  if (/dailylimit/i.test(error)) return 'voice.errors.dailyLimit';
  if (/quota|429|resource_exhausted/i.test(error)) return 'voice.errors.quota';
  if (/timeout|timed out/i.test(error)) return 'voice.errors.timeout';
  if (/network|offline|failed to fetch/i.test(error)) return 'voice.errors.offline';
  if (/notallowed|agegate/i.test(error)) return 'voice.errors.notAllowed';
  if (error.startsWith('system-voice-')) return 'voice.errors.systemVoice';
  return 'voice.errors.other';
}
