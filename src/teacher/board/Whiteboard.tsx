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
  Shrink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { AiContentBar } from '@/safety/AiContentBar';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { cx } from '@/ui/cx';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  PEN_SPEEDS,
  nextZoom,
  useBoardStore,
  type BoardMark,
} from './boardStore';
import { BoardDrawing } from './BoardDrawing';
import { BoardMinimap } from './BoardMinimap';
import { BOARD_W, boardRules, type BoardElement, type Line, type TextElement } from './layout';
import { clampScroll, rescaleScroll } from './minimap';
import {
  cancelPendingStart,
  claimStart,
  clearBoard,
  continueLesson,
  finishNow,
  pauseLesson,
  playLesson,
  replayLesson,
  reserveStart,
  resumeLesson,
  showFace,
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
  const teacherFace = useBoardStore((s) => s.teacherFace);
  const speed = useBoardStore((s) => s.speed);
  const penMode = useBoardStore((s) => s.penMode);
  const zoom = useBoardStore((s) => s.zoom);
  const subtitle = useBoardStore((s) => s.subtitle);
  const set = useBoardStore((s) => s.set);
  const locale = useSettingsStore((s) => s.locale);
  useEffect(() => {
    // A new answer starts a new lesson; a longer copy of the same answer ("Viết tiếp") is
    // written after what is already on the board; nothing is ever taught twice by itself.
    const store = useBoardStore.getState();
    if (!lesson) {
      // The chat was cleared: the lesson ends and the board is empty again.
      if (store.lessonId !== null) clearBoard();
      return;
    }
    if (store.lessonId === lesson.id && store.lessonContent === lesson.content) return;
    // Written after what is on the board only when the board holds the start of this answer
    // (an empty `lessonContent` means its start was cancelled before it began).
    const append = store.lessonId === lesson.id && store.lessonContent !== '';
    // A new answer stops the old lesson now, not once the fonts are ready: its pen and voice
    // never go on under "Đang chuẩn bị bảng…".
    if (!append) stopLesson();
    store.set({ lessonId: lesson.id, lessonContent: lesson.content });
    if (!append) store.set({ status: 'preparing' });
    const ticket = reserveStart();
    void prepareMeasure().then(() => {
      // Skipped when a newer answer arrived, or the page closed, while the fonts were loading.
      if (!claimStart(ticket)) return;
      void (append ? continueLesson : playLesson)(lesson, browserMeasure);
    });
  }, [lesson]);

  // Hiding the board ("Trò chuyện") pauses the lesson, so coming back shows "Tiếp tục"; leaving
  // the page stops it (and the voice). A start still waiting for the fonts never begins.
  useEffect(
    () => () => {
      cancelPendingStart();
      if (useTeacherStore.getState().open) pauseLesson();
      else stopLesson();
    },
    [],
  );

  // The teacher stops to listen when the learner asks something: the lesson pauses as the chat
  // starts answering, and the sentence it cut is read again on "Tiếp tục".
  useEffect(
    () =>
      useChatStore.subscribe((s, p) => {
        if (s.answering && !p.answering) pauseLesson();
      }),
    [],
  );

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
              // While a new answer is being prepared, the last lesson is not the one shown.
              <button
                type="button"
                className="btn"
                disabled={status === 'preparing'}
                onClick={replayLesson}
              >
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
        {/* Larger writing for the learner who needs it; the board then scrolls sideways too. */}
        <div className="board__zoom" role="group" aria-label={t('board.zoom')}>
          <button
            type="button"
            className="btn board__icon-btn"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => {
              set({ zoom: nextZoom(zoom, -1) });
            }}
            title={t('board.zoomOut')}
            aria-label={t('board.zoomOut')}
          >
            <ZoomOut size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn board__icon-btn"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => {
              set({ zoom: nextZoom(zoom, 1) });
            }}
            title={t('board.zoomIn')}
            aria-label={t('board.zoomIn')}
          >
            <ZoomIn size={15} aria-hidden="true" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                set({ zoom: 1 });
              }}
              title={t('board.zoomFitHint')}
            >
              <Shrink size={15} aria-hidden="true" />
              {t('board.zoomFit')}
            </button>
          )}
        </div>
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
                showFace(i);
              }}
            >
              {t('board.face', { n: i + 1 })}
              {f.title ? ` · ${f.title}` : ''}
              {/* Where the teacher writes, while the lesson is under way. */}
              {i === teacherFace && (playing || status === 'paused') && (
                <span className="board__face-teacher" title={t('board.teacherHere')}>
                  <PenLine size={13} aria-hidden="true" />
                  <span className="sr-only"> {t('board.teacherHere')}</span>
                </span>
              )}
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
      {lesson && (
        <AiContentBar
          {...(lesson.model ? { model: lesson.model } : {})}
          fallback={lesson.fallback === true}
        />
      )}
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

