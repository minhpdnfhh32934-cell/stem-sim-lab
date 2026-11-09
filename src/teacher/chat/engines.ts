/** The engines that answer: an online provider, Gemma in the app, a runtime on this computer. */
import { translate, type Locale, type MessageKey } from '@/app/i18n';
import { useAiStore } from '@/ai/aiStore';
import { gemmaChatText, gemmaReady } from '@/ai/gemmaTransport';
import { webGPUStatus } from '@/ai/webGemma';
import { gemmaBlockedByGpuFault, isGpuFailure } from '@/ai/gpuSafety';
import { getTransport } from '@/ai/transport';
import { fallbackFor } from '@/ai/fallback';
import { AiError, toAiError, type ChatMessage, type ChatRequest, type Provider } from '@/ai/types';
import { localFailure, localFailureText, localModelLabel } from '@/app/ai/localRuntime';
import { getLocalClient } from '@/ai/local/client';
import type { LocalSelection, ProbeStatus } from '@/ai/local/types';
import { cloudFailure, cloudFailureText, type CloudErrorKind, type CloudRole } from './cloudErrors';
import {
  AnswerStopped,
  TeacherError,
  requestId,
  stopIfAsked,
  untilStopped,
  type Answer,
} from './teacherErrors';

interface CloudOptions {
  /**
   * Never switch to the quota fallback. Think sets it on every call (draft, summary, review): the
   * draft and the review come from the two providers the learner chose, never from a third one.
   */
  noFallback?: boolean;
  signal?: AbortSignal;
  /**
   * The text so far while the answer streams (provisional: a late reasoning tag can take text
   * back, see `StreamEvent`). Only for an answer that is shown as it is written: never for Think's
   * draft or review, a summary, or a structured (JSON) answer.
   */
  onPartial?: (textSoFar: string) => void;
  /** Who is asked, named in a failure ("Bên rà soát (Claude) …"). Default: the answering AI. */
  role?: CloudRole;
}

/**
 * Failure kinds that may come from the quota fallback as well, when it was asked: everything that
 * happens once the question is on its way (the daily cap, the safety gate and the chosen
 * provider's own key are checked before anything is sent).
 */
const SENT_KINDS: ReadonlySet<CloudErrorKind | 'filtered'> = new Set<CloudErrorKind | 'filtered'>([
  'timeout',
  'stalled',
  'network',
  'quota',
  'badKey',
  'badModel',
  'emptyAnswer',
  'reasoningOnly',
  'tooLarge',
  'server',
  'other',
]);

/**
 * An online provider answers. It streams through `onPartial` when the transport can
 * (`chatStream`: `ai_chat_stream` on the desktop, SSE in the browser), otherwise the answer arrives
 * whole. Retries happen only in the gateway (Rust: at most 3, on 429/5xx); this page never sends a
 * question again by itself. A failure becomes a TeacherError: the learner's sentence (cloudErrors.ts)
 * with the Settings page that helps; "Dừng" stays AnswerStopped.
 */
