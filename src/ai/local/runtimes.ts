/**
 * What every local runtime adapter provides: request descriptions and pure parsers, the web-side
 * mirror of src-tauri/src/ai/local/{runtime,ollama,openai_compat,lmstudio,llamacpp}.rs. Only the
 * browser client (src/ai/local/fetchClient.ts: development and end-to-end tests) sends these
 * requests; in the desktop app Rust does, with the same rules.
 *
 * Runtime answers are untrusted text: ids and labels are bounded and cleaned here.
 */
import { AiError } from '../types';
import { asciiLower } from './endpoint';
import { rustTrim } from './stream';
import {
  FAILED,
  LOADING,
  MODEL_MISSING,
  NEEDS_AUTH,
  UNVERIFIED,
  type Cap,
  type Capabilities,
  type LocalChatMessage,
  type LocalChatRequest,
  type LocalModel,
  type ModelDetails,
  type RuntimeKind,
} from './types';
import { dataUrl } from './vision';
import { utf8Length } from '../sse';

/** A request of an adapter: method, fixed path and JSON body. */
export interface HttpRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

/** What a fingerprint answer says about the address. */
export type Fingerprint =
  /** It is this runtime (`loading`: still loading its model). */
  | { kind: 'match'; version: string | null; loading: boolean }
  /** Something answered but wants a key (401/403). */
  | { kind: 'needsAuth' }
  /** Not this runtime. */
  | { kind: 'notThis' };

/** Generation settings decided by the client (clamped there), shared by every adapter. */
export interface ChatOptions {
  maxTokens: number;
  /** Context window to ask for (Ollama `num_ctx`; the others use what was loaded). */
  contextLength: number;
  /** Ollama `think`, only sent when the model has the "thinking" capability. */
  think: boolean | null;
}

/** One line of a streamed answer. */
export interface StreamPiece {
  text: string | null;
  /** The answer ended; `true` when it stopped at the output limit. */
  done: boolean | null;
  model: string | null;
}

export interface LocalRuntimeAdapter {
  kind: RuntimeKind;
  /** What the runtime's documentation says it supports (a hint, never shown as checked). */
  declared: Capabilities;
  /** A cheap request that only this runtime answers in its own way. */
  fingerprint: HttpRequest;
  parseFingerprint(status: number, body: string): Fingerprint;
  models: HttpRequest;
  parseModels(v: unknown): LocalModel[];
  /** The runtime to ask for the model list, and to identify the server, when this one's API is missing. */
  modelsFallback?: RuntimeKind;
  /** A request for one model's details, when the runtime has one. */
  info?(model: string): HttpRequest;
  parseInfo(v: unknown, model: string): ModelDetails;
  /** A request telling whether the model is loaded (llama.cpp `/health`). */
  health?: HttpRequest;
  /** `true` loaded, `false` still loading, `null` unknown. */
  parseHealth?(status: number, body: string): boolean | null;
  chat(req: LocalChatRequest, opts: ChatOptions): HttpRequest;
  streamFormat: 'ndjson' | 'sse';
  /** One stream payload; an error object in the stream throws an AiError with a local tag. */
  parseEvent(data: string): StreamPiece;
}

// --- JSON helpers (serde_json's `Value` indexing: a missing field or a wrong type is null) ---

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `v[key]` when `v` is an object, else undefined. */
export function field(v: unknown, key: string): unknown {
  return isObj(v) ? v[key] : undefined;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Parses JSON, or undefined when the text is not JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Rust's `char::is_control` (Unicode Cc). */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * A model id from a runtime or the page: non-empty, at most 256 bytes, no control characters,
 * not a path step. Anything else is dropped (runtime data is untrusted text).
 */
export function cleanId(s: string): string | null {
  const t = rustTrim(s);
  const ok = t !== '' && utf8Length(t) <= 256 && t !== '.' && t !== '..' && !CONTROL.test(t);
  return ok ? t : null;
}

/** A short descriptive label from a runtime (family, size, quantization): at most 64 bytes. */
export function cleanLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = rustTrim(v);
  return t !== '' && utf8Length(t) <= 64 && !CONTROL.test(t) ? t : null;
}

/** A positive integer from a runtime (sizes, context lengths). */
export function positive(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
}

/** The OpenAI-style `{"data":[{"id":…}]}` model list (also LM Studio and llama.cpp). */
export function openaiModelList(v: unknown): unknown[] | null {
  const data = field(v, 'data');
  if (!Array.isArray(data)) return null;
  return data.every((m) => typeof field(m, 'id') === 'string') ? data : null;
}

