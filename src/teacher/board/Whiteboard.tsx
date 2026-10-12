import {
  CircleAlert,
  CircleCheck,
  Eraser,
  FastForward,
  Pause,
  PenLine,
  Pencil,
  Play,
  RotateCcw,
} from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { AiContentBar } from '@/safety/AiContentBar';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { cx } from '@/ui/cx';
import { PEN_SPEEDS, useBoardStore, type BoardMark } from './boardStore';
import { BoardDrawing } from './BoardDrawing';
import { BOARD_W, COLUMNS, COLUMN_TOP, type Line, type TextElement } from './layout';
import {
  continueLesson,
  finishNow,
  pauseLesson,
  playLesson,
  replayLesson,
  resumeLesson,
  stopLesson,
  type LessonInput,
} from './lesson';
import { browserMeasure, prepareMeasure, renderMath } from './measure';
import * as rough from './rough';
import './board.css';

/**
 * The AI Teacher's whiteboard (PROMPT_PHAN_2 B7): handwritten Vietnamese with a visible pen,
 * formulas revealed left to right, underlines / circles / boxes / arrows drawn by hand, simple
 * diagrams, several board faces (history), a pen for the learner, and a subtitle of what the
 * teacher says. The layout is computed by code (layout.ts); the AI never chooses positions.
 */
