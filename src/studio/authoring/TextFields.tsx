import { useId } from 'react';
import { useT } from '@/app/i18n';
import type { TextPair } from './draft';

/** One teacher text in Vietnamese (required) and English (optional, falls back to Vietnamese). */
export function PairField({
  label,
  value,
  onChange,
  multiline = false,
  list = false,
  hint,
}: {
  label: string;
  value: TextPair;
  onChange: (next: TextPair) => void;
  multiline?: boolean;
  /** One item per line. */
  list?: boolean;
  hint?: string;
}) {
  const t = useT();
  const id = useId();
  const rows = list ? 3 : 2;
  const field = (lang: 'vi' | 'en') => {
    const props = {
      id: `${id}-${lang}`,
      value: value[lang],
      'aria-describedby': hint || list ? `${id}-hint` : undefined,
      onChange: (e: { target: { value: string } }) => {
        onChange({ ...value, [lang]: e.target.value });
      },
    };
    return (
      <div className="author-pair__lang">
        <label htmlFor={props.id}>{t(`studio.authoring.editor.${lang}`)}</label>
        {multiline || list ? <textarea rows={rows} {...props} /> : <input type="text" {...props} />}
      </div>
    );
  };
  return (
    <fieldset className="author-pair">
      <legend>{label}</legend>
      {(hint || list) && (
        <p id={`${id}-hint`} className="muted small">
          {hint ?? t('studio.authoring.editor.perLine')}
        </p>
      )}
      <div className="author-pair__grid">
        {field('vi')}
        {field('en')}
      </div>
    </fieldset>
  );
}
