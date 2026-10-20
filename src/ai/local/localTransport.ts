/**
 * The analysis pipeline's `LlmTransport` ("Phân tích đề", later "Giải thích") backed by the local
 * runtime and model chosen in Settings (`useLocalAiStore().selected`). Like the in-app Gemma: no
 * key, no daily cap, never a fallback to the cloud. The request's cloud provider and model are
 * ignored: the chosen local model answers.
 *
 * Structured output (Ollama `format`, OpenAI-style `response_format`) is only asked for when the
 * check on this computer said the runtime supports it; otherwise the schema goes into the system
 * prompt and the pipeline's repair loop does the rest. No time limit of the cloud is passed on: a
 * local runtime has its own stall timers (it may have to load the model first).
 */
import type { KeyTest } from '../keyTest';
import { schemaInSystem } from '../prompts';
import type { LlmTransport } from '../transport';
import { AiError, type ChatRequest, type ChatResponse } from '../types';
import { getLocalClient } from './client';
import { checkFor, useLocalAiStore } from './localAiStore';
import {
  NOT_SELECTED,
  type LocalChatOptions,
  type LocalChatRequest,
  type LocalChatResponse,
  type LocalRuntimeClient,
  type LocalSelection,
  type LocalTest,
} from './types';

/** "Kiểm tra" of the local model in the words of the cloud key check. */
export function keyTestOf(t: LocalTest): KeyTest {
  switch (t.status) {
    case 'ok':
      return { status: 'ok', detail: '' };
    case 'unreachable':
      return { status: 'offline', detail: '' };
    case 'needsAuth':
      return { status: 'badKey', detail: '' };
    case 'modelMissing':
      return { status: 'badModel', detail: '' };
    case 'notAllowed':
      return { status: 'notAllowed', detail: '' };
    default:
      return { status: 'error', detail: t.detail || t.status };
  }
}

export class LocalTransport implements LlmTransport {
  constructor(
    private readonly selection: () => LocalSelection | null = () =>
      useLocalAiStore.getState().selected,
    private readonly client: () => LocalRuntimeClient = getLocalClient,
  ) {}

  private chosen(): LocalSelection {
    const sel = this.selection();
    if (!sel) throw new AiError('unavailable', NOT_SELECTED);
    return sel;
  }

  private request(req: ChatRequest, sel: LocalSelection): LocalChatRequest {
    const schema = req.jsonSchema;
    const structured =
      schema !== undefined &&
      checkFor(useLocalAiStore.getState(), sel)?.capabilities.jsonSchema === 'yes';
    return {
      requestId: req.requestId,
      kind: sel.kind,
      baseUrl: sel.baseUrl,
      model: sel.model,
      system: schema !== undefined && !structured ? schemaInSystem(req.system, schema) : req.system,
      messages: req.messages,
      ...(structured ? { jsonSchema: schema } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.maxTokens !== undefined ? { maxTokens: req.maxTokens } : {}),
    };
  }

  private async ask(req: ChatRequest, opts: LocalChatOptions): Promise<ChatResponse> {
    const sel = this.chosen();
    const r: LocalChatResponse = await this.client().chat(this.request(req, sel), opts);
    return {
      content: r.content,
      model: r.model,
      durationMs: r.durationMs,
      truncated: r.truncated,
    };
  }

  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    return this.ask(req, signal ? { signal } : {});
  }

  /** Streams text answers; a JSON-schema request is answered whole, as by the cloud transports. */
  chatStream(
    req: ChatRequest,
    onText: (shown: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    if (req.jsonSchema !== undefined) return this.chat(req, signal);
    return this.ask(req, { onPartial: onText, ...(signal ? { signal } : {}) });
  }

  /** The chosen runtime's models that run on this computer. */
  async models(): Promise<string[]> {
    const sel = this.selection();
    if (!sel) return [];
    const list = await this.client().models(sel.kind, sel.baseUrl);
    return list.models.filter((m) => !m.remote).map((m) => m.id);
  }

  setKey(): Promise<void> {
    return Promise.reject(new AiError('unavailable', 'local runtimes need no API key'));
  }

  hasKey(): Promise<boolean> {
    return Promise.resolve(this.selection() !== null);
  }

  deleteKey(): Promise<void> {
    return Promise.resolve();
  }

  /** "Kiểm tra" with the chosen model (it makes the runtime load the model). */
  async testKey(): Promise<KeyTest> {
    const sel = this.selection();
    if (!sel) return { status: 'noKey', detail: '' };
    return keyTestOf(await this.client().test(sel.kind, sel.baseUrl, sel.model));
  }
}

export const localTransport: LlmTransport = new LocalTransport();
