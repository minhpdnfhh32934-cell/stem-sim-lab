import { useEffect, useState, type CSSProperties } from 'react';
import { useT } from '@/app/i18n';
import { effectsOn, reducedMotion } from './fx';

/** The opening plays this long (ms), then fades into the app; with reduced motion, a still. */
export const PLAY_MS = 2500;
export const PLAY_MS_STILL = 700;
const LEAVE_MS = 450;
const LEAVE_MS_STILL = 250;
/** How often it looks for a dialog that should come first (ms). */
const WATCH_MS = 120;

type Phase = 'play' | 'leave' | 'done';

/** Once per start of the app. */
let played = false;

/**
 * The app's opening, after the game's (fx.css): the logo's square pops in, its orbit spins into
 * place while it is drawn, a ball flies along the trajectory, the point mass appears, then the
 * letters of the name rise one by one with a light sweeping across, and it all fades into the
 * launch page (whose reveal waits for it: `data-intro`). A press or a key skips it; a dialog at
 * start (first run, an update) ends it, since it comes first. With reduced motion it is a short
 * still and a fade. Decorative only (aria-hidden): the page under it is already there.
 */
export function Intro() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>(() => (!played && effectsOn() ? 'play' : 'done'));

  useEffect(() => {
    if (phase !== 'play') return;
    played = true;
    const root = document.documentElement;
    root.dataset.intro = 'on';
    const leave = () => {
      setPhase('leave');
    };
    const timer = window.setTimeout(leave, reducedMotion() ? PLAY_MS_STILL : PLAY_MS);
    const watch = window.setInterval(() => {
      if (document.querySelector('dialog[open]')) leave();
    }, WATCH_MS);
    window.addEventListener('pointerdown', leave, true);
    window.addEventListener('keydown', leave, true);
    return () => {
      delete root.dataset.intro;
      window.clearTimeout(timer);
      window.clearInterval(watch);
      window.removeEventListener('pointerdown', leave, true);
      window.removeEventListener('keydown', leave, true);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leave') return;
    const timer = window.setTimeout(
      () => {
        setPhase('done');
      },
      reducedMotion() ? LEAVE_MS_STILL : LEAVE_MS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [phase]);

  if (phase === 'done') return null;
  return (
    <div className={phase === 'leave' ? 'fx-intro is-leaving' : 'fx-intro'} aria-hidden="true">
      <div className="fx-intro__mark">
        <svg viewBox="0 0 32 32" focusable="false">
          <rect className="fx-intro__bg" x="1" y="1" width="30" height="30" rx="8" />
          <ellipse
            className="fx-intro__orbit"
            cx="16"
            cy="16"
            rx="10.5"
            ry="4.6"
            pathLength={100}
          />
          <path className="fx-intro__arc" d="M6.5 23.5 Q 14 5.5 25.5 20" />
          <circle className="fx-intro__dot" cx="16" cy="16" r="2.6" />
        </svg>
        <span className="fx-intro__ball" />
      </div>
      <div className="fx-intro__word">
        {Array.from(t('app.name')).map((letter, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties}>
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
