import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Grade } from '@/app/curriculum';
import type { Subject } from '@/app/workspaceStore';

/**
 * Learning levels (PROMPT_PHAN_2 A4.1): "Nền tảng" ≈ upper-secondary content (the MVP),
 * "Đại cương" = first-year university courses (later). Only AI Teacher reads it (its prompt hint);
 * the library is arranged by grade instead (`GradeChoice`).
 */
export type Level = 'foundation' | 'general';

/** The library's view: one grade's textbook chapters (pending a teacher) or every topic. */
export type GradeChoice = Grade | 'all';

export interface ProfileState {
  level: Level;
  /** Grade the learner studies or revises; only arranges the library and suggestions. */
  grade: GradeChoice;
  /** Subjects chosen during onboarding (used to order the suggestions on the home screen). */
  interests: Subject[];
  /** Grade + subject steps of the first-run onboarding are done. */
  onboarded: boolean;
  /** The "Kết nối AI" onboarding step (main edition) was shown (connected or "Để sau"). */
  connectSeen: boolean;
  /** Last opened topic, for "Tiếp tục bài đang học". */
  lastTopic: string | null;
  setGrade: (grade: GradeChoice) => void;
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
      grade: 'all',
      interests: [],
      onboarded: usedBefore(),
      connectSeen: usedBefore(),
      lastTopic: null,
      setGrade: (grade) => {
        set({ grade });
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v1 had no grade: people who used the app before keep seeing every topic.
      migrate: (old) => ({ grade: 'all', ...(old as object) }),
      partialize: ({ level, grade, interests, onboarded, connectSeen, lastTopic }) => ({
        level,
        grade,
        interests,
        onboarded,
        connectSeen,
        lastTopic,
      }),
    },
  ),
);
