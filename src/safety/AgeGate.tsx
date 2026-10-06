import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { localDay } from '@/ai/aiStore';
import { checkAiStatus } from '@/app/ai/useAiStatus';
import { getSafety, validPin, type SafetyStatus } from './safety';
import { safetyErrorText } from './pinError';
import {
  closeGate,
  isUnlocked,
  loadSafety,
  openPrivacy,
  refreshUnlock,
  setSafetyStatus,
  useGateVisible,
  useSafetyStore,
} from './safetyStore';
import './safety.css';

/** Saves a new status and refreshes the AI pill (the gateway follows the same rules). */
function applied(status: SafetyStatus): SafetyStatus {
  setSafetyStatus(status);
  void checkAiStatus();
  return status;
}

/**
 * First-run safety gate (PROMPT_PHAN_2 A3).
 * - Main edition: "Tôi đủ 18 tuổi" (with the terms) or "Tôi chưa đủ 18 tuổi". Simulations work
 *   either way; the AI only after the first answer.
 * - Pilot edition: birth year → supervisor PIN → (under 18) recorded parental consent. The
 *   supervisor can choose "Để sau": the app then works without AI.
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
        // Esc: the main-edition question has to be answered (one click either way); the pilot
        // supervisor can postpone.
        e.preventDefault();
        if (status?.edition === 'pilot') closeGate(true);
        else if (status?.answered) closeGate();
      }}
    >
      <header className="dialog__header">
        <h2 id="age-gate-title">
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.gate.title')}
        </h2>
      </header>
      {visible && status && (status.edition === 'pilot' ? <PilotGate /> : <MainGate />)}
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
      setError(safetyErrorText(t, e));
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

function PilotGate() {
  const t = useT();
  const status = useSafetyStore((s) => s.status);
  const unlocked = useSafetyStore((s) => isUnlocked(s));
  if (!status) return null;
  const step = !status.answered
    ? 'year'
    : !status.pinSet
      ? 'pin'
      : status.minor && !status.consentDay
        ? 'consent'
        : 'done';
  return (
    <>
      <div className="dialog__body age-gate__body">
        <p>{t('safety.gate.pilotIntro')}</p>
        {step === 'year' && <YearStep />}
        {step === 'pin' && <PinStep />}
        {step === 'consent' && <ConsentStep needPin={!unlocked} />}
        {step === 'done' && (
          <p className="age-gate__ok" role="status">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            {status.minor
              ? t('safety.settings.consentOn', { day: status.consentDay ?? '' })
              : t('safety.gate.adultTester')}
          </p>
        )}
        {step === 'pin' && !status.minor && (
          <p className="muted small">{t('safety.gate.adultTester')}</p>
        )}
        <button type="button" className="link-btn" onClick={openPrivacy}>
          {t('safety.gate.openTerms')}
        </button>
      </div>
      <footer className="dialog__footer">
        {step === 'done' ? (
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => {
              closeGate();
            }}
          >
            {t('safety.gate.done')}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              closeGate(true);
            }}
          >
            {t('safety.gate.later')}
          </button>
        )}
      </footer>
    </>
  );
}

function YearStep() {
  const t = useT();
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    try {
      applied(await getSafety().setBirthYear(Number(year)));
    } catch (e) {
      setError(safetyErrorText(t, e));
    }
  };
  return (
    <form
      className="age-gate__step"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="ai-settings__field">
        <span>{t('safety.gate.birthYear')}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1900}
          max={2100}
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
          }}
        />
      </label>
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
      <div className="ai-settings__actions">
        <button type="submit" className="btn btn--accent" disabled={!/^\d{4}$/.test(year)}>
          {t('safety.gate.next')}
        </button>
      </div>
    </form>
  );
}

/** Two PIN fields (new + repeat); used by the gate and by Settings → "Đổi mã PIN". */
export function NewPinFields({
  onSubmit,
  label,
}: {
  onSubmit: (pin: string) => Promise<void>;
  label: string;
}) {
  const t = useT();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    if (!validPin(pin)) {
      setError(t('safety.gate.pinInvalid'));
      return;
    }
    if (pin !== again) {
      setError(t('safety.gate.pinMismatch'));
      return;
    }
    try {
      await onSubmit(pin);
      setPin('');
      setAgain('');
    } catch (e) {
      setError(safetyErrorText(t, e));
    }
  };
  const field = (value: string, set: (v: string) => void, text: string) => (
    <label className="ai-settings__field">
      <span>{text}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        maxLength={8}
        value={value}
        onChange={(e) => {
          set(e.target.value.replace(/\D/g, ''));
        }}
      />
    </label>
  );
  return (
    <form
      className="age-gate__step"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {field(pin, setPin, t('safety.gate.pin'))}
      {field(again, setAgain, t('safety.gate.pinAgain'))}
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
      <div className="ai-settings__actions">
        <button type="submit" className="btn btn--accent" disabled={!pin || !again}>
          {label}
        </button>
      </div>
    </form>
  );
}

function PinStep() {
  const t = useT();
  return (
    <section className="age-gate__supervisor">
      <h3>{t('safety.gate.supervisorTitle')}</h3>
      <p className="small">{t('safety.gate.supervisorIntro')}</p>
      <NewPinFields
        label={t('safety.gate.setPin')}
        onSubmit={async (pin) => {
          applied(await getSafety().setPin(pin));
          await refreshUnlock();
        }}
      />
    </section>
  );
}

/** Recording consent; shared with Settings. `needPin`: the supervisor session is closed. */
export function ConsentStep({ needPin }: { needPin: boolean }) {
  const t = useT();
  const [agree, setAgree] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const record = async () => {
    setError('');
    try {
      applied(await getSafety().recordConsent(localDay(), needPin ? pin : undefined));
      setPin('');
    } catch (e) {
      setError(safetyErrorText(t, e));
    }
  };
  return (
    <section className="age-gate__supervisor">
      <h3>{t('safety.gate.consentTitle')}</h3>
      <label className="age-gate__check">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => {
            setAgree(e.target.checked);
          }}
        />
        <span>{t('safety.gate.consentText')}</span>
      </label>
      {needPin && (
        <label className="ai-settings__field">
          <span>{t('safety.gate.consentPin')}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
            }}
          />
        </label>
      )}
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
      <div className="ai-settings__actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={!agree || (needPin && !validPin(pin))}
          onClick={() => {
            void record();
          }}
        >
          {t('safety.gate.recordConsent')}
        </button>
      </div>
    </section>
  );
}
