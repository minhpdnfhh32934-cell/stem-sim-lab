import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from '../common';
import { useBohrStore } from './bohrStore';
import { SERIES, transitionWavelength } from './hydrogen';
import { wavelengthColor } from './spectrumColor';

const VIS_MIN = 380;
const VIS_MAX = 750;

/** Hydrogen emission lines of the Lyman, Balmer and Paschen series (Rydberg formula). */
export function SpectrumBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { nLower, nUpper } = useBohrStore();
  const f = (v: number) =>
    formatNumber(locale, v, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const balmer = [3, 4, 5, 6, 7].map((n) => ({ n, nm: transitionWavelength(2, n) * 1e9 }));
  return (
    <div className="chem-block">
      <p className="econf__label">
        {Lz(
          L(
            'Dãy Balmer trong vùng nhìn thấy (màu minh họa)',
            'Balmer lines in the visible range (illustrative colours)',
          ),
        )}
      </p>
      <div className="spectrum-wrap">
        <div className="spectrum" aria-hidden="true" />
        {balmer.map(({ n, nm }) => (
          <span key={n}>
            <span
              className="spectrum-line"
              style={{
                left: `${((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * 100}%`,
                background: wavelengthColor(nm) ?? 'currentColor',
                outline: n === nUpper && nLower === 2 ? '2px solid var(--accent)' : undefined,
              }}
            />
            <span
              className="spectrum-label"
              style={{ left: `${((nm - VIS_MIN) / (VIS_MAX - VIS_MIN)) * 100}%` }}
            >
              {Math.round(nm)}
            </span>
          </span>
        ))}
      </div>
      <div className="spectrum-axis">
        <span>380 nm</span>
        <span>750 nm</span>
      </div>
      <table className="chem-table chem-table--spaced">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Dãy', 'Series'))}</th>
            {[1, 2, 3, 4, 5].map((k) => (
              <th key={k} scope="col" className="num">
                {Lz(L(`vạch ${k}`, `line ${k}`))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SERIES.map((s) => (
            <tr key={s.nLower} className={s.nLower === nLower ? 'is-active' : undefined}>
              <th scope="row">{Lz(s.name)}</th>
              {[1, 2, 3, 4, 5].map((k) => (
                <td key={k} className="num">
                  {f(transitionWavelength(s.nLower, s.nLower + k) * 1e9)} nm
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
