/**
 * Language models run by another program on this computer (Ollama, LM Studio, llama.cpp's
 * llama-server or another OpenAI-compatible server; user decision 2026-10-14). Mirrors the types
 * of src-tauri/src/ai/local/ (serde camelCase; Rust `Option` arrives as `null`).
 *
 * They are not cloud providers: no key, no daily cap, no retry and never a fallback to the cloud.
 */
import type { ChatMessage, StreamEvent } from '../types';

export type RuntimeKind = 'ollama' | 'lmStudio' | 'llamaCpp' | 'openAiCompatible';

/** The order in which an unknown address is identified (most specific first). */
export const PROBE_ORDER: readonly RuntimeKind[] = [
  'ollama',
  'lmStudio',
  'llamaCpp',
  'openAiCompatible',
];

export function isRuntimeKind(v: unknown): v is RuntimeKind {
  return typeof v === 'string' && (PROBE_ORDER as readonly string[]).includes(v);
}

/** One capability: seen on this computer (`yes` / `no`) or not checked (`unverified`). */
export type Cap = 'yes' | 'no' | 'unverified';

export function isCap(v: unknown): v is Cap {
  return v === 'yes' || v === 'no' || v === 'unverified';
}

export interface Capabilities {
  listModels: Cap;
  contextLength: Cap;
  vision: Cap;
  streaming: Cap;
  cancel: Cap;
  jsonSchema: Cap;
  loadState: Cap;
}

export const CAPABILITY_NAMES: readonly (keyof Capabilities)[] = [
  'listModels',
  'contextLength',
  'vision',
  'streaming',
  'cancel',
  'jsonSchema',
  'loadState',
];

export const UNVERIFIED: Capabilities = {
  listModels: 'unverified',
  contextLength: 'unverified',
  vision: 'unverified',
  streaming: 'unverified',
  cancel: 'unverified',
  jsonSchema: 'unverified',
  loadState: 'unverified',
};

/** A model a runtime offers. Names and labels are untrusted text from the runtime. */
export interface LocalModel {
  id: string;
  sizeBytes: number | null;
  family: string | null;
  parameterSize: string | null;
  quantization: string | null;
  contextLength: number | null;
  vision: Cap;
  /** Loaded in memory now (LM Studio), when the runtime says. */
  loaded: boolean | null;
  /** Runs on another computer (an Ollama "cloud" model): listed, never used. */
  remote: boolean;
}

export interface LocalModels {
  models: LocalModel[];
  /** The runtime offered more models than the list keeps. */
  more: boolean;
}

/** What the runtime on this computer says about one model. */
export interface ModelDetails {
  model: string;
  contextLength: number | null;
  vision: Cap;
  /** The model reasons before answering (Ollama "thinking" capability). */
  thinking: Cap;
  loaded: boolean | null;
  remote: boolean;
  /** Seen on this computer (`yes`/`no`) or not known (`unverified`). */
  capabilities: Capabilities;
  /** What the runtime's documentation says: a hint only, never shown as checked. */
  declared: Capabilities;
}

export type ProbeStatus =
  | 'found'
  /** Found, still loading its model. */
  | 'loading'
  /** Something answered and wants a key. */
  | 'needsAuth'
  /** Something answered, but no known runtime. */
  | 'notRuntime'
  /** Nothing answers. */
  | 'unreachable';

export interface RuntimeProbe {
  /** Detection: the runtime this is the usual address of. */
  expected: RuntimeKind | null;
  /** The runtime that answered. */
  kind: RuntimeKind | null;
  baseUrl: string;
  status: ProbeStatus;
  version: string | null;
}

export type LocalTestStatus =
  | 'ok'
  | 'unreachable'
  | 'notRuntime'
  | 'needsAuth'
  | 'modelMissing'
  | 'loading'
  | 'remoteModel'
  | 'stalled'
  | 'error'
  /** The safety gate is closed, or the address is not on this computer. */
  | 'notAllowed';

/** Result of "Kiểm tra trả lời": a tiny streamed answer (it loads the model into memory). */
export interface LocalTest {
  status: LocalTestStatus;
  firstPieceMs: number | null;
  streamed: boolean;
  /** Short runtime message for `error`; `ollama` for `notRuntime` when the address is Ollama. */
  detail: string;
}

