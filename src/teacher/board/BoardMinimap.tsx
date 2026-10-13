import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import { useBoardStore } from './boardStore';
import { BOARD_W } from './layout';
import { scrollForRow, visibleBand, type View } from './minimap';

/** Largest size of the map on screen (px); the board is scaled down to fit inside. */
const MAP_W = 72;
const MAP_H = 168;
/** Below this the board fits (almost) on screen and the map would only add clutter. */
const SHOW_RATIO = 1.15;

/**
 * Minimap of a long board face (gallery pattern 104): every written block as a small bar, the
 * part on screen as a frame. Click or drag on it to move there. A mouse/touch convenience only
 * (aria-hidden): the board itself scrolls with the keyboard and the text is in the page.
 */
export function BoardMinimap({
  viewport,
  scale,
  height,
}: {
  viewport: RefObject<HTMLDivElement | null>;
  scale: number;
  height: number;
}) {
  const face = useBoardStore((s) => s.face);
  const elements = useBoardStore((s) => s.layout.elements);
  const progress = useBoardStore((s) => s.progress);
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => {
      setView(visibleBand(node.scrollTop, node.clientHeight, scale));
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

  if (!view || height <= view.height * SHOW_RATIO) return null;
  const k = Math.min(MAP_W / BOARD_W, MAP_H / height);

  const moveTo = (e: PointerEvent<SVGSVGElement>) => {
    const node = viewport.current;
    if (!node) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * height;
    const top = scrollForRow(y, scale, node.clientHeight, node.scrollHeight);
    // Straight there: the board's smooth scrolling would lag behind a dragging finger.
    // (jsdom has no element scrollTo.)
    if (typeof node.scrollTo === 'function') node.scrollTo({ top, behavior: 'instant' });
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
          x={8}
          y={Math.max(0, view.top)}
          width={BOARD_W - 16}
          height={Math.min(view.height, height)}
          rx={14}
        />
      </svg>
    </div>
  );
}
