import { ArrowLeft, Info, MessageCircle, Presentation } from 'lucide-react';
import { lazy, Suspense, useEffect, useId } from 'react';
import { useT } from '@/app/i18n';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { useChatStore, type ChatMessageRecord } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { ChatPanel } from '@/teacher/chat/ChatPanel';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { closeTeacher, useTeacherStore, type TeacherLayout } from '@/teacher/teacherStore';
import type { LessonInput } from '@/teacher/board/lesson';
import './teacher.css';

// The board (fonts, KaTeX, layout) loads only when the learner opens the board layout.
const Whiteboard = lazy(() =>
  import('@/teacher/board/Whiteboard').then((m) => ({ default: m.Whiteboard })),
);

const LAYOUTS: TeacherLayout[] = ['talk', 'board'];

function latestLesson(messages: ChatMessageRecord[]): LessonInput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant') continue;
    const question = messages
      .slice(0, i)
      .reverse()
      .find((q) => q.role === 'user');
    return {
      id: m.id,
      content: m.content,
      question: question?.content ?? '',
      ...(m.model ? { model: m.model } : {}),
    };
  }
  return null;
}

export default function TeacherScreen() {
  const t = useT();
  const layout = useTeacherStore((s) => s.layout);
  const setLayout = useTeacherStore((s) => s.setLayout);
  const engine = useAnalysisEngine() === 'cloud' ? 'cloud' : 'gemma';
  const gemmaModel = useChatStore((s) => s.gemmaModel);
  const messages = useChatStore((s) => s.messages);
  const speaking = useVoiceStore((s) => s.speaking);
  const layoutId = useId();
  // The board teaches the latest answer, with the question it answers (its numbers are given).
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
    <section className="teacher" aria-labelledby="teacher-title" data-layout={layout}>
      <header className="teacher__header">
        <button type="button" className="btn teacher__back" onClick={closeTeacher}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('teacher.back')}
        </button>
        <h1 id="teacher-title" className="teacher__title">
          {t('teacher.title')}
        </h1>
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
            <TeacherFace mood={speaking ? 'speaking' : 'idle'} trackCursor />
          </div>
          <span className="teacher__ai-label">{t('teacher.aiLabel')}</span>
          <p className="teacher__caption">
            {t(layout === 'board' ? 'teacher.boardCaption' : 'teacher.talkCaption')}
          </p>
          <span className="teacher__engine-pill">
            <span className="teacher__engine-dot" />
            {engine === 'gemma' ? t('chat.model', { model: gemmaModel }) : t('chat.cloud')}
          </span>
        </aside>

        {layout === 'board' && (
          <div className="teacher__board">
            <Suspense fallback={<p className="muted">{t('board.preparing')}</p>}>
              <Whiteboard lesson={lesson} />
            </Suspense>
          </div>
        )}

        <main className="teacher__chat-wrap" aria-label={t('chat.label')}>
          <ChatPanel showScreenContext={false} teacherPage />
        </main>
      </div>
    </section>
  );
}
