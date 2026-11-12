import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fieldText } from './fieldText';
import { IconButton } from './IconButton';
import { NumberField } from './NumberField';

/**
 * A slider with its number box and − / + (#205 B7, B8): the physics parameters' row
 * (ParamsPanel: `param` classes, so it looks the same) for the chemistry and biology panels. The
 * value is clamped to [min, max]; − / + move one step, rounded to the step's decimals.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Shown after the number box and read with it. */
  unit?: string | undefined;
  onChange: (v: number) => void;
}) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const id = useId();
  const set = (v: number) => {
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
  };
  const nudge = (sign: 1 | -1) => {
    const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
    set(Number((value + sign * step).toFixed(decimals)));
  };
  return (
    <div className="param slider-field">
      <div className="param__head">
        <label htmlFor={id} className="param__label">
          {label}
        </label>
      </div>
      <div className="param__controls">
        <IconButton
          className="param__step param__step--minus"
          icon={Minus}
          label={t('bench.decrease', { name: label })}
          disabled={value <= min}
          onClick={() => {
            nudge(-1);
          }}
        />
        <input
          type="range"
          aria-label={label}
          aria-valuetext={unit ? `${fieldText(locale, value)} ${unit}` : fieldText(locale, value)}
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) => {
            set(Number(e.target.value));
          }}
        />
        <label className="param__num">
          <NumberField
            id={id}
            label={label}
            describedBy={unit ? `${id}-unit` : undefined}
            value={value}
            step={step}
            min={min}
            max={max}
            onChange={set}
          />
          {unit && (
            <span id={`${id}-unit`} className="param__unit">
              {unit}
            </span>
          )}
        </label>
        <IconButton
          className="param__step param__step--plus"
          icon={Plus}
          label={t('bench.increase', { name: label })}
          disabled={value >= max}
          onClick={() => {
            nudge(1);
          }}
        />
      </div>
    </div>
  );
}