/** The error message of an OpenAI-style or Ollama error answer, if the body is one. */
export function errorMessage(v: unknown): string | null {
  const e = field(v, 'error');
  if (e === undefined) return null;
  const msg = str(e) ?? str(field(e, 'message'));
  return msg === null ? null : Array.from(msg).slice(0, 200).join('');
}

/** Runtime text, shortened and without control characters. */
export function detail(s: string): string {
  return rustTrim(Array.from(s.replace(CONTROLS, '')).slice(0, 200).join(''));
}

/** Only user and assistant turns come from the page. */
function chatRole(role: string): 'user' | 'assistant' {
  return role === 'assistant' ? 'assistant' : 'user';
}

function hasSchema(req: LocalChatRequest): boolean {
  return req.jsonSchema !== undefined && req.jsonSchema !== null;
}

// --- Errors (the tags of src-tauri/src/ai/local/mod.rs) ---

/** An error the runtime reported inside the stream. */
export function streamError(msg: string): AiError {
  const lower = asciiLower(msg);
  const tag =
    lower.includes('model') && lower.includes('not found')
      ? MODEL_MISSING
      : lower.includes('loading')
        ? LOADING
        : FAILED;
  return new AiError('http', `${tag}: ${detail(msg)}`);
}

/** An HTTP error answer of a runtime. */
export function statusError(status: number, body: string): AiError {
  const msg = detail(errorMessage(parseJson(body)) ?? body);
  const lower = asciiLower(msg);
  if (status === 401 || status === 403) return new AiError('http', `${NEEDS_AUTH}: ${status}`);
  if (status >= 300 && status <= 399) {
    return new AiError('http', `${FAILED}: ${status}: redirect not followed`);
  }
  let tag = FAILED;
  if (status === 404) tag = MODEL_MISSING;
  else if (status === 503) tag = LOADING;
  else if (
    (status === 400 || status === 422) &&
    lower.includes('model') &&
    (lower.includes('not found') || lower.includes('not_found'))
  ) {
    tag = MODEL_MISSING;
  }
  return new AiError('http', `${tag}: ${status}: ${msg}`);
}

function unreadableLine(): AiError {
  return new AiError('badResponse', `${FAILED}: unreadable stream line`);
}

// --- Shared model shapes ---

/** A model whose tag says it runs on ollama.com ("gpt-oss:120b-cloud", "x:cloud"). */
export function isCloudName(name: string): boolean {
  const colon = name.lastIndexOf(':');
  const tag = colon < 0 ? '' : asciiLower(name.slice(colon + 1));
  return tag === 'cloud' || tag.endsWith('-cloud');
}

/**
 * A model known by its id only. A name in Ollama's cloud form is flagged `remote` whatever the
 * runtime: Ollama lists its cloud models in its OpenAI-compatible `/v1/models` too.
 */
export function namedModel(id: string): LocalModel {
  return {
    id,
    sizeBytes: null,
    family: null,
    parameterSize: null,
    quantization: null,
    contextLength: null,
    vision: 'unverified',
    loaded: null,
    remote: isCloudName(id),
  };
}

/** Details known from a model listing only. */
export function detailsFromListing(m: LocalModel, declared: Capabilities): ModelDetails {
  return {
    model: m.id,
    contextLength: m.contextLength,
    vision: m.vision,
    thinking: 'unverified',
    loaded: m.loaded,
    remote: m.remote,
    capabilities: {
      ...UNVERIFIED,
      listModels: 'yes',
      contextLength: m.contextLength !== null ? 'yes' : 'unverified',
      vision: m.vision,
      loadState: m.loaded !== null ? 'yes' : 'unverified',
    },
    declared,
  };
}

const capOf = (b: boolean): Cap => (b ? 'yes' : 'no');

// --- Ollama ---

/** The answer describes a model that runs on another computer. */
function hasRemoteFields(v: unknown): boolean {
  return ['remote_host', 'remote_model'].some((k) => {
    const s = str(field(v, k));
    return s !== null && rustTrim(s) !== '';
  });
}

