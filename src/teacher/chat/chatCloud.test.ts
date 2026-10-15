import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '@/app/i18n';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import {
  AiError,
  type ChatRequest,
  type ChatResponse,
  type Provider,
  type StreamEvent,
} from '@/ai/types';
import { AnswerStopped, TeacherError, askTeacher } from './chatService';
import { useChatStore, type ChatMessageRecord } from './chatStore';
import { cloudFailure } from './cloudErrors';

/**
 * Online providers in AI Teacher, with a scripted transport (no real API): failures are explained
 * in the learner's words, the quota fallback is labelled and never used by Think, and an answer
 * streams through the same safety wrapper as on this computer.
 */
let calls: ChatRequest[];
let streamed: ChatRequest[];
let keys: Provider[];

/** A transport whose `chat` answers with `reply` (a rejection: throw it). */
function fake(
  reply: (req: ChatRequest) => Partial<ChatResponse> | Promise<Partial<ChatResponse>>,
  stream?: (
    req: ChatRequest,
    onText: (shown: string) => void,
  ) => Promise<Partial<ChatResponse>> | Partial<ChatResponse>,
): LlmTransport {
  return {
    chat: async (req) => {
      calls.push(req);
      return {
        content: 'Trả lời',
        model: `${req.provider}-model`,
        durationMs: 1,
        ...(await reply(req)),
      };
    },
    ...(stream
      ? {
          chatStream: async (req: ChatRequest, onText: (shown: string) => void) => {
            streamed.push(req);
            return {
              content: 'Trả lời',
              model: `${req.provider}-model`,
              durationMs: 1,
              ...(await stream(req, onText)),
            };
          },
        }
      : {}),
    models: () => Promise.resolve([]),
    setKey: () => Promise.resolve(),
    hasKey: (p) => Promise.resolve(keys.includes(p)),
    deleteKey: () => Promise.resolve(),
  };
}

const ask = (
  question: string,
  options: Partial<Parameters<typeof askTeacher>[3]> = {},
  records: ChatMessageRecord[] = [],
) => askTeacher(question, 'vi', records, { includeScreen: false, think: false, ...options });

/** What `askTeacher` rejected with. */
async function failure(promise: Promise<unknown>): Promise<TeacherError> {
  const e: unknown = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(e instanceof TeacherError)) throw new Error(`expected a TeacherError, got ${String(e)}`);
  return e;
}

beforeEach(() => {
  calls = [];
  streamed = [];
  keys = ['gemini', 'groq', 'claude'];
  useAiStore.setState({ provider: 'gemini', fallback: 'off', timeoutSecs: 30 });
  useChatStore.setState({
    engine: 'cloud',
    engineChosen: true,
    verifierProvider: 'groq',
    verifierModel: '',
    webLookup: false,
    summary: null,
    messages: [],
  });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  setTransportForTests(null);
  vi.restoreAllMocks();
});

