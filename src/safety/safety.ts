import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Safety gates (PROMPT_PHAN_2 A3). The rules live in Rust (src-tauri/src/safety.rs) so the web
 * page cannot bypass them: the AI gateway itself refuses calls and keys while a gate is closed.
 * This file is the page's view of them, with a browser-only copy for UI development and tests.
 */

/** Bump together with `TERMS_VERSION` in safety.rs when the terms change. */
export const TERMS_VERSION = 1;

export interface SafetyStatus {
  edition: 'main' | 'pilot';
  termsVersion: number;
  /** The age question has been answered. */
  answered: boolean;
  /** AI features may be used (adult confirmed, or consent recorded for a minor). */
  aiAllowed: boolean;
  /** Under 18 (main: declared; pilot: from the birth year). */
  minor: boolean;
  consentDay: string | null;
  pinSet: boolean;
}

/** What is stored (`safety.json` in the desktop app). Never the PIN itself. */
export interface SafetyFile {
  adultTerms?: number | null;
  declaredMinor?: boolean;
  birthYear?: number | null;
  consentDay?: string | null;
  pinSalt?: string | null;
  pinHash?: string | null;
}

export type IncidentKind =
  'inputPersonalData' | 'inputUnsafe' | 'inputCrisis' | 'outputUnsafe' | 'userReport' | 'pinFailed';

/** One line of the incident log: the kind and the time (seconds since 1970) — no content. */
export interface Incident {
  at: number;
  kind: IncidentKind;
}

export type SafetyErrorCode = 'wrongPin' | 'locked' | 'notAllowed' | 'invalid' | 'storage';

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

/** Under 18 by birth year: someone born in `current - 18` may still be 17, so counted as minor. */
export function isMinorByYear(birthYear: number, currentYear: number): boolean {
  return currentYear - birthYear <= 18;
}

/** Same rules as `status_of` in safety.rs (both are tested with the same cases). */
export function statusOf(f: SafetyFile, pilot: boolean, year: number): SafetyStatus {
  const pinSet = !!f.pinHash;
  if (pilot) {
    const by = f.birthYear ?? null;
    const minor = by === null || isMinorByYear(by, year);
    return {
      edition: 'pilot',
      termsVersion: TERMS_VERSION,
      answered: by !== null,
      aiAllowed: by !== null && (!minor || !!f.consentDay),
      minor,
      consentDay: f.consentDay ?? null,
      pinSet,
    };
  }
  const adult = f.adultTerms === TERMS_VERSION && !f.declaredMinor;
  return {
    edition: 'main',
    termsVersion: TERMS_VERSION,
    answered: adult || !!f.declaredMinor,
    aiAllowed: adult,
    minor: !!f.declaredMinor,
    consentDay: null,
    pinSet,
  };
}

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

/** What the page can ask of the safety layer. */
export interface SafetyBackend {
  status(): Promise<SafetyStatus>;
  /** Main edition: "Tôi đủ 18 tuổi và đồng ý điều khoản" / "Tôi chưa đủ 18 tuổi". */
  answerAdult(adult: boolean): Promise<SafetyStatus>;
  /** Pilot edition. Changing an existing year needs the PIN or an open supervisor session. */
  setBirthYear(year: number, pin?: string): Promise<SafetyStatus>;
  /** Pilot edition. The first PIN needs nothing; changing it needs the current PIN or session. */
  setPin(newPin: string, currentPin?: string): Promise<SafetyStatus>;
  recordConsent(day: string, pin?: string): Promise<SafetyStatus>;
  withdrawConsent(pin?: string): Promise<SafetyStatus>;
  /** Opens the supervisor session; returns its remaining seconds. */
  unlock(pin: string): Promise<number>;
  unlockedSecs(): Promise<number>;
  lock(): Promise<void>;
  logIncident(kind: IncidentKind): Promise<void>;
  incidents(pin?: string): Promise<Incident[]>;
  clearIncidents(pin?: string): Promise<void>;
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
  setBirthYear = (year: number, pin?: string) =>
    call<SafetyStatus>('safety_set_birth_year', { year, pin: pin ?? null });
  setPin = (newPin: string, currentPin?: string) =>
    call<SafetyStatus>('safety_set_pin', { newPin, currentPin: currentPin ?? null });
  recordConsent = (day: string, pin?: string) =>
    call<SafetyStatus>('safety_record_consent', { day, pin: pin ?? null });
  withdrawConsent = (pin?: string) =>
    call<SafetyStatus>('safety_withdraw_consent', { pin: pin ?? null });
  unlock = (pin: string) => call<number>('safety_unlock', { pin });
  unlockedSecs = () => call<number>('safety_unlocked');
  lock = () => call<undefined>('safety_lock');
  logIncident = (kind: IncidentKind) => call<undefined>('safety_log_incident', { kind });
  incidents = (pin?: string) => call<Incident[]>('safety_incidents', { pin: pin ?? null });
  clearIncidents = (pin?: string) =>
    call<undefined>('safety_clear_incidents', { pin: pin ?? null });
}

