/**
 * Local runtimes without the desktop app: browser development and the end-to-end tests. The
 * web-side twin of src-tauri/src/ai/local/mod.rs, with the same rules:
 *
 * - only loopback addresses (`parseLoopback`, checked on every call) and only the three usual
 *   ones for detection; a request never follows a redirect and sends no cookie or referrer;
 * - the safety gate must be open (the page's copy of it: in the desktop app Rust checks);
 * - a prompt only goes to a server that identified itself as the chosen runtime, never to an
 *   Ollama "cloud" model, and an address that answers as Ollama is only used as Ollama;
 * - no key, no daily cap, no retry and never a fallback to the cloud;
 * - stall timers: first piece 120 s, then 45 s between pieces, at most 600 s; sizes capped;
 * - reasoning is removed while it streams (`ThinkFilter`); streamed text is provisional and the
 *   returned content is final;
 * - a picture goes only to a model whose runtime says it reads pictures, and only when the
 *   caller asked for it (src/ai/local/vision.ts).
 *
 * It works only when the runtime allows the page's origin (CORS): Ollama allows localhost pages
 * by default, LM Studio and llama.cpp need it switched on. A refused request looks like "nothing
 * answers". Never used in the desktop app (the factory picks `TauriLocalClient`, and the
 * production CSP blocks loopback hosts anyway).
 */
import { isTauri } from '@tauri-apps/api/core';
import { getSafety } from '@/safety/safety';
import { concatBytes, decodeUtf8, readChunk, utf8Length } from '../sse';
import { ThinkFilter } from '../thinkFilter';
import { AiError, ShownText, toAiError, type StreamEvent } from '../types';
import { DEFAULTS, loopbackUrl, loopbackV4, parseLoopback, type Loopback } from './endpoint';
import {
  adapter,
  cleanId,
  detail,
  detailsFromListing,
  field,
  isCloudName,
  parseJson,
  statusError,
  streamError,
  errorMessage,
  type ChatOptions,
  type HttpRequest,
  type LocalRuntimeAdapter,
} from './runtimes';
import { Lines, MAX_ANSWER_BYTES, MAX_LINE_BYTES, MAX_MODELS, rustTrim, sseLine } from './stream';
import { allowVision, checkRequest } from './vision';
import {
  FAILED,
  IS_OLLAMA,
  LOADING,
  MODEL_MISSING,
  NEEDS_AUTH,
  NOT_LOOPBACK,
  NOT_RUNTIME,
  PROBE_ORDER,
  REMOTE_MODEL,
  STALLED,
  TOO_LARGE,
  UNREACHABLE,
  type LocalChatOptions,
  type LocalChatRequest,
  type LocalChatResponse,
  type LocalModels,
  type LocalRuntimeClient,
  type LocalTest,
  type LocalTestStatus,
  type ModelDetails,
  type RuntimeKind,
  type RuntimeProbe,
} from './types';

/** Time and size limits (as `Limits` in Rust; tests inject small ones). */
export interface LocalLimits {
  /** Wait for the first piece of an answer (connecting, loading the model, reading the prompt). */
  firstPieceMs: number;
  /** Longest silence between two pieces. */
  gapMs: number;
  /** Longest answer in all; by default the request's `timeoutSecs` (5–600 s, default 600). */
  overallMs?: number;
  /** Identification, model check and lists before a question. */
  precheckMs: number;
  /** One identification step during detection. */
  probeStepMs: number;
  maxAnswerBytes: number;
  maxLineBytes: number;
}

export const LOCAL_LIMITS: LocalLimits = {
  firstPieceMs: 120_000,
  gapMs: 45_000,
  precheckMs: 10_000,
  probeStepMs: 1_500,
  maxAnswerBytes: MAX_ANSWER_BYTES,
  maxLineBytes: MAX_LINE_BYTES,
};

/** Longest answer, in all (seconds). */
const OVERALL_MAX_SECS = 600;
/** "Kiểm tra trả lời" may wait this much longer than the first piece (the model may load). */
const TEST_EXTRA_MS = 30_000;

