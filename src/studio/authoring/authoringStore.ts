import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StudioScenario, StudioSubject } from '../scenario';
import { AUTHORED_STORE_VERSION, migrateAuthored, upsert } from './collection';

export interface AuthoringState {
  /** Teacher-authored scenarios (local only; no accounts, classes or sync). */
  scenarios: StudioScenario[];
  /** Stores a verified scenario (see `service.ts`), replacing the one with the same id. */
  put: (s: StudioScenario) => void;
  remove: (id: string) => void;
}

export const useAuthoringStore = create<AuthoringState>()(
  persist(
    (set) => ({
      scenarios: [],
      put: (s) => {
        set((st) => ({ scenarios: upsert(st.scenarios, s) }));
      },
      remove: (id) => {
        set((st) => ({ scenarios: st.scenarios.filter((s) => s.id !== id) }));
      },
    }),
    {
      name: 'stemsim.studio.authored',
      version: AUTHORED_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ scenarios }) => ({ scenarios }),
      migrate: (persisted) => migrateAuthored(persisted),
      // Same-version data is validated too.
      merge: (persisted, current) => ({ ...current, ...migrateAuthored(persisted) }),
    },
  ),
);

export function useAuthoredFor(subject: StudioSubject): StudioScenario[] {
  const all = useAuthoringStore((s) => s.scenarios);
  return useMemo(() => all.filter((s) => s.subject === subject), [all, subject]);
}
