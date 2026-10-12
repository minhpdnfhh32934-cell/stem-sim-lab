import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Safety gate (PROMPT_PHAN_2 A3). The rule lives in Rust (src-tauri/src/safety.rs) so the web
 * page cannot bypass it: the AI gateway itself refuses calls and keys while the gate is closed.
 * This file is the page's view of it, with a browser-only copy for UI development and tests.
 * (The supervised high-school "pilot" edition — birth year, PIN, consent — was removed in 0.5.0.)
 */

/** Bump together with `TERMS_VERSION` in safety.rs when the terms change. */
export const TERMS_VERSION = 1;

export interface SafetyStatus {
  termsVersion: number;
  /** The age question has been answered. */
  answered: boolean;
  /** AI features may be used (18+ and the current terms confirmed). */
  aiAllowed: boolean;
  /** The user said they are under 18. */
  minor: boolean;
}

/** What is stored (`safety.json` in the desktop app). */
export interface SafetyFile {
  adultTerms?: number | null;
  declaredMinor?: boolean;
}

export type IncidentKind =
  'inputPersonalData' | 'inputUnsafe' | 'inputCrisis' | 'outputUnsafe' | 'userReport';

/** One line of the incident log: the kind and the time (seconds since 1970) — no content. */
export interface Incident {
  at: number;
  kind: IncidentKind;
}

export type SafetyErrorCode = 'invalid' | 'storage';

export class SafetyError extends Error {
  override name = 'SafetyError';
  constructor(
    readonly code: SafetyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function toSafetyError(e: unknown): SafetyError {
  if (e instanceof SafetyError) return e;
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const o = e as { code: string; message?: unknown };
    return new SafetyError(
      o.code as SafetyErrorCode,
      typeof o.message === 'string' ? o.message : '',
    );
  }
  return new SafetyError('storage', e instanceof Error ? e.message : String(e));
}

/** Same rule as `status_of` in safety.rs (both are tested with the same cases). */
export function statusOf(f: SafetyFile): SafetyStatus {
  const adult = f.adultTerms === TERMS_VERSION && !f.declaredMinor;
  return {
    termsVersion: TERMS_VERSION,
    answered: adult || !!f.declaredMinor,
    aiAllowed: adult,
    minor: !!f.declaredMinor,
  };
}

/** What the page can ask of the safety layer. */
export interface SafetyBackend {
  status(): Promise<SafetyStatus>;
  /** "Tôi đủ 18 tuổi và đồng ý điều khoản" / "Tôi chưa đủ 18 tuổi". */
  answerAdult(adult: boolean): Promise<SafetyStatus>;
  logIncident(kind: IncidentKind): Promise<void>;
  incidents(): Promise<Incident[]>;
  clearIncidents(): Promise<void>;
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toSafetyError(e);
  }
}

class TauriSafety implements SafetyBackend {
  status = () => call<SafetyStatus>('safety_status');
  answerAdult = (adult: boolean) =>
    call<SafetyStatus>('safety_answer_adult', { adult, termsVersion: TERMS_VERSION });
  logIncident = (kind: IncidentKind) => call<undefined>('safety_log_incident', { kind });
  incidents = () => call<Incident[]>('safety_incidents');
  clearIncidents = () => call<undefined>('safety_clear_incidents');
}

const DEV_KEY = 'stemsim.safety';
const DEV_LOG = 'stemsim.incidents';
const MAX_INCIDENTS = 500;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the gate simply asks again next time */
  }
}

/**
 * Browser-only copy for UI development and end-to-end tests (`localStorage`). It follows the
 * same rule, but a web page can always be edited, so the shipped desktop app uses Rust.
 */
export class BrowserSafety implements SafetyBackend {
  constructor(private readonly now: () => Date = () => new Date()) {}

  private file(): SafetyFile {
    return readJson<SafetyFile>(DEV_KEY, {});
  }

  status(): Promise<SafetyStatus> {
    return Promise.resolve(statusOf(this.file()));
  }
  answerAdult(adult: boolean): Promise<SafetyStatus> {
    const f: SafetyFile = {
      ...this.file(),
      adultTerms: adult ? TERMS_VERSION : null,
      declaredMinor: !adult,
    };
    writeJson(DEV_KEY, f);
    return Promise.resolve(statusOf(f));
  }
  logIncident(kind: IncidentKind): Promise<void> {
    const list = readJson<Incident[]>(DEV_LOG, []);
    list.push({ at: Math.floor(this.now().getTime() / 1000), kind });
    writeJson(DEV_LOG, list.slice(-MAX_INCIDENTS));
    return Promise.resolve();
  }
  incidents(): Promise<Incident[]> {
    return Promise.resolve(readJson<Incident[]>(DEV_LOG, []));
  }
  clearIncidents(): Promise<void> {
    try {
      localStorage.removeItem(DEV_LOG);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  }
}

let override: SafetyBackend | null = null;
let browser: BrowserSafety | null = null;

/** Tests can inject a fake backend. */
export function setSafetyBackendForTests(b: SafetyBackend | null): void {
  override = b;
  browser = null;
}

export function getSafety(): SafetyBackend {
  if (override) return override;
  if (isTauri()) return new TauriSafety();
  browser ??= new BrowserSafety();
  return browser;
}