/** A question for a local runtime (`LocalChatRequest` in Rust). */
export interface LocalChatRequest {
  /** Also the id `ai_cancel` stops. */
  requestId: string;
  kind: RuntimeKind;
  baseUrl: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  /** Structured output, only when the check on this computer said the runtime supports it. */
  jsonSchema?: unknown;
  temperature?: number;
  maxTokens?: number;
  /** Context window (Ollama `num_ctx`); never more than the model's own. */
  contextLength?: number;
  /** Ollama `think` for models that reason first (ignored by other runtimes). */
  think?: boolean;
  /** Longest answer in seconds (5–600, default 600). */
  timeoutSecs?: number;
}

export interface LocalChatResponse {
  /** The whole answer, reasoning removed: the only final text. */
  content: string;
  model: string;
  runtime: RuntimeKind;
  durationMs: number;
  /** Time until the first piece of text. */
  firstPieceMs: number | null;
  /** The answer stopped at the output limit, or the stream ended without its end mark. */
  truncated: boolean;
  /** The text arrived in more than one piece. */
  streamed: boolean;
}

/** A change to the answer shown while it streams (provisional, see `StreamEvent`). */
export type LocalEvent = StreamEvent;

export interface LocalChatOptions {
  /**
   * The whole answer shown so far, after every change (provisional: a late reasoning tag takes
   * text back). The last call is always the final content.
   */
  onPartial?: (shown: string) => void;
  /** "Dừng": the call rejects with `cancelled` and the connection to the runtime closes. */
  signal?: AbortSignal;
}

/**
 * How the page talks to local runtimes: `TauriLocalClient` (Rust commands `local_ai_*`) in the
 * desktop app, `FetchLocalClient` only in the browser (development, end-to-end tests). Nothing
 * here runs on its own: every call is something the learner asked for.
 */
export interface LocalRuntimeClient {
  /** "Tìm trên máy này": asks the three usual addresses which runtime answers. */
  detect(): Promise<RuntimeProbe[]>;
  /** Identifies the runtime at an address the user typed (loopback only). */
  probe(baseUrl: string): Promise<RuntimeProbe>;
  models(kind: RuntimeKind, baseUrl: string): Promise<LocalModels>;
  modelInfo(kind: RuntimeKind, baseUrl: string, model: string): Promise<ModelDetails>;
  /** "Kiểm tra trả lời": a tiny streamed answer. It makes the runtime load the model. */
  test(kind: RuntimeKind, baseUrl: string, model: string): Promise<LocalTest>;
  chat(req: LocalChatRequest, opts?: LocalChatOptions): Promise<LocalChatResponse>;
}

/** The runtime and model chosen for AI Teacher. */
export interface LocalSelection {
  kind: RuntimeKind;
  /** Normalised loopback address (`http://127.0.0.1:11434`). */
  baseUrl: string;
  model: string;
  /** What the learner sees, e.g. "Ollama · qwen3:8b". */
  label: string;
}

// Error tags: the start of an AiError message from a local runtime ("<tag>" or
// "<tag>: <detail>"), the constants of src-tauri/src/ai/local/mod.rs.
/** Nothing answers at the address, or the connection broke. */
export const UNREACHABLE = 'local-unreachable';
/** The runtime does not have this model. */
export const MODEL_MISSING = 'model-missing';
/** The runtime is still loading its model (HTTP 503). */
export const LOADING = 'loading';
/** The server wants a key (HTTP 401/403). */
export const NEEDS_AUTH = 'needs-auth';
/** No answer in time (first piece, gap between pieces, or overall). */
export const STALLED = 'local-stalled';
/** An Ollama "cloud" model, which runs on ollama.com. */
export const REMOTE_MODEL = 'remote-model';
/** Something answered, but not the chosen runtime. */
export const NOT_RUNTIME = 'not-runtime';
/** Detail of NOT_RUNTIME: the address is Ollama, chosen as another kind. */
export const IS_OLLAMA = 'ollama';
/** The address is not on this computer. */
export const NOT_LOOPBACK = 'not-loopback';
/** An answer, a line or a list over its size cap. */
export const TOO_LARGE = 'too-large';
/** Any other error the runtime reported. */
export const FAILED = 'local-failed';
/**
 * Web-side only: the desktop app is older than this page and has no local-runtime command (the
 * web part was updated alone). The learner must install the new app.
 */
export const NEEDS_APP_UPDATE = 'needs-app-update';
/** Web-side only: a local runtime was asked for, but no runtime and model are chosen. */
export const NOT_SELECTED = 'local-not-selected';
