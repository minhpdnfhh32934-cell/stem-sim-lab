import type { KeyboardEvent } from 'react';
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

/** Keys that move the choice inside a radio group: step −1 / +1, or jump to the first / last. */
const RADIO_KEYS: Record<string, -1 | 1 | 'first' | 'last'> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
  Home: 'first',
  End: 'last',
};

/**
 * Radio-style segmented control. Keyboard as a radio group: one tab stop (the checked option,
 * or the first one when none is), arrow keys move the focus and the choice (wrapping around),
 * Home / End jump to the first / last option.
 */
export function Segmented<T extends string>(props: {
  label: LocalizedText;
  value: T;
  options: { id: T; label: LocalizedText }[];
  onChange: (v: T) => void;
  /** Shown but not changeable (e.g. a lesson holds the value). */
  disabled?: boolean;
}) {
  const Lz = useLocalized();
  const { options, value } = props;
  const checked = options.findIndex((o) => o.id === value);
  const tabStop = checked >= 0 ? checked : 0;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = RADIO_KEYS[e.key];
    const n = options.length;
    if (key === undefined || n === 0) return;
    e.preventDefault();
    const next = key === 'first' ? 0 : key === 'last' ? n - 1 : (index + key + n) % n;
    const option = options[next];
    if (!option) return;
    const buttons =
      e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(':scope > [role="radio"]');
    buttons?.[next]?.focus();
    if (option.id !== value) props.onChange(option.id);
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={Lz(props.label)}>
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={i === tabStop ? 0 : -1}
          className="segmented__item"
          disabled={props.disabled}
          onClick={() => {
            props.onChange(o.id);
          }}
          onKeyDown={(e) => {
            onKeyDown(e, i);
          }}
        >
          {Lz(o.label)}
        </button>
      ))}
    </div>
  );
}
