import { Gauge, Keyboard, LayoutPanelLeft, Orbit, Palette, Type } from 'lucide-react';
import { LOCALES, formatNumber, useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { ModeSwitch } from '@/app/learner/ModeSwitch';
import { SHORTCUTS, formatChord, type ShortcutAction } from '@/app/shortcuts/shortcuts';
import { GRAVITY_PRESETS } from '@/core/constants';
import { usePerfStore } from '@/perf/perfStore';
import type { QualityPreference } from '@/perf/tiers';
import { remeasure } from '@/perf/useStartupBenchmark';
import { FONT_SCALES, useSettingsStore, type ThemePreference } from './settingsStore';

const QUALITY: QualityPreference[] = ['auto', 'low', 'medium', 'high'];

const THEMES: {
  id: ThemePreference;
  key: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark';
}[] = [
  { id: 'system', key: 'settings.themeSystem' },
  { id: 'light', key: 'settings.themeLight' },
  { id: 'dark', key: 'settings.themeDark' },
];

/** Shortcuts listed in Settings (tool keys are shown in tool tooltips instead). */
const LISTED = [
  'playPause',
  'reset',
  'step',
  'undo',
  'redo',
  'save',
  'open',
  'presentation',
  'fontLarger',
  'fontSmaller',
  'commandPalette',
] as const satisfies readonly ShortcutAction[];

/** "Giao diện": Basic/Advanced, theme, text size, language, layout. */
export function AppearanceSettings() {
  const t = useT();
  const settings = useSettingsStore();
  const resetLayout = useLayoutStore((s) => s.resetLayout);

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Palette size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('settings.lookCard')}
        </legend>
        <ModeSwitch />
        <div className="settings-row">
          <span id="theme-label">{t('settings.theme')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                role="radio"
                aria-checked={settings.theme === th.id}
                className="segmented__item"
                onClick={() => {
                  settings.setTheme(th.id);
                }}
              >
                {t(th.key)}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Type size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('settings.textCard')}
        </legend>
        <div className="settings-row">
          <span id="font-label">{t('settings.fontSize')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="font-label">
            {FONT_SCALES.map((scale) => (
              <button
                key={scale}
                type="button"
                role="radio"
                aria-checked={settings.fontScale === scale}
                className="segmented__item mono"
                onClick={() => {
                  settings.setFontScale(scale);
                }}
              >
                {formatNumber(settings.locale, scale, { style: 'percent' })}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <span id="lang-label">{t('settings.language')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="lang-label">
            {LOCALES.map((loc) => (
              <button
                key={loc}
                type="button"
                role="radio"
                aria-checked={settings.locale === loc}
                className="segmented__item"
                onClick={() => {
                  settings.setLocale(loc);
                }}
              >
                {t(`languages.${loc}`)}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <LayoutPanelLeft size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('settings.layout')}
        </legend>
        <p className="muted">{t('settings.layoutHint')}</p>
        <div className="settings-actions">
          <button type="button" className="btn" onClick={resetLayout}>
            {t('settings.resetLayout')}
          </button>
        </div>
      </fieldset>
    </>
  );
}

/** "Mô phỏng & hiệu năng": display quality, machine benchmark, default gravity. */
export function SimulationSettings() {
  const t = useT();
  const settings = useSettingsStore();
  const perf = usePerfStore();

  return (
    <>
      <fieldset className="settings-group">
        <legend>
          <Gauge size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('settings.quality')}
        </legend>
        <div className="settings-row">
          <span id="quality-label">{t('settings.quality')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="quality-label">
            {QUALITY.map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={perf.preference === q}
                className="segmented__item"
                onClick={() => {
                  perf.setPreference(q);
                }}
              >
                {q === 'auto' && perf.benchmark
                  ? t('quality.autoWith', { tier: t(`quality.${perf.benchmark.tier}`) })
                  : t(`quality.${q}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">{t('settings.qualityHint')}</p>
        <div className="settings-row">
          <span className="muted mono">
            {perf.benchmarking
              ? t('quality.measuring')
              : perf.benchmark
                ? t('quality.benchmarkSummary', {
                    cpu: perf.benchmark.cpuScore,
                    draw: perf.benchmark.drawScore,
                    webgl: perf.benchmark.webgl2 ? t('quality.yes') : t('quality.no'),
                    cores: perf.benchmark.cores,
                  })
                : ''}
          </span>
          <button
            type="button"
            className="btn"
            disabled={perf.benchmarking}
            onClick={() => {
              void remeasure();
            }}
          >
            {t('quality.remeasure')}
          </button>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>
          <Orbit size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('physicsSettings.title')}
        </legend>
        <div className="settings-row">
          <span id="gravity-label">{t('physicsSettings.defaultGravity')}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="gravity-label">
            {GRAVITY_PRESETS.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={settings.defaultGravity === g}
                className="segmented__item mono"
                onClick={() => {
                  settings.setDefaultGravity(g);
                }}
              >
                {formatNumber(settings.locale, g)}
                {g === 9.80665 ? ` (${t('physicsSettings.standard')})` : ''}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">{t('physicsSettings.defaultGravityHint')}</p>
      </fieldset>
    </>
  );
}

/** "Phím tắt": the main keyboard shortcuts. */
export function ShortcutSettings() {
  const t = useT();
  return (
    <fieldset className="settings-group">
      <legend>
        <Keyboard size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('settings.shortcuts')}
      </legend>
      <dl className="shortcut-list">
        {LISTED.map((action) => {
          const def = SHORTCUTS.find((s) => s.action === action);
          if (!def) return null;
          return (
            <div key={action} className="shortcut-list__row">
              <dt>{t(`shortcuts.${action}`)}</dt>
              <dd>
                {def.chords.slice(0, 2).map((c) => (
                  <kbd key={formatChord(c)}>{formatChord(c)}</kbd>
                ))}
              </dd>
            </div>
          );
        })}
        <div className="shortcut-list__row">
          <dt>{t('shortcuts.analyze')}</dt>
          <dd>
            <kbd>Ctrl + Enter</kbd>
          </dd>
        </div>
      </dl>
    </fieldset>
  );
}
