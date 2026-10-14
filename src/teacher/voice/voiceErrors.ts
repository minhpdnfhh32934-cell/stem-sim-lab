import type { MessageKey } from '@/app/i18n';

/**
 * On-device failures after which a lesson reads on with the system voice (speak.ts
 * `lastingFailure`): silence, a model that will not load, a crashed worker.
 */
const LESSON_LONG = /^(?:voice-model-(?:silent|load-)|worker-crashed)/;

/**
 * Friendly words for the reasons a voice could not speak (`useVoiceStore.lastError`, written by
 * `speak.ts` as "code: message" for AI errors, e.g. "timeout: 30s", "http: 429: …").
 * `gpuFault` is the failure that moved the on-device voice off the graphics card in this session
 * (`localVoiceGpuFault`): the learner is told the voice now runs on the CPU.
 */
export function voiceErrorKey(error: string, gpuFault: string | null = null): MessageKey {
  if (gpuFault !== null && error === gpuFault) return 'voice.errors.gpuToCpu';
  if (error.includes('no-key') || error.toLowerCase().includes('missingkey'))
    return 'voice.errors.noKey';
  if (error.includes('voice-model-missing')) return 'voice.errors.noModel';
  if (LESSON_LONG.test(error)) return 'voice.errors.lessonRest';
  if (/dailylimit/i.test(error)) return 'voice.errors.dailyLimit';
  if (/quota|429|resource_exhausted/i.test(error)) return 'voice.errors.quota';
  if (/timeout|timed out/i.test(error)) return 'voice.errors.timeout';
  if (/network|offline|failed to fetch/i.test(error)) return 'voice.errors.offline';
  if (/notallowed|agegate/i.test(error)) return 'voice.errors.notAllowed';
  if (error.startsWith('system-voice-')) return 'voice.errors.systemVoice';
  return 'voice.errors.other';
}
