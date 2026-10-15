/**
 * Local runtimes chosen in Settings (`stemsim.local-ai`, v1). Saved: the addresses the user added,
 * the runtime and model chosen for AI Teacher, and what was checked about each model on this
 * computer. Not saved: the result of the last detection (`status`, `detectedAt`) and the model
 * lists it led to (`lists`): they last for the session, so Settings shows them again when it is
 * reopened, with the time they were seen.
 *
 * Nothing is asked on load: the saved choice is restored as it was, and the runtime is first
 * contacted when the learner asks something or presses a button. Stored data is never trusted:
 * every address is checked again (loopback only) and anything invalid is dropped when the store
 * is read back, and the cleaned data is written back at once (an address off this computer does
 * not stay in storage until the next change).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { aiErrorKind, type AiErrorKind } from '../errorKind';
import { toAiError, type AiError } from '../types';
import { getLocalClient } from './client';
import { parseLoopback, tryLoopback } from './endpoint';
import { cleanId, positive } from './runtimes';
import {
  CAPABILITY_NAMES,
  UNVERIFIED,
  isCap,
  isRuntimeKind,
  type Capabilities,
  type LocalModels,
  type LocalSelection,
  type LocalTest,
  type ModelDetails,
  type RuntimeKind,
  type RuntimeProbe,
} from './types';

/** Most addresses the user may add (the three usual ones are always asked by detection). */
export const MAX_USER_ENDPOINTS = 10;
/** Most model checks kept (the oldest go first). */
export const MAX_CHECKS = 100;
/** Longest label kept. */
const MAX_LABEL = 120;

/** What was seen on this computer about one model. */
export interface ModelCheck {
  capabilities: Capabilities;
  contextLength: number | null;
  /** When it was checked (ms since 1970). */
  checkedAt: number;
  /** When "Kiểm tra trả lời" last got an answer from it (ms since 1970); absent: never. */
  testedAt?: number;
}

export interface LocalStatus {
  /** `detecting`: "Tìm trên máy này" or an address check is running. */
  phase: 'idle' | 'detecting' | 'done' | 'error';
  /** Every runtime answer of the last detection or address check. */
  probes: RuntimeProbe[];
  error: AiErrorKind | null;
}

/** The model list of a runtime found by the last detection. */
export type LocalModelList =
  | { phase: 'loading' }
  | { phase: 'done'; list: LocalModels }
  /** The error as the client threw it (the page words it). */
  | { phase: 'error'; error: AiError };

interface Persisted {
  /** Addresses the user added, normalised (`http://127.0.0.1:11435`). */
  userEndpoints: string[];
  selected: LocalSelection | null;
  /** By `checkKey(kind, baseUrl, model)`. */
  checks: Record<string, ModelCheck>;
}

export interface LocalAiState extends Persisted {
  /** Not saved. */
  status: LocalStatus;
  /** When the last detection finished (ms since 1970), or null. Not saved. */
  detectedAt: number | null;
  /** The model lists of the runtimes the last detection found, by address. Not saved. */
  lists: Record<string, LocalModelList>;
  /** Adds an address (normalised); throws `not-loopback` for an address off this computer. */
  addEndpoint: (input: string) => string;
  removeEndpoint: (baseUrl: string) => void;
  /** The runtime and model for AI Teacher, or null. */
  select: (selection: LocalSelection | null) => void;
  /** Keeps what the runtime said about a model (only values seen on this computer count). */
  recordCheck: (kind: RuntimeKind, baseUrl: string, details: ModelDetails, at?: number) => void;
  /**
   * Keeps the result of "Kiểm tra trả lời" when the model answered: the time, and streaming seen
   * on this computer when the answer came in more than one piece. A failed test changes nothing
   * saved (the page shows why).
   */
  recordTest: (
    kind: RuntimeKind,
    baseUrl: string,
    model: string,
    test: LocalTest,
    at?: number,
  ) => void;
  /**
   * "Khôi phục mặc định": forgets the added addresses, every check and the chosen runtime and
   * model (the chat engine is left as it is: a chosen local engine then sends nothing).
   */
  reset: () => void;
  /** "Tìm trên máy này": the three usual addresses plus the ones the user added. */
  detect: () => Promise<RuntimeProbe[]>;
  /**
   * The model list of each runtime the last detection found (one request each, never retried).
   * Results that arrive after a newer detection, list or `reset` are dropped.
   */
  loadLists: () => Promise<void>;
}

const IDLE: LocalStatus = { phase: 'idle', probes: [], error: null };

