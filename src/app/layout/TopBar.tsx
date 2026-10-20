import {
  Camera,
  House,
  LoaderCircle,
  Maximize2,
  PencilRuler,
  Moon,
  Redo2,
  Search,
  Settings,
  Sparkles,
  Sun,
  Undo2,
  X,
} from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AiStatusPill } from '@/app/ai/AiStatusPill';
import { cancelAnalyze, openManual, useAnalyzeStore } from '@/app/ai/analyze';
import { submitProblem } from '@/app/ai/submit';
import { usePhotoCapture } from '@/app/ai/usePhotoCapture';
import { useT } from '@/app/i18n';
import { goHome, useIsHome, useIsLanding, useIsStudio, useIsTeacher } from '@/app/topics';
import { useAiStore } from '@/ai/aiStore';
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
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { useCommandPalette } from '@/app/command/commands';
import { useLayoutStore } from './layoutStore';

export const TopBar = memo(function TopBar() {
  const t = useT();
  const theme = useResolvedTheme();
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const setPresentation = useLayoutStore((s) => s.setPresentation);
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
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const provider = useAiStore((s) => s.provider);
  const running = useAnalyzeStore((s) => s.phase === 'running');
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);
  const stage = useAnalyzeStore((s) => s.stage);
  const aiOff = provider === 'off';
  // The problem is read on this computer (Gemma when ready or chosen, or the runtime the learner
  // chose): no API key is needed and an AI provider set to "off" does not block it.
  const onDevice = useAnalysisEngine() !== 'cloud';
  // No key yet: the AI button leads to "Kết nối AI" instead (PROMPT_PHAN_2 A2).
  const needsKey = useAiStore((s) => s.status === 'noKey') && !aiOff && !onDevice;
  const canAnalyze = (!aiOff || onDevice) && problemText.trim().length > 0 && !running;
  const {
    cameraAllowed,
    cameraOpen,
    cameraBusy,
    cameraError,
    cameraErrorSection,
    openCamera,
    closeCamera,
    onPhoto,
    CameraDialog,
  } = usePhotoCapture();

  const teacher = useIsTeacher();
  const studio = useIsStudio();
  const landing = useIsLanding();
  const home = (useIsHome() || landing) && !teacher;

  const onProblemKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submitProblem(problemText);
    }
  };

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand"
        aria-label={t('home.goHome')}
        data-tip={t('home.goHome')}
        data-tip-side="bottom"
        aria-current={home ? 'page' : undefined}
        onClick={goHome}
      >
        <Logo />
        <span className="topbar__brand-text">
          <span className="topbar__name">{t('app.name')}</span>
          <span className="topbar__tagline">{t('app.tagline')}</span>
        </span>
        <House className="topbar__home-icon" size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Subjects and undo/redo belong to the lab; the AI Teacher page does not use them. */}
      {!landing && !teacher && !studio && (
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
      )}

      {/* On the home screen the big problem box is the main action; no second one up here. */}
      {home || teacher || studio ? (
        <div className="topbar__spacer" />
      ) : (
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
              disabled={!canAnalyze && !needsKey}
              data-tip={
                aiOff && !onDevice
                  ? t('topbar.analyzeAiOff')
                  : needsKey
                    ? t('topbar.analyzeNeedsKey')
                    : !problemText.trim()
                      ? t('topbar.analyzeNeedsText')
                      : undefined
              }
              onClick={() => {
                void submitProblem(problemText);
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
          {/* Reading a photo is an AI call: hidden while the safety gates are closed. */}
          {cameraAllowed && (
            <IconButton
              icon={Camera}
              label={t('home.cameraButton')}
              disabled={running || cameraBusy}
              onClick={openCamera}
            />
          )}
        </div>
      )}
      {cameraOpen && (
        <CameraDialog
          open={cameraOpen}
          busy={cameraBusy}
          error={cameraError}
          errorSection={cameraErrorSection}
          onClose={closeCamera}
          onCapture={(photo) => {
            void onPhoto(photo);
          }}
        />
      )}

      <div className="topbar__actions">
        <AiStatusPill
          onClick={(section) => {
            if (section) openSettingsAt(section);
            else setSettingsOpen(true);
          }}
        />
        <IconButton
          icon={Search}
          label={t('command.openButton')}
          onClick={() => {
            useCommandPalette.getState().setOpen(true);
          }}
        />
        <span className="topbar__divider" aria-hidden="true" />
        {!teacher && (
          <>
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
          </>
        )}
        <IconButton
          icon={Moon}
          altIcon={Sun}
          showAlt={theme === 'dark'}
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
