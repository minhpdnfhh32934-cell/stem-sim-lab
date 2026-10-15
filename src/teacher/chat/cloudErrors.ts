/**
 * Learner-facing words for an online provider (Gemini, Claude, Groq) that could not answer an AI
 * Teacher question: one study-partner sentence per kind of failure, naming who failed (the provider
 * that answers, or the Think reviewer) and the Settings page that helps. The provider's own
 * message ("429 Too Many Requests: {…}", "100/100", "30s") is machine text: it never reaches the
 * learner, and stays out of the console too (it may carry parts of the provider's reply).
 *
 * Asking again is always the learner's own click ("Hỏi lại"); the page never re-sends by itself.
 */
import { translate, type Locale } from '@/app/i18n';
import { PROVIDER_NAME } from '@/app/ai/aiStatusView';
import { SECTIONS } from '@/app/settings/sectionMeta';
import type { SettingsSection } from '@/app/workspaceStore';
import { aiErrorKind } from '@/ai/errorKind';
import { toAiError, type Provider } from '@/ai/types';

/** The kinds AI Teacher explains for an online provider (`chat.errors.cloud.*`). */
export type CloudErrorKind =
  | 'timeout'
  /** A streamed answer stopped coming mid-way, or ran past the overall cap. */
  | 'stalled'
  | 'network'
  | 'quota'
  | 'badKey'
  | 'badModel'
  | 'dailyLimit'
  | 'missingKey'
  | 'notAllowed'
  | 'emptyAnswer'
  | 'reasoningOnly'
  | 'tooLarge'
  | 'server'
  | 'other';

/** Who was asked: the provider that answers, or the Think reviewer. */
export type CloudRole = 'answer' | 'review';

export interface CloudFailure {
  /** `filtered`: the provider's own safety filter stopped the answer (`chat.errors.filtered`). */
  kind: CloudErrorKind | 'filtered';
  /** The Settings page that helps (null: none does). */
  section: SettingsSection | null;
  /** Asking again (the learner's own click) may work. */
  retry: boolean;
}

/**
 * The Settings page of a provider's key, model and choice: "Kết nối AI" for the provider that
 * answers, "AI Teacher" for the reviewer (its model and second key are chosen there).
 */
function pageOf(role: CloudRole): SettingsSection {
  return role === 'review' ? 'teacher' : 'ai';
}

/**
 * A streamed answer's timer that ran out after the answer had started (src-tauri/src/ai/stream.rs
 * `Clock::expired`, src/ai/cloudStream.ts `expired`): the gap between two pieces (`gap: 45s`) or
 * the whole call (`overall: 600s`). Both are fixed; the wait in Settings → Kết nối AI covers only
 * the first text (`first-delta: …`) and a whole (non-streamed) answer (`30s`).
 */
const STREAM_STALL = /^(?:gap|overall):/;

/** What to tell the learner about whatever an online provider's call threw. */
export function cloudFailure(e: unknown, role: CloudRole): CloudFailure {
  const page = pageOf(role);
  switch (aiErrorKind(e)) {
    case 'timeout':
      // No setting can lengthen these: ask again, or for a shorter answer.
      if (STREAM_STALL.test(toAiError(e).message)) {
        return { kind: 'stalled', section: null, retry: true };
      }
      // The wait is set in Settings → Kết nối AI for every call, the review's too.
      return { kind: 'timeout', section: 'ai', retry: true };
    case 'network':
      return { kind: 'network', section: page, retry: true };
    case 'quota':
      return { kind: 'quota', section: page, retry: true };
    case 'badKey':
      return { kind: 'badKey', section: page, retry: false };
    case 'badModel':
      return { kind: 'badModel', section: page, retry: false };
    case 'dailyLimit':
      return { kind: 'dailyLimit', section: 'ai', retry: false };
    case 'missingKey':
    case 'keychain':
      return { kind: 'missingKey', section: page, retry: false };
    case 'notAllowed':
      return { kind: 'notAllowed', section: 'safety', retry: false };
    case 'emptyAnswer':
      return { kind: 'emptyAnswer', section: page, retry: true };
    case 'reasoningOnly':
      return { kind: 'reasoningOnly', section: page, retry: true };
    case 'tooLarge':
      return { kind: 'tooLarge', section: 'memory', retry: false };
    case 'server':
      return { kind: 'server', section: page, retry: true };
    case 'filtered':
      return { kind: 'filtered', section: null, retry: false };
    default:
      return { kind: 'other', section: page, retry: true };
  }
}

/**
 * The failure's sentence. `fallback`: the quota fallback provider may have been asked too (the
 * error may be its own), so both are named instead of blaming one of them.
 */
export function cloudFailureText(
  locale: Locale,
  failure: CloudFailure,
  provider: Provider,
  role: CloudRole,
  fallback?: Provider,
): string {
  if (failure.kind === 'filtered') return translate(locale, 'chat.errors.filtered');
  const name = PROVIDER_NAME[provider];
  const who =
    role === 'review'
      ? translate(locale, 'chat.errors.cloud.reviewer', { name })
      : fallback && fallback !== provider
        ? translate(locale, 'chat.errors.cloud.withFallback', {
            name,
            fallback: PROVIDER_NAME[fallback],
          })
        : name;
  const page = translate(locale, SECTIONS[failure.section ?? pageOf(role)].title);
  return translate(locale, `chat.errors.cloud.${failure.kind}`, { who, page });
}