export async function cloudChat(
  provider: Provider,
  model: string,
  system: string,
  messages: ChatMessage[],
  locale: Locale,
  maxTokens: number,
  options: CloudOptions = {},
): Promise<Answer> {
  const { noFallback = false, signal, onPartial, role = 'answer' } = options;
  const transport = getTransport();
  if (!(await transport.hasKey(provider))) {
    throw new TeacherError(
      translate(locale, role === 'review' ? 'chat.errors.noVerifierKey' : 'chat.errors.noCloudKey'),
      role === 'review' ? 'teacher' : 'ai',
      false,
      { cause: new AiError('missingKey', provider) },
    );
  }
  // Stopped while the key was looked up: send nothing (it would count and be paid for).
  stopIfAsked(signal);
  const request: ChatRequest = {
    requestId: requestId(),
    provider,
    model,
    system,
    messages,
    temperature: 0.2,
    maxTokens,
    timeoutSecs: useAiStore.getState().timeoutSecs,
    ...(noFallback ? { noFallback } : {}),
  };
  try {
    // "Dừng" cancels the request itself (desktop: ai_cancel, browser: fetch abort).
    const answer = await untilStopped(
      onPartial && transport.chatStream
        ? transport.chatStream(request, onPartial, signal)
        : transport.chat(request, signal),
      signal,
    );
    // Only the quota fallback answers for another provider (the gateway names it then); without
    // it, the provider asked is the one that answered.
    const fallback = answer.fallback === true && answer.provider !== undefined;
    return {
      content: answer.content,
      model: answer.model,
      truncated: answer.truncated === true,
      provider: fallback && answer.provider ? answer.provider : provider,
      fallback,
    };
  } catch (e) {
    if (e instanceof AnswerStopped || signal?.aborted) throw new AnswerStopped();
    const failure = cloudFailure(e, role);
    // The kind and the code only: the provider's message may carry parts of its reply.
    console.warn('[teacher-cloud]', role, provider, failure.kind, toAiError(e).code);
    // The fallback may have answered this call and failed itself: then both are named.
    const fallback =
      noFallback || !SENT_KINDS.has(failure.kind) ? undefined : fallbackFor(provider);
    const fallbackAsked =
      fallback !== undefined && (await transport.hasKey(fallback.provider).catch(() => false));
    throw new TeacherError(
      cloudFailureText(
        locale,
        failure,
        provider,
        role,
        fallbackAsked ? fallback.provider : undefined,
      ),
      failure.section,
      failure.retry,
      { cause: e },
    );
  }
}

export async function localGemma(
  model: string,
  system: string,
  messages: ChatMessage[],
  locale: Locale,
  maxTokens: number,
  inputBudget: number,
  onPartial?: (textSoFar: string) => void,
  extra: { signal?: AbortSignal; echo?: string; images?: ArrayBuffer[] } = {},
): Promise<Answer> {
  if (webGPUStatus() !== 'webgpu') throw new Error(translate(locale, 'chat.errors.webgpu'));
  if (!(await gemmaReady(model))) throw new Error(translate(locale, 'chat.errors.gemmaMissing'));
  try {
    // "Dừng" interrupts the generation in the worker (src/ai/webGemmaWorker.ts).
    return await untilStopped(
      gemmaChatText({
        model,
        system,
        messages,
        maxTokens,
        inputBudget,
        ...(onPartial ? { onPartial } : {}),
        ...(extra.signal ? { signal: extra.signal } : {}),
        ...(extra.echo ? { echo: extra.echo } : {}),
        ...(extra.images?.length ? { images: extra.images } : {}),
      }),
      extra.signal,
    );
  } catch (e) {
    if (e instanceof AnswerStopped || extra.signal?.aborted) throw new AnswerStopped();
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[teacher-gemma]', message);
    throw new Error(translate(locale, gemmaErrorKey(message)), { cause: e });
  }
}

/**
 * A runtime the learner runs on this computer (Ollama, LM Studio, llama.cpp…) answers. It streams
 * through `onPartial` (provisional text, see `askTeacher`), is never retried, never counted
 * against the daily cap and never replaced by an online provider: a failure is the runtime's own
 * sentence (`localFailure`) with the Settings page that helps. "Dừng" closes the connection to the
 * runtime (desktop: `ai_cancel` in Rust, browser: fetch abort).
 */
export async function localRuntimeChat(
  selection: LocalSelection,
  system: string,
  messages: ChatMessage[],
  locale: Locale,
  maxTokens: number,
  contextLength: number,
  onPartial?: (textSoFar: string) => void,
  signal?: AbortSignal,
  /** Ollama `think` (the clients send it only to a model seen reasoning first). */
  think?: boolean,
  /**
   * A picture of the circled area (PNG, base64) for a model seen reading pictures: in the
   * learner's last turn, with `vision` (the client checks the model again before sending).
   */
  picture?: string,
): Promise<Answer> {
  stopIfAsked(signal);
  try {
    const last = messages.length - 1;
    const answer = await untilStopped(
      getLocalClient().chat(
        {
          requestId: requestId(),
          kind: selection.kind,
          baseUrl: selection.baseUrl,
          model: selection.model,
          system,
          messages: picture
            ? messages.map((m, i) => (i === last ? { ...m, images: [picture] } : m))
            : messages,
          temperature: 0.2,
          maxTokens,
          contextLength,
          ...(think !== undefined ? { think } : {}),
          ...(picture ? { vision: true } : {}),
        },
        {
          ...(onPartial ? { onPartial } : {}),
          ...(signal ? { signal } : {}),
        },
      ),
      signal,
    );
    return {
      content: answer.content,
      model: localModelLabel(locale, selection.kind, answer.model || selection.model),
      truncated: answer.truncated,
    };
  } catch (e) {
    throw localError(e, selection, locale, signal);
  }
}

