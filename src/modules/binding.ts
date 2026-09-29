import type { ModuleStateBinding } from './types';

/** The part of a Zustand store the binding needs. */
interface StoreLike<S> {
  getState(): S;
  setState(partial: Partial<S>): void;
  subscribe(listener: (state: S) => void): () => void;
}

function sameShape(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b);
  if (a === null || b === null) return a === b || typeof (a ?? b) === 'object';
  return typeof a === typeof b;
}

/**
 * Binds selected keys of a store as the module's persisted inputs. `apply` replaces the
 * plain `setState` when restoring needs side effects (e.g. rebuilding a simulation).
 */
export function bindStore<S extends object, K extends keyof S & string>(
  store: StoreLike<S>,
  keys: readonly K[],
  apply?: (patch: Partial<Pick<S, K>>) => void,
): ModuleStateBinding {
  const pick = (s: S): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = s[k];
    return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
  };
  return {
    get: () => pick(store.getState()),
    set: (state) => {
      const current = store.getState();
      const patch: Partial<Pick<S, K>> = {};
      for (const k of keys) {
        if (k in state && sameShape(state[k], current[k])) {
          (patch as Record<string, unknown>)[k] = state[k];
        }
      }
      if (apply) apply(patch);
      else store.setState(patch as Partial<S>);
    },
    subscribe: (listener) => {
      let last = JSON.stringify(pick(store.getState()));
      return store.subscribe((s) => {
        const now = JSON.stringify(pick(s));
        if (now !== last) {
          last = now;
          listener();
        }
      });
    },
  };
}

/** Several bindings saved side by side under their names (e.g. element + Bohr levels). */
export function combineBindings(parts: Record<string, ModuleStateBinding>): ModuleStateBinding {
  const entries = Object.entries(parts);
  return {
    get: () => Object.fromEntries(entries.map(([k, b]) => [k, b.get()])),
    set: (state) => {
      for (const [k, b] of entries) {
        const v = state[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) b.set(v as Record<string, unknown>);
      }
    },
    subscribe: (listener) => {
      const offs = entries.map(([, b]) => b.subscribe(listener));
      return () => {
        for (const off of offs) off();
      };
    },
  };
}
