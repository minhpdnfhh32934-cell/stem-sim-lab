import { BookOpenCheck, Lock, LockOpen, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { checkAiStatus } from '@/app/ai/useAiStatus';
import { ConsentStep, NewPinFields } from './AgeGate';
import { getSafety, type Incident, type SafetyStatus } from './safety';
import { safetyErrorText } from './pinError';
import {
  lockSupervisor,
  openGate,
  openPrivacy,
  setSafetyStatus,
  unlockSupervisor,
  useSafetyStore,
} from './safetyStore';
import './safety.css';

function applied(status: SafetyStatus): void {
  setSafetyStatus(status);
  void checkAiStatus();
}

/** Re-renders every `ms` while `active` (for the supervisor session countdown). */
function useTick(active: boolean, ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, ms);
    return () => {
      window.clearInterval(id);
    };
  }, [active, ms]);
  return now;
}

/** Settings → "An toàn & quyền riêng tư" (PROMPT_PHAN_2 A3). */
export function SafetySettings() {
  const t = useT();
  const status = useSafetyStore((s) => s.status);
  if (!status) return null;
  return (
    <fieldset className="settings-group safety-settings">
      <legend>
        <ShieldCheck size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('safety.settings.title')}
      </legend>
      {status.edition === 'pilot' ? <PilotPanel status={status} /> : <MainPanel status={status} />}
      <div className="ai-settings__actions">
        <button type="button" className="btn" onClick={openPrivacy}>
          <BookOpenCheck size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.settings.privacy')}
        </button>
      </div>
    </fieldset>
  );
}

function MainPanel({ status }: { status: SafetyStatus }) {
  const t = useT();
  const line = status.aiAllowed
    ? t('safety.settings.mainAdult', { version: String(status.termsVersion) })
    : status.answered
      ? t('safety.settings.mainMinor')
      : t('safety.settings.unanswered');
  return (
    <>
      <p className="safety-settings__line" data-ok={status.aiAllowed}>
        {line}
      </p>
      <div className="ai-settings__actions">
        <button type="button" className="btn" onClick={openGate}>
          {t('safety.settings.answerAgain')}
        </button>
      </div>
      <IncidentLog />
    </>
  );
}

function PilotPanel({ status }: { status: SafetyStatus }) {
  const t = useT();
  const until = useSafetyStore((s) => s.unlockedUntil);
  const now = useTick(until > 0);
  const unlocked = until > now;
  return (
    <>
      {status.answered && (
        <p className="safety-settings__line">
          {status.minor ? t('safety.settings.studentMinor') : t('safety.settings.studentAdult')}{' '}
          {status.minor &&
            (status.consentDay
              ? t('safety.settings.consentOn', { day: status.consentDay })
              : t('safety.settings.consentOff'))}
        </p>
      )}
      {!status.pinSet || !status.answered ? (
        <>
          <p className="muted">{t('safety.settings.noPin')}</p>
          <div className="ai-settings__actions">
            <button type="button" className="btn btn--accent" onClick={openGate}>
              {t('safety.settings.setup')}
            </button>
          </div>
        </>
      ) : unlocked ? (
        <SupervisorTools status={status} minutes={Math.max(1, Math.ceil((until - now) / 60_000))} />
      ) : (
        <UnlockForm />
      )}
    </>
  );
}

function UnlockForm() {
  const t = useT();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const unlock = async () => {
    setError('');
    try {
      await unlockSupervisor(pin);
      setPin('');
    } catch (e) {
      setError(safetyErrorText(t, e));
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void unlock();
      }}
    >
      <p className="muted">{t('safety.settings.locked')}</p>
      <div className="ai-settings__actions">
        <label className="ai-settings__field safety-settings__pin">
          <span>{t('safety.settings.pin')}</span>
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
        <button type="submit" className="btn btn--accent" disabled={pin.length < 4}>
          <LockOpen size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.settings.unlock')}
        </button>
      </div>
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function SupervisorTools({ status, minutes }: { status: SafetyStatus; minutes: number }) {
  const t = useT();
  const [message, setMessage] = useState('');
  const run = async (f: () => Promise<SafetyStatus>) => {
    setMessage('');
    try {
      applied(await f());
      setMessage(t('safety.settings.saved'));
    } catch (e) {
      setMessage(safetyErrorText(t, e));
    }
  };
  return (
    <>
      <div className="ai-settings__actions">
        <span className="safety-settings__line" data-ok="true">
          {t('safety.settings.unlocked', { min: minutes })}
        </span>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void lockSupervisor();
          }}
        >
          <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.settings.lock')}
        </button>
      </div>

      {status.minor && !status.consentDay && <ConsentStep needPin={false} />}
      {status.consentDay && (
        <div className="ai-settings__actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              void run(() => getSafety().withdrawConsent());
            }}
          >
            {t('safety.settings.withdraw')}
          </button>
        </div>
      )}

      <details className="safety-settings__more">
        <summary>{t('safety.settings.changePin')}</summary>
        <NewPinFields
          label={t('safety.settings.save')}
          onSubmit={async (pin) => {
            await run(() => getSafety().setPin(pin));
          }}
        />
      </details>
      <details className="safety-settings__more">
        <summary>{t('safety.settings.changeYear')}</summary>
        <YearForm
          onSave={(year) => {
            void run(() => getSafety().setBirthYear(year));
          }}
        />
      </details>
      {message && (
        <p className="small" role="status">
          {message}
        </p>
      )}
      <IncidentLog />
    </>
  );
}

function YearForm({ onSave }: { onSave: (year: number) => void }) {
  const t = useT();
  const [year, setYear] = useState('');
  return (
    <form
      className="ai-settings__actions"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(year));
      }}
    >
      <label className="ai-settings__field">
        <span>{t('safety.settings.year')}</span>
        <input
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
          }}
        />
      </label>
      <button type="submit" className="btn" disabled={!/^\d{4}$/.test(year)}>
        {t('safety.settings.save')}
      </button>
    </form>
  );
}

/** Kind + time only. In the pilot edition it is behind the supervisor session (Rust checks). */
function IncidentLog() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const [list, setList] = useState<Incident[] | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    setError('');
    try {
      setList(await getSafety().incidents());
    } catch (e) {
      setError(safetyErrorText(t, e));
    }
  };
  const clear = async () => {
    try {
      await getSafety().clearIncidents();
      setList([]);
    } catch (e) {
      setError(safetyErrorText(t, e));
    }
  };
  const fmt = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return (
    <div className="incident-log">
      <p className="muted small">{t('safety.settings.incidentsHint')}</p>
      <div className="ai-settings__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            void load();
          }}
        >
          <ScrollText size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.settings.incidentsShow')}
        </button>
        {list && list.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              void clear();
            }}
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('safety.settings.incidentsClear')}
          </button>
        )}
      </div>
      {error && (
        <p className="small ai-settings__error" role="alert">
          {error}
        </p>
      )}
      {list && list.length === 0 && (
        <p className="muted small">{t('safety.settings.incidentsEmpty')}</p>
      )}
      {list && list.length > 0 && (
        <table className="incident-log__table" aria-label={t('safety.settings.incidents')}>
          <tbody>
            {[...list].reverse().map((i, n) => (
              <tr key={`${String(i.at)}-${String(n)}`}>
                <td>{fmt.format(new Date(i.at * 1000))}</td>
                <td>{t(`safety.settings.incidentKinds.${i.kind}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
