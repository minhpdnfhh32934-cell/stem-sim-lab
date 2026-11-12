import { ArrowLeft, Info, MessageCircle, Presentation } from 'lucide-react';
import { useContext, useEffect, useId, useRef, type ComponentProps } from 'react';
import { useLoaded, type Loaded } from '@/app/bench/useLoaded';
import { BenchContext } from '@/app/bench/shellMode';
import { useT } from '@/app/i18n';
import { engineKind, useAnalysisEngine } from '@/app/ai/engineChoice';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { ChatPanel } from '@/teacher/chat/ChatPanel';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { OrbView } from '@/teacher/orb/OrbView';
import { useOrbState } from '@/teacher/orb/useOrbState';
import { closeTeacher, useTeacherStore, type TeacherLayout } from '@/teacher/teacherStore';
import { Skeleton } from '@/ui/Skeleton';
import { latestLesson } from './latestLesson';
import './teacher.css';

// The board (fonts, KaTeX, layout) loads only when the learner opens the board layout. By hand
// (useLoaded), not lazy(): the orb draws every frame and could starve a suspended retry (#228).
type BoardProps = ComponentProps<typeof import('@/teacher/board/Whiteboard').Whiteboard>;
const board: Loaded<BoardProps> = { Component: null };
const loadBoard = () => import('@/teacher/board/Whiteboard').then((m) => m.Whiteboard);
const backToTalk = () => {
  useTeacherStore.getState().setLayout('talk');
};

const LAYOUTS: TeacherLayout[] = ['talk', 'board'];

export default function TeacherScreen() {
  const t = useT();
  const layout = useTeacherStore((s) => s.layout);
  const setLayout = useTeacherStore((s) => s.setLayout);
  const engine = engineKind(useAnalysisEngine());
  const gemmaModel = useChatStore((s) => s.gemmaModel);
  const localLabel = useLocalAiStore((s) => s.selected?.label ?? null);
  const messages = useChatStore((s) => s.messages);
  const speaking = useVoiceStore((s) => s.speaking);
  // The face shows what the teacher is doing: speaking, waiting for the AI, or listening.
  const answering = useChatStore((s) => s.answering);
  const layoutId = useId();
  const page = useRef<HTMLElement>(null);
  const orbState = useOrbState(page);
  const boardLoaded = useLoaded(
    board,
    layout === 'board',
    loadBoard,
    t('bench.loadFailed'),
    backToTalk,
  );
  // The bench names it an AI beside the title (docs/BENCH_DESIGN.md §9.8).
  const bench = useContext(BenchContext);
  // The board teaches the latest answer that is not about part of the board (latestLesson.ts).
  const lesson = latestLesson(messages);
  // What the page is and what may leave the computer: one tooltip instead of two lines of text.
  const about = `${t('teacher.sketchNote')} ${t('landing.privacy')}`;

  // Esc goes back to where the learner came from (ignored while typing a question).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Esc first closes an open dialog (Settings, camera…); it must not also leave the page.
      if (document.querySelector('dialog[open], [role="dialog"]')) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      closeTeacher();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    // One title, the header's "AI Teacher" (#205 B5); the region keeps its own name.
    <section
      ref={page}
      className="teacher"
      aria-label={t('teacher.regionLabel')}
      data-layout={layout}
    >
      <header className="teacher__header">
        <button type="button" className="btn teacher__back" onClick={closeTeacher}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('teacher.back')}
        </button>
        {bench && <span className="teacher__is-ai">{t('bench.isAi')}</span>}
        <span
          className="teacher__about"
          role="note"
          tabIndex={0}
          aria-label={about}
          data-tip={about}
          data-tip-side="bottom"
        >
          <Info size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="teacher__layout">
          <span id={layoutId} className="sr-only">
            {t('teacher.layoutLabel')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby={layoutId}>
            {LAYOUTS.map((item) => {
              const Icon = item === 'talk' ? MessageCircle : Presentation;
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={layout === item}
                  className="segmented__item"
                  onClick={() => {
                    setLayout(item);
                  }}
                >
                  <Icon size={15} aria-hidden="true" />
                  {t(item === 'talk' ? 'teacher.layoutTalk' : 'teacher.layoutBoard')}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="teacher__stage">
        <aside className="teacher__presence">
          {/* The orb (#234); the SVG rings and the face when it cannot be drawn. */}
          <OrbView
            state={orbState}
            fallback={
              <div className="teacher-ring" aria-hidden="true">
                <svg viewBox="0 0 200 200" className="teacher-ring__waves">
                  <circle
                    cx="100"
                    cy="100"
                    r="78"
                    className="teacher-ring__wave teacher-ring__wave--1"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    className="teacher-ring__wave teacher-ring__wave--2"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="62"
                    className="teacher-ring__wave teacher-ring__wave--3"
                  />
                </svg>
                <TeacherFace
                  mood={speaking ? 'speaking' : answering ? 'thinking' : 'idle'}
                  trackCursor
                />
              </div>
            }
          />
          <p className="teacher__caption">
            {t(layout === 'board' ? 'teacher.boardCaption' : 'teacher.talkCaption')}
          </p>
          <span className="teacher__engine-pill">
            <span className="teacher__engine-dot" />
            {engine === 'gemma'
              ? t('chat.model', { model: gemmaModel })
              : engine === 'local'
                ? (localLabel ?? t('chat.local'))
                : t('chat.cloud')}
          </span>
        </aside>

        {layout === 'board' && (
          <div className="teacher__board">
            {boardLoaded && board.Component ? (
              <board.Component lesson={lesson} />
            ) : (
              <Skeleton label={t('board.preparing')} variant="board" />
            )}
          </div>
        )}

        <main className="teacher__chat-wrap" aria-label={t('chat.label')}>
          <ChatPanel showScreenContext={false} teacherPage />
        </main>
      </div>
    </section>
  );
}
