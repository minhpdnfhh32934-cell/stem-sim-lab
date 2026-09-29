import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { Equation } from '@/science-card/Equation';
import { L } from '../common';
import { REAL_ORBITALS, levelEnergyEv, meanRadius, orbitalById } from './hydrogen';
import { MAX_ORBITAL_N, useOrbitalStore, type OrbitalMode } from './orbitalStore';

const L_NAMES = ['s', 'p', 'd', 'f'];

/** Choose n and the real orbital; shows ⟨r⟩ and the level energy. */
export function OrbitalPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { n, orbital, mode } = useOrbitalStore();
  const current = orbitalById(orbital);
  const f = (v: number) => formatNumber(locale, v, { maximumSignificantDigits: 5 });
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Số lượng tử chính n', 'Principal quantum number n'))}</span>
        <select
          value={n}
          onChange={(e) => {
            const nn = Number(e.target.value);
            // Keep l < n: fall back to s when the orbital is not allowed.
            useOrbitalStore.setState({ n: nn, orbital: current.l < nn ? orbital : 's' });
          }}
        >
          {Array.from({ length: MAX_ORBITAL_N }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div className="orbital-picker" role="radiogroup" aria-label={Lz(L('Orbital', 'Orbital'))}>
        {REAL_ORBITALS.filter((o) => o.l < n).map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === orbital}
            className="orbital-picker__item"
            onClick={() => {
              useOrbitalStore.setState({ orbital: o.id });
            }}
          >
            <Equation tex={`${n}${o.label}`} display={false} />
          </button>
        ))}
      </div>
      <div className="segmented" role="radiogroup" aria-label={Lz(L('Hiển thị', 'Show'))}>
        {(
          [
            ['psi', L('Hàm sóng ψ (dấu)', 'Wavefunction ψ (sign)')],
            ['density', L('Mật độ |ψ|²', 'Density |ψ|²')],
          ] as [OrbitalMode, ReturnType<typeof L>][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            className="segmented__item"
            onClick={() => {
              useOrbitalStore.setState({ mode: id });
            }}
          >
            {Lz(label)}
          </button>
        ))}
      </div>
      <table className="chem-table">
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Phân lớp', 'Subshell'))}</th>
            <td className="num">
              {n}
              {L_NAMES[current.l]} (l = {current.l})
            </td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Năng lượng E_n', 'Energy E_n'))}</th>
            <td className="num">{f(levelEnergyEv(n))} eV</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Khoảng cách trung bình ⟨r⟩', 'Mean distance ⟨r⟩'))}</th>
            <td className="num">{f(meanRadius(n, current.l))} a₀</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Số nút xuyên tâm', 'Radial nodes'))}</th>
            <td className="num">{n - current.l - 1}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
