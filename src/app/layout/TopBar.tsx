import {
  Cloud,
  CloudOff,
  KeyRound,
  LoaderCircle,
  Maximize2,
  PencilRuler,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Redo2,
  Settings,
  Sparkles,
  Sun,
  Undo2,
  X,
} from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { analyze, cancelAnalyze, openManual, useAnalyzeStore } from '@/app/ai/analyze';
import { useT } from '@/app/i18n';
import { DEFAULT_MODELS, useAiStore } from '@/ai/aiStore';
import { FileMenu } from '@/app/project/FileMenu';
import { redo, undo, useUndoStore } from '@/app/project/undo';
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
  const settingsOpen = useWorkspaceStore((s) => s.settingsOpen);
  const setSettingsOpen = useWorkspaceStore((s) => s.setSettingsOpen);
  const provider = useAiStore((s) => s.provider);
  const running = useAnalyzeStore((s) => s.phase === 'running');
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);
  const stage = useAnalyzeStore((s) => s.stage);
  const aiOff = provider === 'off';
  const canAnalyze = !aiOff && problemText.trim().length > 0 && !running;

  const onProblemKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canAnalyze) void analyze(problemText);
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

      <div
        className="subject-switch"
        role="radiogroup"
        aria-label={t('subjects.label')}
        data-tour="subjects"
      >
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

      <div className="problem-input" data-tour="problem">
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
        {running ? (
          <>
            <span
              className="btn btn--accent problem-input__submit"
              role="status"
              aria-live="polite"
            >
              <LoaderCircle className="spin" size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{stage ? t(`analyze.stage.${stage}`) : t('topbar.analyze')}</span>
            </span>
            <IconButton
              icon={X}
              label={t('topbar.cancelAnalyze')}
              onClick={() => {
                cancelAnalyze();
              }}
            />
          </>
        ) : (
          <button
            type="button"
            className="btn btn--accent problem-input__submit"
            aria-label={t('topbar.analyze')}
            disabled={!canAnalyze}
            data-tip={
              aiOff
                ? t('topbar.analyzeAiOff')
                : !problemText.trim()
                  ? t('topbar.analyzeNeedsText')
                  : undefined
            }
            onClick={() => {
              void analyze(problemText);
            }}
          >
            <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('topbar.analyze')}</span>
          </button>
        )}
        <IconButton
          icon={PencilRuler}
          label={t('topbar.manual')}
          onClick={() => {
            void openManual();
          }}
        />
      </div>

      <div className="topbar__actions">
        <AiStatusPill
          onClick={() => {
            setSettingsOpen(true);
          }}
        />
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
        <IconButton
          icon={Undo2}
          label={t('topbar.undo')}
          disabled={!canUndo}
          onClick={() => {
            undo();
          }}
        />
        <IconButton
          icon={Redo2}
          label={t('topbar.redo')}
          disabled={!canRedo}
          onClick={() => {
            redo();
          }}
        />
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
        <FileMenu />
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

const PROVIDER_NAME = { gemini: 'Gemini', claude: 'Claude' } as const;

/** Connection state of the AI (click → AI settings). */
function AiStatusPill({ onClick }: { onClick: () => void }) {
  const t = useT();
  const ai = useAiStore(
    useShallow((s) => ({ provider: s.provider, status: s.status, models: s.models })),
  );
  let kind: 'offline' | 'cloud' = 'offline';
  let label = t('ai.offline');
  let hint = t('ai.offHint');
  let Icon = CloudOff;
  if (ai.provider === 'off') {
    label = t('ai.off');
  } else if (ai.status === 'noKey' || ai.status === 'badKey') {
    label = t('ai.noKey');
    Icon = KeyRound;
    hint = t(ai.status === 'noKey' ? 'ai.noKeyHint' : 'ai.badKeyHint', {
      provider: PROVIDER_NAME[ai.provider],
    });
  } else if (ai.status === 'ok') {
    kind = 'cloud';
    label = t('ai.cloud');
    Icon = Cloud;
    hint = t('ai.cloudHint', {
      provider: PROVIDER_NAME[ai.provider],
      model: ai.models[ai.provider] || DEFAULT_MODELS[ai.provider],
    });
  }
  return (
    <button
      type="button"
      className="ai-status"
      data-status={kind}
      aria-label={`${label}. ${hint}`}
      data-tip={hint}
      onClick={onClick}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="ai-status__label">{label}</span>
    </button>
  );
}
