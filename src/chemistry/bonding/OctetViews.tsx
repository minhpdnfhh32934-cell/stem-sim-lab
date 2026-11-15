import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { ReviewBadge } from '@/ui/Badges';
import { L, usePublishCard } from '../common';
import { moleculeById, prettyFormula, type Molecule } from '../data/molecules';
import { OCTET_CARD } from './cards';
import { LewisDrawing } from './LewisDrawing';
import { MoleculeChips } from './MoleculeChips';
import {
  octetCounts,
  OCTET_MOLECULES,
  valenceTotal,
  type AtomCount,
  type OctetVerdict,
} from './octet';
import { useBondingStore } from './store';
import '../chem.css';
import './bonding.css';

const VERDICT: Record<OctetVerdict, LocalizedText> = {
  ok: L('đạt', 'met'),
  deficient: L('ít hơn 8', 'fewer than 8'),
  expanded: L('nhiều hơn 8', 'more than 8'),
  odd: L('số lẻ', 'odd number'),
};

function useOctetMolecule(): Molecule {
  const id = useBondingStore((s) => s.octet);
  const m = moleculeById(id) ?? moleculeById(OCTET_MOLECULES[0]);
  if (!m) throw new Error('molecule data missing');
  return m;
}

/** "B: 6 electron (ít hơn 8)" for every atom that breaks the rule. */
function exceptionText(Lz: (t: LocalizedText) => string, bad: readonly AtomCount[]): string {
  const e = Lz(L('electron', 'electrons'));
  const lines = bad.map((c) => `${c.el}: ${String(c.total)} ${e} (${Lz(VERDICT[c.verdict])})`);
  return [...new Set(lines)].join('; ');
}

export function OctetStage() {
  const Lz = useLocalized();
  const m = useOctetMolecule();
  usePublishCard(OCTET_CARD);
  const counts = useMemo(() => octetCounts(m), [m]);
  const bad = counts.filter((c) => c.verdict !== 'ok');
  const formula = prettyFormula(m.display_formula);
  return (
    <div className="chem-view bond-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong>{formula}</strong>
        </span>
        {bad.length === 0 ? (
          <span className="chem-chip chem-chip--qual">
            {Lz(
              L(
                'Mọi nguyên tử đạt octet (H: 2 electron)',
                'Every atom has an octet (H: 2 electrons)',
              ),
            )}
          </span>
        ) : (
          <span className="chem-chip chem-chip--approx">
            {Lz(L('Ngoại lệ — ', 'Exception — '))}
            {exceptionText(Lz, bad)}
          </span>
        )}
        <span className="chem-chip">
          {Lz(L('Hình minh họa kiểu Lewis', 'Lewis-style illustration'))}
        </span>
      </div>
      <div className="bond-view__figure">
        <LewisDrawing
          molecule={m}
          highlight={bad.map((c) => c.index)}
          label={`${Lz(L('Công thức Lewis', 'Lewis structure'))} ${formula}`}
        />
      </div>
    </div>
  );
}

/** Rows of identical atoms merged: "H ×4". */
function groupRows(counts: readonly AtomCount[]): { c: AtomCount; n: number }[] {
  const rows = new Map<string, { c: AtomCount; n: number }>();
  for (const c of counts) {
    const key = `${c.el}|${String(c.charge)}|${String(c.bondOrder)}|${String(c.nonbonding)}`;
    const row = rows.get(key);
    if (row) row.n += 1;
    else rows.set(key, { c, n: 1 });
  }
  return [...rows.values()];
}

export function OctetPanel() {
  const Lz = useLocalized();
  const m = useOctetMolecule();
  const counts = useMemo(() => octetCounts(m), [m]);
  return (
    <div className="chem-form">
      <MoleculeChips
        ids={OCTET_MOLECULES}
        value={m.id}
        label={L('Phân tử và ion', 'Molecules and ions')}
        onPick={(octet) => {
          useBondingStore.setState({ octet });
        }}
      />
      <div>
        <p className="el-card__name">{Lz(m.name)}</p>
        <p className="mono">{prettyFormula(m.display_formula)}</p>
        <ReviewBadge status={m.review_status} />
      </div>
      <p>
        {Lz(L('Tổng số electron hoá trị: ', 'Total valence electrons: '))}
        <strong className="mono">{valenceTotal(counts)}</strong>
      </p>
      <table className="chem-table bond-table">
        <thead>
          <tr>
            <th scope="col">{Lz(L('Nguyên tử', 'Atom'))}</th>
            <th scope="col" className="num">
              {Lz(L('e hoá trị', 'Valence e'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Dùng chung', 'Shared'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Riêng', 'Own'))}
            </th>
            <th scope="col" className="num">
              {Lz(L('Quanh nguyên tử', 'Around'))}
            </th>
          </tr>
        </thead>
        <tbody>
          {groupRows(counts).map(({ c, n }) => (
            <tr key={c.index} className={c.verdict === 'ok' ? undefined : 'is-exception'}>
              <th scope="row">
                {c.el}
                {n > 1 ? ` ×${String(n)}` : ''}
              </th>
              <td className="num">{c.valence}</td>
              <td className="num">{c.shared}</td>
              <td className="num">{c.nonbonding}</td>
              <td className="num">
                {c.total} ({Lz(VERDICT[c.verdict])})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">
        {Lz(
          L(
            'Dùng chung: 2 electron cho mỗi gạch liên kết, tính cho cả hai nguyên tử. Riêng = hoá trị − điện tích hình thức − số gạch. Octet: 8 electron quanh nguyên tử (H: 2, như He).',
            'Shared: 2 electrons per bond line, counted for both atoms. Own = valence − formal charge − bond lines. Octet: 8 electrons around the atom (H: 2, like He).',
          ),
        )}
      </p>
    </div>
  );
}
