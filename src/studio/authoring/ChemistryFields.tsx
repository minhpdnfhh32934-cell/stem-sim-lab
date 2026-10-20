import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { formatFormula } from '@/chemistry/formula';
import { ReviewBadge } from '@/ui/Badges';
import { equationString } from '../chemistry/library';
import { withReagent, withSwappedTarget, withTarget } from './bindingDraft';
import { chemistryReagents, chemistryTargets } from './choices';
import type { AuthorDraft } from './draft';
import { PairField } from './TextFields';

interface Props {
  draft: AuthorDraft;
  onChange: (d: AuthorDraft) => void;
}

/** Chemistry: a precipitation record of the library as the question, solutions on the rack. */
export function ChemistryFields({ draft, onChange }: Props) {
  const t = useT();
  const L = useLocalized();
  const b = draft.binding;
  if (b.kind !== 'chemistry') return null;
  const targets = chemistryTargets();
  const record = targets.find((r) => r.id === b.reaction);
  return (
    <div className="author-binding">
      <label className="author-select">
        <span>{t('studio.authoring.editor.chemistry.target')}</span>
        <select
          value={b.reaction}
          onChange={(e) => {
            const r = targets.find((x) => x.id === e.target.value);
            if (r) onChange(withTarget(draft, r));
          }}
        >
          {targets.map((r) => (
            <option key={r.id} value={r.id}>
              {L(r.name)} — {equationString(r)}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">{t('studio.authoring.editor.chemistry.targetHint')}</p>
      {record && (
        <div className="author-record">
          <ReviewBadge status={record.review_status} />
          <ul className="muted small">
            {record.sources.map((s) => (
              <li key={s.id}>{s.citation}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="author-row">
        <p>
          {t('studio.authoring.editor.chemistry.order', {
            first: formatFormula(b.target[0]),
            second: formatFormula(b.target[1]),
          })}
        </p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            onChange(withSwappedTarget(draft));
          }}
        >
          {t('studio.authoring.editor.chemistry.swap')}
        </button>
      </div>
      <fieldset className="author-checks">
        <legend>{t('studio.authoring.editor.chemistry.rack')}</legend>
        <p className="muted small">{t('studio.authoring.editor.chemistry.rackHint')}</p>
        {chemistryReagents().map((f) => (
          <label key={f} className="author-check">
            <input
              type="checkbox"
              checked={b.inventory.includes(f)}
              disabled={b.target.includes(f)}
              onChange={(e) => {
                onChange(withReagent(draft, f, e.target.checked));
              }}
            />
            {formatFormula(f)}
          </label>
        ))}
      </fieldset>
      <PairField
        label={t('studio.authoring.editor.fields.question')}
        value={draft.question}
        multiline
        onChange={(question) => {
          onChange({ ...draft, question });
        }}
      />
    </div>
  );
}
