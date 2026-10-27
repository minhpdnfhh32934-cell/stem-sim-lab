import { useState } from 'react';
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
  className = 'param__number mono',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  id?: string;
  className?: string;
}) {
  const locale = useSettingsStore((s) => s.locale);
  const [text, setText] = useState(() => fieldText(locale, value));
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      className={className}
      inputMode="decimal"
      aria-label={label}
      value={focused ? text : fieldText(locale, value)}
      onFocus={() => {
        setText(fieldText(locale, value));
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseField(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}
