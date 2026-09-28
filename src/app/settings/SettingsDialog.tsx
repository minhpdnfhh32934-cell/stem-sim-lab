import { Bot, Keyboard, LayoutPanelLeft, Palette, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { LOCALES, formatNumber, useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { SHORTCUTS, formatChord, type ShortcutAction } from '@/app/shortcuts/shortcuts';
import { IconButton } from '@/ui/IconButton';
import { FONT_SCALES, useSettingsStore, type ThemePreference } from './settingsStore';

const THEMES: {
  id: ThemePreference;
  key: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark';
}[] = [
  { id: 'system', key: 'settings.themeSystem' },
  { id: 'light', key: 'settings.themeLight' },
  { id: 'dark', key: 'settings.themeDark' },
];

/** Shortcuts listed in the dialog (tool keys are shown in tool tooltips instead). */
const LISTED = [
  'playPause',
  'reset',
  'step',
  'undo',
  'redo',
  'toggleLeft',
  'toggleRight',
  'toggleBottom',
  'presentation',
  'fontLarger',
  'fontSmaller',
] as const satisfies readonly ShortcutAction[];

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const settings = useSettingsStore();
  const resetLayout = useLayoutStore((s) => s.resetLayout);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="dialog__header">
        <h2 id="settings-title">{t('settings.title')}</h2>
        <IconButton icon={X} label={t('settings.close')} onClick={onClose} tooltipSide="left" />
      </header>

      <div className="dialog__body">
        <fieldset className="settings-group">
          <legend>
            <Palette size={15} strokeWidth={1.75} aria-hidden="true" />
            {t('settings.appearance')}
          </legend>

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
          <button type="button" className="btn" onClick={resetLayout}>
            {t('settings.resetLayout')}
          </button>
        </fieldset>

        <fieldset className="settings-group">
          <legend>
            <Bot size={15} strokeWidth={1.75} aria-hidden="true" />
            {t('settings.ai')}
          </legend>
          <p className="muted">{t('settings.aiLater')}</p>
        </fieldset>

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
      </div>
    </dialog>
  );
}
