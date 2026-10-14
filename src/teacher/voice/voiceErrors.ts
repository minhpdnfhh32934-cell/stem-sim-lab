import type { MessageKey } from '@/app/i18n';

/**
 * On-device failures after which a lesson reads on with the system voice (speak.ts
 * `lastingFailure`): silence, a model that will not load, a crashed worker.
 */
const LESSON_LONG = /^(?:voice-model-(?:silent|load-)|worker-crashed)/;

/**
 * Friendly words for the reasons a voice could not speak (`useVoiceStore.lastError`, written by
 * `speak.ts` as "code: message" for AI errors, e.g. "timeout: 30s", "http: 429: …").
 * A phrase that failed because the graphics card failed starts with "voice-model-card-fault"
 * (localVoice.ts `CARD_FAULT`): the learner is told the voice now runs on the CPU.
 */
export function voiceErrorKey(error: string): MessageKey {
  if (error.startsWith('voice-model-card-fault')) return 'voice.errors.gpuToCpu';
  if (error.includes('no-key') || error.toLowerCase().includes('missingkey'))
    return 'voice.errors.noKey';
  if (error.includes('voice-model-missing')) return 'voice.errors.noModel';
  // The voice left the card for the CPU while a phrase was rendered there (localVoice.ts load).
  if (error === 'voice-model-moved-to-cpu') return 'voice.errors.movedToCpu';
  if (LESSON_LONG.test(error)) return 'voice.errors.lessonRest';
  if (/dailylimit/i.test(error)) return 'voice.errors.dailyLimit';
  if (/quota|429|resource_exhausted/i.test(error)) return 'voice.errors.quota';
  if (/timeout|timed out/i.test(error)) return 'voice.errors.timeout';
  if (/network|offline|failed to fetch/i.test(error)) return 'voice.errors.offline';
  if (/notallowed|agegate/i.test(error)) return 'voice.errors.notAllowed';
  if (error.startsWith('system-voice-')) return 'voice.errors.systemVoice';
  return 'voice.errors.other';
}
