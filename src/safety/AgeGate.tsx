import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { checkAiStatus } from '@/app/ai/useAiStatus';
import { getSafety, toSafetyError, type SafetyStatus } from './safety';
import {
  closeGate,
  loadSafety,
  openPrivacy,
  setSafetyStatus,
  useGateVisible,
  useSafetyStore,
} from './safetyStore';
import './safety.css';

/** Saves a new status and refreshes the AI pill (the gateway follows the same rule). */
function applied(status: SafetyStatus): SafetyStatus {
  setSafetyStatus(status);
  void checkAiStatus();
  return status;
}

/**
 * First-run safety gate (PROMPT_PHAN_2 A3): "Tôi đủ 18 tuổi" (with the terms) or "Tôi chưa đủ
 * 18 tuổi". Simulations work either way; the AI only after the first answer.
 */
export function AgeGate({ hold = false }: { hold?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  // `hold`: the first-run onboarding (level, subjects) comes before the gate.
  const visible = useGateVisible() && !hold;
  const status = useSafetyStore((s) => s.status);

  useEffect(() => {
    void loadSafety().catch(() => undefined);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (visible && !d.open) d.showModal();
    if (!visible && d.open) d.close();
  }, [visible]);

  return (
    <dialog
      ref={ref}
      className="dialog age-gate"
      aria-labelledby="age-gate-title"
      onCancel={(e) => {
        // Esc: the question has to be answered once (one click either way).
        e.preventDefault();
        if (status?.answered) closeGate();
      }}
      onClose={() => {
        // Chromium (WebView2) closes a modal dialog on Esc even when its cancel event was
        // prevented: an unanswered gate comes straight back, an answered one is put away.
        const d = ref.current;
        if (!visible || !d) return;
        if (status?.answered) closeGate();
        else if (!d.open) d.showModal();
      }}
    >
      <header className="dialog__header">
        <h2 id="age-gate-title">
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.gate.title')}
        </h2>
      </header>
      {visible && status && <MainGate />}
    </dialog>
  );
}

function MainGate() {
  const t = useT();
  const [read, setRead] = useState(false);
  const [error, setError] = useState('');
  const answer = async (adult: boolean) => {
    setError('');
    try {
      applied(await getSafety().answerAdult(adult));
      closeGate();
    } catch (e) {
      const err = toSafetyError(e);
      setError(err.message || err.code);
    }
  };
  return (
    <>
      <div className="dialog__body age-gate__body">
        <p>{t('safety.gate.mainIntro')}</p>
        <label className="age-gate__check">
          <input
            type="checkbox"
            checked={read}
            onChange={(e) => {
              setRead(e.target.checked);
            }}
          />
          <span>{t('safety.gate.readTerms')}</span>
        </label>
        <button type="button" className="link-btn" onClick={openPrivacy}>
          {t('safety.gate.openTerms')}
        </button>
        <p className="muted small">{t('safety.gate.minorNote')}</p>
        {error && (
          <p className="small ai-settings__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="dialog__footer">
        <button
          type="button"
          className="btn"
          onClick={() => {
            void answer(false);
          }}
        >
          {t('safety.gate.minor')}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          disabled={!read}
          onClick={() => {
            void answer(true);
          }}
        >
          {t('safety.gate.adult')}
        </button>
      </footer>
    </>
  );
}
