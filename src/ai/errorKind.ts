/**
 * What went wrong with an AI call, in a few kinds the learner-facing screens can explain in simple
 * words (the messages themselves are machine text: "100/100", "30s", "429 Too Many Requests: {…}",
 * "loading: 503"). One place for the rules, so "Phân tích đề", AI Teacher and Settings agree:
 *
 * - HTTP errors follow the quota rule of the fallback (`is_quota_error` in src-tauri/src/ai/mod.rs):
 *   402, 429, 400 with "credit balance", RESOURCE_EXHAUSTED → quota. Then 401/403 or an invalid
 *   key → badKey; 404 or an unknown model → badModel; 413 → tooLarge; 5xx (529 included) or
 *   "overloaded" → server.
 * - Local runtimes tag their messages (src-tauri/src/ai/local/mod.rs); the tag decides first. A
 *   local runtime's message is never read as a cloud quota or key problem, whatever status it
 *   carries ("local-failed: 429: busy", "needs-auth: 401"): those rules are for cloud providers.
 */
import {
  BAD_IMAGE,
  FAILED,
  IS_OLLAMA,
  LOADING,
  MODEL_MISSING,
  NEEDS_APP_UPDATE,
  NEEDS_AUTH,
  NOT_LOOPBACK,
  NOT_RUNTIME,
  NOT_SELECTED,
  NO_VISION,
  REMOTE_MODEL,
  STALLED,
  TOO_LARGE,
  UNREACHABLE,
  VISION_UNVERIFIED,
} from './local/types';
import { toAiError } from './types';

/**
 * Every tag a local runtime's error message starts with, plus the page's own local messages
 * (src/ai/local/types.ts).
 */
const LOCAL_TAGS: ReadonlySet<string> = new Set([
  UNREACHABLE,
  MODEL_MISSING,
  LOADING,
  NEEDS_AUTH,
  STALLED,
  REMOTE_MODEL,
  NOT_RUNTIME,
  NOT_LOOPBACK,
  TOO_LARGE,
  FAILED,
  NO_VISION,
  VISION_UNVERIFIED,
  BAD_IMAGE,
  NEEDS_APP_UPDATE,
  NOT_SELECTED,
]);

/** The message comes from a local runtime (it starts with one of their tags). */
export function isLocalMessage(message: string): boolean {
  return LOCAL_TAGS.has(tagOf(message));
}

/**
 * The HTTP status of an error message: its first number ("429 Too Many Requests: …",
 * "529: overloaded_error: …", the browser's "429: …"), or 0. Same as `http_status` in Rust.
 */
export function httpStatus(message: string): number {
  const digits = /\d+/.exec(message)?.[0];
  if (digits === undefined) return 0;
  const n = Number(digits);
  return n <= 65535 ? n : 0;
}

/**
 * Out of quota or credit (the rule of `is_quota_error` in Rust and of `isQuotaError`). Never for a
 * local runtime's message: a busy runtime on this computer is not a provider's quota, and must not
 * switch to a cloud fallback.
 */
export function isQuotaMessage(message: string): boolean {
  if (isLocalMessage(message)) return false;
  const status = httpStatus(message);
  const lower = message.toLowerCase();
  return (
    status === 402 ||
    status === 429 ||
    (status === 400 && lower.includes('credit balance')) ||
    lower.includes('resource_exhausted')
  );
}

export type HttpErrorKind =
  | 'quota'
  | 'badKey'
  | 'badModel'
  | 'tooLarge'
  | 'server'
  | 'http'
  /** A local runtime's error: not a cloud provider's quota, key or model (see `aiErrorKind`). */
  | 'local';

/**
 * An HTTP error from a cloud provider, by its status and body; `local` for a local runtime's
 * message, whatever status it carries.
 */
export function httpErrorCode(message: string): HttpErrorKind {
  if (isLocalMessage(message)) return 'local';
  if (isQuotaMessage(message)) return 'quota';
  const status = httpStatus(message);
  const lower = message.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return 'badKey';
  }
  if (
    status === 404 ||
    (status === 400 &&
      lower.includes('model') &&
      (lower.includes('not found') || lower.includes('not_found')))
  ) {
    return 'badModel';
  }
  if (status === 413) return 'tooLarge';
  if ((status >= 500 && status <= 599) || lower.includes('overloaded')) return 'server';
  return 'http';
}