const PROBE_BODY_CAP = 256 * 1024;
const LIST_BODY_CAP = 4 * 1024 * 1024;
/** `/api/show` also returns the model's licence and template. */
const INFO_BODY_CAP = 2 * 1024 * 1024;
const ERROR_BODY_CAP = 64 * 1024;

const DEFAULT_MAX_TOKENS = 2048;
const MAX_TOKENS_CAP = 16_384;
/** Context window asked from Ollama when the page gives none (Ollama's own default is smaller). */
const DEFAULT_CONTEXT = 8192;
const MIN_CONTEXT = 2048;
const MAX_CONTEXT = 262_144;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The page's copy of the safety gate (Rust's `require_ai_allowed` in the desktop app). */
async function requireAiAllowed(): Promise<void> {
  const allowed = await getSafety()
    .status()
    .then((s) => s.aiAllowed)
    .catch(() => false);
  if (!allowed) throw new AiError('notAllowed', 'ageGate');
}

function refuseInDesktop(): void {
  // The desktop app talks to runtimes through Rust only.
  if (isTauri()) throw new AiError('unavailable', 'desktop app uses Rust');
}

function aborted(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/** Settles with `p`, or rejects with an AbortError as soon as `signal` aborts. */
function untilAborted<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(aborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * One request: aborted (which closes the connection) by the caller's stop, by its deadline, and
 * when it ends. `deadline` is a `performance.now()` time.
 */
class Attempt {
  readonly ctl = new AbortController();
  readonly deadline: number;
  timedOut = false;
  private timer: ReturnType<typeof setTimeout> | null;
  private readonly onOuter = () => {
    this.ctl.abort();
  };

  constructor(
    limitMs: number,
    private readonly outer?: AbortSignal,
  ) {
    this.deadline = performance.now() + limitMs;
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.ctl.abort();
    }, limitMs);
    outer?.addEventListener('abort', this.onOuter, { once: true });
    if (outer?.aborted) this.ctl.abort();
  }

  get stopped(): boolean {
    return this.outer?.aborted === true;
  }

  /** The deadline no longer applies (the reading has timers of its own); a stop still does. */
  disarm(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  end(): void {
    this.disarm();
    this.outer?.removeEventListener('abort', this.onOuter);
    this.ctl.abort();
  }
}

function netError(e: unknown): AiError {
  return new AiError('network', `${UNREACHABLE}: ${e instanceof Error ? e.message : String(e)}`);
}

/** The request as `fetch` options: no redirect followed, no cookie, no referrer, no cache. */
function requestInit(r: HttpRequest, signal: AbortSignal): RequestInit {
  return {
    method: r.method,
    ...(r.body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.body) }
      : {}),
    redirect: 'manual',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    signal,
  };
}

/** The HTTP status; a redirect the browser hid ("opaqueredirect") counts as one (3xx). */
function statusOf(resp: Response): number {
  return resp.type === 'opaqueredirect' ? 300 : resp.status;
}

function jsonOf(body: string): unknown {
  const v = parseJson(body);
  if (v === undefined) throw new AiError('badResponse', NOT_RUNTIME);
  return v;
}

/**
 * The API asked for is missing: a 404, or an error object where a list was expected (servers
 * answer an unknown path in different ways).
 */
function apiMissing(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 200) return false;
  const v = parseJson(body);
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.hasOwn(v, 'error') && !Object.hasOwn(v, 'data');
}

function stalled(phase: string, ms: number): AiError {
  return new AiError('timeout', `${STALLED}: ${phase} ${ms} ms`);
}

/** The tag at the start of an error message (`tag_of` in Rust). */
function tagOf(e: AiError): string {
  return (e.message.split(':', 1)[0] ?? '').trim();
}

/** Rust's `Display` of an AiError (the `detail` of a failed test). */
function display(e: AiError): string {
  switch (e.code) {
    case 'timeout':
      return 'request timed out';
    case 'cancelled':
      return 'request cancelled';
    case 'http':
      return `HTTP error: ${e.message}`;
    case 'network':
      return `network error: ${e.message}`;
    case 'missingKey':
      return 'missing API key';
    case 'badResponse':
    case 'invalidJson':
      return `unexpected response: ${e.message}`;
    case 'keychain':
      return `keychain error: ${e.message}`;
    case 'dailyLimit':
      return `daily limit reached: ${e.message}`;
    case 'notAllowed':
      return `not allowed: ${e.message}`;
    case 'unavailable':
      return `unavailable: ${e.message}`;
  }
}

