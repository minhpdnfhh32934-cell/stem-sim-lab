import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ELEMENTS } from '../data/elements';
import { L } from '../common';
import { selectElement, usePeriodicStore } from './store';

/** Compact element selector shared by the atom modules. */
export function ElementPicker({ max = 118 }: { max?: number }) {
  const Lz = useLocalized();
  const z = usePeriodicStore((s) => s.selected);
  const locale = useSettingsStore((s) => s.locale);
  return (
    <label className="el-picker">
      <span>{Lz(L('Nguyên tố', 'Element'))}</span>
      <select
        value={Math.min(z, max)}
        onChange={(e) => {
          selectElement(Number(e.target.value));
        }}
      >
        {ELEMENTS.filter((e) => e.z <= max).map((e) => (
          <option key={e.z} value={e.z}>
            {e.z} · {e.symbol} — {e.name}
            {locale === 'vi' && e.aliases_vi[0] ? ` (${e.aliases_vi[0]})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
