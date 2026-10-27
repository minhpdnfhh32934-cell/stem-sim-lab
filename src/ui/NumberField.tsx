import { useId, useState } from 'react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fieldText, parseField } from './fieldText';

/**
 * Number box in the UI language ("0,25" in Vietnamese). While focused it keeps the typed text,
 * so intermediate input ("0,", "-") is not rejected and every typed digit reaches `onChange`.
 */
export function NumberField({
  label,
  value,
  onChange,
  id,
  step,
  min = -Infinity,
  max = Infinity,
  className = 'param__number mono',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  id?: string;
  /** Arrow up / down add or remove it (as a number input did). */
  step?: number | undefined;
  /** Range the arrows stay in (the parent clamps typed values itself). */
  min?: number | undefined;
  max?: number | undefined;
  className?: string;
}) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const hintId = useId();
  const [text, setText] = useState(() => fieldText(locale, value));
  const [focused, setFocused] = useState(false);
  // The value the learner typed (null until they type: focusing or an arrow never counts, so a
  // rounded "16,6667" for 16,666… is not "wrong"). When the parent clamped it, say so.
  const [typed, setTyped] = useState<number | null>(null);
  const differs =
    focused && typed !== null && Math.abs(typed - value) > 1e-9 * Math.max(1, Math.abs(value));
  const bounded = Number.isFinite(min) && Number.isFinite(max);
  return (
    <span className="number-field">
      <input
        id={id}
        className={className}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={differs || undefined}
        aria-describedby={differs ? hintId : undefined}
        value={focused ? text : fieldText(locale, value)}
        onFocus={() => {
          setText(fieldText(locale, value));
          setTyped(null);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseField(e.target.value);
          setTyped(Number.isFinite(v) ? v : null);
          if (Number.isFinite(v)) onChange(v);
        }}
        onKeyDown={(e) => {
          if (!step || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
          e.preventDefault();
          // Rounded to the step's decimals, so 0,1 + 0,2 shows 0,3.
          const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
          const next = Math.min(
            max,
            Math.max(min, Number((value + (e.key === 'ArrowUp' ? step : -step)).toFixed(decimals))),
          );
          setText(fieldText(locale, next));
          setTyped(null);
          onChange(next);
        }}
      />
      {differs && (
        <span id={hintId} className="number-field__hint">
          {bounded
            ? t('params.clampedHint', {
                value: fieldText(locale, value),
                min: fieldText(locale, min),
                max: fieldText(locale, max),
              })
            : fieldText(locale, value)}
        </span>
      )}
    </span>
  );
}
