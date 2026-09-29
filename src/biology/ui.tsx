import type { LocalizedText } from '@/core/data/dataset';
import { useLocalized } from '@/app/i18n/localized';
import { useFmt } from './fmt';

/** Labelled slider that shows its current value with the user's locale. */
export function Range(props: {
  label: LocalizedText;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  digits?: number;
  onChange: (v: number) => void;
}) {
  const Lz = useLocalized();
  const fmt = useFmt();
  return (
    <label>
      <span>
        {Lz(props.label)}{' '}
        <strong className="mono">
          {fmt(props.value, props.digits ?? 3)}
          {props.unit ? ` ${props.unit}` : ''}
        </strong>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => {
          props.onChange(Number(e.target.value));
        }}
      />
    </label>
  );
}

/** Radio-style segmented control. */
export function Segmented<T extends string>(props: {
  label: LocalizedText;
  value: T;
  options: { id: T; label: LocalizedText }[];
  onChange: (v: T) => void;
}) {
  const Lz = useLocalized();
  return (
    <div className="segmented" role="radiogroup" aria-label={Lz(props.label)}>
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={props.value === o.id}
          className="segmented__item"
          onClick={() => {
            props.onChange(o.id);
          }}
        >
          {Lz(o.label)}
        </button>
      ))}
    </div>
  );
}
