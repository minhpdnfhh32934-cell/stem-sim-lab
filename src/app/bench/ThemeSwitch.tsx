import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';

/**
 * Light / dark switch of the bench (uiverse JkHuger/old-falcon-20, MIT): on = dark. Choosing a
 * side leaves "Theo máy"; `system` adds the "Theo máy" toggle (Settings → Giao diện), which, pressed
 * again, keeps the theme on screen as the learner's own choice. Saved in `stemsim.settings`, the
 * key `theme-boot.js` reads before the app loads.
 */
export function ThemeSwitch({ system = false }: { system?: boolean }) {
  const t = useT();
  const preference = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const shown = useResolvedTheme();
  const following = preference === 'system';
  return (
    <div className="theme-switch">
      <label className="theme-switch__toggle">
        <input
          type="checkbox"
          role="switch"
          aria-label={t('bench.darkTheme')}
          checked={shown === 'dark'}
          onChange={(e) => {
            setTheme(e.target.checked ? 'dark' : 'light');
          }}
        />
        <span className="theme-switch__icon" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      </label>
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
