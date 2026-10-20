import { Clock3 } from 'lucide-react';
import { formatNumber, useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { card3d } from '@/biology/division/mitosis3d/components';
import type { CellType } from '@/biology/division/mitosis3d/timeline';
import type { EngineFact, EngineQuantity } from '../session';

export function BindingError() {
  const t = useT();
  return (
    <p className="studio-error" role="alert">
      {t('studio.bio.binding')}
    </p>
  );
}

/** Review status and sources of the model's texts, next to where they are used. */
export function DataNote({ cellType }: { cellType: CellType }) {
  const t = useT();
  const card = card3d(cellType);
  const list = card.sources.map((s) => s.citation).join('; ');
  return (
    <p className={`studio-review studio-review--${card.reviewStatus}`}>
      <Clock3 size={14} aria-hidden="true" />
      {card.reviewStatus === 'pending' && `${t('studio.bio.pending')} `}
      {t('studio.bio.sources', { list })}
    </p>
  );
}

/** Counts of a stage record, as the model stored them. */
export function CountList({ quantities }: { quantities: readonly EngineQuantity[] }) {
  const L = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  return (
    <dl className="bio-facts">
      {quantities.map((q) => (
        <div key={q.id} className="bio-facts__row" data-quantity={q.id}>
          <dt>{L(q.label)}</dt>
          <dd>{formatNumber(locale, q.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FactList({ facts }: { facts: readonly EngineFact[] }) {
  const L = useLocalized();
  return (
    <dl className="bio-facts">
      {facts.map((f) => (
        <div key={f.id} className="bio-facts__row" data-fact={f.id}>
          <dt>{L(f.label)}</dt>
          <dd>{L(f.text)}</dd>
        </div>
      ))}
    </dl>
  );
}
