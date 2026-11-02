import type { PlaybackSpeed } from '@/app/workspaceStore';

/** Basic mode's speed choices (user decision 2026-11-02; Advanced keeps the full list). */
export const BASIC_SPEEDS = [0.5, 1, 2] as const satisfies readonly PlaybackSpeed[];

/** The Basic step closest to a speed chosen in Advanced (×10 → 2×, ×0,25 → 0,5×). */
export function nearestBasicSpeed(speed: number): PlaybackSpeed {
  return BASIC_SPEEDS.reduce((best, s) =>
    Math.abs(s - speed) < Math.abs(best - speed) ? s : best,
  );
}
