import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ReviewBadge } from '@/ui/Badges';
import { L } from '../common';
import {
  GEOMETRY,
  angle,
  bondPolarity,
  centralAtom,
  deltaEn,
  distance,
  lonePairs,
  moleculeById,
  neighbors,
  polarity,
  prettyFormula,
  vsepr,
  type Molecule,
} from '../data/molecules';
import { BOND_TYPE, POLARITY, orderName } from './labels';
import { useMoleculeStore, type MoleculeTopic } from './store';

/** Molecule facts, the VSEPR description of its centre and the current measurement. */
export function MoleculePanel({ topic }: { topic: MoleculeTopic }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { id, atoms, bond } = useMoleculeStore();
  const m = moleculeById(id);
  if (!m) return null;
  const f = (v: number, d = 4) => formatNumber(locale, v, { maximumSignificantDigits: d });
  const c = centralAtom(m);
  const v = vsepr(m, c);
  const pol = polarity(m);

  return (
    <div className="chem-form">
      <div>
        <p className="el-card__name">{Lz(m.name)}</p>
        <p className="mono">{prettyFormula(m.display_formula)}</p>
        <ReviewBadge status={m.review_status} />
      </div>
      <table className="chem-table">
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Khối lượng mol', 'Molar mass'))}</th>
            <td className="num">{f(m.molar_mass, 6)} g/mol</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Công thức phân tử', 'Molecular formula'))}</th>
            <td className="num">{prettyFormula(m.formula)}</td>
          </tr>
          <tr>
            <th scope="row">SMILES</th>
            <td className="num">
              <code>{m.smiles}</code>
            </td>
          </tr>
          {v.n >= 2 && (
            <>
              <tr>
                <th scope="row">
                  {Lz(L('Nguyên tử trung tâm', 'Central atom'))} ({m.atoms[c]?.el})
                </th>
                <td className="num">{v.label}</td>
              </tr>
              <tr>
                <th scope="row">{Lz(L('Hình học', 'Shape'))}</th>
                <td>{v.geometry ? Lz(GEOMETRY[v.geometry].name) : '—'}</td>
              </tr>
              {v.geometry && (
                <tr>
                  <th scope="row">{Lz(L('Góc lý tưởng', 'Ideal angle'))}</th>
                  <td className="num">{GEOMETRY[v.geometry].ideal}</td>
                </tr>
              )}
              <tr>
                <th scope="row">{Lz(L('Góc đo được', 'Measured angles'))}</th>
                <td className="num">
                  {centralAngles(m, c)
                    .map((a) => `${f(a, 4)}°`)
                    .join(', ')}
                </td>
              </tr>
            </>
          )}
          {topic !== 'vsepr' && (
            <tr>
              <th scope="row">{Lz(L('Phân tử', 'Molecule'))}</th>
              <td>{Lz(POLARITY[pol.verdict])}</td>
            </tr>
          )}
        </tbody>
      </table>
      <Selection m={m} atoms={atoms} bond={bond} />
      {topic === 'vsepr' && m.atoms[c] && (
        <p className="muted small">
          {Lz(
            L(
              `E = (e hóa trị − điện tích − tổng bậc liên kết)/2 = ${lonePairs(m, c)} cặp electron tự do trên ${m.atoms[c].el}.`,
              `E = (valence e − charge − Σ bond orders)/2 = ${lonePairs(m, c)} lone pair(s) on ${m.atoms[c].el}.`,
            ),
          )}
        </p>
      )}
    </div>
  );
}

function centralAngles(m: Molecule, c: number): number[] {
  const nb = neighbors(m, c);
  const set = new Set<number>();
  for (const i of nb)
    for (const k of nb) if (i < k) set.add(Math.round(angle(m, i, c, k) * 10) / 10);
  return [...set].sort((a, b) => a - b).slice(0, 6);
}

function Selection({ m, atoms, bond }: { m: Molecule; atoms: number[]; bond: number | null }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const f = (v: number, d = 4) => formatNumber(locale, v, { maximumSignificantDigits: d });
  const name = (i: number) => `${m.atoms[i]?.el ?? '?'}${i + 1}`;
  if (bond !== null) {
    const b = m.bonds[bond];
    if (!b) return null;
    const d = deltaEn(m, b);
    return (
      <table className="chem-table">
        <caption className="econf__label">{Lz(L('Liên kết đã chọn', 'Selected bond'))}</caption>
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Nguyên tử', 'Atoms'))}</th>
            <td className="num">
              {name(b.a)}–{name(b.b)}
            </td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Bậc liên kết', 'Bond order'))}</th>
            <td>{b.aromatic ? Lz(L('thơm (1,5)', 'aromatic (1.5)')) : Lz(orderName(b.order))}</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Độ dài', 'Length'))}</th>
            <td className="num">{f(distance(m, b.a, b.b))} Å</td>
          </tr>
          <tr>
            <th scope="row">Δχ</th>
            <td className="num">{d === null ? '—' : f(d, 3)}</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Loại', 'Type'))}</th>
            <td>{d === null ? '—' : Lz(BOND_TYPE[bondPolarity(d)])}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (atoms.length === 0) {
    return (
      <p className="muted small">
        {Lz(
          L(
            'Nhấp một nguyên tử hoặc liên kết để xem chi tiết. Shift+nhấp 2 nguyên tử để đo khoảng cách, 3 nguyên tử để đo góc.',
            'Click an atom or bond for details. Shift+click 2 atoms for a distance, 3 atoms for an angle.',
          ),
        )}
      </p>
    );
  }
  const [a, b, c] = atoms;
  return (
    <table className="chem-table">
      <caption className="econf__label">{Lz(L('Phép đo', 'Measurement'))}</caption>
      <tbody>
        {a !== undefined && (
          <tr>
            <th scope="row">{name(a)}</th>
            <td className="num">
              {Lz(L(`${lonePairs(m, a)} cặp e tự do`, `${lonePairs(m, a)} lone pair(s)`))}
              {m.atoms[a]?.charge
                ? `, ${Lz(L('điện tích hình thức', 'formal charge'))} ${m.atoms[a].charge > 0 ? '+' : ''}${m.atoms[a].charge}`
                : ''}
            </td>
          </tr>
        )}
        {a !== undefined && b !== undefined && (
          <tr>
            <th scope="row">
              d({name(a)}, {name(b)})
            </th>
            <td className="num">{f(distance(m, a, b))} Å</td>
          </tr>
        )}
        {a !== undefined && b !== undefined && c !== undefined && (
          <tr>
            <th scope="row">
              ∠{name(a)}–{name(b)}–{name(c)}
            </th>
            <td className="num">{f(angle(m, a, b, c))}°</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
