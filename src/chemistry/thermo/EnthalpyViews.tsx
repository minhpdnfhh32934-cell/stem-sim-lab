import { useMemo } from 'react';
import { formatNumber, type Locale } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { L, usePublishCard } from '../common';
import { reactionById } from '../data/reactions';
import type { EnthalpyReference, Phase } from '../data/enthalpy';
import { formatFormula } from '../formula';
import { ENTHALPY_CARD } from './card';
import { ENTHALPY_REACTION_IDS, reactionEnthalpy, type EnthalpyTerm } from './enthalpy';
import { selectEnthalpyReaction, useEnthalpyStore } from './store';
import '../chem.css';
import './thermo.css';

/** "−890,2" with the given decimals and a typographic minus. */
const kj = (locale: Locale, v: number, decimals: number) =>
  formatNumber(locale, v, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).replace(/^-/, '−');

const SOURCE: Record<EnthalpyReference, LocalizedText> = {
  sgk: L('SGK Bảng 17.1', 'SGK Table 17.1'),
  codata: L('NIST (CODATA)', 'NIST (CODATA)'),
  janaf: L('NIST (JANAF)', 'NIST (JANAF)'),
  definition: L('đơn chất bền: 0', 'stable element: 0'),
};

/** Δ_rH°_298 or Δ_fH°_298 with the book's subscripts (text content stays "ΔrH°298"). */
function DH({ sub }: { sub: 'r' | 'f' }) {
  return (
    <>
      Δ<sub>{sub}</sub>H°<sub>298</sub>
    </>
  );
}

const species = (t: EnthalpyTerm) =>
  `${t.coef > 1 ? String(t.coef) : ''}${formatFormula(t.formula)}(${t.phase})`;

function useResult() {
  const id = useEnthalpyStore((s) => s.id);
  return useMemo(() => reactionEnthalpy(id), [id]);
}

/** Two enthalpy levels and the ΔrH arrow; an illustration, not to scale. */
function LevelDiagram({ exo, label }: { exo: boolean; label: string }) {
  const Lz = useLocalized();
  const [top, bottom] = [40, 140];
  const [yr, yp] = exo ? [top, bottom] : [bottom, top];
  return (
    <figure className="dh-figure">
      <figcaption className="eq-energy__head">
        <span className="econf__label">
          {Lz(L('Sơ đồ biến thiên enthalpy', 'Enthalpy diagram'))}
        </span>
        <span className="chem-chip chem-chip--qual">
          {Lz(L('Minh hoạ, không theo tỉ lệ', 'Illustration, not to scale'))}
        </span>
      </figcaption>
      <svg className="dh-svg" viewBox="0 0 320 180" role="img" aria-label={label}>
        <path className="dh-axis" d="M20 168 L20 12" />
        <text className="dh-text" x="26" y="16">
          H
        </text>
        <path className="dh-level" d={`M40 ${String(yr)} L130 ${String(yr)}`} />
        <path className="dh-level" d={`M190 ${String(yp)} L280 ${String(yp)}`} />
        <text className="dh-text" x="85" y={yr - 8} textAnchor="middle">
          {Lz(L('Chất đầu', 'Reactants'))}
        </text>
        <text className="dh-text" x="235" y={yp - 8} textAnchor="middle">
          {Lz(L('Sản phẩm', 'Products'))}
        </text>
        <path className="dh-guide" d={`M130 ${String(yr)} L170 ${String(yr)}`} />
        <path
          className={`dh-arrow ${exo ? 'dh-arrow--exo' : 'dh-arrow--endo'}`}
          d={`M160 ${String(yr)} L160 ${String(yp + (exo ? -6 : 6))}`}
        />
        <path
          className={`dh-head ${exo ? 'dh-arrow--exo' : 'dh-arrow--endo'}`}
          d={
            exo
              ? `M154 ${String(yp - 8)} L160 ${String(yp)} L166 ${String(yp - 8)}`
              : `M154 ${String(yp + 8)} L160 ${String(yp)} L166 ${String(yp + 8)}`
          }
        />
        <text className="dh-text" x="152" y={(yr + yp) / 2 + 4} textAnchor="end">
          Δ<tspan baselineShift="sub">r</tspan>H {exo ? '< 0' : '> 0'}
        </text>
      </svg>
    </figure>
  );
}