/** The context length in `/api/show`'s `model_info`: `<architecture>.context_length`. */
export function ollamaContextLength(modelInfo: unknown): number | null {
  const arch = str(field(modelInfo, 'general.architecture'));
  if (arch !== null) {
    const n = positive(field(modelInfo, `${arch}.context_length`));
    if (n !== null) return n;
  }
  if (!isObj(modelInfo)) return null;
  // serde_json keeps object keys sorted: the first matching key in that order.
  const key = Object.keys(modelInfo)
    .sort()
    .find((k) => k.endsWith('.context_length'));
  return key === undefined ? null : positive(modelInfo[key]);
}

/** The system prompt first, then the turns as `turn` writes them. */
function systemFirst(req: LocalChatRequest, turn: (m: LocalChatMessage) => Json): Json[] {
  return [{ role: 'system', content: req.system }, ...req.messages.map(turn)];
}

/** One turn of `/api/chat`; a checked picture goes in `images` as base64 (src/ai/local/vision.ts). */
function ollamaMessage(m: LocalChatMessage): Json {
  const turn: Json = { role: chatRole(m.role), content: m.content };
  if (m.images !== undefined && m.images.length > 0) turn.images = [...m.images];
  return turn;
}

/** JSON body for a streamed `/api/chat` (`num_ctx` always sent). */
export function ollamaBody(req: LocalChatRequest, opts: ChatOptions): Json {
  const options: Json = { num_ctx: opts.contextLength, num_predict: opts.maxTokens };
  if (req.temperature !== undefined) options.temperature = req.temperature;
  const body: Json = {
    model: rustTrim(req.model),
    messages: systemFirst(req, ollamaMessage),
    stream: true,
    options,
  };
  if (hasSchema(req)) body.format = req.jsonSchema;
  if (opts.think !== null) body.think = opts.think;
  return body;
}

const OLLAMA: LocalRuntimeAdapter = {
  kind: 'ollama',
  declared: {
    listModels: 'yes',
    contextLength: 'yes',
    vision: 'unverified',
    streaming: 'yes',
    cancel: 'yes',
    jsonSchema: 'yes',
    loadState: 'unverified',
  },
  fingerprint: { method: 'GET', path: '/api/version' },
  /** `{"version":"0.12.6"}` and nothing that looks like another server. */
  parseFingerprint(status, body) {
    if (status === 401 || status === 403) return { kind: 'needsAuth' };
    if (status !== 200) return { kind: 'notThis' };
    const v = parseJson(body);
    if (v === undefined || field(v, 'error') !== undefined) return { kind: 'notThis' };
    const version = cleanLabel(field(v, 'version'));
    return version === null ? { kind: 'notThis' } : { kind: 'match', version, loading: false };
  },
  models: { method: 'GET', path: '/api/tags' },
  parseModels(v) {
    const list = field(v, 'models');
    if (!Array.isArray(list)) return [];
    const out: LocalModel[] = [];
    for (const m of list) {
      const name = str(field(m, 'name'));
      const raw = name !== null && rustTrim(name) !== '' ? name : str(field(m, 'model'));
      const id = raw === null ? null : cleanId(raw);
      if (id === null) continue;
      const d = field(m, 'details');
      out.push({
        ...namedModel(id),
        remote: hasRemoteFields(m) || isCloudName(id),
        sizeBytes: positive(field(m, 'size')),
        family: cleanLabel(field(d, 'family')),
        parameterSize: cleanLabel(field(d, 'parameter_size')),
        quantization: cleanLabel(field(d, 'quantization_level')),
      });
    }
    return out;
  },
  info: (model) => ({ method: 'POST', path: '/api/show', body: { model } }),
  /** Newer Ollama lists `capabilities`; with older versions vision and thinking stay unverified. */
  parseInfo(v, model) {
    const caps = field(v, 'capabilities');
    const names = Array.isArray(caps) ? caps.filter((c) => typeof c === 'string') : null;
    const has = (name: string): Cap =>
      names === null ? 'unverified' : capOf(names.includes(name));
    const context = ollamaContextLength(field(v, 'model_info'));
    const vision = has('vision');
    return {
      model,
      contextLength: context,
      vision,
      thinking: has('thinking'),
      loaded: null,
      remote: hasRemoteFields(v) || isCloudName(model),
      capabilities: {
        ...UNVERIFIED,
        listModels: 'yes',
        contextLength: context !== null ? 'yes' : 'unverified',
        vision,
      },
      declared: OLLAMA.declared,
    };
  },
  chat: (req, opts) => ({ method: 'POST', path: '/api/chat', body: ollamaBody(req, opts) }),
  streamFormat: 'ndjson',
  parseEvent(data) {
    const v = parseJson(data);
    if (v === undefined) throw unreadableLine();
    const msg = errorMessage(v);
    if (msg !== null) throw streamError(msg);
    return {
      text: str(field(field(v, 'message'), 'content')),
      done: field(v, 'done') === true ? field(v, 'done_reason') === 'length' : null,
      model: str(field(v, 'model')),
    };
  },
};

