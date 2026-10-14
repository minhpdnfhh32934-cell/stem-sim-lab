/**
 * Local runtimes chosen in Settings (`stemsim.local-ai`, v1). Saved: the addresses the user added,
 * the runtime and model chosen for AI Teacher, and what was checked about each model on this
 * computer. Not saved: the result of the last detection (`status`).
 *
 * Nothing is asked on load: the saved choice is restored as it was, and the runtime is first
 * contacted when the learner asks something or presses a button. Stored data is never trusted:
 * every address is checked again (loopback only) and anything invalid is dropped when the store
 * is read back.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { aiErrorKind, type AiErrorKind } from '../errorKind';
import { getLocalClient } from './client';
import { parseLoopback, tryLoopback } from './endpoint';
import { cleanId, positive } from './runtimes';
import {
  CAPABILITY_NAMES,
  isCap,
  isRuntimeKind,
  type Capabilities,
  type LocalSelection,
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
}

export interface LocalStatus {
  /** `detecting`: "Tìm trên máy này" or an address check is running. */
  phase: 'idle' | 'detecting' | 'done' | 'error';
  /** Every runtime answer of the last detection or address check. */
  probes: RuntimeProbe[];
  error: AiErrorKind | null;
}

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
  /** Adds an address (normalised); throws `not-loopback` for an address off this computer. */
  addEndpoint: (input: string) => string;
  removeEndpoint: (baseUrl: string) => void;
  /** The runtime and model for AI Teacher, or null. */
  select: (selection: LocalSelection | null) => void;
  /** Keeps what the runtime said about a model (only values seen on this computer count). */
  recordCheck: (kind: RuntimeKind, baseUrl: string, details: ModelDetails, at?: number) => void;
  /** "Tìm trên máy này": the three usual addresses plus the ones the user added. */
  detect: () => Promise<RuntimeProbe[]>;
}

const IDLE: LocalStatus = { phase: 'idle', probes: [], error: null };

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
  return { capabilities, contextLength: positive(o.contextLength), checkedAt: o.checkedAt };
}

/** The newest `MAX_CHECKS` checks. */
function newest(checks: [string, ModelCheck][]): Record<string, ModelCheck> {
  return Object.fromEntries(
    checks.sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, MAX_CHECKS),
  );
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

export const useLocalAiStore = create<LocalAiState>()(
  persist(
    (set, get) => ({
      userEndpoints: [],
      selected: null,
      checks: {},
      status: IDLE,
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
        const check: ModelCheck = {
          capabilities: { ...details.capabilities },
          contextLength: positive(details.contextLength),
          checkedAt: at,
        };
        set({
          checks: newest([
            ...Object.entries(get().checks),
            [checkKey(kind, base.base, model), check],
          ]),
        });
      },
      detect: async () => {
        set({ status: { phase: 'detecting', probes: [], error: null } });
        try {
          const client = getLocalClient();
          const probes = [...(await client.detect())];
          const usual = new Set(probes.map((p) => p.baseUrl));
          for (const base of get().userEndpoints) {
            if (!usual.has(base)) probes.push(await client.probe(base));
          }
          set({ status: { phase: 'done', probes, error: null } });
          return probes;
        } catch (e) {
          set({ status: { phase: 'error', probes: [], error: aiErrorKind(e) } });
          throw e;
        }
      },
    }),
    {
      name: 'stemsim.local-ai',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ userEndpoints, selected, checks }) => ({ userEndpoints, selected, checks }),
      migrate: (old) => sanitizeLocalAi(old),
      // Checked again on every load, not only when the version changes.
      merge: (persisted, current) => ({ ...current, ...sanitizeLocalAi(persisted) }),
    },
  ),
);