/** The thermochemical equation, the two sums and ΔrH°298, and the level diagram. */
export function EnthalpyStage() {
  usePublishCard(ENTHALPY_CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const res = useResult();
  if (!res) return null;
  const reactants = res.terms.filter((t) => t.side === 'reactant');
  const products = res.terms.filter((t) => t.side === 'product');
  const equation = `${reactants.map(species).join(' + ')} → ${products.map(species).join(' + ')}`;
  if (!res.ok)
    return (
      <div className="chem-view">
        <h3 className="hh10-title">{Lz(res.reaction.name)}</h3>
        <p className="rx-eq rx-eq--big">{equation}</p>
        <p className="chem-note chem-note--warn" role="note">
          {Lz(
            L(
              `Chưa có nhiệt tạo thành có nguồn cho: ${res.missing.map(species).join(', ')}.`,
              `No cited enthalpy of formation for: ${res.missing.map(species).join(', ')}.`,
            ),
          )}
        </p>
      </div>
    );
  const d = res.decimals;
  // Each value as its source prints it; an element's defined 0 as "0".
  const terms = (list: EnthalpyTerm[]) =>
    list
      .map(
        (t) =>
          `${String(t.coef)} · (${kj(locale, t.data?.dfh_kj_mol ?? 0, t.data?.decimals ?? 0)})`,
      )
      .join(' + ');
  const dH = `${kj(locale, res.dH, d)} kJ`;
  const rounded = res.dHExact !== res.dH;
  const kind = res.kind;
  const products_ = kj(locale, res.products, res.productsDecimals);
  const reactants_ = kj(locale, res.reactants, res.reactantsDecimals);
  return (
    <div className="chem-view">
      <h3 className="hh10-title">{Lz(res.reaction.name)}</h3>
      <p className="rx-eq rx-eq--big">
        {equation}
        <span className="dh-result">
          <DH sub="r" /> = {dH}
        </span>
      </p>
      <dl className="dh-sum">
        <dt>{Lz(L('Tổng nhiệt tạo thành các chất sản phẩm', 'Total for the products'))}</dt>
        <dd className="mono">
          Σ<DH sub="f" />({Lz(L('sp', 'products'))}) = {terms(products)} = {products_} kJ
        </dd>
        <dt>{Lz(L('Tổng nhiệt tạo thành các chất đầu', 'Total for the reactants'))}</dt>
        <dd className="mono">
          Σ<DH sub="f" />({Lz(L('cđ', 'reactants'))}) = {terms(reactants)} = {reactants_} kJ
        </dd>
        <dt>{Lz(L('Biến thiên enthalpy của phản ứng', 'Enthalpy change of the reaction'))}</dt>
        <dd className="mono">
          <DH sub="r" /> = {products_} − ({reactants_}) ={' '}
          {rounded &&
            `${kj(locale, res.dHExact, Math.max(res.productsDecimals, res.reactantsDecimals))} ≈ `}
          <strong>{dH}</strong>
        </dd>
      </dl>
      {rounded && (
        <p className="small muted">
          {Lz(
            L(
              `Kết quả ghi đến ${String(d)} chữ số thập phân, bằng giá trị kém chính xác nhất đã dùng.`,
              `The result is given to ${String(d)} decimal place(s), like the least precise value used.`,
            ),
          )}
        </p>
      )}
      <p className="chem-note" role="note">
        {Lz(
          kind === 'exothermic'
            ? L('ΔrH < 0: phản ứng toả nhiệt.', 'ΔrH < 0: the reaction releases heat (exothermic).')
            : kind === 'endothermic'
              ? L(
                  'ΔrH > 0: phản ứng thu nhiệt.',
                  'ΔrH > 0: the reaction absorbs heat (endothermic).',
                )
              : L(
                  'ΔrH = 0: phản ứng không toả nhiệt, không thu nhiệt.',
                  'ΔrH = 0: the reaction neither releases nor absorbs heat.',
                ),
        )}
      </p>
      {kind !== 'none' && (
        <LevelDiagram
          exo={kind === 'exothermic'}
          label={Lz(
            L(
              `Sơ đồ: sản phẩm ${kind === 'exothermic' ? 'thấp' : 'cao'} hơn chất đầu, ΔrH°298 = ${dH}`,
              `Diagram: products ${kind === 'exothermic' ? 'below' : 'above'} the reactants, ΔrH°298 = ${dH}`,
            ),
          )}
        />
      )}
    </div>
  );
}

/** Choice of a library reaction with cited enthalpies of formation. */
export function EnthalpyPanel() {
  const Lz = useLocalized();
  const id = useEnthalpyStore((s) => s.id);
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Phản ứng', 'Reaction'))}</span>
        <select
          value={id}
          onChange={(e) => {
            selectEnthalpyReaction(e.target.value);
          }}
        >
          {ENTHALPY_REACTION_IDS.map((rid) => {
            const r = reactionById(rid);
            return r ? (
              <option key={rid} value={rid}>
                {Lz(r.name)}
              </option>
            ) : null;
          })}
        </select>
      </label>
      <p className="small muted">
        {Lz(
          L(
            'Các phản ứng lấy từ thư viện đã kiểm chứng; mỗi chất ở trạng thái ghi trong ngoặc: (s) rắn, (l) lỏng, (g) khí.',
            'Reactions from the verified library; each species in the state in brackets: (s) solid, (l) liquid, (g) gas.',
          ),
        )}
      </p>
    </div>
  );
}