// --- OpenAI-compatible (also the chat of LM Studio and llama.cpp) ---

/**
 * One turn of `/v1/chat/completions`. A turn with a checked picture is a list of parts: its text,
 * then the picture as an `image_url` data URL.
 */
function openaiMessage(m: LocalChatMessage): Json {
  const role = chatRole(m.role);
  if (m.images === undefined || m.images.length === 0) return { role, content: m.content };
  return {
    role,
    content: [
      { type: 'text', text: m.content },
      ...m.images.map((image) => ({ type: 'image_url', image_url: { url: dataUrl(image) } })),
    ],
  };
}

/** JSON body for a streamed `/v1/chat/completions`. */
export function openaiBody(req: LocalChatRequest, opts: ChatOptions): Json {
  const body: Json = {
    model: rustTrim(req.model),
    messages: systemFirst(req, openaiMessage),
    stream: true,
    max_tokens: opts.maxTokens,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  // Support differs per server: only asked for when the check on this computer said yes.
  if (hasSchema(req)) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'result', schema: req.jsonSchema },
    };
  }
  return body;
}

/** One `data:` payload of an OpenAI-style stream (reasoning fields are never read). */
export function parseOpenaiEvent(data: string): StreamPiece {
  const v = parseJson(data);
  if (v === undefined) throw unreadableLine();
  const msg = errorMessage(v);
  if (msg !== null) throw streamError(msg);
  const choices = field(v, 'choices');
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const reason = str(field(choice, 'finish_reason'));
  return {
    text: str(field(field(choice, 'delta'), 'content')),
    done: reason === null ? null : reason === 'length',
    model: str(field(v, 'model')),
  };
}

/** Model ids of an OpenAI-style list. */
export function openaiModels(v: unknown): LocalModel[] {
  const out: LocalModel[] = [];
  for (const m of openaiModelList(v) ?? []) {
    const raw = str(field(m, 'id'));
    const id = raw === null ? null : cleanId(raw);
    if (id !== null) out.push(namedModel(id));
  }
  return out;
}

const openaiChat = (req: LocalChatRequest, opts: ChatOptions): HttpRequest => ({
  method: 'POST',
  path: '/v1/chat/completions',
  body: openaiBody(req, opts),
});

const OPENAI_COMPAT: LocalRuntimeAdapter = {
  kind: 'openAiCompatible',
  declared: { ...UNVERIFIED, listModels: 'yes' },
  fingerprint: { method: 'GET', path: '/v1/models' },
  /** A 200 answer with `{"data":[{"id":…}, …]}`. */
  parseFingerprint(status, body) {
    if (status === 401 || status === 403) return { kind: 'needsAuth' };
    if (status !== 200) return { kind: 'notThis' };
    return openaiModelList(parseJson(body)) !== null
      ? { kind: 'match', version: null, loading: false }
      : { kind: 'notThis' };
  },
  models: { method: 'GET', path: '/v1/models' },
  parseModels: openaiModels,
  parseInfo: (_v, model) => detailsFromListing(namedModel(model), OPENAI_COMPAT.declared),
  chat: openaiChat,
  streamFormat: 'sse',
  parseEvent: parseOpenaiEvent,
};

// --- LM Studio ---

