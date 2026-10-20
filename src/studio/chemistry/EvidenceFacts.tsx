import { useLocalized } from '@/app/i18n/localized';
import type { EngineFact } from '../session';

/** The facts of one bench record, as copied from the library when the mix happened. */
export function EvidenceFacts({ facts }: { facts: readonly EngineFact[] }) {
  const L = useLocalized();
  return (
    <dl className="chem-facts">
      {facts.map((f) => (
        <div key={f.id} className="chem-facts__row" data-fact={f.id}>
          <dt>{L(f.label)}</dt>
          <dd>{L(f.text)}</dd>
        </div>
      ))}
    </dl>
  );
}
