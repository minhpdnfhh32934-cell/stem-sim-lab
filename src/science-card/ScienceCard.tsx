import { AlertTriangle, BookMarked, Cpu, Hand, Ruler, SquareFunction } from 'lucide-react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { formatNumber } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ConfidenceBadge, ReviewBadge } from '@/ui/Badges';
import { Equation } from './Equation';
import type { ScienceCardData } from './types';

/** The Science Card (MASTER_PROMPT §2.3). */
export function ScienceCard({ card }: { card: ScienceCardData }) {
  const t = useT();
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);

  return (
    <article className="science-card" aria-label={t('science.cardLabel')}>
      <header className="science-card__head">
        <h4 className="science-card__title">{L(card.title)}</h4>
        <div className="science-card__badges">
          <ConfidenceBadge level={card.confidence} />
          {card.reviewStatus && <ReviewBadge status={card.reviewStatus} />}
        </div>
      </header>

      {card.userIntervened && (
        <p className="science-card__alert" role="note">
          <Hand size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('science.intervened')}
        </p>
      )}

      <dl className="science-card__list">
        <dt>
          <Cpu size={13} strokeWidth={1.75} aria-hidden="true" />
          {t('science.model')}
        </dt>
        <dd>{L(card.model)}</dd>

        {card.equations.length > 0 && (
          <>
            <dt>
              <SquareFunction size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('science.equations')}
            </dt>
            <dd className="science-card__equations">
              {card.equations.map((eq) => (
                <div key={eq.tex} className="science-card__equation">
                  {eq.label && <span className="science-card__eq-label">{L(eq.label)}</span>}
                  <Equation tex={eq.tex} />
                </div>
              ))}
            </dd>
          </>
        )}

        {card.assumptions.length > 0 && (
          <>
            <dt>
              <AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('science.assumptions')}
            </dt>
            <dd>
              <ul>
                {card.assumptions.map((a) => (
                  <li key={a.vi}>{L(a)}</li>
                ))}
              </ul>
            </dd>
          </>
        )}

        {card.validity && (
          <>
            <dt>
              <Ruler size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('science.validity')}
            </dt>
            <dd>{L(card.validity)}</dd>
          </>
        )}

        {(card.method ?? card.confidenceNote ?? card.estimatedError !== undefined) && (
          <>
            <dt>
              <Cpu size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('science.method')}
            </dt>
            <dd>
              {card.method && <p>{L(card.method)}</p>}
              {card.confidenceNote && <p>{L(card.confidenceNote)}</p>}
              {card.estimatedError !== undefined && (
                <p className="mono">
                  {t('science.estimatedError', {
                    value: formatNumber(locale, card.estimatedError, {
                      style: 'percent',
                      maximumSignificantDigits: 2,
                    }),
                  })}
                </p>
              )}
            </dd>
          </>
        )}

        {card.sources.length > 0 && (
          <>
            <dt>
              <BookMarked size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('science.sources')}
            </dt>
            <dd>
              <ul className="science-card__sources">
                {card.sources.map((s) => (
                  <li key={s.id}>{s.citation}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}
