import { CircleCheck } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { L, usePublishCard } from '../common';
import type { HydroxideCharacter, OxideCharacter } from '../data/period3';
import { formatFormula } from '../formula';
import { signed } from '../redox/oxidation';
import { PERIOD_TRENDS_CARD } from './card';
import { period3Compounds, romanGroup, type CompoundRow } from './compounds';
import { selectPeriod3Element, usePeriodTrendStore } from './store';
import '../chem.css';
import './periodTrends.css';

/** The book's words (SGK Bảng 7.2, tr. 41). */
const OXIDE: Record<OxideCharacter, LocalizedText> = {
  basic: L('basic oxide', 'basic oxide'),
  amphoteric: L('oxide lưỡng tính', 'amphoteric oxide'),
  acidic: L('acidic oxide', 'acidic oxide'),
};
const HYDROXIDE: Record<HydroxideCharacter, LocalizedText> = {
  strongBase: L('base mạnh', 'strong base'),
  weakBase: L('base yếu', 'weak base'),
  amphoteric: L('hydroxide lưỡng tính', 'amphoteric hydroxide'),
  weakAcid: L('acid yếu', 'weak acid'),
  mediumAcid: L('acid trung bình', 'medium-strength acid'),
  strongAcid: L('acid mạnh', 'strong acid'),
  veryStrongAcid: L('acid rất mạnh', 'very strong acid'),
};
/** Colour family of a character: base, amphoteric or acid (the book's blue-to-red arrow). */
const tone = (c: OxideCharacter | HydroxideCharacter) =>
  c === 'amphoteric' ? 'amph' : c === 'basic' || c.endsWith('Base') ? 'base' : 'acid';

/** Computed once: the rows depend only on the data tables. */
const ROWS: readonly CompoundRow[] = period3Compounds();
const useRows = () => ROWS;

