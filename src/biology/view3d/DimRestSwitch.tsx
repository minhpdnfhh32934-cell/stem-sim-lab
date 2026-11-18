import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from '../common';
import { useDimRest } from './dimRest';

/** "Làm mờ phần còn lại" in the division 3D views' Inspector: Advanced mode only (#195 step 3). */
export function DimRestSwitch() {
  const Lz = useLocalized();
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const on = useDimRest((s) => s.on);
  if (!advanced) return null;
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