export function Whiteboard({ lesson }: { lesson: LessonInput | null }) {
  const t = useT();
  const status = useBoardStore((s) => s.status);
  const faces = useBoardStore((s) => s.layout.faces);
  const face = useBoardStore((s) => s.face);
  const speed = useBoardStore((s) => s.speed);
  const penMode = useBoardStore((s) => s.penMode);
  const subtitle = useBoardStore((s) => s.subtitle);
  const set = useBoardStore((s) => s.set);
  const locale = useSettingsStore((s) => s.locale);
  useEffect(() => {
    // A new answer starts a new lesson; a longer copy of the same answer ("Viết tiếp") is
    // written after what is already on the board; nothing is ever taught twice by itself.
    if (!lesson) return;
    const store = useBoardStore.getState();
    if (store.lessonId === lesson.id && store.lessonContent === lesson.content) return;
    const append = store.lessonId === lesson.id;
    store.set({ lessonId: lesson.id, lessonContent: lesson.content });
    if (!append) store.set({ status: 'preparing' });
    void prepareMeasure().then(() => {
      // Skip it if a newer answer arrived while the fonts were loading.
      if (useBoardStore.getState().lessonContent !== lesson.content) return;
      void (append ? continueLesson : playLesson)(lesson, browserMeasure);
    });
  }, [lesson]);

  // Leaving the page stops the lesson (and the voice).
  useEffect(() => stopLesson, []);

  const playing = status === 'playing';
  return (
    <section className="board" aria-label={t('board.label')}>
      <div className="board__toolbar" role="toolbar" aria-label={t('board.controls')}>
        {/* Playback controls appear with the first lesson; an empty board only offers the pen. */}
        {lesson && (
          <>
            {playing ? (
              <button type="button" className="btn" onClick={pauseLesson}>
                <Pause size={15} aria-hidden="true" />
                {t('board.pause')}
              </button>
            ) : status === 'paused' ? (
              <button type="button" className="btn btn--accent" onClick={resumeLesson}>
                <Play size={15} aria-hidden="true" />
                {t('board.resume')}
              </button>
            ) : (
              <button type="button" className="btn" onClick={replayLesson}>
                <RotateCcw size={15} aria-hidden="true" />
                {t('board.replay')}
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={!(playing || status === 'paused')}
              onClick={finishNow}
              title={t('board.finishHint')}
            >
              <FastForward size={15} aria-hidden="true" />
              {t('board.finish')}
            </button>
            <div className="segmented" role="radiogroup" aria-label={t('board.speed')}>
              {PEN_SPEEDS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={speed === v}
                  className="segmented__item mono"
                  onClick={() => {
                    set({ speed: v });
                  }}
                >
                  {formatNumber(locale, v)}×
                </button>
              ))}
            </div>
          </>
        )}
        <span className="board__toolbar-gap" />
        <button
          type="button"
          className={cx('btn', penMode && 'btn--accent')}
          aria-pressed={penMode}
          onClick={() => {
            set({ penMode: !penMode });
          }}
          title={t('board.penHint')}
        >
          <Pencil size={15} aria-hidden="true" />
          {t('board.myPen')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            useBoardStore.getState().clearStrokes(face);
          }}
          title={t('board.clearPen')}
          aria-label={t('board.clearPen')}
        >
          <Eraser size={15} aria-hidden="true" />
        </button>
      </div>

      {faces.length > 1 && (
        <div className="board__faces" role="tablist" aria-label={t('board.history')}>
          {faces.map((f, i) => (
            <button
              key={`${String(i)}-${f.title ?? ''}`}
              type="button"
              role="tab"
              aria-selected={face === i}
              className="board__face-tab"
              onClick={() => {
                set({ face: i });
              }}
            >
              {t('board.face', { n: i + 1 })}
              {f.title ? ` · ${f.title}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="board__area">
        <BoardSheet />
        {!lesson && <p className="board__empty">{t('board.empty')}</p>}
      </div>

      {(lesson || status === 'preparing') && (
        <p className="board__subtitle" aria-live="polite">
          {status === 'preparing' ? t('board.preparing') : subtitle}
        </p>
      )}
      {/* What is on the board was written by an AI: labelled, with the report button. */}
      {lesson && <AiContentBar {...(lesson.model ? { model: lesson.model } : {})} />}
      <Legend />
    </section>
  );
}

function Legend() {
  const t = useT();
  const provenance = useBoardStore((s) => s.provenance);
  const statuses = Object.values(provenance).map((p) => p.status);
  if (!statuses.some((s) => s !== 'given')) return null;
  return (
    <p className="board__legend">
      {statuses.includes('checked') && (
        <span>
          <CircleCheck size={13} aria-hidden="true" /> {t('board.checked')}
        </span>
      )}
      {statuses.includes('unverified') && (
        <span className="is-warn">
          <CircleAlert size={13} aria-hidden="true" /> {t('board.unverified')}
        </span>
      )}
    </p>
  );
}

/** The scaled board surface for the shown face, with the camera following the pen. */
function BoardSheet() {
  const t = useT();
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const face = useBoardStore((s) => s.face);
  const layout = useBoardStore((s) => s.layout);
  const focus = useBoardStore((s) => s.focus);
  const marks = useBoardStore((s) => s.marks);
  const pen = useBoardStore((s) => s.pen);
  const penMode = useBoardStore((s) => s.penMode);
  const strokes = useBoardStore((s) => s.strokes);
  const status = useBoardStore((s) => s.status);
  const height = layout.faces[face]?.height ?? 700;
  const elements = layout.elements.filter((e) => e.face === face);

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => {
      setScale(Math.max(0.3, (node.clientWidth - 2) / BOARD_W));
    };
    update();
    // Very old engines (and jsdom) have no ResizeObserver: the first measurement stays.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Camera: keep what the teacher is writing in view, like a teacher stepping along the board.
  useEffect(() => {
    const node = viewport.current;
    const e = focus ? layout.elements.find((x) => x.id === focus) : undefined;
    if (!node || !e || e.face !== face) return;
    const top = e.y * scale;
    const bottom = (e.y + e.h) * scale;
    if (bottom > node.scrollTop + node.clientHeight * 0.85 || top < node.scrollTop) {
      // `scroll-behavior: smooth` (board.css) makes this a camera pan.
      node.scrollTop = Math.max(0, bottom - node.clientHeight * 0.7);
    }
  }, [focus, face, scale, layout]);

  const drawing = useRef<[number, number][] | null>(null);
  const [live, setLive] = useState<[number, number][] | null>(null);
  const toBoard = (e: PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };

  return (
    <div className="board__viewport" ref={viewport} data-pen={penMode || undefined}>
      <div className="board__scaler" style={{ width: BOARD_W * scale, height: height * scale }}>
        <div
          className="board__sheet"
          style={{ width: BOARD_W, height, transform: `scale(${String(scale)})` }}
        >
          <svg className="board__rules" width={BOARD_W} height={height} aria-hidden="true">
            <line
              x1={COLUMNS.side.x + COLUMNS.side.w + 20}
              y1={COLUMN_TOP - 8}
              x2={COLUMNS.side.x + COLUMNS.side.w + 20}
              y2={height - 30}
            />
            <line
              x1={COLUMNS.right.x - 20}
              y1={COLUMN_TOP - 8}
              x2={COLUMNS.right.x - 20}
              y2={height - 30}
            />
          </svg>
          {elements.map((e) =>
            e.kind === 'text' ? <TextEl key={e.id} element={e} /> : <DrawEl key={e.id} id={e.id} />,
          )}
          <svg className="board__marks" width={BOARD_W} height={height} aria-hidden="true">
            {marks
              .filter((m) => m.face === face)
              .map((m) => (
                <MarkPath key={m.key} mark={m} />
              ))}
          </svg>
          <svg
            className="board__student"
            width={BOARD_W}
            height={height}
            role={penMode ? 'img' : undefined}
            aria-label={penMode ? t('board.penArea') : undefined}
            aria-hidden={penMode ? undefined : true}
            onPointerDown={(e) => {
              if (!penMode) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drawing.current = [toBoard(e)];
              setLive(drawing.current);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              drawing.current = [...drawing.current, toBoard(e)];
              setLive(drawing.current);
            }}
            onPointerUp={() => {
              const pts = drawing.current;
              drawing.current = null;
              setLive(null);
              if (pts && pts.length > 1) useBoardStore.getState().addStroke({ face, points: pts });
            }}
          >
            {[
              ...strokes.filter((s) => s.face === face).map((s) => s.points),
              ...(live ? [live] : []),
            ].map((pts, i) => (
              <polyline key={i} points={pts.map((p) => p.join(',')).join(' ')} />
            ))}
          </svg>
          {pen && status !== 'done' && (
            <PenLine
              className="board__pen"
              size={34}
              style={{ left: pen.x, top: pen.y - 34 }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
}

const ROLE_CLASS: Record<TextElement['role'], string> = {
  title: 'is-title',
  heading: 'is-heading',
  body: 'is-body',
  keyword: 'is-keyword',
  note: 'is-note',
  result: 'is-result',
};

/** One written element, revealed unit by unit as the pen goes. */
const TextEl = memo(function TextEl({ element: e }: { element: TextElement }) {
  const t = useT();
  const progress = useBoardStore((s) => s.progress[e.id] ?? 0);
  const erased = useBoardStore((s) => s.erased[e.id] ?? false);
  const prov = useBoardStore((s) => s.provenance[e.id]);
  const jitter = rough.letterJitter(rough.seedOf(e.id), e.length + 8);
  // Where each token starts in the pen's unit count (a formula is one unit).
  const starts: number[][] = [];
  let count = 0;
  for (const line of e.lines) {
    const row: number[] = [];
    for (const tok of line.tokens) {
      row.push(count);
      count += tok.kind === 'math' ? 1 : tok.value.length + 1;
    }
    starts.push(row);
  }
  const renderLine = (line: Line, li: number) => (
    <div key={li} className="board__line" style={{ top: line.y, height: line.h }}>
      {line.tokens.map((tok, ti) => {
        const start = starts[li]?.[ti] ?? 0;
        if (tok.kind === 'math') {
          const frac = Math.max(0, Math.min(1, progress - start));
          return (
            <span
              key={ti}
              className="board__math"
              style={{
                marginLeft: tok.space,
                fontSize: e.fontSize * e.scale,
                clipPath: `inset(-20% ${String((1 - frac) * 100)}% -20% -2%)`,
              }}
              // KaTeX output (trust: false): escaped text, no links or scripts.
              dangerouslySetInnerHTML={{ __html: renderMath(tok.value) }}
            />
          );
        }
        return (
          <span key={ti} className="board__word" style={{ marginLeft: tok.space }}>
            {Array.from(tok.value).map((ch, ci) => {
              const j = jitter[(start + ci) % jitter.length];
              return (
                <span
                  key={ci}
                  className="board__char"
                  style={{
                    visibility: start + ci < progress ? 'visible' : 'hidden',
                    transform: j
                      ? `translateY(${String(j.dy)}px) rotate(${String(j.rotate)}deg) scale(${String(j.scale)})`
                      : undefined,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
  return (
    <div
      className={cx('board__el', ROLE_CLASS[e.role], erased && 'is-erased')}
      style={{ left: e.x, top: e.y, width: e.w + 40, height: e.h, fontSize: e.fontSize }}
      data-id={e.id}
    >
      <span className="sr-only">{e.source}</span>
      <div aria-hidden="true">{e.lines.map(renderLine)}</div>
      {prov && prov.status !== 'given' && progress >= e.length && (
        <span
          className={cx('board__prov', prov.status === 'unverified' && 'is-warn')}
          style={{ left: e.w + 6 }}
          title={prov.status === 'checked' ? t('board.checked') : t('board.unverified')}
        >
          {prov.status === 'checked' ? (
            <CircleCheck size={18} aria-label={t('board.checked')} />
          ) : (
            <CircleAlert size={18} aria-label={t('board.unverified')} />
          )}
        </span>
      )}
    </div>
  );
});

function DrawEl({ id }: { id: string }) {
  const e = useBoardStore((s) => s.layout.elements.find((x) => x.id === id));
  const shown = useBoardStore((s) => (s.progress[id] ?? 0) > 0);
  if (!e || e.kind !== 'draw') return null;
  return (
    <div
      className="board__el board__drawing"
      style={{ left: e.x, top: e.y, width: e.w, height: e.h }}
    >
      <BoardDrawing element={e} shown={shown} />
    </div>
  );
}

function MarkPath({ mark }: { mark: BoardMark }) {
  const cls = cx('board__mark', `is-${mark.kind}`, mark.shown && 'is-shown');
  if (mark.kind === 'arrow' && mark.to) {
    const a = rough.arrow(mark.box, mark.to, mark.seed);
    return (
      <g className={cls}>
        <path d={a.shaft} pathLength={1} />
        <path d={a.head} pathLength={1} />
        {mark.label && (
          <text x={a.mid[0]} y={a.mid[1] - 8} className="board__mark-label">
            {mark.label}
          </text>
        )}
      </g>
    );
  }
  const d =
    mark.kind === 'underline'
      ? rough.underline(mark.box, mark.seed)
      : mark.kind === 'circle'
        ? rough.circle(mark.box, mark.seed)
        : mark.kind === 'box'
          ? rough.rect(mark.box, mark.seed)
          : mark.kind === 'highlight'
            ? rough.highlight(mark.box, mark.seed)
            : rough.strike(mark.box, mark.seed);
  return <path className={cls} d={d} pathLength={1} />;
}
