/**
 * Learner-facing words for runtimes on this computer (Ollama, LM Studio, llama.cpp…): their names,
 * the model label shown next to an answer ("Ollama · qwen3:8b"), and one study-partner sentence
 * per failure with the Settings page that helps. A local failure never leads online: the sentence
 * says what to do on this computer, and asking again is the learner's own click.
 */
import { translate, type Locale, type MessageKey } from '@/app/i18n';
import type { SettingsSection } from '@/app/workspaceStore';
import { aiErrorKind } from '@/ai/errorKind';
import type { RuntimeKind } from '@/ai/local/types';
import { toAiError } from '@/ai/types';

/** The runtime's name as the learner knows it. */
export function runtimeName(locale: Locale, kind: RuntimeKind): string {
  return translate(locale, `localRuntime.kinds.${kind}`);
}

/** "Ollama · qwen3:8b": the AI label of an answer names the runtime and its model. */
export function localModelLabel(locale: Locale, kind: RuntimeKind, model: string): string {
  return `${runtimeName(locale, kind)} · ${model}`;
}

/** What to tell the learner when a local runtime could not answer. */
export interface LocalFailure {
  key: MessageKey;
  /** The Settings page that helps (null: none does). */
  section: SettingsSection | null;
  /** Asking again (the learner's own click) may work. */
  retry: boolean;
}

/** A runtime's own words that mean the question did not fit its context window. */
const CONTEXT_FULL =
  /context (length|size|window)|n_ctx|exceeds? (the )?(available )?context|too many tokens|prompt is too long/i;

/** The sentence and Settings page for whatever a local runtime call threw. */
export function localFailure(e: unknown): LocalFailure {
  const kind = aiErrorKind(e);
  const runtimes = 'runtimes' as const;
  switch (kind) {
    case 'localUnreachable':
    case 'network':
      return { key: 'chat.errors.localDown', section: runtimes, retry: true };
    case 'localModelMissing':
      return { key: 'chat.errors.localModelMissing', section: runtimes, retry: true };
    case 'localLoading':
      return { key: 'chat.errors.localLoading', section: runtimes, retry: true };
    case 'localStalled':
    case 'timeout':
      return { key: 'chat.errors.localStalled', section: runtimes, retry: true };
    case 'localNeedsAuth':
      return { key: 'chat.errors.localAuth', section: runtimes, retry: false };
    case 'tooLarge':
      return { key: 'chat.errors.localContext', section: 'memory', retry: false };
    case 'localRemoteModel':
      return { key: 'chat.errors.localRemote', section: runtimes, retry: false };
    case 'localNotRuntime':
    case 'localIsOllama':
      return { key: 'chat.errors.localNotRuntime', section: runtimes, retry: false };
    case 'localNotSelected':
    case 'notLoopback':
      return { key: 'chat.errors.localNotSelected', section: runtimes, retry: false };
    case 'needsAppUpdate':
      return { key: 'chat.errors.localUpdate', section: null, retry: false };
    case 'notAllowed':
      return { key: 'chat.errors.notAllowed', section: 'safety', retry: false };
    default:
      // A runtime that says the question did not fit its window (llama.cpp, LM Studio).
      if (CONTEXT_FULL.test(toAiError(e).message))
        return { key: 'chat.errors.localContext', section: 'memory', retry: false };
      return { key: 'chat.errors.localFailed', section: runtimes, retry: true };
  }
}

/** The failure's sentence, naming the runtime. */
export function localFailureText(locale: Locale, failure: LocalFailure, kind: RuntimeKind): string {
  return translate(locale, failure.key, { name: runtimeName(locale, kind) });
}
