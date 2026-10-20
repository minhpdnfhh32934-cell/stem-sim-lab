/**
 * 3D or 2D, per biology lesson: the learner's choice is remembered on this device (a viewer
 * convenience, like a remembered tab — not part of a saved .stemsim file; mitosis keeps its own
 * `view3d` input in the division store). New lessons open in 3D.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Biology lessons whose 3D view uses this kit's 3D / 2D choice. Mitosis and meiosis keep theirs in
 * the division store (saved in .stemsim files): `view3d` and `meiosisView3d`; "ADN → mARN →
 * Protein" in the dogma store (`view3d`).
 */
export type Bio3DLesson =
  | 'pointMutation'
  | 'mendel'
  | 'hardyWeinberg'
  | 'drift'
  | 'logistic'
  | 'lotkaVolterra'
  | 'enzyme'
  | 'transport';

export const BIO3D_LESSONS: readonly Bio3DLesson[] = [
  'pointMutation',
  'mendel',
  'hardyWeinberg',
  'drift',
  'logistic',
  'lotkaVolterra',
  'enzyme',
  'transport',
];

interface Bio3DPrefs {
  /** Lessons the learner switched to the 2D picture. */
  off: Bio3DLesson[];
}

export const useBio3DPrefs = create<Bio3DPrefs>()(
  persist(() => ({ off: [] as Bio3DLesson[] }), {
    name: 'stemsim.bio3d',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    // A stored list from another version or a hand edit keeps only known lessons.
    merge: (persisted, current) => {
      const off = (persisted as Partial<Bio3DPrefs> | undefined)?.off;
      return {
        ...current,
        off: Array.isArray(off)
          ? off.filter((x): x is Bio3DLesson => (BIO3D_LESSONS as readonly string[]).includes(x))
          : [],
      };
    },
  }),
);

export function set3d(lesson: Bio3DLesson, on: boolean): void {
  useBio3DPrefs.setState((s) => ({
    off: on ? s.off.filter((x) => x !== lesson) : [...new Set([...s.off, lesson])],
  }));
}

export function use3dWanted(lesson: Bio3DLesson): boolean {
  return useBio3DPrefs((s) => !s.off.includes(lesson));
}

/**
 * The GPU context of a biology 3D view was lost (driver reset) or never started: every lesson
 * uses its 2D picture for the rest of the session (never retried, like mitosis).
 */
export const useBio3DHealth = create<{ failed: boolean }>()(() => ({ failed: false }));