/** Errors as the gateway (Rust or the browser transport) words them, and the learner's kind. */
const GATEWAY_ERRORS: [AiError | { code: string; message: string }, string][] = [
  [new AiError('dailyLimit', '100/100'), 'dailyLimit'],
  [new AiError('timeout', '30s'), 'timeout'],
  [new AiError('timeout', 'gap: 45s'), 'timeout'],
  [
    new AiError(
      'http',
      '429 Too Many Requests: {"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}',
    ),
    'quota',
  ],
  [new AiError('http', '402 Payment Required: {"error":{"type":"billing_error"}}'), 'quota'],
  [
    new AiError(
      'http',
      '400 Bad Request: {"type":"error","error":{"message":"Your credit balance is too low to access the Anthropic API."}}',
    ),
    'quota',
  ],
  [new AiError('http', '401 Unauthorized: {"error":"invalid x-api-key"}'), 'badKey'],
  [new AiError('http', '403 Forbidden: {"error":{"status":"PERMISSION_DENIED"}}'), 'badKey'],
  [new AiError('http', '400 Bad Request: {"error":{"status":"API_KEY_INVALID"}}'), 'badKey'],
  [new AiError('http', '404 Not Found: models/gemini-9 is not found'), 'badModel'],
  [new AiError('http', '413 Payload Too Large: {"error":"Request too large"}'), 'tooLarge'],
  [new AiError('http', '503 Service Unavailable: {"error":{"code":503}}'), 'server'],
  [new AiError('http', '529: overloaded_error: Overloaded'), 'server'],
  [new AiError('badResponse', 'empty answer (MAX_TOKENS)'), 'emptyAnswer'],
  [new AiError('badResponse', 'reasoningOnly'), 'reasoningOnly'],
  [
    new AiError(
      'network',
      'error sending request for url (https://generativelanguage.googleapis.com/v1beta/models/x)',
    ),
    'network',
  ],
  [new AiError('missingKey', 'gemini'), 'missingKey'],
  [new AiError('keychain', 'platform failure'), 'missingKey'],
  [new AiError('notAllowed', 'ageGate'), 'notAllowed'],
  [new AiError('http', "418 I'm a teapot: {}"), 'other'],
  [new AiError('badResponse', 'answer over 1048576 bytes'), 'other'],
  // Rust's AiError reaches the page as a plain object.
  [{ code: 'http', message: '500 Internal Server Error: {"error":{}}' }, 'server'],
];

describe('a failed online answer, in the learner’s words', () => {
  it.each(GATEWAY_ERRORS)('%o → chat.errors.cloud.%s', async (raw, kind) => {
    // Rust's errors are plain objects, as `invoke` rejects with them.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    setTransportForTests(fake(() => Promise.reject(raw)));
    const e = await failure(ask('Lực là gì?'));
    expect(e.message).toBe(
      translate('vi', `chat.errors.cloud.${kind}` as Parameters<typeof translate>[1], {
        who: 'Gemini',
        page: translate(
          'vi',
          e.section === 'memory'
            ? 'settings.nav.memory'
            : e.section === 'safety'
              ? 'safety.settings.title'
              : 'settings.ai',
        ),
      }),
    );
    // No machine text reaches the learner: no JSON, no status code, no key name, no raw detail.
    expect(e.message).not.toMatch(/[{}]/);
    expect(e.message).not.toMatch(/\b\d{3}\b/);
    expect(e.message).not.toMatch(/\b(?:gemini|claude|groq)\b|x-api-key|API_KEY|\d+\/\d+|\d+s\b/);
    expect(e.message).not.toContain('{who}');
    expect(e.message).not.toContain('{page}');
    // Each names the Settings page to open.
    expect(e.message).toMatch(/Cài đặt → /);
    expect(e.section).not.toBeNull();
    // The console gets who, the kind and the code only, never the provider's message.
    expect(vi.mocked(console.warn).mock.calls).toEqual([
      ['[teacher-cloud]', 'answer', 'gemini', kind, raw.code],
    ]);
    // The question was sent once: the page itself never sends it again.
    expect(calls).toHaveLength(1);
  });

  it('offers "Hỏi lại" only where asking again may help', () => {
    const retry = (raw: AiError) => cloudFailure(raw, 'answer').retry;
    expect(retry(new AiError('timeout', '30s'))).toBe(true);
    expect(retry(new AiError('http', '429 Too Many Requests'))).toBe(true);
    expect(retry(new AiError('http', '503 Service Unavailable'))).toBe(true);
    expect(retry(new AiError('network', 'down'))).toBe(true);
    expect(retry(new AiError('dailyLimit', '100/100'))).toBe(false);
    expect(retry(new AiError('http', '401 Unauthorized'))).toBe(false);
    expect(retry(new AiError('http', '404 Not Found'))).toBe(false);
    expect(retry(new AiError('missingKey', 'gemini'))).toBe(false);
  });

  it('a Rust error object keeps its code while the answer can be stopped (the chat panel)', async () => {
    setTransportForTests(
      fake(() =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        Promise.reject({ code: 'dailyLimit', message: '100/100' }),
      ),
    );
    const e = await failure(ask('Lực là gì?', { signal: new AbortController().signal }));
    expect(e.message).toMatch(/^Hôm nay đã dùng hết số lượt AI tối đa mỗi ngày/);
    expect(e.retry).toBe(false);
  });

  it('the provider’s own safety filter gives the filter sentence', async () => {
    setTransportForTests(
      fake(() => Promise.reject(new AiError('badResponse', 'empty answer (SAFETY)'))),
    );
    const e = await failure(ask('Lực là gì?'));
    expect(e.message).toBe(translate('vi', 'chat.errors.filtered'));
  });

  it('"Dừng" stays a stop, not an error', async () => {
    const ctl = new AbortController();
    setTransportForTests(
      fake(() => {
        ctl.abort();
        return Promise.reject(new AiError('cancelled', 'req'));
      }),
    );
    await expect(ask('Lực là gì?', { signal: ctl.signal })).rejects.toBeInstanceOf(AnswerStopped);
  });

  it('names both providers when the quota fallback may have answered and failed itself', async () => {
    useAiStore.setState({ fallback: 'groq' });
    setTransportForTests(fake(() => Promise.reject(new AiError('http', '401 Unauthorized: {}'))));
    let e = await failure(ask('Lực là gì?'));
    expect(e.message).toMatch(/^Gemini \(hoặc Groq dự phòng\) không nhận khóa API/);
    // Without a Groq key the fallback was never asked: only Gemini is named.
    keys = ['gemini'];
    e = await failure(ask('Lực là gì?'));
    expect(e.message).toMatch(/^Gemini không nhận khóa API/);
    // The daily cap is checked before anything is sent: never the fallback's.
    keys = ['gemini', 'groq'];
    setTransportForTests(fake(() => Promise.reject(new AiError('dailyLimit', '100/100'))));
    e = await failure(ask('Lực là gì?'));
    expect(e.message).not.toContain('Groq');
  });
});