export type AiErrorKind =
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'quota'
  | 'badKey'
  | 'badModel'
  | 'dailyLimit'
  | 'missingKey'
  | 'keychain'
  /** The safety gate is closed (18+ confirmation). */
  | 'notAllowed'
  | 'unavailable'
  /** The desktop app is older than the page (a command is missing): reinstall the app. */
  | 'needsAppUpdate'
  /** The provider answered nothing (or only an empty text). */
  | 'emptyAnswer'
  /** The provider's own filter stopped the answer (Gemini SAFETY, Claude refusal, …). */
  | 'filtered'
  /** The answer was only the model's reasoning. */
  | 'reasoningOnly'
  /** The question (with its context) was too large for the provider (HTTP 413). */
  | 'tooLarge'
  /** The answer was over the size cap. */
  | 'answerTooLarge'
  /** The provider's server failed or is overloaded (5xx, 529). */
  | 'server'
  | 'badResponse'
  // Local runtimes (Ollama, LM Studio, llama.cpp, OpenAI-compatible).
  | 'localUnreachable'
  | 'localModelMissing'
  | 'localLoading'
  | 'localNeedsAuth'
  | 'localStalled'
  | 'localRemoteModel'
  | 'localNotRuntime'
  /** The address is Ollama but was chosen as another kind: choose Ollama. */
  | 'localIsOllama'
  /** A local runtime is the chosen engine, but no runtime and model are picked yet. */
  | 'localNotSelected'
  | 'notLoopback'
  | 'localFailed'
  /** A picture was sent to a model that cannot read pictures (or without asking for it). */
  | 'localNoVision'
  /** The runtime does not say whether the model reads pictures, so none is sent. */
  | 'localVisionUnverified'
  /** The picture is not a PNG or JPEG, is too large, or there is more than one. */
  | 'localBadImage'
  /** The app itself failed (the desktop bridge, or a programming error): no provider's fault. */
  | 'internal'
  | 'other';

/** Finish or block reasons that mean the provider's own filter stopped the answer. */
const FILTERED = new Set([
  'SAFETY',
  'RECITATION',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
  'refusal',
  'content_filter',
]);

/** The tag at the start of a message ("loading: 503" → "loading"), as `tag_of` in Rust. */
function tagOf(message: string): string {
  return (message.split(':', 1)[0] ?? '').trim();
}

function badResponseKind(message: string): AiErrorKind {
  if (message === 'reasoningOnly') return 'reasoningOnly';
  const empty = /^empty answer \((.*)\)$/s.exec(message);
  if (empty) return FILTERED.has(empty[1] ?? '') ? 'filtered' : 'emptyAnswer';
  if (message === 'missing content') return 'emptyAnswer';
  if (/^(answer|event) over \d+ bytes/.test(message)) return 'answerTooLarge';
  return 'badResponse';
}

/** The kind of a local runtime's tagged error, or null when the message has no local tag. */
function localKind(message: string): AiErrorKind | null {
  switch (tagOf(message)) {
    case UNREACHABLE:
      return 'localUnreachable';
    case MODEL_MISSING:
      return 'localModelMissing';
    case LOADING:
      return 'localLoading';
    case NEEDS_AUTH:
      return 'localNeedsAuth';
    case STALLED:
      return 'localStalled';
    case REMOTE_MODEL:
      return 'localRemoteModel';
    case NOT_RUNTIME:
      return message.trim() === `${NOT_RUNTIME}: ${IS_OLLAMA}`
        ? 'localIsOllama'
        : 'localNotRuntime';
    case NOT_LOOPBACK:
      return 'notLoopback';
    case TOO_LARGE:
      return 'answerTooLarge';
    case FAILED:
      return 'localFailed';
    case NO_VISION:
      return 'localNoVision';
    case VISION_UNVERIFIED:
      return 'localVisionUnverified';
    case BAD_IMAGE:
      return 'localBadImage';
    case NEEDS_APP_UPDATE:
      return 'needsAppUpdate';
    case NOT_SELECTED:
      return 'localNotSelected';
    default:
      return null;
  }
}

/** The kind of whatever an AI call threw (AiError, Rust's `{code, message}`, an AbortError…). */
export function aiErrorKind(e: unknown): AiErrorKind {
  const err = toAiError(e);
  const { message } = err;
  if (err.code === 'cancelled') return 'cancelled';
  const local = localKind(message);
  if (local) return local;
  switch (err.code) {
    case 'timeout':
      return 'timeout';
    case 'network':
      return 'network';
    case 'dailyLimit':
      return 'dailyLimit';
    case 'missingKey':
      return 'missingKey';
    case 'keychain':
      return 'keychain';
    case 'notAllowed':
      return 'notAllowed';
    case 'unavailable':
      return 'unavailable';
    case 'internal':
      return 'internal';
    case 'invalidJson':
      return 'badResponse';
    case 'badResponse':
      return badResponseKind(message);
    case 'http': {
      const kind = httpErrorCode(message);
      // `local` cannot come here: every local tag was read above.
      return kind === 'http' || kind === 'local' ? 'other' : kind;
    }
    default:
      // A code this page does not know (a newer desktop app).
      return 'other';
  }
}
