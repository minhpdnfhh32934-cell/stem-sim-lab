import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from '../common';
import { ElementDetails } from '../periodic/ElementDetails';
import { selectElement, usePeriodicStore } from '../periodic/store';
import { MAX_N, useBohrStore } from './bohrStore';
import { levelEnergyEv, transitionEnergyEv, transitionWavelength } from './hydrogen';
import { regionOf } from './spectrumColor';

const REGION = {
  uv: L('tử ngoại', 'ultraviolet'),
  visible: L('ánh sáng nhìn thấy', 'visible light'),
  ir: L('hồng ngoại', 'infrared'),
};

/** Hydrogen transition calculator (Rydberg formula) + the element data sheet. */
export function BohrPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const z = usePeriodicStore((s) => s.selected);
  const { nLower, nUpper } = useBohrStore();
  const f = (v: number, d = 6) => formatNumber(locale, v, { maximumSignificantDigits: d });
  const ns = Array.from({ length: MAX_N }, (_, i) => i + 1);

  if (z !== 1) {
    return (
      <div className="chem-form">
        <ElementDetails />
        <button
          type="button"
          className="btn"
          onClick={() => {
            selectElement(1);
          }}
        >
          {Lz(L('Xem phổ hydro (Z = 1)', 'Show the hydrogen spectrum (Z = 1)'))}
        </button>
      </div>
    );
  }
  const lam = transitionWavelength(nLower, nUpper) * 1e9;
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Mức đầu n₂', 'Upper level n₂'))}</span>
        <select
          value={nUpper}
          onChange={(e) => {
            const v = Number(e.target.value);
            useBohrStore.setState({ nUpper: v, nLower: Math.min(nLower, v - 1) });
          }}
        >
          {ns.slice(1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{Lz(L('Mức cuối n₁', 'Lower level n₁'))}</span>
        <select
          value={nLower}
          onChange={(e) => {
            useBohrStore.setState({ nLower: Number(e.target.value) });
          }}
        >
          {ns.slice(0, nUpper - 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <table className="chem-table">
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Năng lượng photon', 'Photon energy'))}</th>
            <td className="num">{f(transitionEnergyEv(nLower, nUpper))} eV</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Bước sóng (chân không)', 'Wavelength (vacuum)'))}</th>
            <td className="num">{f(lam)} nm</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Vùng phổ', 'Region'))}</th>
            <td>{Lz(REGION[regionOf(lam)])}</td>
          </tr>
        </tbody>
      </table>
      <p className="econf__label">{Lz(L('Các mức năng lượng', 'Energy levels'))}</p>
      <table className="chem-table">
        <tbody>
          {ns.map((n) => (
            <tr key={n} className={n === nLower || n === nUpper ? 'is-active' : undefined}>
              <th scope="row">n = {n}</th>
              <td className="num">{f(levelEnergyEv(n), 5)} eV</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
