import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { useOnboardingPhase } from '@/app/learner/onboardingPhase';
import { useNavigationStore } from '@/app/navigationStore';
import { endTour, useProjectUi } from './uiStore';

export interface TourStep {
  /** CSS selector of the highlighted element (none, or not on screen: centered card). */
  target?: string;
  title: MessageKey;
  body: MessageKey;
}

const STEPS: TourStep[] = [
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
  const step = useProjectUi((s) => s.tourStep);
  // Onboarding (level, subjects), the safety question and "Kết nối AI" come first; the tour
  // explains the lab, so it waits until the learner opens "Phòng thí nghiệm".
  const inLab = useNavigationStore((s) => s.screen === 'lab');
  const waiting = useOnboardingPhase() !== 'tour' || !inLab;
  // While the tour waits (onboarding, launch page, teacher page) nothing is rendered, so Esc
  // belongs to whatever is on screen: it must not silently end a tour the learner has not seen.
  if (step === null || waiting) return null;
  return (
    <TourOverlay
      steps={STEPS}
      step={step}
      onStep={(next) => {
        useProjectUi.setState({ tourStep: next });
      }}
      onEnd={endTour}
    />
  );
}

/**
 * A step-by-step guide over the screen: spotlight on each step's element, a card with
 * Back / Next / Skip, Esc to close. Shared by the lab's first-run tour and Science Studio's
 * "Cách học" guide.
 */
export function TourOverlay({
  steps,
  step,
  onStep,
  onEnd,
}: {
  steps: readonly TourStep[];
  step: number;
  onStep: (step: number) => void;
  onEnd: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const bodyId = useId();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);
  const current = steps[step];

  useLayoutEffect(() => {
    if (!current) return;
    const measure = () => {
      const el = current.target ? document.querySelector(current.target) : null;
      // A target inside a scrolling screen (Science Studio) may be below the fold. jsdom has no
      // scrollIntoView.
      if (el && 'scrollIntoView' in el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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

  // Closing gives the keyboard focus back to whatever had it (e.g. the "Cách học" button).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    cardRef.current?.querySelector<HTMLButtonElement>('.btn--accent')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      if (e.key !== 'Tab') return;
      // Tab wraps around the card's buttons. Focus elsewhere (the chat bubble, the Ctrl+K
      // palette, a dialog opened on top) is left alone.
      const buttons = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      const first = buttons[0];
      const lastButton = buttons[buttons.length - 1];
      if (!first || !lastButton) return;
      const active = document.activeElement;
      const inside = cardRef.current?.contains(active) ?? false;
      if (inside && (e.shiftKey ? active === first : active === lastButton)) {
        e.preventDefault();
        (e.shiftKey ? lastButton : first).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [current, onEnd]);

  if (!current) return null;
  const last = step === steps.length - 1;
  const go = (d: number) => {
    onStep(step + d);
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
  // The card always stays inside the window, whatever the target's position.
  top = Math.min(Math.max(GAP, top), vh - cardH - GAP);

  return (
    <div
      className="tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
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
        <p className="tour__counter mono">{t('tour.counter', { i: step + 1, n: steps.length })}</p>
        <h2 id={titleId}>{t(current.title)}</h2>
        <p id={bodyId}>{t(current.body)}</p>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost" onClick={onEnd}>
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
              if (last) onEnd();
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