const LM_STUDIO: LocalRuntimeAdapter = {
  kind: 'lmStudio',
  declared: {
    listModels: 'yes',
    contextLength: 'yes',
    vision: 'unverified',
    streaming: 'yes',
    cancel: 'unverified',
    jsonSchema: 'yes',
    loadState: 'yes',
  },
  fingerprint: { method: 'GET', path: '/api/v0/models' },
  /** `/api/v0/models` exists only in LM Studio: a 200 answer with an OpenAI-style list. */
  parseFingerprint(status, body) {
    if (status === 401 || status === 403) return { kind: 'needsAuth' };
    if (status !== 200) return { kind: 'notThis' };
    const v = parseJson(body);
    return field(v, 'object') === 'list' && openaiModelList(v) !== null
      ? { kind: 'match', version: null, loading: false }
      : { kind: 'notThis' };
  },
  models: { method: 'GET', path: '/api/v0/models' },
  /** Chat models only (embedding models cannot answer). */
  parseModels(v) {
    const out: LocalModel[] = [];
    for (const m of openaiModelList(v) ?? []) {
      const type = field(m, 'type');
      if (type === 'embeddings') continue;
      const raw = str(field(m, 'id'));
      const id = raw === null ? null : cleanId(raw);
      if (id === null) continue;
      const state = field(m, 'state');
      out.push({
        ...namedModel(id),
        family: cleanLabel(field(m, 'arch')),
        quantization: cleanLabel(field(m, 'quantization')),
        // Only the context it was loaded with: a model that is not loaded gets LM Studio's own,
        // often much smaller, window when it is, so its maximum is no window seen here.
        contextLength: positive(field(m, 'loaded_context_length')),
        vision: type === 'vlm' ? 'yes' : type === 'llm' ? 'no' : 'unverified',
        loaded: state === 'loaded' ? true : state === 'not-loaded' ? false : null,
      });
    }
    return out;
  },
  modelsFallback: 'openAiCompatible',
  parseInfo: (_v, model) => detailsFromListing(namedModel(model), LM_STUDIO.declared),
  chat: openaiChat,
  streamFormat: 'sse',
  parseEvent: parseOpenaiEvent,
};

// --- llama.cpp's llama-server ---

/** llama-server's answer while it loads its model. */
function isLoading(status: number, body: string): boolean {
  return status === 503 && asciiLower(body).includes('loading model');
}

const LLAMA_CPP: LocalRuntimeAdapter = {
  kind: 'llamaCpp',
  declared: {
    listModels: 'yes',
    contextLength: 'yes',
    vision: 'unverified',
    streaming: 'yes',
    cancel: 'yes',
    jsonSchema: 'yes',
    loadState: 'yes',
  },
  fingerprint: { method: 'GET', path: '/props' },
  /** Port 8080 is used by many programs: only llama-server's own fields count. */
  parseFingerprint(status, body) {
    if (isLoading(status, body)) return { kind: 'match', version: null, loading: true };
    if (status === 401 || status === 403) return { kind: 'needsAuth' };
    if (status !== 200) return { kind: 'notThis' };
    const v = parseJson(body);
    const slots = field(v, 'total_slots');
    return isObj(field(v, 'default_generation_settings')) ||
      (typeof slots === 'number' && Number.isSafeInteger(slots) && slots >= 0)
      ? { kind: 'match', version: cleanLabel(field(v, 'build_info')), loading: false }
      : { kind: 'notThis' };
  },
  models: { method: 'GET', path: '/v1/models' },
  parseModels: openaiModels,
  info: () => ({ method: 'GET', path: '/props' }),
  /** `modalities` exists in newer builds only; without it vision stays unverified. */
  parseInfo(v, model) {
    const context =
      positive(field(field(v, 'default_generation_settings'), 'n_ctx')) ??
      positive(field(v, 'n_ctx'));
    const flag = field(field(v, 'modalities'), 'vision');
    const vision: Cap = typeof flag === 'boolean' ? capOf(flag) : 'unverified';
    return {
      model,
      contextLength: context,
      vision,
      thinking: 'unverified',
      loaded: true,
      // As in every list: a name in Ollama's cloud form is never treated as local.
      remote: isCloudName(model),
      capabilities: {
        ...UNVERIFIED,
        listModels: 'yes',
        contextLength: context !== null ? 'yes' : 'unverified',
        vision,
        loadState: 'yes',
      },
      declared: LLAMA_CPP.declared,
    };
  },
  health: { method: 'GET', path: '/health' },
  parseHealth(status, body) {
    if (isLoading(status, body)) return false;
    const v = parseJson(body);
    if (v === undefined) return null;
    return status === 200 && field(v, 'status') === 'ok' ? true : null;
  },
  chat: openaiChat,
  streamFormat: 'sse',
  parseEvent: parseOpenaiEvent,
};

const ADAPTERS: Record<RuntimeKind, LocalRuntimeAdapter> = {
  ollama: OLLAMA,
  lmStudio: LM_STUDIO,
  llamaCpp: LLAMA_CPP,
  openAiCompatible: OPENAI_COMPAT,
};

/** The adapter for a runtime. */
export function adapter(kind: RuntimeKind): LocalRuntimeAdapter {
  return ADAPTERS[kind];
}
