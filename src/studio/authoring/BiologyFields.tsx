import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { CELL_TYPE_NAME, COMPONENTS } from '@/biology/division/mitosis3d/components';
import { withCellType, withPairs, withPart } from './bindingDraft';
import { BIO_CELL_TYPES, BIO_PAIRS, biologyParts } from './choices';
import type { AuthorDraft } from './draft';
import { PairField } from './TextFields';

interface Props {
  draft: AuthorDraft;
  onChange: (d: AuthorDraft) => void;
}

/** Biology: cell type, chromosome pairs and parts of the 3D mitosis model. */
export function BiologyFields({ draft, onChange }: Props) {
  const t = useT();
  const L = useLocalized();
  const b = draft.binding;
  if (b.kind !== 'biology') return null;
  return (
    <div className="author-binding">
      <div
        className="author-row"
        role="group"
        aria-label={t('studio.authoring.editor.biology.cellType')}
      >
        <span>{t('studio.authoring.editor.biology.cellType')}</span>
        {BIO_CELL_TYPES.map((c) => (
          <button
            key={c}
            type="button"
            className="btn btn--ghost"
            aria-pressed={b.cellType === c}
            onClick={() => {
              onChange(withCellType(draft, c));
            }}
          >
            {L(CELL_TYPE_NAME[c])}
          </button>
        ))}
      </div>
      <label className="author-select">
        <span>{t('studio.authoring.editor.biology.pairs')}</span>
        <select
          value={b.pairs}
          onChange={(e) => {
            onChange(withPairs(draft, Number(e.target.value)));
          }}
        >
          {BIO_PAIRS.map((n) => (
            <option key={n} value={n}>
              {t('studio.authoring.editor.biology.pairsValue', { n, twoN: 2 * n })}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="author-checks">
        <legend>{t('studio.authoring.editor.biology.parts')}</legend>
        <p className="muted small">{t('studio.authoring.editor.biology.partsHint')}</p>
        {biologyParts(b.cellType).map((id) => (
          <label key={id} className="author-check">
            <input
              type="checkbox"
              checked={b.parts.includes(id)}
              onChange={(e) => {
                onChange(withPart(draft, id, e.target.checked));
              }}
            />
            {L(COMPONENTS[id].name)}
          </label>
        ))}
      </fieldset>
      <PairField
        label={t('studio.authoring.editor.fields.question')}
        value={draft.question}
        multiline
        hint={t('studio.authoring.editor.biology.answerNote')}
        onChange={(question) => {
          onChange({ ...draft, question });
        }}
      />
    </div>
  );
}