/**
 * Bumped by every detection, model listing and `reset`: an answer that arrives after a newer one
 * (or after a reset) is not shown.
 */
let generation = 0;

/** The key of a model's check. */
export function checkKey(kind: RuntimeKind, baseUrl: string, model: string): string {
  return `${kind}|${baseUrl}|${model}`;
}

/** The saved check of the chosen model, if any. */
export function checkFor(
  s: Pick<Persisted, 'checks'>,
  sel: LocalSelection | null,
): ModelCheck | null {
  if (!sel) return null;
  return s.checks[checkKey(sel.kind, sel.baseUrl, sel.model)] ?? null;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

function cleanLabel(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = Array.from(v.replace(CONTROL, '').trim()).slice(0, MAX_LABEL).join('');
  return s === '' ? fallback : s;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function sanitizeSelection(v: unknown): LocalSelection | null {
  const o = obj(v);
  const base = tryLoopback(o.baseUrl);
  const model = typeof o.model === 'string' ? cleanId(o.model) : null;
  if (!isRuntimeKind(o.kind) || !base || model === null) return null;
  return { kind: o.kind, baseUrl: base.base, model, label: cleanLabel(o.label, model) };
}

function sanitizeCheck(v: unknown): ModelCheck | null {
  const o = obj(v);
  const caps = obj(o.capabilities);
  if (!CAPABILITY_NAMES.every((n) => isCap(caps[n]))) return null;
  if (typeof o.checkedAt !== 'number' || !Number.isFinite(o.checkedAt)) return null;
  const capabilities = Object.fromEntries(
    CAPABILITY_NAMES.map((n) => [n, caps[n]]),
  ) as unknown as Capabilities;
  const tested =
    typeof o.testedAt === 'number' && Number.isFinite(o.testedAt) ? { testedAt: o.testedAt } : {};
  return {
    capabilities,
    contextLength: positive(o.contextLength),
    checkedAt: o.checkedAt,
    ...tested,
  };
}

/** The newest `MAX_CHECKS` checks. */
function newest(checks: [string, ModelCheck][]): Record<string, ModelCheck> {
  return Object.fromEntries(
    checks.sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, MAX_CHECKS),
  );
}

/**
 * The checks with `check` under `key`, replacing an older one (a check made again must win
 * whatever the times say: an older entry is never kept next to it).
 */
function withCheck(
  checks: Record<string, ModelCheck>,
  key: string,
  check: ModelCheck,
): Record<string, ModelCheck> {
  return newest([...Object.entries(checks).filter(([k]) => k !== key), [key, check]]);
}

/** Stored data checked again: anything invalid is dropped. */
export function sanitizeLocalAi(old: unknown): Persisted {
  const o = obj(old);
  const endpoints: string[] = [];
  for (const e of Array.isArray(o.userEndpoints) ? o.userEndpoints : []) {
    const base = tryLoopback(e);
    if (base && !endpoints.includes(base.base)) endpoints.push(base.base);
  }
  const checks: [string, ModelCheck][] = [];
  for (const [key, value] of Object.entries(obj(o.checks))) {
    const [kind, baseUrl, ...rest] = key.split('|');
    const base = tryLoopback(baseUrl);
    const model = cleanId(rest.join('|'));
    const check = sanitizeCheck(value);
    if (isRuntimeKind(kind) && base && model !== null && check) {
      checks.push([checkKey(kind, base.base, model), check]);
    }
  }
  return {
    userEndpoints: endpoints.slice(0, MAX_USER_ENDPOINTS),
    selected: sanitizeSelection(o.selected),
    checks: newest(checks),
  };
}

/** The store's key in localStorage, and its version. */
const STORE_NAME = 'stemsim.local-ai';
const STORE_VERSION = 1;

const storage = createJSONStorage<Persisted>(() => localStorage);

/** JSON with object keys sorted: the same data always gives the same text. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_key, value: unknown) =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
}

/** The cleaned data while the stored data held something invalid, until it is written back. */
let cleaned: Persisted | null = null;

export const useLocalAiStore = create<LocalAiState>()(
  persist(
    (set, get) => ({
      userEndpoints: [],
      selected: null,
      checks: {},
      status: IDLE,
      detectedAt: null,
      lists: {},
      addEndpoint: (input) => {
        // The same check and error (`not-loopback`) as every client call.
        const base = parseLoopback(input);
        const list = get().userEndpoints.filter((e) => e !== base.base);
        set({ userEndpoints: [base.base, ...list].slice(0, MAX_USER_ENDPOINTS) });
        return base.base;
      },
      removeEndpoint: (baseUrl) => {
        set({ userEndpoints: get().userEndpoints.filter((e) => e !== baseUrl) });
      },
      select: (selection) => {
        set({ selected: selection === null ? null : sanitizeSelection(selection) });
      },
      recordCheck: (kind, baseUrl, details, at = Date.now()) => {
        const base = tryLoopback(baseUrl);
        const model = cleanId(details.model);
        if (!base || model === null) return;
        const key = checkKey(kind, base.base, model);
        const before = get().checks[key];
        const check: ModelCheck = {
          capabilities: {
            ...details.capabilities,
            // Streaming seen by "Kiểm tra trả lời" stays seen.
            ...(before?.capabilities.streaming === 'yes' ? { streaming: 'yes' as const } : {}),
          },
          contextLength: positive(details.contextLength),
          checkedAt: at,
          ...(before?.testedAt !== undefined ? { testedAt: before.testedAt } : {}),
        };
        set({ checks: withCheck(get().checks, key, check) });
      },
      recordTest: (kind, baseUrl, model, test, at = Date.now()) => {
        const base = tryLoopback(baseUrl);
        const id = cleanId(model);
        if (!base || id === null || test.status !== 'ok') return;
        const key = checkKey(kind, base.base, id);
        const before = get().checks[key];
        const check: ModelCheck = {
          capabilities: {
            ...(before?.capabilities ?? UNVERIFIED),
            ...(test.streamed ? { streaming: 'yes' as const } : {}),
          },
          contextLength: before?.contextLength ?? null,
          checkedAt: before?.checkedAt ?? at,
          testedAt: at,
        };
        set({ checks: withCheck(get().checks, key, check) });
      },
      reset: () => {
        generation++;
        set({
          userEndpoints: [],
          selected: null,
          checks: {},
          status: IDLE,
          detectedAt: null,
          lists: {},
        });
      },
      detect: async () => {
        const id = ++generation;
        set({
          status: { phase: 'detecting', probes: [], error: null },
          detectedAt: null,
          lists: {},
        });
        try {
          const client = getLocalClient();
          const probes = [...(await client.detect())];
          const usual = new Set(probes.map((p) => p.baseUrl));
          for (const base of get().userEndpoints) {
            if (!usual.has(base)) probes.push(await client.probe(base));
          }
          // Undone by "Khôi phục mặc định" meanwhile: the page stays as it was reset.
          if (id === generation) {
            set({ status: { phase: 'done', probes, error: null }, detectedAt: Date.now() });
          }
          return probes;
        } catch (e) {
          if (id === generation) {
            set({ status: { phase: 'error', probes: [], error: aiErrorKind(e) } });
          }
          throw e;
        }
      },
      loadLists: async () => {
        const { status } = get();
        if (status.phase !== 'done') return;
        const id = ++generation;
        const found = status.probes.flatMap((p) =>
          p.status === 'found' && p.kind !== null ? [{ kind: p.kind, baseUrl: p.baseUrl }] : [],
        );
        set({
          lists: Object.fromEntries(found.map((p) => [p.baseUrl, { phase: 'loading' } as const])),
        });
        const client = getLocalClient();
        await Promise.all(
          found.map(async ({ kind, baseUrl }) => {
            let next: LocalModelList;
            try {
              next = { phase: 'done', list: await client.models(kind, baseUrl) };
            } catch (e) {
              next = { phase: 'error', error: toAiError(e) };
            }
            if (id === generation) set({ lists: { ...get().lists, [baseUrl]: next } });
          }),
        );
      },
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      storage,
      partialize: ({ userEndpoints, selected, checks }) => ({ userEndpoints, selected, checks }),
      migrate: (old) => sanitizeLocalAi(old),
      // Checked again on every load, not only when the version changes.
      merge: (persisted, current) => {
        const clean = sanitizeLocalAi(persisted);
        cleaned =
          persisted !== undefined && canonical(persisted) !== canonical(clean) ? clean : null;
        return { ...current, ...clean };
      },
      // What had to be cleaned is written back once, right after loading.
      onRehydrateStorage: () => (state) => {
        const clean = cleaned;
        cleaned = null;
        if (!state || !clean) return;
        try {
          void storage?.setItem(STORE_NAME, { state: clean, version: STORE_VERSION });
        } catch {
          // Storage unavailable: the cleaned data stays in memory, and is saved on the next change.
        }
      },
    },
  ),
);
