import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from '../common';
import { bondPolarity, deltaEn, distance, moleculeById } from '../data/molecules';
import { BOND_TYPE } from './labels';
import { pickBond, useMoleculeStore } from './store';

/** Every bond of the molecule: order, length, Δχ and type. Click a row to highlight it. */
export function BondTable() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { id, bond } = useMoleculeStore();
  const m = moleculeById(id);
  if (!m) return null;
  const f = (v: number, d = 4) => formatNumber(locale, v, { maximumSignificantDigits: d });
  return (
    <div className="chem-block">
      <table className="chem-table">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Liên kết', 'Bond'))}</th>
            <th scope="col">{Lz(L('Bậc', 'Order'))}</th>
            <th scope="col" className="num">
              {Lz(L('Độ dài (Å)', 'Length (Å)'))}
            </th>
            <th scope="col" className="num">
              Δχ
            </th>
            <th scope="col">{Lz(L('Loại', 'Type'))}</th>
          </tr>
        </thead>
        <tbody>
          {m.bonds.map((b, k) => {
            const d = deltaEn(m, b);
            return (
              <tr
                key={k}
                className={bond === k ? 'is-active' : undefined}
                onClick={() => {
                  pickBond(k);
                }}
              >
                <td className="num">
                  {m.atoms[b.a]?.el}
                  {b.a + 1}–{m.atoms[b.b]?.el}
                  {b.b + 1}
                </td>
                <td>{b.aromatic ? '1,5' : b.order}</td>
                <td className="num">{f(distance(m, b.a, b.b))}</td>
                <td className="num">{d === null ? '—' : f(d, 3)}</td>
                <td>{d === null ? '—' : Lz(BOND_TYPE[bondPolarity(d)])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
