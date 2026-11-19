/**
 * The page's side of "Qwen trong app" (#190): the Rust `builtin_ai_*` commands. Questions go
 * through the local client (`builtin` requests, src/ai/local/client.ts); this file covers the
 * Settings card and the warm-up. Every command needs the 18+ gate, which Rust checks.
 */
import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { isMissingCommand } from '../transport';
import { AiError, toAiError } from '../types';
import { NEEDS_APP_UPDATE } from '../local/types';
import { freeGemmaMemory } from '../webGemma';
import { BUILTIN_UNSUPPORTED, type BuiltinStatus } from './types';

export interface BuiltinClient {
  status(): Promise<BuiltinStatus>;
  /** Downloads (or resumes) the model; `onBytes` gets the bytes on disk so far. */
  download(onBytes: (bytes: number) => void): Promise<void>;
  cancel(): Promise<void>;
  remove(): Promise<void>;
  /** Loads the model on the card ahead of the first question. */
  start(): Promise<void>;
  stop(): Promise<void>;
  /** "Bật lại" after a card fault. */
  enable(): Promise<void>;
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // The web part was updated without the desktop app: it has no builtin command yet.
    if (isMissingCommand(e)) throw new AiError('unavailable', NEEDS_APP_UPDATE);
    throw toAiError(e);
  }
}

export class TauriBuiltinClient implements BuiltinClient {
  status(): Promise<BuiltinStatus> {
    return call<BuiltinStatus>('builtin_ai_status');
  }

  // The other commands answer `null` (Rust `()`).
  async download(onBytes: (bytes: number) => void): Promise<void> {
    const onProgress = new Channel<number>(onBytes);
    await call<null>('builtin_ai_download', { onProgress });
  }

  async cancel(): Promise<void> {
    await call<null>('builtin_ai_cancel');
  }

  async remove(): Promise<void> {
    await call<null>('builtin_ai_delete');
  }

  async start(): Promise<void> {
    freeGemmaMemory();
    await call<null>('builtin_ai_start');
  }

  async stop(): Promise<void> {
    await call<null>('builtin_ai_stop');
  }

  async enable(): Promise<void> {
    await call<null>('builtin_ai_enable');
  }
}

/** Without the desktop app: Qwen in the app does not exist (nothing is ever started). */
class NoBuiltin implements BuiltinClient {
  private refuse(): Promise<never> {
    return Promise.reject(new AiError('unavailable', BUILTIN_UNSUPPORTED));
  }
  status(): Promise<BuiltinStatus> {
    return this.refuse();
  }
  download(): Promise<void> {
    return this.refuse();
  }
  cancel(): Promise<void> {
    return Promise.resolve();
  }
  remove(): Promise<void> {
    return this.refuse();
  }
  start(): Promise<void> {
    return this.refuse();
  }
  stop(): Promise<void> {
    return Promise.resolve();
  }
  enable(): Promise<void> {
    return this.refuse();
  }
}

let override: BuiltinClient | null = null;

/** Tests can inject a fake client. */
export function setBuiltinClientForTests(c: BuiltinClient | null): void {
  override = c;
}

export function getBuiltinClient(): BuiltinClient {
  if (override) return override;
  return isTauri() ? new TauriBuiltinClient() : new NoBuiltin();
}

/** Frees the card for Gemma; a server that is not running, or no desktop app, is fine. */
export async function stopBuiltin(): Promise<void> {
  await getBuiltinClient()
    .stop()
    .catch(() => undefined);
}
