import { Camera, LoaderCircle, PencilRuler, Sparkles, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cancelAnalyze, openManual, useAnalyzeStore } from '@/app/ai/analyze';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { submitProblem } from '@/app/ai/submit';
import { usePhotoCapture } from '@/app/ai/usePhotoCapture';
import { useT } from '@/app/i18n';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { IconButton } from '@/ui/IconButton';

/**
 * The problem box: the text, "Phân tích đề", the manual scene and the photo button. The classic
 * top bar shows it inline; the bench shell (0.8.1) shows it in its "Đề bài" sheet.
 */
export function ProblemInput() {
  const t = useT();
  const { problemText, setProblemText } = useWorkspaceStore(
    useShallow((s) => ({ problemText: s.problemText, setProblemText: s.setProblemText })),
  );
  const provider = useAiStore((s) => s.provider);
  const running = useAnalyzeStore((s) => s.phase === 'running');
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

  const onProblemKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submitProblem(problemText);
    }
  };

  return (
    <>
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
    </>
  );
}
