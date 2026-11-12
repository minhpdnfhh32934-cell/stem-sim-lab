import { FileText, Redo2, Search, Settings, Undo2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useAnalyzeStore } from '@/app/ai/analyze';
import { AiStatusPill } from '@/app/ai/AiStatusPill';
import { useCommandPalette } from '@/app/command/commands';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { ProblemInput } from '@/app/layout/ProblemInput';
import { useProblemSheet } from './problemSheet';
import { ModeSwitch } from '@/app/learner/ModeSwitch';
import { FileMenu } from '@/app/project/FileMenu';
import { redo, undo, useUndoStore } from '@/app/project/undo';
import { SettingsDialog } from '@/app/settings/SettingsDialog';
import { useSimStore } from '@/app/sim/simStore';
import { UpdateReminder } from '@/app/update/UpdateReminder';
import { goHome, useIsHome, useIsLanding, useIsStudio, useIsTeacher } from '@/app/topics';
import { useSafetyStore } from '@/safety/safetyStore';
import { openTeacher } from '@/teacher/teacherStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { useCutTip } from '@/ui/useCutTip';
import { IconButton } from '@/ui/IconButton';
import { Logo } from '@/ui/Logo';
import { ThemeSwitch } from './ThemeSwitch';
import { toLibrary } from './toLibrary';

/**
 * The bench's 48 px frame header (docs/BENCH_DESIGN.md §9.4): the SimLab mark (launch page), the
 * breadcrumb (every crumb a 40 px button, the open topic is the page's h1), "Đề bài", AI status,
 * search, Basic/Advanced, the light / dark switch, undo/redo, Tệp and Settings (presentation: F5);
 * "Có bản cập nhật" after "Để sau" (the classic status bar's reminder).
 */
