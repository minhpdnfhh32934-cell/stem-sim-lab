import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Subject } from '@/app/workspaceStore';

/**
 * Learning levels (PROMPT_PHAN_2 A4.1): "Nền tảng" ≈ upper-secondary content (the MVP),
 * "Đại cương" = first-year university courses (later). Which topic belongs to which level is a
 * structural choice; mapping topics to a curriculum (grade, lesson) is left to teachers
 * (`src/app/levels.ts`, review_status "pending").
 */
export type Level = 'foundation' | 'general';

export interface ProfileState {
  level: Level;
  /** Subjects chosen during onboarding (used to order the suggestions on the home screen). */
  interests: Subject[];
  /** Level + subject steps of the first-run onboarding are done. */
  onboarded: boolean;
  /** The "Kết nối AI" onboarding step (main edition) was shown (connected or "Để sau"). */
  connectSeen: boolean;
  /** Last opened topic, for "Tiếp tục bài đang học". */
  lastTopic: string | null;
  setLevel: (level: Level) => void;
  toggleInterest: (subject: Subject) => void;
  finishProfile: () => void;
  finishConnect: () => void;
  setLastTopic: (topic: string) => void;
}

/** People who used the app before onboarding existed (tour already done) skip it. */
function usedBefore(): boolean {
  try {
    return localStorage.getItem('stemsim.tourDone') === '1';
  } catch {
    return false;
  }
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      level: 'foundation',
      interests: [],
      onboarded: usedBefore(),
      connectSeen: usedBefore(),
      lastTopic: null,
      setLevel: (level) => {
        set({ level });
      },
      toggleInterest: (subject) => {
        set((s) => ({
          interests: s.interests.includes(subject)
            ? s.interests.filter((x) => x !== subject)
            : [...s.interests, subject],
        }));
      },
      finishProfile: () => {
        set({ onboarded: true });
      },
      finishConnect: () => {
        set({ connectSeen: true });
      },
      setLastTopic: (lastTopic) => {
        set({ lastTopic });
      },
    }),
    {
      name: 'stemsim.profile',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ level, interests, onboarded, connectSeen, lastTopic }) => ({
        level,
        interests,
        onboarded,
        connectSeen,
        lastTopic,
      }),
    },
  ),
);
