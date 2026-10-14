/**
 * The live whiteboard: what is written (with how much of it the pen has drawn), the marks, the
 * pen tip, the subtitle, the faces (board history) and the learner's own pen strokes.
 * Session state only; nothing here is saved or sent.
 */
import { create } from 'zustand';
import type { Box, Layout } from './layout';
import { emptyLayout } from './layout';
import type { Provenance } from './provenance';

export type MarkKind = 'underline' | 'circle' | 'box' | 'highlight' | 'strike' | 'arrow';

export interface BoardMark {
  key: string;
  kind: MarkKind;
  face: number;
  box: Box;
  /** Arrows: the box the arrow points to. */
  to?: Box;
  label?: string;
  seed: number;
  /** False until the stroke is being drawn (it then animates in). */
  shown: boolean;
}

export interface Stroke {
  face: number;
  points: [number, number][];
}

export type BoardStatus = 'idle' | 'preparing' | 'playing' | 'paused' | 'done';

/**
 * The teacher's pen tip: on one face, owned by one lesson run (lesson.ts). It is drawn only on
 * that face and only while that run is the board's run, so it never moves across another face.
 */
export interface TeacherPen {
  run: number;
  face: number;
  x: number;
  y: number;
}

interface BoardState {
  lessonId: string | null;
  /** The answer text taught so far (it grows when the learner asks for "Viết tiếp"). */
  lessonContent: string;
  layout: Layout;
  /** Units drawn per element id (characters; a formula counts 1, fractions are partial). */
  progress: Record<string, number>;
  erased: Record<string, boolean>;
  provenance: Record<string, Provenance>;
  marks: BoardMark[];
  /** Face shown on screen (the learner may browse other faces than the teacher's). */
  face: number;
  /** Face the teacher is on (where the pen is, or writes next). */
  teacherFace: number;
  /** The view follows the teacher; false while the learner looks at another face. */
  follow: boolean;
  /** Lesson run that owns the board (lesson.ts; 0 = none). */
  run: number;
  /** Element the camera keeps in view. */
  focus: string | null;
  pen: TeacherPen | null;
  subtitle: string;
  status: BoardStatus;
  /** Pen speed multiplier (1 = normal). */
  speed: number;
  /** The learner is drawing with their own pen. */
  penMode: boolean;
  /**
   * How much larger than "fit to width" the board is shown (1 = the whole width in view; see
   * ZOOMS). A view setting of this session only: kept across lessons, never saved.
   */
  zoom: number;
  strokes: Stroke[];
  set: (patch: BoardPatch) => void;
  setProgress: (id: string, value: number) => void;
  showMark: (key: string) => void;
  addStroke: (stroke: Stroke) => void;
  clearStrokes: (face: number) => void;
}

/** A change to the board's data (no actions). */
export type BoardPatch = Partial<
  Omit<BoardState, 'set' | 'setProgress' | 'showMark' | 'addStroke' | 'clearStrokes'>
>;

export const useBoardStore = create<BoardState>()((set, get) => ({
  lessonId: null,
  lessonContent: '',
  layout: emptyLayout(),
  progress: {},
  erased: {},
  provenance: {},
  marks: [],
  face: 0,
  teacherFace: 0,
  follow: true,
  run: 0,
  focus: null,
  pen: null,
  subtitle: '',
  status: 'idle',
  speed: 1,
  penMode: false,
  zoom: 1,
  strokes: [],
  set: (patch) => {
    set(patch);
  },
  setProgress: (id, value) => {
    set({ progress: { ...get().progress, [id]: value } });
  },
  showMark: (key) => {
    set({ marks: get().marks.map((m) => (m.key === key ? { ...m, shown: true } : m)) });
  },
  addStroke: (stroke) => {
    set({ strokes: [...get().strokes, stroke] });
  },
  clearStrokes: (face) => {
    set({ strokes: get().strokes.filter((s) => s.face !== face) });
  },
}));

export const PEN_SPEEDS = [0.75, 1, 1.5, 2] as const;

/** Board zoom steps (1 = fit to width). */
export const ZOOMS = [1, 1.25, 1.5, 2] as const;
export const MIN_ZOOM = ZOOMS[0];
export const MAX_ZOOM = ZOOMS[3];

/** The next zoom step in or out from `zoom` (stays at the ends). */
export function nextZoom(zoom: number, direction: 1 | -1): number {
  const steps: readonly number[] = ZOOMS;
  if (direction > 0) return steps.find((z) => z > zoom) ?? steps[steps.length - 1] ?? 1;
  return [...steps].reverse().find((z) => z < zoom) ?? steps[0] ?? 1;
}
