import { ChevronLeft, ChevronRight, ListChecks, LoaderCircle, Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { AiContentBar } from '@/safety/AiContentBar';
import { MessageBody } from '@/teacher/chat/MessageBody';
import { useChatStore } from '@/teacher/chat/chatStore';
import { speak, speechSupported, stopSpeaking } from '@/teacher/voice/speak';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { cx } from '@/ui/cx';
import { toLesson } from './lesson';
import './board.css';

/** Pause between steps when the teacher is not reading aloud. */
const STEP_MS = 1600;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface Shown {
  /** Answer the progress belongs to. */
  id: string;
  /** Steps written on the board so far. */
  count: number;
  /** Highlighted step. */
  current: number;
  /** Steps keep appearing on their own. */
  auto: boolean;
}

/** How a new answer starts: read aloud (voice on), all at once (reduced motion) or step by step. */
function firstView(id: string, reading: boolean): Shown {
  if (reading) return { id, count: 0, current: 0, auto: false };
  if (prefersReducedMotion())
    return { id, count: Number.MAX_SAFE_INTEGER, current: 0, auto: false };
  return { id, count: 1, current: 0, auto: true };
}

/**
 * "Giảng trên bảng": the latest answer written on the board step by step. With the voice on,
 * the teacher reads one step at a time and the step being read is highlighted. The board only
 * shows the AI's own answer (labelled as AI content), split along its structure (`lesson.ts`).
 */
export function LessonBoard() {
  const t = useT();
  const messages = useChatStore((s) => s.messages);
  const answering = useChatStore((s) => s.answering);
  const voiceOn = useVoiceStore((s) => s.enabled);
  const speaking = useVoiceStore((s) => s.speaking);

  const answerIndex = messages.findLastIndex((m) => m.role === 'assistant');
  const answer = answerIndex >= 0 ? messages[answerIndex] : undefined;
  const question = messages
    .slice(0, Math.max(answerIndex, 0))
    .findLast((m) => m.role === 'user')?.content;
  const lesson = useMemo(
    () => (answer ? toLesson(answer.content, question ?? t('teacher.board.title')) : null),
    [answer, question, t],
  );
  const steps = useMemo(() => lesson?.steps ?? [], [lesson]);

  const reading = voiceOn && speechSupported();
  const answerId = answer?.id ?? '';
  const [shown, setShown] = useState<Shown>({ id: '', count: 0, current: 0, auto: false });
  const readRun = useRef(0);
  const total = steps.length;
  // A new answer starts with `firstView` ("Viết tiếp" keeps the same id: progress stays).
  const state = shown.id === answerId ? shown : firstView(answerId, reading);
  const count = Math.min(state.count, total);
  const update = (change: (s: Shown) => Shown) => {
    setShown((prev) => change(prev.id === answerId ? prev : firstView(answerId, reading)));
  };

  /** Reads the steps aloud from `start`, revealing each one as it is read. */
  const readFrom = async (start: number) => {
    const run = ++readRun.current;
    for (let i = start; i < steps.length; i++) {
      if (readRun.current !== run) return;
      update((s) => ({ ...s, count: Math.max(s.count, i + 1), current: i, auto: false }));
      await speak(steps[i] ?? '');
    }
  };
  const stopReading = () => {
    readRun.current++;
    stopSpeaking();
    update((s) => ({ ...s, auto: false }));
  };

  // A new answer with the voice on: the teacher reads it step by step.
  useEffect(() => {
    if (!answerId || !reading) return;
    const run = readRun;
    void readFrom(0);
    return () => {
      run.current++;
    };
    // Only when another answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerId]);

  // Timed reveal while not reading aloud (also picks up steps added by "Viết tiếp").
  useEffect(() => {
    if (!state.auto || count >= total || count === 0) return;
    const timer = window.setTimeout(() => {
      update((s) => ({ ...s, count: s.count + 1, current: s.count }));
    }, STEP_MS);
    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerId, state.auto, count, total]);

  useEffect(() => {
    const run = readRun;
    return () => {
      run.current++;
    };
  }, []);

  const go = (current: number) => {
    stopReading();
    update((s) => ({ ...s, count: Math.max(s.count, current + 1), current, auto: false }));
  };

  if (!answer || !lesson) {
    return (
      <section className="lesson-board is-empty" aria-label={t('teacher.board.regionLabel')}>
        {answering ? (
          <p className="lesson-board__notice" role="status">
            <LoaderCircle size={18} className="spin" aria-hidden="true" />
            {t('teacher.board.preparing')}
          </p>
        ) : (
          <p className="lesson-board__notice">{t('teacher.board.empty')}</p>
        )}
      </section>
    );
  }

  const current = Math.min(state.current, Math.max(total - 1, 0));
  return (
    <section className="lesson-board" aria-label={t('teacher.board.regionLabel')}>
      <header className="lesson-board__header">
        <h2 className="lesson-board__title">{lesson.title}</h2>
        {answering && (
          <span className="lesson-board__busy" role="status">
            <LoaderCircle size={14} className="spin" aria-hidden="true" />
            {t('teacher.board.preparing')}
          </span>
        )}
      </header>
      <ol className="lesson-board__steps">
        {steps.slice(0, count).map((step, i) => (
          <li
            // Steps are positional: the same index is the same step after "Viết tiếp".
            key={i}
            className={cx('lesson-board__step', i === current && 'is-current')}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="lesson-board__number" aria-hidden="true">
              {i + 1}
            </span>
            <div className="lesson-board__body">
              <MessageBody content={step} />
            </div>
          </li>
        ))}
      </ol>
      <footer className="lesson-board__footer">
        <AiContentBar {...(answer.model ? { model: answer.model } : {})} />
        <p className="lesson-board__source">{t('teacher.board.source')}</p>
        <div className="lesson-board__controls">
          <span className="lesson-board__progress" aria-live="polite">
            {t('teacher.board.progress', { n: Math.min(count, total), total })}
          </span>
          <button
            type="button"
            className="btn"
            disabled={current <= 0}
            onClick={() => {
              go(current - 1);
            }}
          >
            <ChevronLeft size={15} aria-hidden="true" />
            {t('teacher.board.prev')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={current >= total - 1}
            onClick={() => {
              go(current + 1);
            }}
          >
            {t('teacher.board.next')}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn"
            disabled={count >= total}
            onClick={() => {
              stopReading();
              update((s) => ({ ...s, count: total, current: total - 1, auto: false }));
            }}
          >
            <ListChecks size={15} aria-hidden="true" />
            {t('teacher.board.all')}
          </button>
          {speechSupported() &&
            (speaking ? (
              <button type="button" className="btn" onClick={stopReading}>
                <Square size={14} aria-hidden="true" />
                {t('teacher.board.stop')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => void readFrom(current)}
              >
                <Volume2 size={15} aria-hidden="true" />
                {t('teacher.board.read')}
              </button>
            ))}
        </div>
      </footer>
    </section>
  );
}
