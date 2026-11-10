import { useEffect } from 'react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { SHOWCASE, stopShowcase, useShowcase } from './showcase';
import './showcase.css';

/**
 * The showcase's caption while it runs. Any press or key stops it; leaving presentation mode
 * (Esc, its exit button) stops it too.
 */
export function ShowcaseOverlay() {
  const t = useT();
  const L = useLocalized();
  const index = useShowcase((s) => s.index);
  const presentation = useLayoutStore((s) => s.presentation);
  const running = index !== null;

  useEffect(() => {
    if (!running) return;
    const stop = () => {
      stopShowcase();
    };
    // Registered after the press or key that started it has finished.
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('keydown', stop, true);
    return () => {
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('keydown', stop, true);
    };
  }, [running]);

  useEffect(() => {
    if (running && !presentation) stopShowcase();
  }, [running, presentation]);

  const scene = index === null ? undefined : SHOWCASE[index];
  if (!scene || index === null) return null;
  return (
    <div className="showcase" role="status" aria-live="polite">
      <p className="showcase__caption">
        <span className="showcase__count">
          {index + 1}/{SHOWCASE.length}
        </span>{' '}
        {L(scene.caption)}
      </p>
      <p className="showcase__hint">{t('showcase.stopHint')}</p>
    </div>
  );
}