function testStatus(e: AiError): LocalTestStatus {
  switch (tagOf(e)) {
    case UNREACHABLE:
      return 'unreachable';
    case NOT_RUNTIME:
      return 'notRuntime';
    case NEEDS_AUTH:
      return 'needsAuth';
    case MODEL_MISSING:
      return 'modelMissing';
    case LOADING:
      return 'loading';
    case REMOTE_MODEL:
      return 'remoteModel';
    case STALLED:
      return 'stalled';
    case NOT_LOOPBACK:
    case 'ageGate':
      return 'notAllowed';
    default:
      return 'error';
  }
}

function testFailed(e: AiError): LocalTest {
  const status = testStatus(e);
  return {
    status,
    firstPieceMs: null,
    streamed: false,
    detail:
      status === 'error'
        ? detail(display(e))
        : e.code === 'badResponse' && e.message === `${NOT_RUNTIME}: ${IS_OLLAMA}`
          ? IS_OLLAMA
          : '',
  };
}

/** A streamed answer before the empty-answer rule. */
interface Streamed {
  text: string;
  removed: boolean;
  model: string | null;
  firstPieceMs: number | null;
  truncated: boolean;
  pieces: number;
  durationMs: number;
}

/** The answer as it streams in. */
class Answer {
  private readonly filter = new ThinkFilter();
  private bytes = 0;
  pieces = 0;
  firstPieceMs: number | null = null;
  model: string | null = null;
  /** Set once the end mark arrived (`true`: stopped at the output limit). */
  private done: boolean | null = null;

  /** The end mark arrived. */
  ended(): boolean {
    return this.done !== null;
  }

  constructor(
    private readonly rt: LocalRuntimeAdapter,
    private readonly started: number,
    private readonly maxBytes: number,
    private readonly emit: (e: StreamEvent) => void,
  ) {}

  line(line: string): void {
    let data: string;
    if (this.rt.streamFormat === 'ndjson') {
      if (rustTrim(line) === '') return;
      data = line;
    } else {
      const s = sseLine(line);
      if (s.kind === 'ignore') return;
      if (s.kind === 'done') {
        this.done ??= false;
        return;
      }
      if (s.kind === 'error') {
        const v = parseJson(s.data);
        const message = field(v, 'message');
        throw streamError(
          errorMessage(v) ?? (typeof message === 'string' ? message : null) ?? s.data,
        );
      }
      data = s.data;
    }
    const piece = this.rt.parseEvent(data);
    this.model ??= piece.model === null ? null : cleanId(piece.model);
    if (piece.text !== null && piece.text !== '') {
      this.bytes += utf8Length(piece.text);
      if (this.bytes > this.maxBytes) {
        throw new AiError('badResponse', `${TOO_LARGE}: answer over ${this.maxBytes} bytes`);
      }
      this.pieces++;
      this.firstPieceMs ??= Math.round(performance.now() - this.started);
      const change = this.filter.push(piece.text);
      if (change) this.emit(change);
    }
    if (piece.done !== null) this.done = piece.done;
  }

  finish(): Streamed {
    const fin = this.filter.finish();
    if (fin.change) this.emit(fin.change);
    return {
      text: fin.text,
      removed: fin.removed,
      model: this.model,
      firstPieceMs: this.firstPieceMs,
      // No end mark: the answer may be incomplete.
      truncated: this.done ?? true,
      pieces: this.pieces,
      durationMs: Math.round(performance.now() - this.started),
    };
  }
}

export class FetchLocalClient implements LocalRuntimeClient {
  private readonly limits: LocalLimits;

  constructor(limits: Partial<LocalLimits> = {}) {
    this.limits = { ...LOCAL_LIMITS, ...limits };
  }

