import { useEffect, useSyncExternalStore } from 'react';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore, type ResolvedTheme } from '@/app/settings/settingsStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const mql = window.matchMedia(DARK_QUERY);
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

/** Presentation mode enlarges everything on top of the user's font scale. */
const PRESENTATION_BOOST = 1.25;

/** Reflects theme, language and font scale onto <html> so CSS tokens can react. */
export function useApplyTheme(): ResolvedTheme {
  const theme = useResolvedTheme();
  const locale = useSettingsStore((s) => s.locale);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const presentation = useLayoutStore((s) => s.presentation);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.lang = locale;
    root.style.setProperty(
      '--font-scale',
      String(fontScale * (presentation ? PRESENTATION_BOOST : 1)),
    );
  }, [theme, locale, fontScale, presentation]);

  return theme;
}
