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
  /** Face shown on screen (the teacher's current face unless the learner browses history). */
  face: number;
  /** Element the camera keeps in view. */
  focus: string | null;
  pen: { x: number; y: number } | null;
  subtitle: string;
  status: BoardStatus;
  /** Pen speed multiplier (1 = normal). */
  speed: number;
  /** The learner is drawing with their own pen. */
  penMode: boolean;
  strokes: Stroke[];
  set: (patch: Partial<Omit<BoardState, 'set'>>) => void;
  setProgress: (id: string, value: number) => void;
  showMark: (key: string) => void;
  addStroke: (stroke: Stroke) => void;
  clearStrokes: (face: number) => void;
}

export const useBoardStore = create<BoardState>()((set, get) => ({
  lessonId: null,
  lessonContent: '',
  layout: emptyLayout(),
  progress: {},
  erased: {},
  provenance: {},
  marks: [],
  face: 0,
  focus: null,
  pen: null,
  subtitle: '',
  status: 'idle',
  speed: 1,
  penMode: false,
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
