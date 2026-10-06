import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { useOnboardingPhase } from '@/app/learner/onboarding';
import { endTour, useProjectUi } from './uiStore';

interface Step {
  /** CSS selector of the highlighted element (none: centered card). */
  target?: string;
  title: MessageKey;
  body: MessageKey;
}

const STEPS: Step[] = [
  { title: 'tour.welcomeTitle', body: 'tour.welcomeBody' },
  { target: '[data-tour="subjects"]', title: 'tour.subjectTitle', body: 'tour.subjectBody' },
  { target: '[data-tour="library"]', title: 'tour.libraryTitle', body: 'tour.libraryBody' },
  { target: '[data-tour="problem"]', title: 'tour.problemTitle', body: 'tour.problemBody' },
  { target: '.stage', title: 'tour.stageTitle', body: 'tour.stageBody' },
  { target: '[data-tour="inspector"]', title: 'tour.inspectorTitle', body: 'tour.inspectorBody' },
  { target: '[data-tour="file"]', title: 'tour.fileTitle', body: 'tour.fileBody' },
];

const CARD_W = 340;
const GAP = 12;

/** First-run tour (can be reopened from the menu). */
export function Tour() {
  const t = useT();
  const step = useProjectUi((s) => s.tourStep);
  // Onboarding (level, subjects), the safety question and "Kết nối AI" come first.
  const waiting = useOnboardingPhase() !== 'tour';
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);
  const current = step === null ? undefined : STEPS[step];

  useLayoutEffect(() => {
    if (!current) return;
    const measure = () => {
      const el = current.target ? document.querySelector(current.target) : null;
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
      if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [current]);

  useEffect(() => {
    if (!current) return;
    cardRef.current?.querySelector<HTMLButtonElement>('.btn--accent')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [current]);

  if (step === null || !current || waiting) return null;
  const last = step === STEPS.length - 1;
  const go = (d: number) => {
    useProjectUi.setState({ tourStep: step + d });
  };

  // Card below the target if there is room, else above, else beside; centered without target.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = vh / 2 - cardH / 2;
  let left = vw / 2 - CARD_W / 2;
  if (rect) {
    left = Math.min(Math.max(GAP, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - GAP);
    if (rect.bottom + GAP + cardH < vh) top = rect.bottom + GAP;
    else if (rect.top - GAP - cardH > 0) top = rect.top - GAP - cardH;
    else {
      top = Math.min(Math.max(GAP, rect.top), vh - cardH - GAP);
      left =
        rect.right + GAP + CARD_W < vw ? rect.right + GAP : Math.max(GAP, rect.left - GAP - CARD_W);
    }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="tour__spot"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : (
        <div className="tour__backdrop" />
      )}
      <div ref={cardRef} className="tour__card" style={{ top, left, width: CARD_W }}>
        <p className="tour__counter mono">{t('tour.counter', { i: step + 1, n: STEPS.length })}</p>
        <h2 id="tour-title">{t(current.title)}</h2>
        <p>{t(current.body)}</p>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost" onClick={endTour}>
            {t('tour.skip')}
          </button>
          <span className="tour__spacer" />
          {step > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                go(-1);
              }}
            >
              {t('tour.back')}
            </button>
          )}
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => {
              if (last) endTour();
              else go(1);
            }}
          >
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
