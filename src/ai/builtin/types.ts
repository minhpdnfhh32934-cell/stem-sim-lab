/**
 * Qwen 3.5 9B inside the app (#190): the shapes of the Rust `builtin_ai_*` commands
 * (src-tauri/src/ai/builtin/mod.rs). The page never knows the server's port or key: it asks
 * Rust, which runs the bundled `llama-server` itself.
 */
import type { LocalSelection } from '../local/types';

/** The model name the in-app server answers to (`server::ALIAS`). */
export const BUILTIN_MODEL = 'qwen3.5-9b';

/**
 * The local-runtime choice "Qwen trong app". It goes through the local route (never counted,
 * never online), but no address is ever used: `builtin` sends every call to Rust's own server.
 * The address is a placeholder no loopback check accepts.
 */
export const BUILTIN_SELECTION: LocalSelection = {
  kind: 'llamaCpp',
  baseUrl: 'builtin:qwen',
  model: BUILTIN_MODEL,
  label: 'Qwen 3.5 9B',
  builtin: true,
};

export const isBuiltin = (sel: LocalSelection | null | undefined): boolean => sel?.builtin === true;

/** The card Qwen runs on. */
export interface BuiltinDevice {
  name: string;
  dedicatedMb: number;
}

/** Why no card may run Qwen (`device::Ineligible`). */
export type Ineligible =
  | { reason: 'noDiscrete' }
  | { reason: 'tooSmall'; name: string; dedicatedMb: number }
  | { reason: 'notListed'; name: string }
  | { reason: 'unknownKind'; name: string };

export type ModelFile =
  { state: 'missing' } | { state: 'partial'; bytes: number } | { state: 'ready' };

export interface BuiltinStatus {
  /** Windows only. */
  supported: boolean;
  /** This copy of SimLab has `llama-server` (a build without it, or an antivirus removed it). */
  runtime: boolean;
  card: BuiltinDevice | null;
  ineligible: Ineligible | null;
  model: ModelFile;
  /** The download's size in bytes. */
  size: number;
  freeBytes: number | null;
  downloading: boolean;
  server: 'stopped' | 'starting' | 'running';
  /** A card fault turned Qwen off until the learner turns it back on. */
  gpuFault: boolean;
}

// Error tags: the start of an `unavailable` AiError message (constants of builtin/mod.rs).
export const BUILTIN_UNSUPPORTED = 'builtin-unsupported';
export const BUILTIN_NO_RUNTIME = 'builtin-no-runtime';
export const BUILTIN_NO_CARD = 'builtin-no-card';
export const BUILTIN_NO_MODEL = 'builtin-no-model';
export const BUILTIN_GPU_FAULT = 'builtin-gpu-fault';
export const BUILTIN_START_FAILED = 'builtin-start-failed';
export const BUILTIN_DOWNLOAD = 'builtin-download';
export const BUILTIN_BUSY = 'builtin-busy';

/** Why a download stopped (`model::DownloadError`). */
export type DownloadFailure =
  | { kind: 'noSpace'; need: number; free: number }
  | { kind: 'offline'; detail: string }
  | { kind: 'stalled' }
  | { kind: 'http'; status: number }
  | { kind: 'badHost' }
  | { kind: 'badSize' }
  | { kind: 'badHash' }
  | { kind: 'cancelled' }
  | { kind: 'disk'; detail: string };
