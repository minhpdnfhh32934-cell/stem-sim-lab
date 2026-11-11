import { Moon, Sun } from 'lucide-react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { IconButton } from '@/ui/IconButton';

/**
 * Light / dark button of the bench (user decision 11/11/2026, #202: an icon button instead of the
 * uiverse switch chosen on 02/11): a moon while light, a sun while dark, pressed = dark. Choosing
 * a side leaves "Theo máy"; `system` adds the "Theo máy" toggle (Settings → Giao diện), which,
 * pressed again, keeps the theme on screen as the learner's own choice. Saved in
 * `stemsim.settings`, the key `theme-boot.js` reads before the app loads.
 */
export function ThemeSwitch({ system = false }: { system?: boolean }) {
  const t = useT();
  const preference = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const shown = useResolvedTheme();
  const following = preference === 'system';
  const dark = shown === 'dark';
  return (
    <div className="theme-switch">
      <IconButton
        icon={Moon}
        altIcon={Sun}
        showAlt={dark}
        label={t('bench.darkTheme')}
        // Pressed, not `active`: the state is the theme on screen, not a highlighted tool.
        aria-pressed={dark}
        onClick={() => {
          setTheme(dark ? 'light' : 'dark');
        }}
      />
      {system && (
        <button
          type="button"
          className="btn theme-switch__system"
          aria-pressed={following}
          onClick={() => {
            setTheme(following ? shown : 'system');
          }}
        >
          {t('bench.followSystem')}
        </button>
      )}
    </div>
  );
}
