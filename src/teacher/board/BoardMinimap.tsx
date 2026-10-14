import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import { useBoardStore } from './boardStore';
import { BOARD_W } from './layout';
import { scrollForRow, visibleBand, visibleColumns } from './minimap';

/** Largest size of the map on screen (px); the board is scaled down to fit inside. */
const MAP_W = 72;
const MAP_H = 168;
/** Below this the board fits (almost) on screen and the map would only add clutter. */
const SHOW_RATIO = 1.15;

/** The part of the board on screen, in board units. */
interface Seen {
  top: number;
  height: number;
  left: number;
  width: number;
}

/**
 * Minimap of a long board face (gallery pattern 104): every written block as a small bar, the
 * part on screen as a frame. Click or drag on it to move there (sideways too when the board is
 * zoomed in). A mouse/touch convenience only (aria-hidden): the board itself scrolls with the
 * keyboard and the text is in the page.
 */
export function BoardMinimap({
  viewport,
  scale,
  height,
  zoomed = false,
  onMove,
}: {
  viewport: RefObject<HTMLDivElement | null>;
  scale: number;
  height: number;
  zoomed?: boolean;
  /** The learner moves the view with the map (the board's camera then leaves it to them). */
  onMove?: () => void;
}) {
  const face = useBoardStore((s) => s.face);
  const elements = useBoardStore((s) => s.layout.elements);
  const progress = useBoardStore((s) => s.progress);
  const [view, setView] = useState<Seen | null>(null);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => {
      setView({
        ...visibleBand(node.scrollTop, node.clientHeight, scale),
        ...visibleColumns(node.scrollLeft, node.clientWidth, scale),
      });
    };
    update();
    node.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => {
      node.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [viewport, scale, height]);

  if (!view) return null;
  const tall = height > view.height * SHOW_RATIO;
  const wide = zoomed && BOARD_W > view.width * SHOW_RATIO;
  if (!tall && !wide) return null;
  const k = Math.min(MAP_W / BOARD_W, MAP_H / height);
  // The frame: the whole width unless zoomed in (inset so its stroke stays inside the map).
  const left = Math.max(8, view.left);
  const right = view.width > 0 ? Math.min(BOARD_W - 8, view.left + view.width) : BOARD_W - 8;

  const moveTo = (e: PointerEvent<SVGSVGElement>) => {
    const node = viewport.current;
    if (!node) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * height;
    const x = ((e.clientX - r.left) / r.width) * BOARD_W;
    const top = scrollForRow(y, scale, node.clientHeight, node.scrollHeight);
    const sideways = scrollForRow(x, scale, node.clientWidth, node.scrollWidth);
    onMove?.();
    // Straight there: the board's smooth scrolling would lag behind a dragging finger.
    // (jsdom has no element scrollTo.)
    if (typeof node.scrollTo === 'function')
      node.scrollTo({ top, left: sideways, behavior: 'instant' });
  };

  return (
    <div className="board__minimap" aria-hidden="true">
      <svg
        width={BOARD_W * k}
        height={height * k}
        viewBox={`0 0 ${String(BOARD_W)} ${String(height)}`}
        preserveAspectRatio="none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => {
          // Captured = the button is still down (a drag that started on the map).
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e);
        }}
      >
        {elements
          .filter((el) => el.face === face)
          .map((el) => (
            <rect
              key={el.id}
              className={(progress[el.id] ?? 0) > 0 ? 'is-written' : undefined}
              x={el.x}
              y={el.y}
              width={el.w}
              height={Math.max(el.h, 14)}
              rx={6}
            />
          ))}
        <rect
          className="board__minimap-view"
          x={left}
          y={Math.max(0, view.top)}
          width={Math.max(16, right - left)}
          height={Math.min(view.height, height)}
          rx={14}
        />
      </svg>
    </div>
  );
}
