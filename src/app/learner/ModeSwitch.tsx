import { useId } from 'react';
import { useT } from '@/app/i18n';
import { useSettingsStore, type UiMode } from '@/app/settings/settingsStore';
import { cx } from '@/ui/cx';
import './learner.css';

const MODES: UiMode[] = ['basic', 'advanced'];

/** "Cơ bản · Nâng cao" (PROMPT_PHAN_2 A4.1). `compact`: the small version in panel headers. */
export function ModeSwitch({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const id = useId();
  const mode = useSettingsStore((s) => s.uiMode);
  const setMode = useSettingsStore((s) => s.setUiMode);
  return (
    <div className={cx('mode-switch', compact ? 'mode-switch--compact' : 'settings-row')}>
      <span id={id} className={compact ? 'sr-only' : undefined}>
        {t('mode.label')}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className="segmented__item"
            data-tip={t(m === 'basic' ? 'mode.basicHint' : 'mode.advancedHint')}
            data-tip-side="bottom"
            onClick={() => {
              setMode(m);
            }}
          >
            {t(`mode.${m}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
