import { create } from 'zustand';

export type ElementsView = 'elements' | 'water';

/** Water calculator ranges: mass in g, temperature rise in °C. */
export const WATER_LIMITS = {
  mass: [1, 1000, 1],
  dT: [1, 50, 1],
} as const satisfies Record<string, readonly [number, number, number]>;

export interface ElementsState {
  view: ElementsView;
  /** The slice whose card is open (figure 4.1 id), or null. */
  selected: string | null;
  mass: number;
  dT: number;
}

export const useElements = create<ElementsState>()(() => ({
  view: 'elements',
  selected: 'C',
  mass: 100,
  dT: 1,
}));

const inRange = (v: unknown, [lo, hi]: readonly [number, number, number]) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Restores a file's (untrusted) inputs; values the controls cannot show are dropped. */
export function restoreElements(patch: Partial<Record<keyof ElementsState, unknown>>): void {
  const clean: Partial<ElementsState> = {};
  if (patch.view === 'elements' || patch.view === 'water') clean.view = patch.view;
  if (inRange(patch.mass, WATER_LIMITS.mass)) clean.mass = patch.mass as number;
  if (inRange(patch.dT, WATER_LIMITS.dT)) clean.dT = patch.dT as number;
  useElements.setState(clean);
}