const DEV_KEY = 'stemsim.safety';
const DEV_LOG = 'stemsim.incidents';
const UNLOCK_SECS = 600;
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

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Browser-only copy for UI development and end-to-end tests (`localStorage`). It follows the
 * same rules, but a web page can always be edited, so the shipped desktop app uses Rust.
 */
export class BrowserSafety implements SafetyBackend {
  private unlockedUntil = 0;
  constructor(
    private readonly pilot = __EDITION__ === 'pilot',
    private readonly now: () => Date = () => new Date(),
  ) {}

  private file(): SafetyFile {
    return readJson<SafetyFile>(DEV_KEY, {});
  }
  private save(f: SafetyFile): SafetyStatus {
    writeJson(DEV_KEY, f);
    return this.view(f);
  }
  private view(f: SafetyFile): SafetyStatus {
    return statusOf(f, this.pilot, this.now().getFullYear());
  }
  private async authorize(f: SafetyFile, pin?: string): Promise<void> {
    if (pin === undefined && this.unlockedSecsSync() > 0) return;
    if (!f.pinHash || !f.pinSalt || (await sha256Hex(`${f.pinSalt}:${pin ?? ''}`)) !== f.pinHash) {
      await this.logIncident('pinFailed');
      throw new SafetyError('wrongPin', '');
    }
  }
  private unlockedSecsSync(): number {
    return Math.max(0, Math.ceil((this.unlockedUntil - this.now().getTime()) / 1000));
  }

  status(): Promise<SafetyStatus> {
    return Promise.resolve(this.view(this.file()));
  }
  answerAdult(adult: boolean): Promise<SafetyStatus> {
    if (this.pilot) return Promise.reject(new SafetyError('notAllowed', 'main edition only'));
    const f = this.file();
    return Promise.resolve(
      this.save({ ...f, adultTerms: adult ? TERMS_VERSION : null, declaredMinor: !adult }),
    );
  }
  async setBirthYear(year: number, pin?: string): Promise<SafetyStatus> {
    if (!this.pilot) throw new SafetyError('notAllowed', 'pilot edition only');
    const cur = this.now().getFullYear();
    if (!Number.isInteger(year) || year < cur - 100 || year > cur - 5) {
      throw new SafetyError('invalid', 'birth year');
    }
    const f = this.file();
    if (f.birthYear !== undefined && f.birthYear !== null) await this.authorize(f, pin);
    return this.save({ ...f, birthYear: year });
  }
  async setPin(newPin: string, currentPin?: string): Promise<SafetyStatus> {
    if (!this.pilot) throw new SafetyError('notAllowed', 'pilot edition only');
    if (!validPin(newPin)) throw new SafetyError('invalid', 'PIN');
    const f = this.file();
    if (f.pinHash) await this.authorize(f, currentPin);
    const salt = await sha256Hex(`${Math.random()}:${Date.now()}`);
    const pinSalt = salt.slice(0, 32);
    const st = this.save({ ...f, pinSalt, pinHash: await sha256Hex(`${pinSalt}:${newPin}`) });
    this.unlockedUntil = this.now().getTime() + UNLOCK_SECS * 1000;
    return st;
  }
  async recordConsent(day: string, pin?: string): Promise<SafetyStatus> {
    if (!this.pilot) throw new SafetyError('notAllowed', 'pilot edition only');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SafetyError('invalid', 'day');
    const f = this.file();
    await this.authorize(f, pin);
    return this.save({ ...f, consentDay: day });
  }
  async withdrawConsent(pin?: string): Promise<SafetyStatus> {
    const f = this.file();
    await this.authorize(f, pin);
    return this.save({ ...f, consentDay: null });
  }
  async unlock(pin: string): Promise<number> {
    await this.authorize(this.file(), pin);
    this.unlockedUntil = this.now().getTime() + UNLOCK_SECS * 1000;
    return this.unlockedSecsSync();
  }
  unlockedSecs(): Promise<number> {
    return Promise.resolve(this.unlockedSecsSync());
  }
  lock(): Promise<void> {
    this.unlockedUntil = 0;
    return Promise.resolve();
  }
  logIncident(kind: IncidentKind): Promise<void> {
    const list = readJson<Incident[]>(DEV_LOG, []);
    list.push({ at: Math.floor(this.now().getTime() / 1000), kind });
    writeJson(DEV_LOG, list.slice(-MAX_INCIDENTS));
    return Promise.resolve();
  }
  async incidents(pin?: string): Promise<Incident[]> {
    if (this.pilot) await this.authorize(this.file(), pin);
    return readJson<Incident[]>(DEV_LOG, []);
  }
  async clearIncidents(pin?: string): Promise<void> {
    if (this.pilot) await this.authorize(this.file(), pin);
    try {
      localStorage.removeItem(DEV_LOG);
    } catch {
      /* ignore */
    }
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
