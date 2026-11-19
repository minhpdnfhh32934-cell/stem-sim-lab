import { useEffect, useState } from 'react';
import { usePortalStore } from './fx';

/** Its flight (fx.css `fx-portal`, 620 ms) plus a margin, then it is removed. */
export const PORTAL_MS = 700;

/**
 * The logo's orbit flying out from where the learner pressed, drawn in the new screen while it
 * opens (`screenChange`): the circle that reveals the screen also reveals the ring. Removed on a
 * timer rather than on `animationend`, so it never stays when an animation does not run.
 */
export function ScreenPortal() {
  const key = usePortalStore((s) => s.key);
  const [ended, setEnded] = useState(0);
  useEffect(() => {
    if (key === 0) return;
    const timer = window.setTimeout(() => {
      setEnded(key);
    }, PORTAL_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [key]);
  if (key === 0 || ended === key) return null;
  return (
    <div key={key} className="fx-portal" aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <ellipse cx="16" cy="16" rx="10.5" ry="4.6" transform="rotate(-28 16 16)" />
        <circle cx="16" cy="16" r="1.6" />
      </svg>
    </div>
  );
}
