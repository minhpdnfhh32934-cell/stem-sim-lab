import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { cx } from '@/ui/cx';

interface SplitterProps {
  /** `vertical` = a vertical bar that resizes widths; `horizontal` resizes heights. */
  orientation: 'vertical' | 'horizontal';
  /** Current size of the panel being resized, in px. */
  value: number;
  min: number;
  max: number;
  /**
   * +1 if dragging right/down grows the panel (panel is before the splitter),
   * -1 if it shrinks it (panel is after the splitter).
   */
  direction: 1 | -1;
  onResize: (px: number) => void;
  onReset: () => void;
  label: string;
}

const KEY_STEP = 16;

/**
 * Draggable, keyboard-accessible panel divider (WAI-ARIA "window splitter").
 * Double-click restores the default size.
 */
export function Splitter({
  orientation,
  value,
  min,
  max,
  direction,
  onResize,
  onReset,
  label,
}: SplitterProps) {
  const drag = useRef<{ start: number; startValue: number } | null>(null);
  const isVertical = orientation === 'vertical';

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: isVertical ? e.clientX : e.clientY, startValue: value };
    document.body.dataset.resizing = orientation;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = (isVertical ? e.clientX : e.clientY) - drag.current.start;
    onResize(drag.current.startValue + delta * direction);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    delete document.body.dataset.resizing;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow = isVertical ? 'ArrowRight' : 'ArrowDown';
    const shrink = isVertical ? 'ArrowLeft' : 'ArrowUp';
    if (e.key === grow || e.key === shrink) {
      e.preventDefault();
      const sign = (e.key === grow ? 1 : -1) * direction;
      onResize(value + sign * KEY_STEP);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onResize(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onResize(max);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onReset();
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      data-tip={label}
      data-tip-side={isVertical ? 'right' : 'top'}
      className={cx('splitter', `splitter--${orientation}`)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
