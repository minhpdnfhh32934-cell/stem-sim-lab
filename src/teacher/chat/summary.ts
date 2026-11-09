/** Older turns folded into the stored summary, written by the engine that answers. */
import type { Locale } from '@/app/i18n';
import { aiErrorKind, type AiErrorKind } from '@/ai/errorKind';
import { stripReasoningOutsideCode } from '@/ai/reasoning';
import type { ChatMessage } from '@/ai/types';
import { localFailure } from '@/app/ai/localRuntime';
import { outputIsSafe } from '@/safety/moderation';
import { useChatStore, type ChatMessageRecord, type ChatSummary } from './chatStore';
import { estimateTokens, sentText, summaryRequest, unsummarized } from './memory';
import { TeacherError, type Answer } from './teacherErrors';

/** Tokens the summary of older turns may use. */
export const SUMMARY_TOKENS = 400;

type SummaryRequest = ReturnType<typeof summaryRequest>;

function requestTokens(request: SummaryRequest): number {
  return request.messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    estimateTokens(request.system),
  );
}

/** Shortest text kept of one turn when the summary request must be squeezed. */
const MIN_SUMMARY_TURN_CHARS = 120;

/**
 * The summary request within `maxTokens` (Gemma on an integrated card, audit GPU-01; the window
 * of a runtime on this computer): it is one message nobody trims later, so the turns are shortened
 * evenly here and the oldest ones are left out when even that is not enough. Null when nothing
 * fits (no summary this time).
 */
function fittedSummaryRequest(
  locale: Locale,
  previous: ChatSummary | null,
  pending: ChatMessageRecord[],
  maxTokens: number,
): SummaryRequest | null {
  // Characters left for the turns (`estimateTokens` counts 3 characters per token).
  const room = (maxTokens - requestTokens(summaryRequest(locale, previous, []))) * 3;
  for (let from = 0; from < pending.length; from++) {
    const turns = pending.slice(from);
    // ~20 characters per turn for the speaker label and the line break.
    const perTurn = Math.floor(room / turns.length) - 20;
    if (perTurn < MIN_SUMMARY_TURN_CHARS) continue;
    const request = summaryRequest(
      locale,
      previous,
      turns.map((r) => ({ id: r.id, role: r.role, content: sentText(r).slice(0, perTurn) })),
    );
    if (requestTokens(request) <= maxTokens) return request;
  }
  return null;
}

/**
 * Turns that no longer fit the budget are folded into the stored summary, written by the same
 * engine that answers (nothing goes anywhere new). A failed or unsafe summary is skipped: the
 * answer is never blocked by it, the oldest turns are then simply left out. `maxInputTokens`
 * caps the whole summary request (on-device Gemma on an integrated card, a runtime on this
 * computer: its window). `fatal` picks the failures that end the question instead: a runtime on
 * this computer that did not answer the summary would not answer the question either, and asking
 * it twice would only make the learner wait twice. A model that could not write the summary in a
 * way it would repeat (only reasoning, nothing, too large, unsafe) is not asked again for this
 * conversation (`writer`: who writes it; `summarySkip` in the chat store).
 */
export async function updateSummary(
  locale: Locale,
  older: ChatMessageRecord[],
  all: ChatMessageRecord[],
  ask: (system: string, messages: ChatMessage[], maxTokens: number) => Promise<Answer>,
  maxInputTokens?: number,
  fatal?: (e: unknown) => boolean,
  writer?: string,
): Promise<void> {
  const store = useChatStore.getState();
  // "Xóa cuộc trò chuyện" while the summary is written: it describes a conversation that is gone.
  const cleared = () => useChatStore.getState().epoch !== store.epoch;
  const pending = unsummarized(older, store.summary, all);
  const last = pending[pending.length - 1];
  if (!last) return;
  const memo = writer === undefined ? null : `${writer}|${all[0]?.id ?? ''}`;
  if (memo !== null && store.summarySkip === memo) return;
  const skip = () => {
    if (memo !== null) useChatStore.setState({ summarySkip: memo });
  };
  try {
    const request =
      maxInputTokens === undefined
        ? summaryRequest(locale, store.summary, pending)
        : fittedSummaryRequest(locale, store.summary, pending, maxInputTokens);
    if (!request) return;
    const answer = await ask(request.system, request.messages, SUMMARY_TOKENS);
    if (cleared()) return;
    // The summary travels with later questions: hidden reasoning is not part of it.
    const text = stripReasoningOutsideCode(answer.content).text.trim();
    if (text && outputIsSafe(answer.content) && outputIsSafe(text))
      useChatStore.getState().setSummary({ text, upto: last.id });
    else skip();
  } catch (e) {
    if (fatal?.(e)) throw e;
    console.warn('[teacher-summary]', e instanceof Error ? e.message : String(e));
    const cause = e instanceof Error && e.cause !== undefined ? e.cause : e;
    if (summaryRepeats(cause)) skip();
  }
}

/**
 * A summary failure the same model would repeat for the same conversation: it did not fit the
 * window, or the model wrote only its reasoning or nothing (the same reading on every engine).
 */
function summaryRepeats(e: unknown): boolean {
  const { key } = localFailure(e);
  return key === 'chat.errors.localContext' || key === 'chat.errors.localNoAnswer';
}

/**
 * Failures of the runtime itself (or of the app around it): the question would fail the same way,
 * so it is not sent and the learner never waits twice.
 */
const RUNTIME_FAILURES: ReadonlySet<AiErrorKind> = new Set<AiErrorKind>([
  'localUnreachable',
  'network',
  'localStalled',
  'timeout',
  'localLoading',
  'localModelMissing',
  'localNeedsAuth',
  'localRemoteModel',
  'localNotRuntime',
  'localIsOllama',
  'localNotSelected',
  'notLoopback',
  'needsAppUpdate',
  'notAllowed',
]);

/**
 * A runtime on this computer failed the summary in a way that the question would fail too (not
 * running, stalled, loading, model missing, locked…): the question is not sent. Anything else is
 * about this one summary — it did not fit the model's window, the model wrote only its reasoning
 * or nothing within the summary's short limit, or another error the question may not meet — so the
 * summary is skipped and the question (fitted to the window by itself) is asked.
 */
export function localSummaryFatal(e: unknown): boolean {
  return e instanceof TeacherError && RUNTIME_FAILURES.has(aiErrorKind(e.cause));
}
