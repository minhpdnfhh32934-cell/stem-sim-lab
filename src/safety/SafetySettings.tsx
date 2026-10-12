import { BookOpenCheck, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { getSafety, toSafetyError, type Incident } from './safety';
import { openGate, openPrivacy, useSafetyStore } from './safetyStore';
import './safety.css';

/** Settings → "An toàn & quyền riêng tư" (PROMPT_PHAN_2 A3): age/terms card and the incident log. */
export function SafetySettings() {
  const t = useT();
  const status = useSafetyStore((s) => s.status);
  if (!status) return null;
  const line = status.aiAllowed
    ? t('safety.settings.mainAdult', { version: String(status.termsVersion) })
    : status.answered
      ? t('safety.settings.mainMinor')
      : t('safety.settings.unanswered');
  return (
    <>
      <fieldset className="settings-group safety-settings">
        <legend>
          <ShieldCheck size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.settings.ageCard')}
        </legend>
        <p className="safety-settings__line" data-ok={status.aiAllowed}>
          {line}
        </p>
        <div className="ai-settings__actions">
          <button type="button" className="btn" onClick={openGate}>
            {t('safety.settings.answerAgain')}
          </button>
          <button type="button" className="btn" onClick={openPrivacy}>
            <BookOpenCheck size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('safety.settings.privacy')}
          </button>
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend>
          <ScrollText size={15} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.settings.incidents')}
        </legend>
        <IncidentLog />
      </fieldset>
    </>
  );
}

/** Kind + time only (no question text, no answer). */
function IncidentLog() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const [list, setList] = useState<Incident[] | null>(null);
  const [error, setError] = useState('');
  const show = (e: unknown) => {
    const err = toSafetyError(e);
    setError(err.message || err.code);
  };
  const load = async () => {
    setError('');
    try {
      setList(await getSafety().incidents());
    } catch (e) {
      show(e);
    }
  };
  const clear = async () => {
    try {
      await getSafety().clearIncidents();
      setList([]);
    } catch (e) {
      show(e);
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
