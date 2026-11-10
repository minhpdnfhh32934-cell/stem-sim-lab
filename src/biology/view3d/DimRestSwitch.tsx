import { useContext } from 'react';
import { BenchContext } from '@/app/bench/shellMode';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from '../common';
import { useDimRest } from './dimRest';

/** The tray's "Làm mờ phần còn lại" switch: bench, Advanced only (§9.6). */
export function DimRestSwitch() {
  const Lz = useLocalized();
  const bench = useContext(BenchContext);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const on = useDimRest((s) => s.on);
  if (!bench || !advanced) return null;
  return (
    <label className="param__toggle">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => {
          useDimRest.setState({ on: e.target.checked });
        }}
      />
      <span>{Lz(L('Làm mờ phần còn lại', 'Dim the other parts'))}</span>
    </label>
  );
}
