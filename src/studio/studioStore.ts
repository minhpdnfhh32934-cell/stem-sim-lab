import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StudioScenario, StudioSubject } from './scenario';
import {
  createSession,
  DEFAULT_TAB,
  migrateStudio,
  STUDIO_STORE_VERSION,
  type StudioSession,
  type StudioTab,
} from './session';

export interface StudioState {
  tab: StudioTab;
  /** scenario id → the learner's session (local only, never sent anywhere). */
  sessions: Record<string, StudioSession>;
  /** Scenario shown per subject tab, kept so a reload returns to the same lesson. */
  picked: Partial<Record<StudioSubject, string>>;
  setTab: (tab: StudioTab) => void;
  /** Shows a scenario in its subject's studio (the authoring preview uses this). */
  openScenario: (subject: StudioSubject, id: string) => void;
  /** Drops a scenario's session (after its authored version changed or was deleted). */
  forget: (scenarioId: string) => void;
  /** Applies a pure session change, starting the session when it does not exist yet. */
  update: (scenario: StudioScenario, change: (s: StudioSession) => StudioSession) => void;
  restart: (scenario: StudioScenario) => void;
  clearAll: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      tab: DEFAULT_TAB,
      sessions: {},
      picked: {},
      setTab: (tab) => {
        set({ tab });
      },
      openScenario: (subject, id) => {
        set((st) => ({ tab: subject, picked: { ...st.picked, [subject]: id } }));
      },
      forget: (scenarioId) => {
        set((st) => {
          if (!(scenarioId in st.sessions)) return st;
          return {
            sessions: Object.fromEntries(
              Object.entries(st.sessions).filter(([id]) => id !== scenarioId),
            ),
          };
        });
      },
      update: (scenario, change) => {
        set((st) => {
          const current = st.sessions[scenario.id] ?? createSession(scenario, Date.now());
          const next = change(current);
          if (next === current && st.sessions[scenario.id]) return st;
          return { sessions: { ...st.sessions, [scenario.id]: next } };
        });
      },
      restart: (scenario) => {
        set((st) => ({
          sessions: { ...st.sessions, [scenario.id]: createSession(scenario, Date.now()) },
        }));
      },
      clearAll: () => {
        set({ sessions: {} });
      },
    }),
    {
      name: 'stemsim.studio',
      version: STUDIO_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ tab, sessions, picked }) => ({ tab, sessions, picked }),
      migrate: (persisted, version) => migrateStudio(persisted, version),
      // Same-version data is validated too: a hand-edited or damaged record is dropped.
      merge: (persisted, current) => ({
        ...current,
        ...migrateStudio(persisted, STUDIO_STORE_VERSION),
      }),
    },
  ),
);

/** The session of a scenario, or null before the learner's first action. */
export function useStudioSession(scenarioId: string): StudioSession | null {
  return useStudioStore((s) => s.sessions[scenarioId] ?? null);
}