export function BenchHeader() {
  const t = useT();
  const L = useLocalized();
  const teacher = useIsTeacher();
  const landing = useIsLanding();
  const studio = useIsStudio() && !teacher;
  const lab = !teacher && !landing;
  // The shelf has nothing to undo; it offers AI Teacher there instead, 18+ only (§9.3).
  const shelf = useIsHome() && lab;
  const adult = useSafetyStore((s) => s.status?.aiAllowed === true);
  const subject = useWorkspaceStore((s) => s.subject);
  const settingsOpen = useWorkspaceStore((s) => s.settingsOpen);
  const setSettingsOpen = useWorkspaceStore((s) => s.setSettingsOpen);
  const openSettingsAt = useWorkspaceStore((s) => s.openSettingsAt);
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);
  const sceneTitle = useSimStore((s) => s.scene?.title);
  const moduleTitle = useModuleStore((s) => s.active?.view.title);
  const topic = sceneTitle ?? moduleTitle;
  // A long name, a large font: cut to "…", whole in the tooltip on hover and keyboard focus.
  const topicRef = useCutTip<HTMLHeadingElement>(topic ? L(topic) : '');
  const problemOpen = useProblemSheet((s) => s.open);
  const setProblemOpen = (open: boolean) => {
    useProblemSheet.setState({ open });
  };
  const problemButton = useRef<HTMLButtonElement>(null);

  // The dialogs sit beside the header, not in it: the frame's colours must not reach them.
  return (
    <>
      <header className="bench-header" data-surface="frame">
        <button
          type="button"
          className="bench-header__mark"
          aria-label={t('home.goHome')}
          data-tip={t('home.goHome')}
          data-tip-side="bottom"
          onClick={goHome}
        >
          <Logo size={24} />
        </button>
        <nav className="bench-crumbs" aria-label={t('bench.breadcrumb')}>
          {lab && (
            <button
              type="button"
              className={topic ? 'bench-crumb bench-crumbs__path' : 'bench-crumb'}
              aria-current={!topic && !studio ? 'page' : undefined}
              onClick={() => {
                toLibrary();
              }}
            >
              {t('landing.labTitle')}
            </button>
          )}
          {lab && topic && (
            <>
              <span className="bench-crumbs__sep bench-crumbs__path" aria-hidden="true">
                ›
              </span>
              <button
                type="button"
                className="bench-crumb bench-crumbs__path"
                onClick={() => {
                  toLibrary(subject);
                }}
              >
                {t(`subjects.${subject}`)}
              </button>
              {/* Short of room, "Virtual Lab › Sinh học" folds into "…" (#205 B2b, bench.css): its
                  name and tooltip keep the whole path; it goes where the subject crumb goes. */}
              <button
                type="button"
                className="bench-crumb bench-crumbs__fold"
                aria-label={`${t('landing.labTitle')} › ${t(`subjects.${subject}`)}`}
                data-tip={`${t('landing.labTitle')} › ${t(`subjects.${subject}`)}`}
                onClick={() => {
                  toLibrary(subject);
                }}
              >
                …
              </button>
              <span className="bench-crumbs__sep" aria-hidden="true">
                ›
              </span>
              <h1 ref={topicRef} className="bench-crumb bench-crumb--current">
                {L(topic)}
              </h1>
            </>
          )}
          {/* The teacher page has its own h1. */}
          {teacher && <span className="bench-crumb bench-crumb--current">{t('chat.title')}</span>}
        </nav>

        {/* One place to type a problem (#205 B3): the shelf has its "Có đề bài?" card. */}
        {lab && !studio && !shelf && (
          <button
            ref={problemButton}
            type="button"
            className="btn bench-header__problem"
            onClick={() => {
              setProblemOpen(true);
            }}
          >
            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('bench.problem')}</span>
          </button>
        )}
        <div className="bench-header__spacer" />
        <UpdateReminder />
        {/* The launch page has nothing to undo and no AI on it yet (§9.1). */}
        {!landing && (
          <AiStatusPill
            onClick={(section) => {
              if (section) openSettingsAt(section);
              else setSettingsOpen(true);
            }}
          />
        )}
        {/* An icon (#205 B2: "Tìm…" read as cut text): its words stay the name, Ctrl+K the tip. */}
        <button
          type="button"
          className="btn bench-header__search"
          aria-keyshortcuts="Control+K"
          data-tip={`${t('bench.search')} (Ctrl+K)`}
          onClick={() => {
            useCommandPalette.getState().setOpen(true);
          }}
        >
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{t('bench.search')}</span>
        </button>
        {lab && <ModeSwitch compact />}
        {/* Short of room it moves into Tệp (#205 B2, bench.css). */}
        <ThemeSwitch />
        {shelf && adult && (
          <button
            type="button"
            className="btn bench-header__teacher"
            aria-label={t('home.teacherOpen')}
            onClick={openTeacher}
          >
            {t('landing.teacherTitle')}
          </button>
        )}
        {/* Short of room they move into Tệp (#205 B2b, bench.css); Ctrl+Z / Ctrl+Y still work. */}
        {lab && !shelf && (
          <span className="bench-header__history">
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
          </span>
        )}
        <FileMenu history={lab && !shelf} />
        <IconButton
          icon={Settings}
          label={t('topbar.settings')}
          animation="spin"
          onClick={() => {
            setSettingsOpen(true);
          }}
        />
      </header>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
      {problemOpen && (
        <ProblemSheet
          onClose={(opener) => {
            setProblemOpen(false);
            // The sheet leaves the page: the focus goes back to its button, or on the shelf (no
            // button, #205 B3) to what opened it ("Có đề bài?").
            (problemButton.current ?? opener)?.focus();
          }}
        />
      )}
    </>
  );
}

/** "Đề bài": the problem box in a sheet; it closes when the analysis starts. */
function ProblemSheet({ onClose }: { onClose: (opener: HTMLElement | null) => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  // What had the focus when the sheet opened (kept from the first render).
  const opener = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const running = useAnalyzeStore((s) => s.phase === 'running');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  // Close the dialog itself (not just unmount it): only then may the focus leave it.
  useEffect(() => {
    if (running) ref.current?.close();
  }, [running]);
  return (
    <dialog
      ref={ref}
      className="dialog bench-problem"
      aria-labelledby="bench-problem-title"
      onClose={() => {
        onClose(opener.current?.isConnected ? opener.current : null);
      }}
    >
      <header className="dialog__header">
        <h2 id="bench-problem-title">{t('bench.problem')}</h2>
        <IconButton
          icon={X}
          label={t('bench.closeProblem')}
          onClick={() => {
            ref.current?.close();
          }}
        />
      </header>
      <div className="dialog__body">
        <ProblemInput />
      </div>
    </dialog>
  );
}