/** Na…Cl side by side: group, highest oxidation number, oxide and hydroxide with their character. */
export function PeriodTrendStage() {
  usePublishCard(PERIOD_TRENDS_CARD);
  const Lz = useLocalized();
  const z = usePeriodTrendStore((s) => s.z);
  const rows = useRows();
  return (
    <div className="chem-view">
      <h3 className="hh10-title">
        {Lz(
          L(
            'Oxide và hydroxide ứng với hoá trị cao nhất, chu kì 3',
            'Oxides and hydroxides for the highest valence, period 3',
          ),
        )}
      </h3>
      <ol className="p3-row">
        {rows.map((r) => (
          <li key={r.z}>
            <button
              type="button"
              className={`p3-card${r.z === z ? ' is-active' : ''}`}
              aria-pressed={r.z === z}
              onClick={() => {
                selectPeriod3Element(r.z);
              }}
            >
              <span className="p3-card__el">{r.symbol}</span>
              <span className="p3-card__group">
                {romanGroup(r.n)} · {signed(r.n)}
              </span>
              <span className="p3-card__formula">{formatFormula(r.oxide)}</span>
              <span className={`p3-chip p3-chip--${tone(r.oxideCharacter)}`}>
                {Lz(OXIDE[r.oxideCharacter])}
              </span>
              <span className="p3-card__formula">{formatFormula(r.hydroxide)}</span>
              <span className={`p3-chip p3-chip--${tone(r.hydroxideCharacter)}`}>
                {Lz(HYDROXIDE[r.hydroxideCharacter])}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="p3-arrow">
        <span className="p3-arrow__bar" aria-hidden="true" />
        <span>
          {Lz(
            L(
              'Chiều giảm tính base và tăng tính acid',
              'Basic character falls, acidic character rises',
            ),
          )}
        </span>
      </p>
      <p className="small muted">
        {Lz(
          L(
            'Nói chung, hydroxide của các nguyên tố nhóm IA thể hiện tính base mạnh, hydroxide ứng với hoá trị cao nhất của các nguyên tố nhóm VIIA (trừ fluorine) thể hiện tính acid mạnh (SGK tr. 41).',
            'In general, group IA hydroxides are strong bases and the hydroxides for the highest valence of group VIIA elements (except fluorine) are strong acids (SGK p. 41).',
          ),
        )}
      </p>
    </div>
  );
}

/** How the selected element's formulas follow from its group. */
export function PeriodTrendPanel() {
  const Lz = useLocalized();
  const z = usePeriodTrendStore((s) => s.z);
  const rows = useRows();
  const r = rows.find((x) => x.z === z);
  if (!r) return null;
  const odd = r.n % 2 === 1;
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Nguyên tố', 'Element'))}</span>
        <select
          value={z}
          onChange={(e) => {
            selectPeriod3Element(Number(e.target.value));
          }}
        >
          {rows.map((x) => (
            <option key={x.z} value={x.z}>
              {x.z} · {x.symbol}
            </option>
          ))}
        </select>
      </label>
      <dl className="p3-facts">
        <dt>{Lz(L('Nhóm và số oxi hoá cao nhất', 'Group and highest oxidation number'))}</dt>
        <dd>
          {Lz(
            L(
              `Nhóm ${romanGroup(r.n)} → ${signed(r.n)}`,
              `Group ${romanGroup(r.n)} → ${signed(r.n)}`,
            ),
          )}
        </dd>
        <dt>{Lz(L('Oxide cao nhất', 'Highest oxide'))}</dt>
        <dd>
          {formatFormula(r.oxide)} —{' '}
          {Lz(
            odd
              ? L(
                  `n = ${String(r.n)} lẻ: 2 nguyên tử ${r.symbol}, ${String(r.n)} nguyên tử O`,
                  `n = ${String(r.n)} odd: 2 ${r.symbol} atoms, ${String(r.n)} O atoms`,
                )
              : L(
                  `n = ${String(r.n)} chẵn: 1 nguyên tử ${r.symbol}, n : 2 = ${String(r.n / 2)} nguyên tử O`,
                  `n = ${String(r.n)} even: 1 ${r.symbol} atom, n ÷ 2 = ${String(r.n / 2)} O atoms`,
                ),
          )}
        </dd>
        <dt>{Lz(L('Hydroxide tương ứng', 'Corresponding hydroxide'))}</dt>
        <dd>
          {formatFormula(r.hydroxide)} —{' '}
          {r.hydroxideFrom === 'rule'
            ? Lz(L('kim loại: E(OH)ₙ', 'metal: E(OH)ₙ'))
            : Lz(L('công thức acid theo SGK Bảng 7.1', 'acid formula from SGK Bảng 7.1'))}
        </dd>
        {r.checked && (
          <dd className="p3-check">
            <CircleCheck size={15} strokeWidth={1.75} aria-hidden="true" />
            {Lz(
              L(
                `Kiểm tra: với H +1, O −2 thì ${r.symbol} có số oxi hoá ${signed(r.n)} trong ${formatFormula(r.hydroxide)}.`,
                `Check: with H +1, O −2, ${r.symbol} is ${signed(r.n)} in ${formatFormula(r.hydroxide)}.`,
              ),
            )}
          </dd>
        )}
      </dl>
    </div>
  );
}

/** The book's Bảng 7.2 as a table. */
export function PeriodTrendBottom() {
  const Lz = useLocalized();
  const z = usePeriodTrendStore((s) => s.z);
  const rows = useRows();
  return (
    <table className="chem-table">
      <thead>
        <tr>
          <th scope="col">{Lz(L('Nguyên tố', 'Element'))}</th>
          <th scope="col">{Lz(L('Nhóm', 'Group'))}</th>
          <th scope="col">Oxide</th>
          <th scope="col">{Lz(L('Tính chất', 'Character'))}</th>
          <th scope="col">Hydroxide</th>
          <th scope="col">{Lz(L('Tính chất', 'Character'))}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.z} className={r.z === z ? 'is-active' : undefined}>
            <th scope="row">{r.symbol}</th>
            <td>{romanGroup(r.n)}</td>
            <td>{formatFormula(r.oxide)}</td>
            <td>{Lz(OXIDE[r.oxideCharacter])}</td>
            <td>{formatFormula(r.hydroxide)}</td>
            <td>{Lz(HYDROXIDE[r.hydroxideCharacter])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
