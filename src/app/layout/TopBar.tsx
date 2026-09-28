import {
  Maximize2,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Redo2,
  Settings,
  Sparkles,
  Sun,
  Undo2,
  WifiOff,
} from 'lucide-react';
import { memo, useState, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { SettingsDialog } from '@/app/settings/SettingsDialog';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { SUBJECT_ICON } from '@/app/subjectIcons';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { Logo } from '@/ui/Logo';
import { useLayoutStore } from './layoutStore';

export const TopBar = memo(function TopBar() {
  const t = useT();
  const theme = useResolvedTheme();
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const layout = useLayoutStore(
    useShallow((s) => ({
      leftOpen: s.leftOpen,
      rightOpen: s.rightOpen,
      bottomOpen: s.bottomOpen,
      toggle: s.toggle,
      setPresentation: s.setPresentation,
    })),
  );
  const { setPresentation } = layout;
  const { subject, setSubject, problemText, setProblemText } = useWorkspaceStore(
    useShallow((s) => ({
      subject: s.subject,
      setSubject: s.setSubject,
      problemText: s.problemText,
      setProblemText: s.setProblemText,
    })),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const onProblemKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // Phase 3: send to the AI extraction pipeline.
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Logo />
        <div className="topbar__brand-text">
          <span className="topbar__name">{t('app.name')}</span>
          <span className="topbar__tagline">{t('app.tagline')}</span>
        </div>
      </div>

      <div className="subject-switch" role="radiogroup" aria-label={t('subjects.label')}>
        {SUBJECTS.map((s) => {
          const Icon = SUBJECT_ICON[s];
          const checked = s === subject;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={checked}
              className={cx('subject-switch__item', `subject--${s}`, checked && 'is-checked')}
              onClick={() => {
                setSubject(s);
              }}
            >
              <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{t(`subjects.${s}`)}</span>
            </button>
          );
        })}
      </div>

      <div className="problem-input">
        <label htmlFor="problem-text" className="sr-only">
          {t('topbar.problemLabel')}
        </label>
        <textarea
          id="problem-text"
          className="problem-input__field"
          rows={1}
          placeholder={t('topbar.problemPlaceholder')}
          value={problemText}
          spellCheck={false}
          onChange={(e) => {
            setProblemText(e.target.value);
          }}
          onKeyDown={onProblemKeyDown}
        />
        <button
          type="button"
          className="btn btn--accent problem-input__submit"
          disabled
          data-tip={t('topbar.analyzeUnavailable')}
        >
          <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>{t('topbar.analyze')}</span>
        </button>
      </div>

      <div className="topbar__actions">
        <span
          className="ai-status"
          data-status="offline"
          role="status"
          aria-label={`${t('ai.offline')}. ${t('ai.offlineHint')}`}
          data-tip={t('ai.offlineHint')}
          tabIndex={0}
        >
          <WifiOff size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="ai-status__label">{t('ai.offline')}</span>
        </span>
        <span className="topbar__divider" aria-hidden="true" />
        <IconButton
          icon={PanelLeft}
          label={t('layout.toggleLeft')}
          active={layout.leftOpen}
          onClick={() => {
            layout.toggle('left');
          }}
        />
        <IconButton
          icon={PanelBottom}
          label={t('layout.toggleBottom')}
          active={layout.bottomOpen}
          onClick={() => {
            layout.toggle('bottom');
          }}
        />
        <IconButton
          icon={PanelRight}
          label={t('layout.toggleRight')}
          active={layout.rightOpen}
          onClick={() => {
            layout.toggle('right');
          }}
        />
        <span className="topbar__divider" aria-hidden="true" />
        <IconButton icon={Undo2} label={t('topbar.undo')} disabled />
        <IconButton icon={Redo2} label={t('topbar.redo')} disabled />
        <IconButton
          icon={theme === 'dark' ? Sun : Moon}
          label={t('topbar.toggleTheme')}
          animation="spin"
          onClick={() => {
            toggleTheme(theme);
          }}
        />
        <IconButton
          icon={Maximize2}
          label={t('topbar.presentation')}
          onClick={() => {
            setPresentation(true);
          }}
        />
        <IconButton
          icon={Settings}
          label={t('topbar.settings')}
          animation="spin"
          onClick={() => {
            setSettingsOpen(true);
          }}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </header>
  );
});
