/**
 * Local Gemma without any server: the model runs inside the app (WebGPU + MediaPipe).
 * Keeps the previous export names so callers (chat, problem analysis, camera) stay
 * unchanged; only the engine underneath is new.
 */
import { useChatStore } from '@/teacher/chat/chatStore';
import type { KeyTest } from './keyTest';
import type { LlmTransport } from './transport';
import {
  webGemmaChat,
  webGemmaReady,
  webGemmaStatus,
  webGPUStatus,
  type DownloadProgress,
} from './webGemma';
import { AiError, type ChatRequest, type ChatResponse, type Provider } from './types';

export interface GemmaStatus {
  /** A usable WebGPU device is present (replaces the old Ollama check). */
  runtimeAvailable: boolean;
  installed: boolean;
  model: string;
  error?: string;
}

export interface GemmaLocalMessage {
  role: string;
  content: string;
}

/** Asks the in-browser Gemma model. Extra images go to `images` (ArrayBuffers). */
export async function gemmaChatText(args: {
  model: string;
  system: string;
  messages: GemmaLocalMessage[];
  images?: ArrayBuffer[];
  temperature?: number;
  maxTokens?: number;
  inputBudget?: number;
  /** The answer so far, while it is generated (see webGemmaChat). */
  onPartial?: (textSoFar: string) => void;
  /** Stops the generation ("Dừng"); the call then rejects with "cancelled". */
  signal?: AbortSignal;
  /** The question a small model may repeat first (default: the last user message). */
  echo?: string;
}): Promise<{ content: string; model: string; truncated: boolean }> {
  if (webGPUStatus() !== 'webgpu') throw new AiError('unavailable', 'webgpu-missing');
  return webGemmaChat({
    model: args.model,
    system: args.system,
    messages: args.messages,
    ...(args.images ? { images: args.images } : {}),
    ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
    ...(args.maxTokens !== undefined ? { maxTokens: args.maxTokens } : {}),
    ...(args.inputBudget !== undefined ? { inputBudget: args.inputBudget } : {}),
    ...(args.onPartial ? { onPartial: args.onPartial } : {}),
    ...(args.signal ? { signal: args.signal } : {}),
    ...(args.echo ? { echo: args.echo } : {}),
  });
}

export async function gemmaStatus(model?: string): Promise<GemmaStatus> {
  const name = model ?? useChatStore.getState().gemmaModel;
  const gpu = webGPUStatus() === 'webgpu';
  const installed = gpu && (await webGemmaStatus(name)) === 'ready';
  return {
    runtimeAvailable: gpu,
    installed,
    model: name,
    ...(gpu ? {} : { error: 'WebGPU is not available in this browser.' }),
  };
}

export async function gemmaReady(model?: string): Promise<boolean> {
  const name = model ?? useChatStore.getState().gemmaModel;
  return webGemmaReady(name);
}

export type { DownloadProgress };

/**
 * The pipeline's `LlmTransport` backed by the in-browser Gemma model. There is no
 * JSON-schema mode, so the schema is pasted into the system prompt and the
 * pipeline's repair loop (which feeds validation errors back) does the rest.
 */
class GemmaTransport implements LlmTransport {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const started = performance.now();
    const system = req.jsonSchema
      ? `${req.system}\n\nTrả về DUY NHẤT một JSON đúng schema sau, không giải thích, không dùng code fence:\n${JSON.stringify(req.jsonSchema)}`
      : req.system;
    const answer = await gemmaChatText({
      model: req.model.trim(),
      system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.maxTokens !== undefined ? { maxTokens: req.maxTokens } : {}),
    });
    if (!answer.content.trim()) throw new AiError('badResponse', 'missing content');
    return {
      content: answer.content,
      model: answer.model,
      durationMs: performance.now() - started,
      truncated: answer.truncated,
    };
  }
  models(): Promise<string[]> {
    return Promise.resolve(['gemma3-270m', 'gemma3-1b', 'gemma4-e2b']);
  }
  setKey(): Promise<void> {
    return Promise.reject(new AiError('unavailable', 'the local model needs no API key'));
  }
  hasKey(): Promise<boolean> {
    return gemmaReady();
  }
  deleteKey(): Promise<void> {
    return Promise.resolve();
  }
  async testKey(_provider: Provider, model: string): Promise<KeyTest> {
    return (await gemmaReady(model))
      ? { status: 'ok', detail: '' }
      : { status: 'noKey', detail: '' };
  }
}

export const gemmaTransport: LlmTransport = new GemmaTransport();
