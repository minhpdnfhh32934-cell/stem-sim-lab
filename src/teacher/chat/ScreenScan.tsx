import { useEffect, useState } from 'react';

/**
 * A Gemini-style scan band sweeping across the screen when the learner turns on
 * "take information from the screen". Purely decorative feedback: no screenshot is
 * taken and no pixel is read — the context comes from app state (see context.ts).
 */
export function ScreenScan() {
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    const onScan = () => {
      setSweep((n) => n + 1);
    };
    window.addEventListener('stemsim:screen-scan', onScan);
    return () => {
      window.removeEventListener('stemsim:screen-scan', onScan);
    };
  }, []);
  useEffect(() => {
    if (sweep === 0) return;
    const timer = window.setTimeout(() => {
      setSweep(0);
    }, 1100);
    return () => {
      window.clearTimeout(timer);
    };
  }, [sweep]);
  if (sweep === 0) return null;
  return (
    <div className="screen-scan" aria-hidden="true">
      <div className="screen-scan__band" />
    </div>
  );
}
