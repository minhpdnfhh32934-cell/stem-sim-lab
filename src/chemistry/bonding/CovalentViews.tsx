import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { ReviewBadge } from '@/ui/Badges';
import { L, usePublishCard } from '../common';
import { moleculeById, prettyFormula, type Molecule } from '../data/molecules';
import { BOND_TYPE, orderName } from '../molecule/labels';
import { COVALENT_CARD } from './cards';
import { COVALENT_MOLECULES, covalentBonds, sigmaPiTotals, type BondRow } from './covalent';
import { LewisDrawing } from './LewisDrawing';
import { MoleculeChips } from './MoleculeChips';
import { useBondingStore } from './store';
import '../chem.css';
import './bonding.css';

function useCovalentMolecule(): Molecule {
  const id = useBondingStore((s) => s.covalent);
  const m = moleculeById(id) ?? moleculeById(COVALENT_MOLECULES[0]);
  if (!m) throw new Error('molecule data missing');
  return m;
}

/** "σ", "σ + π", "σ + 2π". */
const sigmaPiText = (r: BondRow) => (r.pi === 0 ? 'σ' : `σ + ${r.pi > 1 ? String(r.pi) : ''}π`);

const bondName = (m: Molecule, r: BondRow) =>
  `${m.atoms[r.a]?.el ?? '?'}${String(r.a + 1)}–${m.atoms[r.b]?.el ?? '?'}${String(r.b + 1)}`;

export function CovalentStage() {
  const Lz = useLocalized();
  const m = useCovalentMolecule();
  usePublishCard(COVALENT_CARD);
  const rows = useMemo(() => covalentBonds(m), [m]);
  const t = sigmaPiTotals(rows);
  const formula = prettyFormula(m.display_formula);
  return (
    <div className="chem-view bond-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong>{formula}</strong>
        </span>
        <span className="chem-chip chem-chip--qual">
          {Lz(L('Liên kết σ: ', 'σ bonds: '))}
          {t.sigma} · {Lz(L('liên kết π: ', 'π bonds: '))}
          {t.pi}
        </span>
        <span className="chem-chip">
          {Lz(L('Hình minh họa kiểu Lewis', 'Lewis-style illustration'))}
        </span>
      </div>
      <div className="bond-view__figure">
        <LewisDrawing
          molecule={m}
          bondLabels={rows.map(sigmaPiText)}
          label={`${Lz(L('Công thức Lewis', 'Lewis structure'))} ${formula}: σ ${String(t.sigma)}, π ${String(t.pi)}`}
        />
      </div>
    </div>
  );
}

export function CovalentPanel() {
  const Lz = useLocalized();
  const m = useCovalentMolecule();
  const rows = useMemo(() => covalentBonds(m), [m]);
  const t = sigmaPiTotals(rows);
  const exception = rows.some((r) => r.thresholdException);
  return (
    <div className="chem-form">
      <MoleculeChips
        ids={COVALENT_MOLECULES}
        value={m.id}
        label={L('Phân tử mẫu', 'Sample molecules')}
        onPick={(covalent) => {
          useBondingStore.setState({ covalent });
        }}
      />
      <div>
        <p className="el-card__name">{Lz(m.name)}</p>
        <p className="mono">{prettyFormula(m.display_formula)}</p>
        <ReviewBadge status={m.review_status} />
      </div>
      <table className="chem-table">
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Liên kết σ', 'σ bonds'))}</th>
            <td className="num">{t.sigma}</td>
          </tr>
          <tr>
            <th scope="row">{Lz(L('Liên kết π', 'π bonds'))}</th>
            <td className="num">{t.pi}</td>
          </tr>
        </tbody>
      </table>
      {exception && (
        <p className="chem-note chem-note--warn" role="note">
          <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {Lz(
              L(
                '|Δχ| ≥ 1,7 nhưng các nguyên tử vẫn dùng chung cặp electron: một ngoại lệ của Bảng 12.1 (SGK nêu ví dụ HF).',
                '|Δχ| ≥ 1.7 yet the atoms share an electron pair: an exception to Table 12.1 (the textbook names HF).',
              ),
            )}
          </span>
        </p>
      )}
      <p className="small muted">
        {Lz(
          L(
            'Liên kết đơn: 1 σ. Liên kết đôi: 1 σ + 1 π. Liên kết ba: 1 σ + 2 π. Bảng liên kết ở khung dưới.',
            'Single bond: 1 σ. Double bond: 1 σ + 1 π. Triple bond: 1 σ + 2 π. The bond table is in the bottom panel.',
          ),
        )}
      </p>
    </div>
  );
}

/** Every bond: order, σ/π, |Δχ| and the type by Table 12.1. */
export function CovalentBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const m = useCovalentMolecule();
  const rows = useMemo(() => covalentBonds(m), [m]);
  return (
    <div className="chem-block">
      <table className="chem-table">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Liên kết', 'Bond'))}</th>
            <th scope="col">{Lz(L('Loại theo bậc', 'By order'))}</th>
            <th scope="col" className="num">
              σ
            </th>
            <th scope="col" className="num">
              π
            </th>
            <th scope="col" className="num">
              |Δχ|
            </th>
            <th scope="col">{Lz(L('Loại theo Bảng 12.1', 'Type by Table 12.1'))}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className={r.thresholdException ? 'is-exception' : undefined}>
              <td>{bondName(m, r)}</td>
              <td>{Lz(orderName(r.order))}</td>
              <td className="num">{r.sigma}</td>
              <td className="num">{r.pi}</td>
              <td className="num">
                {r.deltaEn === null
                  ? '—'
                  : formatNumber(locale, r.deltaEn, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </td>
              <td>
                {r.type ? Lz(BOND_TYPE[r.type]) : '—'}
                {r.thresholdException ? Lz(L(' (ngoại lệ)', ' (exception)')) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