describe('Think and the quota fallback', () => {
  beforeEach(() => {
    useAiStore.setState({ fallback: 'groq' });
  });

  it('the review is sent without the fallback; the reviewer is named in its failure', async () => {
    // The reviewer (Groq) is out of quota; Groq's fallback would be… Groq or Gemini (the drafter).
    useAiStore.setState({ fallback: 'gemini' });
    setTransportForTests(
      fake((req) =>
        req.provider === 'groq'
          ? Promise.reject(new AiError('http', '429 Too Many Requests: {"error":{}}'))
          : { content: 'Bản nháp của Gemini.' },
      ),
    );
    const e = await failure(ask('Lực là gì?', { think: true }));
    expect(e.message).toMatch(/^Bên rà soát \(Groq\) báo đã hết lượt dùng/);
    expect(e.message).toMatch(/Cài đặt → AI Teacher/);
    expect(e.section).toBe('teacher');
    expect(e.message).not.toMatch(/[{}]|\b429\b/);
    // Draft by Gemini, one review request to Groq; nothing else (no self-review by Gemini).
    expect(calls.map((c) => [c.provider, c.noFallback])).toEqual([
      ['gemini', true],
      ['groq', true],
    ]);
  });

  it('with Think the summary of older turns is not sent to the fallback either', async () => {
    const history: ChatMessageRecord[] = Array.from({ length: 60 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Lượt ${i}: `.padEnd(1200, 'a'),
    }));
    setTransportForTests(fake(() => ({ content: 'Câu trả lời' })));
    await ask('tiếp nhé', { think: true }, history);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.noFallback === true)).toBe(true);
  });

  it('checkedBy names the provider that really reviewed', async () => {
    setTransportForTests(
      fake((req) => ({
        content: req.provider === 'groq' ? 'Đã rà soát.' : 'Nháp.',
        provider: req.provider,
        model: `${req.provider}-v2`,
      })),
    );
    const reply = await ask('Lực là gì?', { think: true });
    expect(reply.metadata.checkedBy).toBe('groq · groq-v2');
    expect(reply.metadata.fallback).toBeUndefined();
  });

  it('a fallback answer is reported with the provider that wrote it', async () => {
    setTransportForTests(
      fake(() => ({ content: 'Lực là vectơ.', provider: 'groq', fallback: true, model: 'qwen-t' })),
    );
    const reply = await ask('Lực là gì?');
    expect(reply.metadata).toMatchObject({
      model: 'Groq · qwen-t',
      provider: 'groq',
      fallback: true,
    });
    // Without Think the fallback stays available to the gateway.
    expect(calls[0]?.noFallback).toBeUndefined();
  });

  it('an ordinary answer is not marked as a fallback', async () => {
    setTransportForTests(fake(() => ({ content: 'Lực là vectơ.', provider: 'gemini' })));
    const reply = await ask('Lực là gì?');
    expect(reply.metadata.model).toBe('gemini-model');
    expect(reply.metadata.fallback).toBeUndefined();
    expect(reply.metadata.provider).toBe('gemini');
  });
});

describe('a streamed online answer', () => {
  it('shows provisional text through the safety wrapper; the final content is checked whole', async () => {
    setTransportForTests(
      fake(
        () => ({}),
        (_req, onText) => {
          // As ShownText delivers it: the whole text so far after every event (a reset replaces).
          const events: StreamEvent[] = [
            { kind: 'delta', text: 'Người dùng hỏi' },
            { kind: 'reset', text: 'Lực là' },
            { kind: 'delta', text: ' đại lượng <think>nháp 7 kg' },
          ];
          let shown = '';
          for (const ev of events) {
            shown = ev.kind === 'delta' ? shown + ev.text : ev.text;
            onText(shown);
          }
          onText('Lực là đại lượng vectơ.');
          return { content: 'Lực là đại lượng vectơ.' };
        },
      ),
    );
    const seen: string[] = [];
    const reply = await ask('Lực là gì?', { onPartial: (t) => seen.push(t) });
    expect(streamed).toHaveLength(1);
    expect(calls).toHaveLength(0);
    // The reset took the early text back; reasoning being written is never shown.
    expect(seen).toEqual([
      'Người dùng hỏi',
      'Lực là',
      'Lực là đại lượng',
      'Lực là đại lượng vectơ.',
    ]);
    expect(reply.content).toBe('Lực là đại lượng vectơ.');
  });

  it('takes the text back at the first unsafe piece and blocks the answer', async () => {
    setTransportForTests(
      fake(
        () => ({}),
        (_req, onText) => {
          onText('Bài này ');
          onText('Bài này gọi số 0912345678 ');
          onText('Bài này gọi số 0912345678 để nhận lời giải');
          return { content: 'Bài này gọi số 0912345678 để nhận lời giải' };
        },
      ),
    );
    const seen: string[] = [];
    await expect(ask('Giải giúp em', { onPartial: (t) => seen.push(t) })).rejects.toThrow(
      translate('vi', 'chat.errors.filtered'),
    );
    expect(seen).toEqual(['Bài này ', '']);
  });

  it('a failure in the middle is explained, with "Hỏi lại"; nothing is sent again', async () => {
    setTransportForTests(
      fake(
        () => ({}),
        (_req, onText) => {
          onText('Lực là đại');
          throw new AiError('timeout', 'gap: 45s');
        },
      ),
    );
    const seen: string[] = [];
    const e = await failure(ask('Lực là gì?', { onPartial: (t) => seen.push(t) }));
    expect(seen).toEqual(['Lực là đại']);
    expect(e.message).toMatch(/^Gemini trả lời quá lâu/);
    expect(e.retry).toBe(true);
    expect(streamed).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });

  it('never streams Think (draft and review), a summary, or a call without onPartial', async () => {
    setTransportForTests(
      fake(
        (req) => ({ content: req.provider === 'groq' ? 'Đã rà soát.' : 'Nháp.' }),
        () => ({ content: 'streamed' }),
      ),
    );
    await ask('Lực là gì?', { think: true, onPartial: () => undefined });
    await ask('Lực là gì?');
    expect(streamed).toHaveLength(0);
    expect(calls.map((c) => c.provider)).toEqual(['gemini', 'groq', 'gemini']);
  });
});
