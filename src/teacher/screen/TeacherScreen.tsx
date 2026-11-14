import { ArrowLeft, Info } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { useLoaded, type Loaded } from '@/app/bench/useLoaded';
import { useT, type MessageKey } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useAiStatusView } from '@/app/ai/aiStatusView';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { voiceLevel } from '@/teacher/voice/voiceLevel';
import { ChatPanel } from '@/teacher/chat/ChatPanel';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { OrbView } from '@/teacher/orb/OrbView';
import { useOrbState } from '@/teacher/orb/useOrbState';
import { closeTeacher, useTeacherStore, type TeacherLayout } from '@/teacher/teacherStore';
import { Skeleton } from '@/ui/Skeleton';
import { useGlide } from './glide';
import { latestLesson } from './latestLesson';
import { MemoryView } from './MemoryView';
import { UsageView } from './UsageView';
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
/** Advanced mode adds two pages of plain facts (#234 step 5); numbered by position (01–04). */
const ADVANCED_PAGES: TeacherLayout[] = ['memory', 'usage'];
const TAB_NAMES: Record<TeacherLayout, MessageKey> = {
  talk: 'teacher.layoutTalk',
  board: 'teacher.layoutBoard',
  memory: 'teacherViews.memoryTab',
  usage: 'teacherViews.usageTab',
};

export default function TeacherScreen() {
  const t = useT();
  const chosen = useTeacherStore((s) => s.layout);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  // The Advanced pages go with Advanced mode: in Basic the conversation shows.
  const layout = !advanced && ADVANCED_PAGES.includes(chosen) ? 'talk' : chosen;
  const pages = advanced ? [...LAYOUTS, ...ADVANCED_PAGES] : LAYOUTS;
  const factsPage = ADVANCED_PAGES.includes(layout);
  const setLayout = useTeacherStore((s) => s.setLayout);
  // Who answers, in the header pill's words (#233: the old pill said "AI trực tuyến" beside
  // "Chưa kết nối AI"). Only when an AI can answer: the header and the empty conversation already
  // say what is missing, and the room never repeats "Chưa kết nối" (#205 B5).
  const link = useAiStatusView();
  const answers = link.kind === 'cloud' || link.kind === 'local';
  // Glass cards are translucent; on the Low tier, or once frames run slow, they are opaque.
  const solidGlass = usePerfStore((s) => effectiveTier(s) === 'low');
  const messages = useChatStore((s) => s.messages);
  const speaking = useVoiceStore((s) => s.speaking);
  // The face shows what the teacher is doing: speaking, waiting for the AI, or listening.
  const answering = useChatStore((s) => s.answering);
  const layoutId = useId();
  const [typing, setTyping] = useState(false);
  const orbState = useOrbState(typing);
  const orbSlot = useRef<HTMLDivElement>(null);
  useGlide(orbSlot, layout);
  const boardLoaded = useLoaded(
    board,
    layout === 'board',
    loadBoard,
    t('bench.loadFailed'),
    backToTalk,
  );
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
      className="teacher"
      aria-label={t('teacher.regionLabel')}
      data-layout={layout}
      data-glass={solidGlass ? 'solid' : 'glass'}
    >
      <header className="teacher__header">
        <button type="button" className="btn teacher__back" onClick={closeTeacher}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('teacher.back')}
        </button>
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
        {/* Numbered tabs (#234): the layout switch keeps its radio roles and names. */}
        <span id={layoutId} className="sr-only">
          {t('teacher.layoutLabel')}
        </span>
        <div className="tabs__list teacher__tabs" role="radiogroup" aria-labelledby={layoutId}>
          {pages.map((item, i) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={layout === item}
              className="tabs__tab teacher__tab"
              onClick={() => {
                setLayout(item);
              }}
            >
              <span className="teacher__tab-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              {t(TAB_NAMES[item])}
            </button>
          ))}
        </div>
        {answers && (
          <span className="teacher__link" data-status={link.kind}>
            <span className="teacher__link-dot" aria-hidden="true" />
            {link.label}
          </span>
        )}
      </header>

      <div className="teacher__stage">
        <aside className="teacher__presence">
          {/* The orb (#234); the SVG rings and the face when it cannot be drawn. */}
          <div ref={orbSlot} className="teacher__orb-slot">
            <OrbView
              level={voiceLevel}
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
          </div>
          {/* The orb is aria-hidden: its state is said here (polite: after what is being read). */}
          <p className="teacher__state" aria-live="polite">
            {t(`teacher.state.${orbState}`)}
          </p>
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

        {layout === 'memory' && <MemoryView />}
        {layout === 'usage' && <UsageView />}

        {/* Hidden, not removed, on a facts page: a question being typed or answered stays. */}
        <main className="teacher__chat-wrap" aria-label={t('chat.label')} hidden={factsPage}>
          <ChatPanel showScreenContext={false} teacherPage onComposingChange={setTyping} />
        </main>
      </div>
    </section>
  );
}