  /** Sends a small request and reads its whole (capped) answer. */
  private async fetchText(
    base: Loopback,
    r: HttpRequest,
    limitMs: number,
    cap: number,
    signal?: AbortSignal,
  ): Promise<{ status: number; body: string }> {
    const a = new Attempt(limitMs, signal);
    const late = () => new AiError('timeout', `${STALLED}: no answer in ${limitMs} ms`);
    try {
      const resp = await untilAborted(
        fetch(loopbackUrl(base, r.path), requestInit(r, a.ctl.signal)),
        a.ctl.signal,
      );
      const status = statusOf(resp);
      let bytes: Uint8Array = new Uint8Array(0);
      if (resp.body) {
        const reader = resp.body.getReader();
        try {
          for (;;) {
            const chunk = await readChunk(reader, a.deadline, a.ctl.signal);
            if (chunk === 'timeout') throw late();
            if (chunk.done) break;
            if (bytes.length + chunk.value.length > cap) {
              throw new AiError('badResponse', `${TOO_LARGE}: answer over ${cap} bytes`);
            }
            bytes = concatBytes(bytes, chunk.value);
          }
        } finally {
          reader.cancel().catch(() => undefined);
        }
      }
      return { status, body: decodeUtf8(bytes) };
    } catch (e) {
      if (a.stopped) throw aborted();
      if (a.timedOut) throw late();
      if (e instanceof AiError) throw e;
      throw netError(e);
    } finally {
      a.end();
    }
  }

  /** Asks the address which runtime it is: Ollama, LM Studio, llama.cpp, then any OpenAI-compatible server. */
  private async probeAt(base: Loopback): Promise<RuntimeProbe> {
    const result: RuntimeProbe = {
      expected: null,
      kind: null,
      baseUrl: base.base,
      status: 'notRuntime',
      version: null,
    };
    for (const [step, kind] of PROBE_ORDER.entries()) {
      const rt = adapter(kind);
      let got: { status: number; body: string };
      try {
        got = await this.fetchText(base, rt.fingerprint, this.limits.probeStepMs, PROBE_BODY_CAP);
      } catch (e) {
        // Nothing listens there (or the browser refused): no need to ask the other ways.
        if (step === 0 && e instanceof AiError && e.code === 'network') {
          result.status = 'unreachable';
          return result;
        }
        // Too slow, too large or a broken connection: not this runtime.
        continue;
      }
      const print = rt.parseFingerprint(got.status, got.body);
      if (print.kind === 'match') {
        result.kind = kind;
        result.version = print.version;
        result.status = print.loading ? 'loading' : 'found';
        return result;
      }
      if (print.kind === 'needsAuth') result.status = 'needsAuth';
    }
    return result;
  }

  /**
   * An address chosen as another kind must not be Ollama (through its `/v1` API a cloud model
   * copied under another name looks local, and `num_ctx` cannot be sent). An error while asking
   * is returned too: nothing is sent unless the address is known not to be Ollama.
   */
  private async refuseOllamaAsOther(
    rt: LocalRuntimeAdapter,
    base: Loopback,
    limitMs: number,
    signal?: AbortSignal,
  ): Promise<void> {
    if (rt.kind === 'ollama') return;
    const ollama = adapter('ollama');
    const got = await this.fetchText(base, ollama.fingerprint, limitMs, PROBE_BODY_CAP, signal);
    if (ollama.parseFingerprint(got.status, got.body).kind === 'match') {
      throw new AiError('badResponse', `${NOT_RUNTIME}: ${IS_OLLAMA}`);
    }
  }

  /** The model list, from the runtime's own API or its fallback (LM Studio without `/api/v0`). */
  private async fetchModels(
    rt: LocalRuntimeAdapter,
    base: Loopback,
    limitMs: number,
  ): Promise<LocalModels> {
    let got = await this.fetchText(base, rt.models, limitMs, LIST_BODY_CAP);
    let parser = rt;
    if (apiMissing(got.status, got.body) && rt.modelsFallback) {
      parser = adapter(rt.modelsFallback);
      got = await this.fetchText(base, parser.models, limitMs, LIST_BODY_CAP);
    }
    if (got.status === 404) throw new AiError('badResponse', NOT_RUNTIME);
    if (got.status < 200 || got.status >= 300) throw statusError(got.status, got.body);
    const models = parser.parseModels(jsonOf(got.body));
    return { models: models.slice(0, MAX_MODELS), more: models.length > MAX_MODELS };
  }

