import {
  Eraser,
  FastForward,
  Gauge,
  LassoSelect,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Shrink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useRef } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { cx } from '@/ui/cx';
import { MAX_ZOOM, MIN_ZOOM, PEN_SPEEDS, nextZoom, useBoardStore } from './boardStore';
import { backToLesson, finishNow, pauseLesson, replayLesson, resumeLesson } from './lesson';
import { useToolbarFit } from './toolbarFit';

/**
 * The whiteboard's toolbar: playback, the pen's pace, zoom, circling to ask and the learner's
 * pen. It stays on one row (toolbarFit.ts): the buttons marked `data-compact-from` show their
 * icon only when the names do not fit, the playback button last.
 */
export function BoardToolbar({ hasLesson }: { hasLesson: boolean }) {
  const t = useT();
  const status = useBoardStore((s) => s.status);
  const face = useBoardStore((s) => s.face);
  const speed = useBoardStore((s) => s.speed);
  const penMode = useBoardStore((s) => s.penMode);
  const askMode = useBoardStore((s) => s.askMode);
  const pausedForAsk = useBoardStore((s) => s.pausedForAsk);
  const zoom = useBoardStore((s) => s.zoom);
  const set = useBoardStore((s) => s.set);
  const locale = useSettingsStore((s) => s.locale);
  const toolbar = useRef<HTMLDivElement>(null);
  useToolbarFit(toolbar);

  const playing = status === 'playing';
  const resume = pausedForAsk ? 'board.ask.resume' : 'board.resume';
  return (
    <div ref={toolbar} className="board__toolbar" role="toolbar" aria-label={t('board.controls')}>
      {/* Playback controls appear with the first lesson; an empty board only offers the pen. */}
      {hasLesson && (
        <>
          {playing ? (
            <button
              type="button"
              className="btn board__tool"
              data-compact-from="2"
              onClick={pauseLesson}
              title={t('board.pause')}
            >
              <Pause size={15} aria-hidden="true" />
              <span className="board__tool-label">{t('board.pause')}</span>
            </button>
          ) : status === 'paused' ? (
            // Paused because the learner began circling: going back lets the selection go.
            <button
              type="button"
              className="btn btn--accent board__tool"
              data-compact-from="2"
              onClick={pausedForAsk ? backToLesson : resumeLesson}
              title={t(resume)}
            >
              <Play size={15} aria-hidden="true" />
              <span className="board__tool-label">{t(resume)}</span>
            </button>
          ) : (
            // While a new answer is being prepared, the last lesson is not the one shown.
            <button
              type="button"
              className="btn board__tool"
              data-compact-from="2"
              disabled={status === 'preparing'}
              onClick={replayLesson}
              title={t('board.replay')}
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span className="board__tool-label">{t('board.replay')}</span>
            </button>
          )}
          <button
            type="button"
            className="btn board__tool"
            disabled={!(playing || status === 'paused')}
            onClick={finishNow}
            title={t('board.finishHint')}
          >
            <FastForward size={15} aria-hidden="true" />
            <span className="board__tool-label">{t('board.finish')}</span>
          </button>
          {/* The pen's pace as a short list (as tall as a button), so "Viết nhanh" and
              "Khoanh để hỏi" keep their names on a narrow board. */}
          <label className="board__speed" title={t('board.speed')}>
            <Gauge size={15} aria-hidden="true" />
            <select
              aria-label={t('board.speed')}
              value={String(speed)}
              onChange={(e) => {
                const v = PEN_SPEEDS.find((s) => String(s) === e.target.value);
                if (v !== undefined) set({ speed: v });
              }}
            >
              {PEN_SPEEDS.map((v) => (
                <option key={v} value={String(v)}>
                  {formatNumber(locale, v)}×
                </option>
              ))}
            </select>
          </label>
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
            className="btn board__tool"
            data-compact-from="1"
            onClick={() => {
              set({ zoom: 1 });
            }}
            title={t('board.zoomFitHint')}
          >
            <Shrink size={15} aria-hidden="true" />
            <span className="board__tool-label">{t('board.zoomFit')}</span>
          </button>
        )}
      </div>
      {/* Circling to ask needs something on the board; the pen and it never draw together. */}
      {hasLesson && (
        <button
          type="button"
          className={cx('btn board__tool', askMode && 'btn--accent')}
          aria-pressed={askMode}
          onClick={() => {
            set(askMode ? { askMode: false } : { askMode: true, penMode: false });
          }}
          title={t('board.ask.toolHint')}
        >
          <LassoSelect size={15} aria-hidden="true" />
          <span className="board__tool-label">{t('board.ask.tool')}</span>
        </button>
      )}
      <button
        type="button"
        className={cx('btn board__tool', penMode && 'btn--accent')}
        data-compact-from="1"
        aria-pressed={penMode}
        onClick={() => {
          set(penMode ? { penMode: false } : { penMode: true, askMode: false });
        }}
        title={t('board.penHint')}
      >
        <Pencil size={15} aria-hidden="true" />
        <span className="board__tool-label">{t('board.myPen')}</span>
      </button>
      <button
        type="button"
        className="btn board__icon-btn"
        onClick={() => {
          useBoardStore.getState().clearStrokes(face);
        }}
        title={t('board.clearPen')}
        aria-label={t('board.clearPen')}
      >
        <Eraser size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
