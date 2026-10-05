import { LifeBuoy, Phone } from 'lucide-react';
import { useT } from '@/app/i18n';
import './safety.css';

/**
 * Shown instead of an AI answer when a problem shows signs of a crisis (the text is not sent
 * anywhere). Pilot students are mostly under 18: the child protection line 111 comes first.
 * Numbers: see docs/LEGAL_COMPLIANCE.md (checked 2026-10).
 */
export function CrisisCard() {
  const t = useT();
  return (
    <section className="crisis" role="alert" aria-labelledby="crisis-title">
      <h3 id="crisis-title">
        <LifeBuoy size={18} strokeWidth={1.75} aria-hidden="true" />
        {t('safety.crisis.title')}
      </h3>
      <p>{t('safety.crisis.body')}</p>
      <ul>
        {__EDITION__ === 'pilot' && (
          <li>
            <Phone size={14} strokeWidth={1.75} aria-hidden="true" />
            {t('safety.crisis.line111')}
          </li>
        )}
        <li>
          <Phone size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.crisis.ngayMai')}
        </li>
        <li>
          <Phone size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('safety.crisis.emergency')}
        </li>
      </ul>
      <p className="muted small">{t('safety.crisis.note')}</p>
    </section>
  );
}