/** Where the view was: scroll and viewport size (px) at the scale they were taken at. */
interface ViewSnapshot {
  top: number;
  left: number;
  h: number;
  w: number;
  scale: number;
}

function snapshotOf(node: HTMLElement, scale: number): ViewSnapshot {
  return {
    top: node.scrollTop,
    left: node.scrollLeft,
    h: node.clientHeight,
    w: node.clientWidth,
    scale,
  };
}

/** Moves the view at once (the board's smooth scrolling is for the camera only). */
function scrollInstant(node: HTMLElement, top: number, left: number): void {
  // (jsdom has no element scrollTo.)
  if (typeof node.scrollTo === 'function') node.scrollTo({ top, left, behavior: 'instant' });
  else {
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}

/** Where the camera is taking the view (scroll px at the scale the sheet is drawn at). */
interface Aim {
  top: number;
  left: number;
}

/** Where the camera looks from: where its pan under way is going, else where the view is. */
function cameraView(node: HTMLElement, aimed: Aim | null): Aim {
  return aimed ?? { top: node.scrollTop, left: node.scrollLeft };
}

/**
 * Moves the camera, both axes in one scroll: setting one axis stops a smooth scroll of the other
 * (Chromium / WebView2), so a pan sideways would cancel the pan down the board. The axis not
 * asked for keeps where the camera is already going, not where the view is half-way there.
 */
function aimCamera(
  node: HTMLElement,
  aimed: { current: Aim | null },
  want: { top?: number; left?: number },
): void {
  const from = cameraView(node, aimed.current);
  const top = clampScroll(want.top ?? from.top, node.scrollHeight, node.clientHeight);
  const left = clampScroll(want.left ?? from.left, node.scrollWidth, node.clientWidth);
  aimed.current = { top, left };
  // `scroll-behavior: smooth` (board.css) makes this a camera pan. (jsdom has no element scrollTo.)
  if (typeof node.scrollTo === 'function') node.scrollTo({ top, left });
  else {
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}

/** What the learner does on the board to move the view themselves. */
const LEARNER_MOVES = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
/** Keys that scroll the board (any other key moves nothing). */
const SCROLL_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);
/**
 * Wheel turns and key presses this close together are one move of the learner's; this long after
 * the last one, a move that left the view where it was (at its edge) changes nothing.
 */
const NO_MOVE_MS = 250;

/** The learner moved the view while the teacher wrote this line: the element and the line. */
interface Held {
  focus: string | null;
  line: number | null;
}

/**
 * The scaled board surface for the shown face, with the camera following the pen. The sheet is
 * the board in board units, scaled to the viewport's width (times the learner's zoom): a resize
 * or a zoom only changes the scale and keeps the same part of the board in view; nothing written
 * ever moves on the board.
 */
function BoardSheet() {
  const t = useT();
  const viewport = useRef<HTMLDivElement>(null);
  /** Scale at which the whole board width fits the viewport (null until it is measured). */
  const [fit, setFit] = useState<number | null>(null);
  const zoom = useBoardStore((s) => s.zoom);
  const scale = (fit ?? 0.6) * zoom;
  /** The scale the sheet is drawn at now (read by the scroll listener and the camera). */
  const drawnScale = useRef(scale);
  /** Where the view was before the scale changed (kept on every scroll). */
  const lastView = useRef<ViewSnapshot | null>(null);
  /**
   * Where the board itself last put the view (a resize, a zoom): the scroll event that follows is
   * not a move of the learner's, and comes a frame later, when the height may have changed again.
   */
  const placedAt = useRef<Aim | null>(null);
  /** The fit last measured (a resize that keeps it changes only the viewport's height). */
  const measuredFit = useRef<number | null>(null);
  /** Where the camera's pan under way is taking the view (null once it arrived or was stopped). */
  const aimed = useRef<Aim | null>(null);
  /**
   * The learner moved the view while the teacher wrote this line (null: not since): the element
   * and the height of the pen's line then.
   */
  const heldOn = useRef<Held | null>(null);
  /**
   * The learner moves the view: the pan under way is no longer the camera's, and the camera
   * leaves the view sideways to the learner until the teacher starts a new line.
   */
  const takeOver = useCallback(() => {
    aimed.current = null;
    const s = useBoardStore.getState();
    heldOn.current = { focus: s.focus, line: s.pen?.y ?? null };
  }, []);
  const face = useBoardStore((s) => s.face);
  const layout = useBoardStore((s) => s.layout);
  const focus = useBoardStore((s) => s.focus);
  const marks = useBoardStore((s) => s.marks);
  const pen = useBoardStore((s) => s.pen);
  const run = useBoardStore((s) => s.run);
  const follow = useBoardStore((s) => s.follow);
  const penMode = useBoardStore((s) => s.penMode);
  const strokes = useBoardStore((s) => s.strokes);
  const status = useBoardStore((s) => s.status);
  const height = layout.faces[face]?.height ?? 700;
  const elements = layout.elements.filter((e) => e.face === face);
  // The teacher's pen only on the face it writes on, and only for the lesson under way.
  const showPen =
    pen !== null &&
    pen.face === face &&
    pen.run === run &&
    (status === 'playing' || status === 'paused');

  /** The learner's stroke being drawn, on the face where it began (null when not drawing). */
  const drawing = useRef<{ face: number; points: [number, number][] } | null>(null);
  const [live, setLive] = useState<{ face: number; points: [number, number][] } | null>(null);
  const stroking = live !== null;
  /** Ends the learner's stroke: kept on the face it was drawn on (a dot alone is dropped). */
  const endStroke = () => {
    const stroke = drawing.current;
    drawing.current = null;
    setLive(null);
    if (stroke && stroke.points.length > 1) useBoardStore.getState().addStroke(stroke);
  };
  // A stroke never moves to another face: when the face changes mid-stroke, it ends where it is.
  useEffect(() => {
    if (drawing.current && drawing.current.face !== face) endStroke();
  }, [face]);

  /**
   * The element the teacher writes, when the view follows the teacher (the lesson plays, the
   * learner follows on that face and is not drawing); else null.
   */
  const followed = (): BoardElement | null => {
    const s = useBoardStore.getState();
    const e = s.focus ? s.layout.elements.find((x) => x.id === s.focus) : undefined;
    return e && e.face === s.face && s.status === 'playing' && s.follow && drawing.current === null
      ? e
      : null;
  };

  /**
   * Puts the view at once where the board wants it (a resize, a zoom) and notes it as asked, not
   * as the browser rounded it: a height that changes over several frames (a panel that slides)
   * then never makes the middle row drift a pixel at a time.
   */
  const placeView = (node: HTMLElement, top: number, left: number, at: number) => {
    const want = {
      top: clampScroll(top, node.scrollHeight, node.clientHeight),
      left: clampScroll(left, node.scrollWidth, node.clientWidth),
    };
    if (Math.abs(want.top - node.scrollTop) >= 0.5 || Math.abs(want.left - node.scrollLeft) >= 0.5)
      scrollInstant(node, want.top, want.left);
    placedAt.current = { top: node.scrollTop, left: node.scrollLeft };
    lastView.current = { ...want, h: node.clientHeight, w: node.clientWidth, scale: at };
  };

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => {
      const next = Math.max(0.3, (node.clientWidth - 2) / BOARD_W);
      const before = lastView.current;
      if (next === measuredFit.current && before) {
        // The same scale, a new height (the window, the subtitle or the legend): the row that
        // was in the middle stays in the middle (unless the camera follows the teacher), and the
        // view is noted again, so the next zoom keeps that row in the middle too.
        if (
          before.h !== node.clientHeight &&
          before.scale === drawnScale.current &&
          followed() === null
        ) {
          const top = rescaleScroll(
            before.top,
            before.h,
            before.scale,
            before.scale,
            node.scrollHeight,
            node.clientHeight,
          );
          // The column stays as noted (unless the browser had to move it).
          const left = Math.abs(node.scrollLeft - before.left) < 1 ? before.left : node.scrollLeft;
          placeView(node, top, left, before.scale);
        } else lastView.current = snapshotOf(node, drawnScale.current);
      }
      measuredFit.current = next;
      setFit(next);
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

  // Where the learner looks is noted on every scroll, at the scale the sheet is drawn at.
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const note = () => {
      // The view arrived where the board put it: what was noted then stays (at the height then,
      // which the next resize step needs, not the height of this later frame).
      const own = placedAt.current;
      placedAt.current = null;
      if (own && Math.abs(node.scrollTop - own.top) < 1 && Math.abs(node.scrollLeft - own.left) < 1)
        return;
      lastView.current = snapshotOf(node, drawnScale.current);
    };
    node.addEventListener('scroll', note, { passive: true });
    return () => {
      node.removeEventListener('scroll', note);
    };
  }, []);

  // The camera's pan ends where it was going (or where the learner stopped it); the learner's
  // wheel, touch, keys or scrollbar take the view over. Drawing with "Bút của em" does not, nor
  // does a click on the writing (a press on the viewport itself is one on its scrollbar).
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const arrived = () => {
      aimed.current = null;
    };
    /** Checks, a moment after the learner's wheel turns or key presses, that they moved the view. */
    let check: number | undefined;
    /** Where the view was when those turns or presses began, and whether the camera was held. */
    let burst: { top: number; left: number; held: Held | null } | null = null;
    const learner = (e: Event) => {
      if (e.type === 'pointerdown' && e.target !== node) return;
      if (e instanceof KeyboardEvent && !SCROLL_KEYS.has(e.key)) return;
      const drawing =
        useBoardStore.getState().penMode &&
        e.target instanceof Element &&
        e.target.closest('.board__student') !== null;
      if (drawing) return;
      const held = heldOn.current;
      takeOver();
      window.clearTimeout(check);
      // A press on the scrollbar or a touch: the learner holds the view (a drag may begin late).
      if (e.type === 'pointerdown' || e.type === 'touchstart') {
        burst = null;
        return;
      }
      // Wheel turns or key presses that left the view where it was (the view at its edge)
      // change nothing: the camera goes on as before them (audit A4 follow-up).
      burst ??= { top: node.scrollTop, left: node.scrollLeft, held };
      check = window.setTimeout(() => {
        const b = burst;
        burst = null;
        if (b && node.scrollTop === b.top && node.scrollLeft === b.left) heldOn.current = b.held;
      }, NO_MOVE_MS);
    };
    node.addEventListener('scrollend', arrived);
    for (const type of LEARNER_MOVES) node.addEventListener(type, learner, { passive: true });
    return () => {
      window.clearTimeout(check);
      node.removeEventListener('scrollend', arrived);
      for (const type of LEARNER_MOVES) node.removeEventListener(type, learner);
    };
  }, [takeOver]);

  // A new scale (the board was measured, the window or the panes were resized, or the learner
  // zoomed): the same part of the board stays in the middle of the view, or, while the teacher
  // writes and the learner follows, the line being written is put in view. Never a jump back to
  // the last element. Nothing is anchored on the guess made before the first measurement.
  useLayoutEffect(() => {
    const node = viewport.current;
    drawnScale.current = scale;
    // A pan aimed at the old scale goes nowhere useful now.
    aimed.current = null;
    if (!node || fit === null) return;
    const before = lastView.current;
    const e = followed();
    const left =
      before && before.scale !== scale
        ? rescaleScroll(
            before.left,
            before.w,
            before.scale,
            scale,
            node.scrollWidth,
            node.clientWidth,
          )
        : node.scrollLeft;
    if (e && (before === null || before.scale !== scale)) {
      scrollInstant(node, Math.max(0, (e.y + e.h) * scale - node.clientHeight * 0.7), left);
    } else if (before && before.scale !== scale) {
      const top = rescaleScroll(
        before.top,
        before.h,
        before.scale,
        scale,
        node.scrollHeight,
        node.clientHeight,
      );
      placeView(node, top, left, scale);
      return;
    }
    lastView.current = snapshotOf(node, scale);
  }, [scale, fit]);

  // Another face: a pan aimed on the face before goes nowhere useful.
  useEffect(() => {
    aimed.current = null;
  }, [face]);

  // Camera: keep what the teacher is writing in view, like a teacher stepping along the board.
  // Only while the lesson plays and the learner follows the teacher, never under the learner's
  // own pen (the stroke would jump), and only for the face shown. A new scale does not move it
  // (the effect above keeps the view). It judges from where its pan under way is going, not
  // from where the view is half-way there, and moves both axes at once (`aimCamera`).
  useEffect(() => {
    const node = viewport.current;
    const e = focus ? layout.elements.find((x) => x.id === focus) : undefined;
    if (!node || !e || e.face !== face || status !== 'playing' || !follow || stroking) return;
    const k = drawnScale.current;
    const top = e.y * k;
    const bottom = (e.y + e.h) * k;
    const view = cameraView(node, aimed.current);
    if (bottom > view.top + node.clientHeight * 0.85 || top < view.top)
      aimCamera(node, aimed, { top: Math.max(0, bottom - node.clientHeight * 0.7) });
  }, [focus, face, layout, status, follow, stroking]);

  // Zoomed in, the camera also follows the pen sideways: once when the pen leaves the part of
  // the board it is going to (never again for every letter while the pan is under way), and not
  // while the learner looks elsewhere on the line the teacher writes.
  const penX = showPen ? pen.x : null;
  const penY = showPen ? pen.y : null;
  useEffect(() => {
    const node = viewport.current;
    if (!node || penX === null || zoom === 1 || status !== 'playing' || !follow || stroking) return;
    if (heldOn.current) {
      // Held until the teacher starts a new line: the next element, or a new line of this one.
      if (heldOn.current.focus === focus && heldOn.current.line === penY) return;
      heldOn.current = null;
    }
    const x = penX * drawnScale.current;
    const width = node.clientWidth;
    const view = cameraView(node, aimed.current);
    if (x < view.left + width * 0.1 || x > view.left + width * 0.9)
      aimCamera(node, aimed, { left: Math.max(0, x - width * 0.3) });
  }, [penX, penY, focus, zoom, status, follow, stroking]);

  const toBoard = (e: PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };

  return (
    <>
      <div className="board__viewport" ref={viewport} data-pen={penMode || undefined}>
        <div className="board__scaler" style={{ width: BOARD_W * scale, height: height * scale }}>
          <div
            className="board__sheet"
            style={{ width: BOARD_W, height, transform: `scale(${String(scale)})` }}
          >
            {/* Faint rules only between regions in use on this face (none across a wide face). */}
            <svg className="board__rules" width={BOARD_W} height={height} aria-hidden="true">
              {boardRules(layout, face).map((r) => (
                <line
                  key={`${String(r.x)}-${String(r.y1)}`}
                  x1={r.x}
                  y1={r.y1}
                  x2={r.x}
                  y2={r.y2}
                />
              ))}
            </svg>
            {elements.map((e) =>
              e.kind === 'text' ? (
                <TextEl key={e.id} element={e} />
              ) : (
                <DrawEl key={e.id} id={e.id} />
              ),
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
                // The stroke belongs to the face it begins on.
                drawing.current = { face, points: [toBoard(e)] };
                setLive(drawing.current);
              }}
              onPointerMove={(e) => {
                // A move without a pressed button is not drawing (the press ended elsewhere).
                if (!drawing.current || e.buttons === 0) return;
                drawing.current = {
                  face: drawing.current.face,
                  points: [...drawing.current.points, toBoard(e)],
                };
                setLive(drawing.current);
              }}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              onLostPointerCapture={endStroke}
            >
              {[
                ...strokes.filter((s) => s.face === face).map((s) => s.points),
                ...(live && live.face === face ? [live.points] : []),
              ].map((pts, i) => (
                <polyline key={i} points={pts.map((p) => p.join(',')).join(' ')} />
              ))}
            </svg>
            {showPen && (
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
      <BoardMinimap
        viewport={viewport}
        scale={scale}
        height={height}
        zoomed={zoom !== 1}
        onMove={takeOver}
      />
    </>
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
