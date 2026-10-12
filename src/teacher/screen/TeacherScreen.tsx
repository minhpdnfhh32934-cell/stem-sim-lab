import { ArrowLeft, BookOpen, MessageCircle, Presentation, ShieldCheck } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useT } from '@/app/i18n';
import { useAnalysisEngine } from '@/app/ai/engineChoice';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { ChatPanel } from '@/teacher/chat/ChatPanel';
import { TeacherFace } from '@/teacher/face/TeacherFace';
import { closeTeacher, useTeacherStore, type TeacherLayout } from '@/teacher/teacherStore';
import { cx } from '@/ui/cx';
import './teacher.css';

const LAYOUTS: TeacherLayout[] = ['talk', 'board'];

export default function TeacherScreen() {
  const t = useT();
  const layout = useTeacherStore((s) => s.layout);
  const setLayout = useTeacherStore((s) => s.setLayout);
  const engine = useAnalysisEngine() === 'cloud' ? 'cloud' : 'gemma';
  const gemmaModel = useChatStore((s) => s.gemmaModel);
  const messages = useChatStore((s) => s.messages);
  const speaking = useVoiceStore((s) => s.speaking);
  const layoutId = useId();
  const completedSteps = Math.min(
    4,
    messages.filter((message) => message.role === 'assistant').length,
  );

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
        <button type="button" className="btn" onClick={closeTeacher}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('teacher.back')}
        </button>
        <div className="teacher__heading">
          <h1 id="teacher-title" className="teacher__title">
            {t('teacher.title')}
          </h1>
          <p>{t('teacher.sketchNote')}</p>
        </div>
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

      <div className="teacher__trust">
        <span>
          <BookOpen size={15} aria-hidden="true" />
          {t('landing.teacherBody')}
        </span>
        <span>
          <ShieldCheck size={15} aria-hidden="true" />
          {t('landing.privacy')}
        </span>
      </div>

      <div
        className="teacher__progress"
        role="progressbar"
        aria-label={t('teacher.turnProgress')}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={completedSteps}
      >
        {[0, 1, 2, 3].map((step) => (
          <span key={step} className={cx('teacher__step', step < completedSteps && 'is-done')} />
        ))}
      </div>

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

        <main className="teacher__chat-wrap" aria-label={t('chat.label')}>
          <ChatPanel showScreenContext={false} teacherPage />
        </main>
      </div>
    </section>
  );
}
