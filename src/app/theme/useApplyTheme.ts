import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useEffectsOn } from '@/app/fx/fx';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore, type ResolvedTheme } from '@/app/settings/settingsStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeSystemTheme = (onChange: () => void) => subscribeQuery(DARK_QUERY, onChange);
const subscribeSystemMotion = (onChange: () => void) => subscribeQuery(REDUCE_QUERY, onChange);

function subscribeQuery(query: string, onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => {
    mql.removeEventListener('change', onChange);
  };
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/** The theme actually shown, after resolving "system". */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useSettingsStore((s) => s.theme);
  const system = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    (): ResolvedTheme => 'light',
  );
  return preference === 'system' ? system : preference;
}

/** Motion actually used, after resolving "system" (Windows' animation effects). */
export function useResolvedMotion(): 'reduce' | 'full' {
  const preference = useSettingsStore((s) => s.motion);
  const systemReduces = useSyncExternalStore(
    subscribeSystemMotion,
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
  if (preference !== 'system') return preference;
  return systemReduces ? 'reduce' : 'full';
}

/** Presentation mode enlarges everything on top of the user's font scale. */
const PRESENTATION_BOOST = 1.25;

/**
 * Reflects theme, motion (`data-motion`: the one source CSS and `prefersReducedMotion()` read),
 * the decorative effects (`data-fx`, src/app/fx), language and font scale onto <html> so CSS tokens can react. A layout
 * effect: it runs before every passive effect of the same commit, so views that read theme
 * tokens in their own effects (canvas, three.js palettes) already see the new theme's values.
 */
export function useApplyTheme(): ResolvedTheme {
  const theme = useResolvedTheme();
  const motion = useResolvedMotion();
  const locale = useSettingsStore((s) => s.locale);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const presentation = useLayoutStore((s) => s.presentation);
  const fx = useEffectsOn();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motion;
    root.dataset.fx = fx ? 'on' : 'off';
    root.lang = locale;
    root.style.setProperty(
      '--font-scale',
      String(fontScale * (presentation ? PRESENTATION_BOOST : 1)),
    );
  }, [theme, motion, fx, locale, fontScale, presentation]);

  return theme;
}
