import {
  ArrowLeft,
  Captions,
  Gauge,
  Hand,
  MessageSquareText,
  Mic,
  Pause,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useAiStore } from '@/ai/aiStore';
import { cx } from '@/ui/cx';
import { closeTeacher, useTeacherStore, type TeacherLayout } from '../teacherStore';
import './teacher.css';

const LAYOUTS: TeacherLayout[] = ['talk', 'board'];
const CHIPS = ['again', 'slower', 'example', 'simpler', 'lost'] as const;
const DURATIONS = [15, 30, 45];

/**
 * "Dạy học bằng AI" (PROMPT_PHAN_2 B4) — T0 interface sketch for review, not functional yet.
 * Its own lazy chunk: the simulations never load it. Layouts: the ring in the centre while
 * talking; the ring top-left and the whiteboard taking most of the area while teaching.
 * Controls are rendered but disabled (aria-disabled) until T1–T5 make them work.
 */
export default function TeacherScreen() {
  const t = useT();
  const layout = useTeacherStore((s) => s.layout);
  const setLayout = useTeacherStore((s) => s.setLayout);
  const noKey = useAiStore((s) => s.status === 'noKey');
  const setSettingsOpen = useWorkspaceStore((s) => s.setSettingsOpen);
  const layoutId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeTeacher();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <section className="teacher" aria-labelledby="teacher-title" data-layout={layout}>
      <header className="teacher__header">
        <button type="button" className="btn" onClick={closeTeacher}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('teacher.back')}
        </button>
        <h1 id="teacher-title" className="teacher__title">
          {t('teacher.title')}
        </h1>
        <span className="teacher__badge">{t('teacher.sketchBadge')}</span>
        <div className="teacher__layout">
          <span id={layoutId} className="sr-only">
            {t('teacher.layoutLabel')}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby={layoutId}>
            {LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={layout === l}
                className="segmented__item"
                onClick={() => {
                  setLayout(l);
                }}
              >
                {t(l === 'talk' ? 'teacher.layoutTalk' : 'teacher.layoutBoard')}
              </button>
            ))}
          </div>
        </div>
      </header>

      <p className="teacher__note">{t('teacher.sketchNote')}</p>

      <div
        className="teacher__progress"
        role="progressbar"
        aria-label={t('teacher.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={layout === 'board' ? 1 : 0}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx('teacher__step', layout === 'board' && i === 0 && 'is-done')}
          />
        ))}
      </div>

      <div className="teacher__stage">
        <div className="teacher__presence">
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
            <SketchFace />
          </div>
          <span className="teacher__ai-label">{t('teacher.aiLabel')}</span>
          <p className="teacher__caption">
            {t(layout === 'board' ? 'teacher.boardCaption' : 'teacher.talkCaption')}
          </p>
        </div>

        {layout === 'talk' ? (
          <div className="teacher__start">
            {noKey ? (
              <div className="teacher__connect">
                <p className="teacher__start-title">{t('teacher.connectTitle')}</p>
                <p className="teacher__muted">{t('teacher.connectBody')}</p>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => {
                    setSettingsOpen(true);
                  }}
                >
                  <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
                  {t('teacher.connect')}
                </button>
              </div>
            ) : (
              <>
                <p className="teacher__start-title">{t('teacher.startTitle')}</p>
                <p className="teacher__muted">{t('teacher.startHint')}</p>
              </>
            )}
            <p className="teacher__start-title teacher__start-title--small">
              {t('teacher.durationLabel')}
            </p>
            <div className="teacher__durations">
              {DURATIONS.map((n) => (
                <SketchButton key={n} label={t('teacher.minutes', { n })} />
              ))}
            </div>
          </div>
        ) : (
          <div className="teacher__board" role="img" aria-label={t('teacher.boardLabel')}>
            <p className="teacher__board-heading">{t('teacher.boardHeading')}</p>
            <p className="teacher__board-formula">
              <span className="teacher__board-circled">{t('teacher.boardFormula')}</span>
            </p>
            <p className="teacher__board-note">{t('teacher.boardNote')}</p>
          </div>
        )}
      </div>

      <div className="teacher__chips" role="group" aria-label={t('teacher.chipsLabel')}>
        {CHIPS.map((c) => (
          <SketchButton key={c} label={t(`teacher.chips.${c}` as MessageKey)} chip />
        ))}
      </div>

      <div className="teacher__controls" role="toolbar" aria-label={t('teacher.controlsLabel')}>
        <SketchButton icon={Mic} label={t('teacher.mic')} primary />
        <SketchButton icon={Hand} label={t('teacher.raiseHand')} />
        <SketchButton icon={Pause} label={t('teacher.pause')} />
        <SketchButton icon={Gauge} label={t('teacher.speed')} />
        <SketchButton icon={Captions} label={t('teacher.captions')} />
        <SketchButton icon={MessageSquareText} label={t('teacher.transcript')} />
      </div>
    </section>
  );
}

/** A control that is visible in the sketch but does nothing yet (says so on hover/focus). */
function SketchButton({
  label,
  icon: Icon,
  primary = false,
  chip = false,
}: {
  label: string;
  icon?: LucideIcon;
  primary?: boolean;
  chip?: boolean;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className={cx(
        chip ? 'teacher__chip' : 'teacher__control',
        primary && 'teacher__control--primary',
      )}
      aria-disabled="true"
      data-tip={t('teacher.notYet')}
      onClick={(e) => {
        e.preventDefault();
      }}
    >
      {Icon && <Icon size={20} strokeWidth={1.75} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

/** Placeholder face (an original, neutral design) until Face2D lands in T1. */
function SketchFace() {
  return (
    <svg viewBox="0 0 120 120" className="teacher-face">
      <circle cx="60" cy="60" r="44" className="teacher-face__head" />
      <path d="M38 47 q8 -6 16 0" className="teacher-face__brow" />
      <path d="M66 47 q8 -6 16 0" className="teacher-face__brow" />
      <ellipse cx="46" cy="57" rx="4" ry="5" className="teacher-face__eye" />
      <ellipse cx="74" cy="57" rx="4" ry="5" className="teacher-face__eye" />
      <path d="M46 76 q14 10 28 0" className="teacher-face__mouth" />
    </svg>
  );
}