  /** What the runtime says about one model: its own details request, else its model list. */
  private async detailsOf(
    rt: LocalRuntimeAdapter,
    base: Loopback,
    id: string,
    limitMs: number,
    signal?: AbortSignal,
  ): Promise<ModelDetails> {
    if (rt.info) {
      const got = await this.fetchText(base, rt.info(id), limitMs, INFO_BODY_CAP, signal);
      if (got.status < 200 || got.status >= 300) throw statusError(got.status, got.body);
      return rt.parseInfo(jsonOf(got.body), id);
    }
    const listed = (await this.fetchModels(rt, base, limitMs)).models.find((m) => m.id === id);
    if (!listed) throw new AiError('http', `${MODEL_MISSING}: not listed`);
    return detailsFromListing(listed, rt.declared);
  }

  /**
   * The chosen address must not be Ollama chosen as another kind, and must answer as the chosen
   * runtime, before it gets a prompt. The Ollama check comes first, as for lists and details: an
   * Ollama address chosen as another kind is named as such (`not-runtime: ollama`) whatever that
   * kind's own fingerprint says.
   */
  private async identify(
    rt: LocalRuntimeAdapter,
    base: Loopback,
    limitMs: number,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.refuseOllamaAsOther(rt, base, limitMs, signal);
    const got = await this.fetchText(base, rt.fingerprint, limitMs, PROBE_BODY_CAP, signal);
    let status = got.status;
    let print = rt.parseFingerprint(got.status, got.body);
    if (print.kind === 'notThis' && apiMissing(got.status, got.body) && rt.modelsFallback) {
      const fallback = adapter(rt.modelsFallback);
      const fb = await this.fetchText(base, fallback.fingerprint, limitMs, PROBE_BODY_CAP, signal);
      status = fb.status;
      print = fallback.parseFingerprint(fb.status, fb.body);
    }
    if (print.kind === 'needsAuth') throw new AiError('http', `${NEEDS_AUTH}: ${status}`);
    if (print.kind === 'notThis') throw new AiError('badResponse', NOT_RUNTIME);
    if (print.loading) throw new AiError('http', `${LOADING}: ${status}`);
  }

  /**
   * Generation settings; for Ollama also checks that the model exists and runs on this computer
   * (a cloud model may have been copied under a name without "cloud"), and returns what Ollama
   * said about the model.
   */
  private async prepare(
    rt: LocalRuntimeAdapter,
    base: Loopback,
    req: LocalChatRequest,
    model: string,
    signal?: AbortSignal,
  ): Promise<{ opts: ChatOptions; details: ModelDetails | null }> {
    const asked =
      req.contextLength !== undefined
        ? clamp(Math.round(req.contextLength), MIN_CONTEXT, MAX_CONTEXT)
        : null;
    const opts: ChatOptions = {
      maxTokens: clamp(Math.round(req.maxTokens ?? DEFAULT_MAX_TOKENS), 1, MAX_TOKENS_CAP),
      contextLength: asked ?? DEFAULT_CONTEXT,
      think: null,
    };
    if (rt.kind !== 'ollama') return { opts, details: null };
    const d = await this.detailsOf(rt, base, model, this.limits.precheckMs, signal);
    if (d.remote) throw new AiError('notAllowed', REMOTE_MODEL);
    const own = d.contextLength;
    opts.contextLength =
      asked !== null && own !== null
        ? Math.min(asked, own)
        : (asked ?? (own !== null ? Math.min(own, DEFAULT_CONTEXT) : DEFAULT_CONTEXT));
    opts.think = req.think !== undefined && d.thinking === 'yes' ? req.think : null;
    return { opts, details: d };
  }

