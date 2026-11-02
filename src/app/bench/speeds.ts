import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type PlaybackSpeed } from '@/app/workspaceStore';

/** Basic mode's speed choices (user decision 2026-11-02; Advanced keeps the full list). */
export const BASIC_SPEEDS = [0.5, 1, 2] as const satisfies readonly PlaybackSpeed[];

/** Basic's steps: 0,5× · 1× · 2× and the open lesson's own speed (×1000, ×0,1…) when it has one. */
export function basicSteps(suggested: PlaybackSpeed | null): PlaybackSpeed[] {
  const steps: PlaybackSpeed[] = [...BASIC_SPEEDS];
  if (suggested !== null && !steps.includes(suggested)) steps.push(suggested);
  return steps.sort((a, b) => a - b);
}

/** The step closest to a speed chosen in Advanced (×10 → 2×, ×0,25 → 0,5×). */
export function nearestStep(speed: number, steps: readonly PlaybackSpeed[]): PlaybackSpeed {
  return steps.reduce((best, s) => (Math.abs(s - speed) < Math.abs(best - speed) ? s : best));
}

/** In Basic, a speed off the steps (one chosen in Advanced) lands on the nearest step. */
export function fitBasicSpeed(): void {
  if (useSettingsStore.getState().uiMode !== 'basic') return;
  const { speed, suggestedSpeed } = useWorkspaceStore.getState();
  const steps = basicSteps(suggestedSpeed);
  if (!steps.includes(speed)) useWorkspaceStore.setState({ speed: nearestStep(speed, steps) });
}

/**
 * Keeps Basic's speed on its steps whatever is on screen: on every switch of mode and every lesson
 * opened (its own speed changes the steps). The bench shell calls it once; returns the unsubscribe.
 */
export function keepBasicSpeedOnSteps(): () => void {
  const off = [
    useSettingsStore.subscribe((s, prev) => {
      if (s.uiMode !== prev.uiMode) fitBasicSpeed();
    }),
    useWorkspaceStore.subscribe((s, prev) => {
      if (s.suggestedSpeed !== prev.suggestedSpeed) fitBasicSpeed();
    }),
  ];
  fitBasicSpeed();
  return () => {
    for (const unsubscribe of off) unsubscribe();
  };
}
