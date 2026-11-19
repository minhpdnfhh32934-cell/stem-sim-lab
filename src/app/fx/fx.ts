import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import './fx.css';

/**
 * The app's decorative effects, after the SimLab 3D game's (user request 19/11/2026): the
 * opening (`Intro`), the screen change (`screenChange`, the portal ring `ScreenPortal`) and the
 * launch page's drift and reveals (fx.css). None of them shows or changes a value; the
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

/** The ring that flies out with a screen change: a new key per change (`ScreenPortal`). */
export const usePortalStore = create<{ key: number }>()(() => ({ key: 0 }));

/** Where the last press was, so the new screen opens from there. */
const lastPress = { x: 0, y: 0, at: -Infinity };
/** A press older than this (ms) is not the one that asked for the change (a shortcut, Ctrl+K). */
const PRESS_FRESH_MS = 1500;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPress.x = e.clientX;
      lastPress.y = e.clientY;
      lastPress.at = performance.now();
    },
    { capture: true, passive: true },
  );
}

/** The circle's centre (the press, else the focused control, else the middle) and its radius. */
export function transitionOrigin(
  width: number,
  height: number,
  press: { x: number; y: number } | null,
  focused: DOMRect | null,
): { x: number; y: number; r: number } {
  const x = press ? press.x : focused ? focused.left + focused.width / 2 : width / 2;
  const y = press ? press.y : focused ? focused.top + focused.height / 2 : height / 2;
  // Far enough to reach the farthest corner.
  const r = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  return { x, y, r };
}

function setOrigin(): void {
  const fresh = performance.now() - lastPress.at < PRESS_FRESH_MS;
  const active = document.activeElement;
  const focused = active instanceof HTMLElement && active !== document.body ? active : null;
  const o = transitionOrigin(
    window.innerWidth,
    window.innerHeight,
    fresh ? lastPress : null,
    focused?.getBoundingClientRect() ?? null,
  );
  const style = document.documentElement.style;
  style.setProperty('--fx-x', `${Math.round(o.x)}px`);
  style.setProperty('--fx-y', `${Math.round(o.y)}px`);
  style.setProperty('--fx-r', `${Math.ceil(o.r)}px`);
}

let updating = false;

/**
 * Runs a change of screen (launch page ↔ lab ↔ AI Teacher, a topic opening) as a view
 * transition: the old screen recedes and the new one opens as a circle from where the learner
 * pressed, with the logo's orbit flying out (fx.css). With reduced motion it is a short
 * cross-fade. Nested calls, tests, the Low tier and a browser without view transitions just
 * run `update`, right away. Otherwise `update` runs one frame later (after the browser keeps a
 * picture of the old screen), all of it at once, so no reader sees half a change.
 */
export function screenChange(update: () => void): Promise<void> {
  if (updating || typeof document.startViewTransition !== 'function' || !effectsOn()) {
    update();
    return Promise.resolve();
  }
  setOrigin();
  const ring = !reducedMotion();
  const transition = document.startViewTransition(() => {
    updating = true;
    try {
      flushSync(() => {
        update();
        if (ring) usePortalStore.setState((s) => ({ key: s.key + 1 }));
      });
    } finally {
      updating = false;
    }
  });
  // A skipped transition (window hidden, another change) still ran `update`: nothing to report.
  transition.ready.catch(() => undefined);
  transition.finished.catch(() => undefined);
  return transition.updateCallbackDone;
}