  /** Identifies the runtime, checks the model, sends the question and streams the answer. */
  private async streamAnswer(
    rt: LocalRuntimeAdapter,
    base: Loopback,
    req: LocalChatRequest,
    overallMs: number,
    emit: (e: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<Streamed> {
    const { firstPieceMs, gapMs, precheckMs } = this.limits;
    const started = performance.now();
    const overallEnd = started + overallMs;
    const firstEnd = Math.min(started + firstPieceMs, overallEnd);
    const model = cleanId(req.model);
    if (model === null) throw new AiError('http', `${MODEL_MISSING}: invalid name`);
    // A name in Ollama's cloud form is refused for every kind, before any request.
    if (isCloudName(model)) throw new AiError('notAllowed', REMOTE_MODEL);
    // Pictures are checked before any request too (format, size, count, asked for).
    const pictures = checkRequest(req);
    await this.identify(rt, base, precheckMs, signal);
    const { opts, details } = await this.prepare(rt, base, req, model, signal);
    if (pictures > 0) {
      // The model must read pictures, by what its runtime says (Ollama's details came above).
      const d = details ?? (await this.detailsOf(rt, base, model, precheckMs, signal));
      allowVision(d.vision);
    }

    // Sending: until the first-piece deadline. A stop closes the connection, also later.
    const a = new Attempt(Math.max(0, firstEnd - performance.now()), signal);
    const chat = rt.chat(req, opts);
    let resp: Response;
    try {
      resp = await untilAborted(
        fetch(loopbackUrl(base, chat.path), requestInit(chat, a.ctl.signal)),
        a.ctl.signal,
      );
    } catch (e) {
      a.end();
      if (a.stopped) throw aborted();
      if (a.timedOut) throw stalled('first-piece', Math.min(firstPieceMs, overallMs));
      throw netError(e);
    }
    // Reading has its own timers (first piece, gap, overall).
    a.disarm();
    const reader = resp.body?.getReader();
    try {
      const status = statusOf(resp);
      if (status < 200 || status >= 300) {
        throw statusError(status, await this.errorBody(reader, Math.min(gapMs, 5_000), signal));
      }
      if (!reader) throw new AiError('badResponse', `${FAILED}: no answer body`);
      const lines = new Lines(this.limits.maxLineBytes);
      const answer = new Answer(rt, started, this.limits.maxAnswerBytes, emit);
      let gotBytes = false;
      let last = performance.now();
      read: while (!answer.ended()) {
        const until = gotBytes ? Math.min(last + gapMs, overallEnd) : firstEnd;
        let chunk: Awaited<ReturnType<typeof readChunk>>;
        try {
          chunk = await readChunk(reader, until, a.ctl.signal);
        } catch (e) {
          if (a.stopped) throw aborted();
          throw netError(e);
        }
        if (chunk === 'timeout') {
          if (performance.now() >= overallEnd) throw stalled('overall', overallMs);
          if (gotBytes) throw stalled('gap', gapMs);
          throw stalled('first-piece', firstPieceMs);
        }
        if (chunk.done) break;
        // Any bytes (reasoning, keep-alive comments) show the runtime is still working.
        gotBytes = true;
        last = performance.now();
        for (const line of lines.push(chunk.value)) {
          answer.line(line);
          if (answer.ended()) break read;
        }
      }
      if (!answer.ended()) {
        const line = lines.finish();
        if (line !== null) answer.line(line);
      }
      return answer.finish();
    } finally {
      reader?.cancel().catch(() => undefined);
      a.end();
    }
  }

  /** The start of an error answer, best effort. */
  private async errorBody(
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
    limitMs: number,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!reader) return '';
    const until = performance.now() + limitMs;
    let bytes: Uint8Array = new Uint8Array(0);
    try {
      while (bytes.length <= ERROR_BODY_CAP) {
        const chunk = await readChunk(reader, until, signal);
        if (chunk === 'timeout' || chunk.done) break;
        bytes = concatBytes(bytes, chunk.value);
      }
    } catch {
      // Best effort: what arrived is enough.
    }
    return decodeUtf8(bytes.subarray(0, ERROR_BODY_CAP));
  }

  async detect(): Promise<RuntimeProbe[]> {
    refuseInDesktop();
    await requireAiAllowed();
    return Promise.all(
      DEFAULTS.map(async ({ kind, port }) => ({
        ...(await this.probeAt(loopbackV4(port))),
        expected: kind,
      })),
    );
  }

  async probe(baseUrl: string): Promise<RuntimeProbe> {
    refuseInDesktop();
    await requireAiAllowed();
    return this.probeAt(parseLoopback(baseUrl));
  }

  async models(kind: RuntimeKind, baseUrl: string): Promise<LocalModels> {
    refuseInDesktop();
    await requireAiAllowed();
    const base = parseLoopback(baseUrl);
    const rt = adapter(kind);
    await this.refuseOllamaAsOther(rt, base, this.limits.precheckMs);
    return this.fetchModels(rt, base, this.limits.precheckMs);
  }

  async modelInfo(kind: RuntimeKind, baseUrl: string, model: string): Promise<ModelDetails> {
    refuseInDesktop();
    await requireAiAllowed();
    const base = parseLoopback(baseUrl);
    const id = cleanId(model);
    if (id === null) throw new AiError('http', `${MODEL_MISSING}: invalid name`);
    const rt = adapter(kind);
    const limit = this.limits.precheckMs;
    await this.refuseOllamaAsOther(rt, base, limit);
    let details = await this.detailsOf(rt, base, id, limit);
    if (rt.health && rt.parseHealth) {
      try {
        const got = await this.fetchText(base, rt.health, limit, PROBE_BODY_CAP);
        const loaded = rt.parseHealth(got.status, got.body);
        if (loaded !== null) {
          details = {
            ...details,
            loaded,
            capabilities: { ...details.capabilities, loadState: 'yes' },
          };
        }
      } catch {
        // Load state stays as the details said.
      }
    }
    return details;
  }

  /** A tiny streamed answer (at most 8 tokens); an answer that is only reasoning still counts. */
  async test(kind: RuntimeKind, baseUrl: string, model: string): Promise<LocalTest> {
    try {
      refuseInDesktop();
      await requireAiAllowed();
      const base = parseLoopback(baseUrl);
      const req: LocalChatRequest = {
        requestId: 'local-test',
        kind,
        baseUrl: base.base,
        model,
        system: 'Reply with the single word OK.',
        messages: [{ role: 'user', content: 'OK?' }],
        maxTokens: 8,
        think: false,
      };
      const s = await this.streamAnswer(
        adapter(kind),
        base,
        req,
        this.limits.firstPieceMs + TEST_EXTRA_MS,
        () => undefined,
      );
      return { status: 'ok', firstPieceMs: s.firstPieceMs, streamed: s.pieces > 1, detail: '' };
    } catch (e) {
      return testFailed(toAiError(e));
    }
  }

  /** One question. Never counted, never retried, never sent to the cloud. */
  async chat(req: LocalChatRequest, opts: LocalChatOptions = {}): Promise<LocalChatResponse> {
    const { signal } = opts;
    const shown = new ShownText(opts.onPartial);
    try {
      refuseInDesktop();
      await requireAiAllowed();
      const base = parseLoopback(req.baseUrl);
      if (signal?.aborted) throw aborted();
      const overallMs =
        this.limits.overallMs ??
        clamp(Math.round(req.timeoutSecs ?? OVERALL_MAX_SECS), 5, OVERALL_MAX_SECS) * 1000;
      const s = await this.streamAnswer(
        adapter(req.kind),
        base,
        req,
        overallMs,
        (e) => {
          if (!signal?.aborted) shown.apply(e);
        },
        signal,
      );
      if (rustTrim(s.text) === '') {
        throw new AiError(
          'badResponse',
          s.removed ? 'reasoningOnly' : `empty answer (${s.truncated ? 'length' : 'stop'})`,
        );
      }
      shown.settle(s.text);
      return {
        content: s.text,
        model: s.model ?? rustTrim(req.model),
        runtime: req.kind,
        durationMs: s.durationMs,
        firstPieceMs: s.firstPieceMs,
        truncated: s.truncated,
        streamed: s.pieces > 1,
      };
    } catch (e) {
      if (signal?.aborted) throw new AiError('cancelled', req.requestId);
      throw toAiError(e);
    }
  }
}
