import { describe, expect, it } from 'vitest';
import {
  aiErrorKind,
  httpErrorCode,
  httpStatus,
  isLocalMessage,
  isQuotaMessage,
  type AiErrorKind,
} from './errorKind';
import { isQuotaError } from './fallback';
import {
  BAD_IMAGE,
  FAILED,
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
import { AiError, toAiError, type AiErrorCode } from './types';

/** Message shapes of the Rust gateway (usage.rs, mod.rs, stream.rs, local/mod.rs) and the page. */
const TABLE: [AiErrorCode, string, AiErrorKind][] = [
  ['dailyLimit', '100/100', 'dailyLimit'],
  ['timeout', '30s', 'timeout'],
  ['timeout', 'first-delta: 30s', 'timeout'],
  ['cancelled', 'req-1', 'cancelled'],
  ['network', 'error sending request for url (https://api.anthropic.com/v1/messages)', 'network'],
  ['missingKey', 'gemini', 'missingKey'],
  ['notAllowed', 'ageGate', 'notAllowed'],
  ['keychain', 'no entry', 'keychain'],
  ['unavailable', 'desktop app only', 'unavailable'],
  ['unavailable', 'needs-app-update', 'needsAppUpdate'],
  ['unavailable', 'local-not-selected', 'localNotSelected'],
  ['invalidJson', '3', 'badResponse'],
  ['http', '429 Too Many Requests: {"error":{"status":"RESOURCE_EXHAUSTED"}}', 'quota'],
  ['http', '429: {"error":"PerDay"}', 'quota'],
  ['http', '402 Payment Required: {}', 'quota'],
  ['http', '400 Bad Request: {"error":{"message":"Your credit balance is too low"}}', 'quota'],
  ['http', '400: RESOURCE_EXHAUSTED', 'quota'],
  ['http', '429: rate_limit_error: slow down (quota: GenerateRequestsPerDay)', 'quota'],
  ['http', '401 Unauthorized: {}', 'badKey'],
  ['http', '403', 'badKey'],
  ['http', '400 Bad Request: API key not valid. Please pass a valid API key.', 'badKey'],
  [
    'http',
    '400 Bad Request: {"error":{"status":"INVALID_ARGUMENT","reason":"API_KEY_INVALID"}}',
    'badKey',
  ],
  ['http', '404 Not Found: models/gemini-x is not found', 'badModel'],
  ['http', '400 Bad Request: model `x` not found', 'badModel'],
  ['http', '413 Payload Too Large: Request too large for model', 'tooLarge'],
  ['http', '500 Internal Server Error', 'server'],
  ['http', '503 Service Unavailable: {}', 'server'],
  ['http', '529: overloaded_error: Overloaded', 'server'],
  ['http', '400 Bad Request: something else', 'other'],
  ['badResponse', 'empty answer (MAX_TOKENS)', 'emptyAnswer'],
  ['badResponse', 'empty answer (no text)', 'emptyAnswer'],
  ['badResponse', 'missing content', 'emptyAnswer'],
  ['badResponse', 'empty answer (SAFETY)', 'filtered'],
  ['badResponse', 'empty answer (refusal)', 'filtered'],
  ['badResponse', 'empty answer (content_filter)', 'filtered'],
  ['badResponse', 'reasoningOnly', 'reasoningOnly'],
  ['badResponse', 'answer over 1048576 bytes', 'answerTooLarge'],
  ['badResponse', 'event over 1048576 bytes', 'answerTooLarge'],
  ['badResponse', 'stream event: expected value', 'badResponse'],
  // Local runtimes: the tag decides, whatever the status after it.
  ['network', 'local-unreachable: error sending request', 'localUnreachable'],
  ['http', 'model-missing: 404: model "x" not found', 'localModelMissing'],
  ['http', 'model-missing: invalid name', 'localModelMissing'],
  ['http', 'loading: 503: Loading model', 'localLoading'],
  ['http', 'needs-auth: 401', 'localNeedsAuth'],
  ['timeout', 'local-stalled: gap 45000 ms', 'localStalled'],
  ['notAllowed', 'remote-model', 'localRemoteModel'],
  ['badResponse', 'not-runtime', 'localNotRuntime'],
  ['badResponse', 'not-runtime: ollama', 'localIsOllama'],
  ['notAllowed', 'not-loopback', 'notLoopback'],
  ['badResponse', 'too-large: answer over 524288 bytes', 'answerTooLarge'],
  ['http', 'local-failed: 429: busy', 'localFailed'],
  ['badResponse', 'local-failed: unreadable stream line', 'localFailed'],
  ['notAllowed', 'no-vision', 'localNoVision'],
  ['notAllowed', 'vision-unverified', 'localVisionUnverified'],
  ['notAllowed', 'bad-image: over 2 MB', 'localBadImage'],
];

/** Every tag a local runtime's message may start with (src/ai/local/types.ts). */
const LOCAL_TAGS = [
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
  NOT_SELECTED,
  NEEDS_APP_UPDATE,
  NO_VISION,
  VISION_UNVERIFIED,
  BAD_IMAGE,
];

describe('what went wrong with an AI call', () => {
  it.each(TABLE)('%s "%s" is %s', (code, message, kind) => {
    expect(aiErrorKind(new AiError(code, message))).toBe(kind);
    // Rust's errors arrive as plain objects.
    expect(aiErrorKind({ code, message })).toBe(kind);
  });

  it('reads a stop and an unknown failure', () => {
    expect(aiErrorKind(new DOMException('Aborted', 'AbortError'))).toBe('cancelled');
    expect(aiErrorKind(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('calls only a real network failure "network" (W2 fix round 2)', () => {
    // fetch's own TypeError, in each browser's words (WebView2/Chromium, Firefox, Safari, Node),
    // a body read that broke, and Rust's network error.
    for (const message of [
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Load failed',
      'fetch failed',
      'network error',
      'Error in body stream',
    ]) {
      expect(toAiError(new TypeError(message)).code, message).toBe('network');
    }
    expect(toAiError(new DOMException('offline', 'NetworkError')).code).toBe('network');
    expect(toAiError({ code: 'network', message: 'connection reset' }).code).toBe('network');
    // fetch stopped by an AbortSignal.timeout.
    expect(toAiError(new DOMException('signal timed out', 'TimeoutError')).code).toBe('timeout');
    // The desktop bridge (a plain string from `invoke`) or a programming error is the app's own.
    for (const raw of [
      'Command ai_chat not found',
      'invalid args `request` for command `ai_chat`: missing field `provider`',
      new Error('boom'),
      new TypeError("Cannot read properties of undefined (reading 'content')"),
      new SyntaxError('Unexpected token < in JSON'),
      // A programming error that merely mentions fetch or network.
      new TypeError("Cannot read properties of undefined (reading 'fetch')"),
      new TypeError('networkStatus is not a function'),
    ]) {
      expect(toAiError(raw).code, String(raw)).toBe('internal');
      // Its own kind: no provider (nor the quota fallback) is blamed for it.
      expect(aiErrorKind(raw), String(raw)).toBe('internal');
    }
    // The message is kept for the console and Settings, never shown to a learner as is.
    expect(toAiError('Command ai_chat not found').message).toBe('Command ai_chat not found');
  });

  it('agrees with the fallback rule on every cloud HTTP case', () => {
    for (const [code, message] of TABLE) {
      if (code !== 'http' || /^[a-z]/.test(message)) continue;
      const e = new AiError('http', message);
      expect(httpErrorCode(message) === 'quota', message).toBe(isQuotaError(e));
    }
  });

  it('never reads a local runtime error as a cloud quota, key or model problem', () => {
    for (const tag of LOCAL_TAGS) {
      // Statuses that would mean quota, key or model for a cloud provider.
      for (const rest of ['429: busy', '402: x', '400: credit balance too low', '401', '404: x']) {
        const message = `${tag}: ${rest}`;
        expect(isLocalMessage(message), message).toBe(true);
        expect(isQuotaError(new AiError('http', message)), message).toBe(false);
        expect(isQuotaMessage(message), message).toBe(false);
        expect(httpErrorCode(message), message).toBe('local');
        expect(['quota', 'badKey', 'badModel', 'server', 'other']).not.toContain(
          aiErrorKind(new AiError('http', message)),
        );
      }
      expect(isLocalMessage(tag)).toBe(true);
    }
    // Cloud messages are unchanged.
    expect(isLocalMessage('429 Too Many Requests: {}')).toBe(false);
    expect(isQuotaError(new AiError('http', '429 Too Many Requests: {}'))).toBe(true);
    expect(httpErrorCode('401 Unauthorized: {}')).toBe('badKey');
  });

  it('reads the status as the gateway does: the first number', () => {
    expect(httpStatus('429 Too Many Requests: x')).toBe(429);
    expect(httpStatus('529: overloaded_error: x')).toBe(529);
    expect(httpStatus('no number')).toBe(0);
    expect(httpStatus('99999999: x')).toBe(0);
  });
});
