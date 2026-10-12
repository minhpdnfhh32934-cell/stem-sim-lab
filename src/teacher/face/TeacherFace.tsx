import { useEffect, useRef } from 'react';
import { cx } from '@/ui/cx';
import './face.css';

export type TeacherMood = 'idle' | 'thinking' | 'happy' | 'confused' | 'speaking';

interface TeacherFaceProps {
  mood?: TeacherMood;
  /** When true, the eyes gently follow the mouse cursor. Off by default. */
  trackCursor?: boolean;
  className?: string;
}

/** Maximum pupil travel in SVG units (viewBox is 120x120). */
const GLANCE_RANGE = 3;

/**
 * The teacher's face in the project's original vector style. Replaces the generic bot
 * icon wherever the teacher appears; all surrounding interactions are unchanged.
 */
export function TeacherFace({ mood = 'idle', trackCursor = false, className }: TeacherFaceProps) {
  const root = useRef<SVGSVGElement>(null);
  const pupils = useRef<SVGGElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!trackCursor) return;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const dx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
      const dy = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, dist / 1.5);
      target.current = {
        x: (dx / dist) * GLANCE_RANGE * pull,
        y: (dy / dist) * GLANCE_RANGE * pull,
      };
    };
    const tick = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.12;
      pos.current.y += (target.current.y - pos.current.y) * 0.12;
      pupils.current?.setAttribute(
        'transform',
        `translate(${pos.current.x.toFixed(2)} ${pos.current.y.toFixed(2)})`,
      );
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [trackCursor]);

  return (
    <svg
      ref={root}
      viewBox="0 0 120 120"
      className={cx('teacher-face', className)}
      data-mood={mood}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="44" className="teacher-face__head" />
      {mood === 'thinking' ? (
        <>
          <path d="M38 43 q8 -6 16 0" className="teacher-face__brow" />
          <path d="M66 43 q8 -6 16 0" className="teacher-face__brow" />
        </>
      ) : mood === 'confused' ? (
        <>
          <path d="M38 47 q8 -6 16 0" className="teacher-face__brow" />
          <path d="M66 51 l16 -4" className="teacher-face__brow" />
        </>
      ) : (
        <>
          <path d="M38 47 q8 -6 16 0" className="teacher-face__brow" />
          <path d="M66 47 q8 -6 16 0" className="teacher-face__brow" />
        </>
      )}
      <g ref={pupils}>
        {mood === 'happy' ? (
          <>
            <path d="M40 57 q6 -7 12 0" className="teacher-face__brow" />
            <path d="M68 57 q6 -7 12 0" className="teacher-face__brow" />
          </>
        ) : (
          <>
            <ellipse cx="46" cy="57" rx="4" ry="5" className="teacher-face__eye" />
            <ellipse cx="74" cy="57" rx="4" ry="5" className="teacher-face__eye" />
          </>
        )}
      </g>
      {mood === 'speaking' ? (
        <ellipse cx="60" cy="78" rx="6" ry="7" className="teacher-face__mouth-open" />
      ) : mood === 'happy' ? (
        <path d="M42 74 q18 14 36 0 q-18 6 -36 0" className="teacher-face__mouth" />
      ) : mood === 'confused' ? (
        <path d="M46 78 q7 -5 14 0 q7 5 14 0" className="teacher-face__mouth" />
      ) : (
        <path d="M46 76 q14 10 28 0" className="teacher-face__mouth" />
      )}
    </svg>
  );
}
