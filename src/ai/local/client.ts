/**
 * How the page reaches local runtimes. In the desktop app every call goes through the Rust
 * commands `local_ai_*` (src-tauri/src/ai/local/mod.rs): the production CSP has no loopback
 * host, and Rust holds the gate, the loopback check, the no-proxy/no-redirect client and the
 * stall timers. Without the desktop app (browser development, end-to-end tests) the browser
 * client does the same in the page (src/ai/local/fetchClient.ts).
 */
import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { cancelInRust, isMissingCommand } from '../transport';
import { AiError, ShownText, toAiError } from '../types';
import { parseLoopback } from './endpoint';
import { FetchLocalClient } from './fetchClient';
import {
  NEEDS_APP_UPDATE,
  type LocalChatOptions,
  type LocalChatRequest,
  type LocalChatResponse,
  type LocalEvent,
  type LocalModels,
  type LocalRuntimeClient,
  type LocalTest,
  type ModelDetails,
  type RuntimeKind,
  type RuntimeProbe,
} from './types';

export { FetchLocalClient } from './fetchClient';
export type { LocalChatOptions, LocalRuntimeClient } from './types';

/** An AiError for whatever a `local_ai_*` command threw. */
function commandError(e: unknown): AiError {
  // The web part was updated without the desktop app: it has no local-runtime command yet.
  if (isMissingCommand(e)) return new AiError('unavailable', NEEDS_APP_UPDATE);
  return toAiError(e);
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw commandError(e);
  }
}

/** The desktop app: Rust does every request (and checks every address again). */
export class TauriLocalClient implements LocalRuntimeClient {
  async detect(): Promise<RuntimeProbe[]> {
    return call<RuntimeProbe[]>('local_ai_detect');
  }

  // Addresses are checked here too, so a wrong one fails at once (Rust refuses it as well).
  async probe(baseUrl: string): Promise<RuntimeProbe> {
    return call<RuntimeProbe>('local_ai_probe', { baseUrl: parseLoopback(baseUrl).base });
  }

  async models(kind: RuntimeKind, baseUrl: string): Promise<LocalModels> {
    return call<LocalModels>('local_ai_models', { kind, baseUrl: parseLoopback(baseUrl).base });
  }

  async modelInfo(kind: RuntimeKind, baseUrl: string, model: string): Promise<ModelDetails> {
    return call<ModelDetails>('local_ai_model_info', {
      kind,
      baseUrl: parseLoopback(baseUrl).base,
      model,
    });
  }

  /** Rust answers every failure as a test result (a wrong address: `notAllowed`). */
  async test(kind: RuntimeKind, baseUrl: string, model: string): Promise<LocalTest> {
    return call<LocalTest>('local_ai_test', { kind, baseUrl, model });
  }

  /**
   * `local_ai_chat`: the answer streams through a channel (reasoning already removed). The
   * events are provisional (`ShownText`); the returned content is the answer. A stop asks Rust
   * to cancel the request id (`ai_cancel`, retried until Rust has registered the call), which
   * drops the request and closes the connection to the runtime. A stopped call always ends as
   * `cancelled`, also when Rust finished the answer before the stop reached it: after "Dừng"
   * nothing more is shown.
   */
  async chat(req: LocalChatRequest, opts: LocalChatOptions = {}): Promise<LocalChatResponse> {
    const { signal } = opts;
    if (signal?.aborted) throw new AiError('cancelled', req.requestId);
    const request: LocalChatRequest = { ...req, baseUrl: parseLoopback(req.baseUrl).base };
    let running = true;
    const onAbort = () => {
      void cancelInRust(req.requestId, () => running);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const shown = new ShownText(opts.onPartial);
    const onEvent = new Channel<LocalEvent>((e) => {
      // Events that arrive after the call ended (or after a stop) are not shown.
      if (running && !signal?.aborted) shown.apply(e);
    });
    let answer: LocalChatResponse;
    try {
      answer = await invoke<LocalChatResponse>('local_ai_chat', { request, onEvent });
    } catch (e) {
      if (signal?.aborted) throw new AiError('cancelled', req.requestId);
      throw commandError(e);
    } finally {
      running = false;
      signal?.removeEventListener('abort', onAbort);
    }
    if (signal?.aborted) throw new AiError('cancelled', req.requestId);
    shown.settle(answer.content);
    return answer;
  }
}

let override: LocalRuntimeClient | null = null;

/** Tests can inject a fake client. */
export function setLocalClientForTests(c: LocalRuntimeClient | null): void {
  override = c;
}

/** Rust in the desktop app; the browser client only without it. */
export function getLocalClient(): LocalRuntimeClient {
  if (override) return override;
  return isTauri() ? new TauriLocalClient() : new FetchLocalClient();
}