const PHASE: Record<Phase, LocalizedText> = {
  s: L('rắn', 'solid'),
  l: L('lỏng', 'liquid'),
  g: L('khí', 'gas'),
};

/** Every species: its ΔfH°298, ν·ΔfH°298 and source; Advanced adds the NIST cross-check. */
export function EnthalpyBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const res = useResult();
  if (!res) return null;

  return (
    <table className="chem-table">
      <thead>
        <tr>
          <th scope="col">{Lz(L('Chất', 'Species'))}</th>
          <th scope="col">{Lz(L('Trạng thái', 'State'))}</th>
          <th scope="col">{Lz(L('Hệ số ν', 'Coefficient ν'))}</th>
          <th scope="col">
            <DH sub="f" /> (kJ/mol)
          </th>
          <th scope="col">
            ν · <DH sub="f" /> (kJ)
          </th>
          <th scope="col">{Lz(L('Nguồn', 'Source'))}</th>
          {advanced && <th scope="col">{Lz(L('NIST (đối chiếu)', 'NIST (cross-check)'))}</th>}
        </tr>
      </thead>
      <tbody>
        {res.terms.map((t) => (
          <tr key={`${t.side}${t.formula}`}>
            <th scope="row">{formatFormula(t.formula)}</th>
            <td>{Lz(PHASE[t.phase])}</td>
            <td className="num">{t.coef}</td>
            <td className="num">{t.data ? kj(locale, t.data.dfh_kj_mol, t.data.decimals) : '—'}</td>
            <td className="num">
              {t.data ? kj(locale, t.coef * t.data.dfh_kj_mol, t.data.decimals) : '—'}
            </td>
            <td>{t.data ? Lz(SOURCE[t.data.source]) : '—'}</td>
            {advanced && (
              <td className="num">
                {t.data?.other
                  ? kj(locale, t.data.other.dfh_kj_mol, t.data.other.decimals)
                  : t.data?.source === 'codata' || t.data?.source === 'janaf'
                    ? kj(locale, t.data.dfh_kj_mol, t.data.decimals)
                    : '—'}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
