import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import './fx.css';

/**
 * The app's decorative effects, after the SimLab 3D game's (user request 19/11/2026): the
 * opening (`Intro`) and the launch page's drift and reveals (fx.css). The screen-change circle
 * with its orbit ring was removed on the user's request (19/11/2026): screens change at once. None of them shows or changes a value; the
 * "Chuyển động" setting (`data-motion`) shortens them, and they are off on the Low quality tier.
 * Docs: docs/EFFECTS.md.
 */

/** `?fx=1` turns them on in an automated browser (tests/e2e/fx.spec.ts). */
const forced =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx') === '1';

/**
 * Off in unit tests and in automated browsers (specs would wait on their timing, and axe would
 * read half-faded text): the same rule as the game's opening.
 */
function automationAllows(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  return forced || typeof navigator === 'undefined' || !navigator.webdriver;
}

/** True when the effects may play now. */
export function effectsOn(): boolean {
  return automationAllows() && effectiveTier(usePerfStore.getState()) !== 'low';
}

/** `effectsOn()` for a component (follows the quality tier); `useApplyTheme` sets `data-fx`. */
export function useEffectsOn(): boolean {
  const low = usePerfStore((s) => effectiveTier(s) === 'low');
  return automationAllows() && !low;
}

export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduce';
}