/**
 * A runtime on this computer failed: its own sentence with the Settings page that helps (never an
 * online answer instead); "Dừng" stays AnswerStopped.
 */
function localError(
  e: unknown,
  selection: LocalSelection,
  locale: Locale,
  signal?: AbortSignal,
): Error {
  if (e instanceof AnswerStopped || signal?.aborted) return new AnswerStopped();
  // The runtime's own words stay in the console for troubleshooting (never a key: there is none).
  console.warn('[teacher-local]', e instanceof Error ? e.message : String(e));
  const failure = localFailure(e);
  return new TeacherError(
    localFailureText(locale, failure, selection.kind),
    failure.section,
    failure.retry,
    { cause: e },
  );
}

/** A runtime whose fingerprint shows it cannot answer now: the sentence, and whether asking again may help. */
const PROBE_FAILURE: Record<ProbeStatus, { key: MessageKey; retry: boolean } | null> = {
  found: null,
  loading: { key: 'chat.errors.localLoading', retry: true },
  needsAuth: { key: 'chat.errors.localAuth', retry: false },
  notRuntime: { key: 'chat.errors.localNotRuntime', retry: false },
  unreachable: { key: 'chat.errors.localDown', retry: true },
};

/**
 * Asks the chosen runtime for its fingerprint (`local_ai_probe`: one loopback request, never a
 * generation) and throws the runtime's own sentence when it cannot answer. Used before anything
 * else leaves this computer for the question (the optional Wikipedia lookup), so a runtime that
 * is not running means the question was sent nowhere, as its sentence says.
 */
export async function reachRuntime(
  selection: LocalSelection,
  locale: Locale,
  signal?: AbortSignal,
): Promise<void> {
  stopIfAsked(signal);
  let status: ProbeStatus;
  try {
    status = (await untilStopped(getLocalClient().probe(selection.baseUrl), signal)).status;
  } catch (e) {
    throw localError(e, selection, locale, signal);
  }
  const failure = PROBE_FAILURE[status];
  if (failure === null) return;
  throw new TeacherError(
    localFailureText(locale, { ...failure, section: 'runtimes' }, selection.kind),
    'runtimes',
    failure.retry,
  );
}

/** The learner's sentence for an on-device failure (it never silently goes online instead). */
export function gemmaErrorKey(
  message: string,
):
  | 'chat.errors.gemmaStalled'
  | 'chat.errors.gemmaGpuBlocked'
  | 'chat.errors.gemmaGpu'
  | 'chat.errors.gemmaMissing'
  | 'chat.errors.gemmaFailed' {
  const m = message.toLowerCase();
  if (m.includes('gemma-stalled')) return 'chat.errors.gemmaStalled';
  if (m.includes('gpu-blocked')) return 'chat.errors.gemmaGpuBlocked';
  // A GPU fault turns Gemma off for the session (audit GPU-01): never invite a retry that the
  // block would refuse.
  if (isGpuFailure(m) || m.includes('memory'))
    return gemmaBlockedByGpuFault() ? 'chat.errors.gemmaGpuBlocked' : 'chat.errors.gemmaGpu';
  if (m.includes('model-missing') || m.includes('webgpu')) return 'chat.errors.gemmaMissing';
  return 'chat.errors.gemmaFailed';
}

/** PNG bytes as plain base64 (a local runtime's picture). */
export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
