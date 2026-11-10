/** How an AI Teacher answer fails or stops, and the request plumbing every engine shares. */
import type { SettingsSection } from '@/app/workspaceStore';
import { toAiError, type Provider } from '@/ai/types';

/**
 * An answer that could not be made, in the learner's words, with the Settings page that helps and
 * whether asking again (the learner's own click, never automatic) may work.
 */
export class TeacherError extends Error {
  constructor(
    message: string,
    readonly section: SettingsSection | null,
    readonly retry: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'TeacherError';
  }
}

/** The learner pressed "Dừng": nothing went wrong, the answer was not wanted any more. */
export class AnswerStopped extends Error {
  constructor() {
    super('answer-stopped');
    this.name = 'AnswerStopped';
  }
}

/** Rejects with AnswerStopped as soon as `signal` aborts (the work behind may still finish). */
export function untilStopped<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) {
    // The work's own failure no longer matters (and must not surface as unhandled).
    work.catch(() => undefined);
    return Promise.reject(new AnswerStopped());
  }
  return new Promise<T>((resolve, reject) => {
    const stop = () => {
      reject(new AnswerStopped());
    };
    signal.addEventListener('abort', stop, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', stop);
        resolve(value);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', stop);
        // Rust's errors arrive as plain `{ code, message }` objects: they keep their code.
        reject(signal.aborted ? new AnswerStopped() : e instanceof Error ? e : toAiError(e));
      },
    );
  });
}

/** Throws AnswerStopped once the learner pressed "Dừng". */
export function stopIfAsked(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AnswerStopped();
}

export interface Answer {
  content: string;
  model: string;
  truncated: boolean;
  /** The online provider that answered (cloud answers only). */
  provider?: Provider;
  /** The quota fallback answered (cloud answers only). */
  fallback?: boolean;
}

export function requestId(): string {
  try {
    const id = globalThis.crypto.randomUUID();
    if (id.length > 0) return id;
  } catch {
    // Older or non-secure contexts fall through to the Math.random fallback below.
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
