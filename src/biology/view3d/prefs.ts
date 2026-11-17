/**
 * 3D or 2D, per lesson using this kit: the learner's choice is remembered on this device (a viewer
 * convenience, like a remembered tab — not part of a saved .stemsim file; mitosis keeps its own
 * `view3d` input in the division store). Biology lessons open in 3D; the physics lessons that use
 * the kit (#302) open in 2D, whose picture also holds the lesson's chart, and offer 3D.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Biology lessons whose 3D view uses this kit's 3D / 2D choice. Mitosis and meiosis keep theirs in
 * the division store (saved in .stemsim files): `view3d` and `meiosisView3d`; "ADN → mARN →
 * Protein" and "Đột biến điểm" in the dogma store (`view3d`); "Di truyền Mendel", "Động học
 * enzyme" and "Khuếch tán & thẩm thấu" in their own stores (`view3d`).
 */
export type Bio3DLesson =
  | 'hardyWeinberg'
  | 'drift'
  | 'logistic'
  | 'lotkaVolterra'
  | 'cellToDna'
  | 'cellStructure'
  | 'biomolecules'
  | 'virusStructure'
  | 'magneticForce'
  | 'induction'
  | 'emWave'
  | 'electricField'
  | 'electricPotential'
  | 'electricCurrent'
  | 'capacitor'
  | 'interference'
  | 'travellingWave'
  | 'standingWave'
  | 'idealGas'
  | 'heatAndPhase'
  | 'nucleus'
  | 'radioactivity'
  | 'orbitals'
  | 'atomComposition'
  | 'freeFall'
  | 'horizontalProjectile'
  | 'obliqueProjectile'
  | 'uniformCircularMotion';

/** Lessons that open in 2D until the learner picks 3D (physics: the 2D picture has the chart). */
export const OPT_IN_3D: readonly Bio3DLesson[] = [
  'magneticForce',
  'induction',
  'emWave',
  'electricField',
  'electricPotential',
  'electricCurrent',
  'capacitor',
  'interference',
  'travellingWave',
  'standingWave',
  'idealGas',
  'heatAndPhase',
  'nucleus',
  'radioactivity',
  'orbitals',
  'atomComposition',
  'freeFall',
  'horizontalProjectile',
  'obliqueProjectile',
  'uniformCircularMotion',
];

export const BIO3D_LESSONS: readonly Bio3DLesson[] = [
  'hardyWeinberg',
  'drift',
  'logistic',
  'lotkaVolterra',
  'cellToDna',
  'cellStructure',
  'biomolecules',
  'virusStructure',
  ...OPT_IN_3D,
];

interface Bio3DPrefs {
  /** Lessons the learner switched to the 2D picture. */
  off: Bio3DLesson[];
  /** Opt-in lessons (`OPT_IN_3D`) the learner switched to 3D. */
  on: Bio3DLesson[];
}

const known = (list: unknown): Bio3DLesson[] =>
  Array.isArray(list)
    ? (list as unknown[]).filter(
        (x): x is Bio3DLesson =>
          typeof x === 'string' && (BIO3D_LESSONS as readonly string[]).includes(x),
      )
    : [];

export const useBio3DPrefs = create<Bio3DPrefs>()(
  persist(() => ({ off: [] as Bio3DLesson[], on: [] as Bio3DLesson[] }), {
    name: 'stemsim.bio3d',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    // A stored list from another version or a hand edit keeps only known lessons.
    merge: (persisted, current) => {
      const p = persisted as Partial<Bio3DPrefs> | undefined;
      return { ...current, off: known(p?.off), on: known(p?.on) };
    },
  }),
);

export function set3d(lesson: Bio3DLesson, on: boolean): void {
  if (OPT_IN_3D.includes(lesson)) {
    useBio3DPrefs.setState((s) => ({
      on: on ? [...new Set([...s.on, lesson])] : s.on.filter((x) => x !== lesson),
    }));
    return;
  }
  useBio3DPrefs.setState((s) => ({
    off: on ? s.off.filter((x) => x !== lesson) : [...new Set([...s.off, lesson])],
  }));
}

export function use3dWanted(lesson: Bio3DLesson): boolean {
  return useBio3DPrefs((s) =>
    OPT_IN_3D.includes(lesson) ? s.on.includes(lesson) : !s.off.includes(lesson),
  );
}

/**
 * The GPU context of a biology 3D view was lost (driver reset) or never started: every lesson
 * uses its 2D picture for the rest of the session (never retried, like mitosis).
 */
export const useBio3DHealth = create<{ failed: boolean }>()(() => ({ failed: false }));
