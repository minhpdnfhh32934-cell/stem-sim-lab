import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { NumberField } from '@/ui/NumberField';
import { L, usePublishCard } from '../common';
import { elementByZ, formatAtomicWeight, superscript, type ElementData } from '../data/elements';
import { ISOTOPE_ELEMENTS, isotopesOf, type Isotope } from '../data/isotopes';
import { abundanceGap, averageMass, twoIsotopeAbundances } from './average';
import { ISOTOPE_CARD } from './cards';
import { selectIsotopeElement, useIsotopeStore } from './store';
import '../chem.css';
import './nuclide.css';

const isotopeName = (e: ElementData, i: Isotope) => `${superscript(i.a)}${e.symbol}`;

function useSelected(): { element: ElementData; isotopes: Isotope[] } | null {
  const z = useIsotopeStore((s) => s.z);
  const element = elementByZ(z);
  const isotopes = isotopesOf(z)?.isotopes;
  return element && isotopes ? { element, isotopes } : null;
}

function useNumbers() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    /** Abundances and masses as the table gives them (no rounding beyond 6 decimals). */
    raw: (v: number) => formatNumber(locale, v, { maximumFractionDigits: 6 }),
    avg: (v: number) => formatNumber(locale, v, { maximumSignificantDigits: 7 }),
    pct: (v: number) => formatNumber(locale, v, { maximumFractionDigits: 4 }),
  };
}

/** The element's natural isotopes as bars, and its average atomic mass computed two ways. */
export function IsotopeStage() {
  usePublishCard(ISOTOPE_CARD);
  const Lz = useLocalized();
  const f = useNumbers();
  const sel = useSelected();
  if (!sel) return null;
  const { element: e, isotopes } = sel;
  const byA = averageMass(isotopes, 'massNumber');
  const byMass = averageMass(isotopes, 'mass');
  const alias = f.locale === 'vi' ? e.aliases_vi[0] : undefined;
  const terms = isotopes.map((i) => `${i.a} × ${f.raw(i.abundance_pct)}`).join(' + ');
  const divisor = abundanceGap(byA.abundanceSum) ? f.raw(byA.abundanceSum) : '100';
  return (
    <div className="chem-view iso-view">
      <h3 className="iso-view__title">
        {e.symbol} — {e.name}
        {alias ? ` (${alias})` : ''} · Z = {e.z}
      </h3>
      <p className="small muted">
        {Lz(
          L(
            `Các đồng vị tự nhiên: cùng ${e.z} proton, khác số neutron.`,
            `Natural isotopes: the same ${e.z} protons, different neutron numbers.`,
          ),
        )}
      </p>
      <ul className="iso-bars" aria-label={Lz(L('Phần trăm số nguyên tử', 'Atom percentages'))}>
        {isotopes.map((i) => (
          <li key={i.a}>
            <span className="iso-bars__name">{isotopeName(e, i)}</span>
            <span className="iso-bars__track" aria-hidden="true">
              <span className="iso-bars__fill" style={{ width: `${i.abundance_pct}%` }} />
            </span>
            <span className="iso-bars__value mono">{f.raw(i.abundance_pct)} %</span>
          </li>
        ))}
      </ul>
      <dl className="iso-avg">
        <dt>
          {Lz(L('Ā theo số khối (như sách giáo khoa)', 'Ā from mass numbers (as the textbook)'))}
        </dt>
        <dd className="mono">
          ({terms}) / {divisor} = <strong>{f.avg(byA.value)}</strong>
        </dd>
        <dt>{Lz(L('Ā theo khối lượng thực của đồng vị', 'Ā from the real isotope masses'))}</dt>
        <dd className="mono">
          <strong>{f.avg(byMass.value)}</strong>
        </dd>
        <dt>
          {Lz(
            L(
              'Nguyên tử khối chuẩn IUPAC (để so sánh)',
              'IUPAC standard atomic weight (to compare)',
            ),
          )}
        </dt>
        <dd className="mono">{formatAtomicWeight(e, f.locale)}</dd>
      </dl>
      {abundanceGap(byA.abundanceSum) && (
        <p className="chem-note chem-note--warn" role="note">
          {Lz(
            L(
              `Các phần trăm trong bảng cộng lại được ${f.raw(byA.abundanceSum)} %, không đúng 100 % (số đã làm tròn, hoặc có đồng vị không nằm trong bảng): Ā chia cho tổng này.`,
              `The table’s percentages add up to ${f.raw(byA.abundanceSum)} %, not exactly 100 % (rounded values, or an isotope missing from the table): Ā is divided by this sum.`,
            ),
          )}
        </p>
      )}
    </div>
  );
}

/** Element choice and the textbook's reverse problem (two isotopes: Ā → percentages). */
export function IsotopePanel() {
  const Lz = useLocalized();
  const f = useNumbers();
  const z = useIsotopeStore((s) => s.z);
  const average = useIsotopeStore((s) => s.average);
  const sel = useSelected();
  if (!sel) return null;
  const { element: e, isotopes } = sel;
  const [i1, i2] = isotopes;
  const two = isotopes.length === 2 && i1 && i2 ? ([i1, i2] as const) : null;
  const answer = two ? twoIsotopeAbundances(two[0].a, two[1].a, average) : null;
  const label = Lz(L('Nguyên tử khối trung bình Ā', 'Average atomic mass Ā'));
  return (
    <div className="chem-form iso-panel">
      <label>
        <span>{Lz(L('Nguyên tố', 'Element'))}</span>
        <select
          value={z}
          onChange={(ev) => {
            selectIsotopeElement(Number(ev.target.value));
          }}
        >
          {ISOTOPE_ELEMENTS.map((x) => {
            const el = elementByZ(x.z);
            const alias = f.locale === 'vi' ? el?.aliases_vi[0] : undefined;
            return (
              <option key={x.z} value={x.z}>
                {x.z} · {x.symbol} — {el?.name}
                {alias ? ` (${alias})` : ''}
              </option>
            );
          })}
        </select>
      </label>
      <h4 className="iso-panel__head">
        {Lz(L('Bài toán ngược: biết Ā, tìm phần trăm', 'Reverse problem: from Ā to percentages'))}
      </h4>
      {!two ? (
        <p className="small muted">
          {Lz(
            L(
              `Bài toán ngược cần nguyên tố có đúng hai đồng vị tự nhiên; ${e.symbol} có ${isotopes.length}. Thử Cl, Cu, Br hoặc B.`,
              `The reverse problem needs an element with exactly two natural isotopes; ${e.symbol} has ${isotopes.length}. Try Cl, Cu, Br or B.`,
            ),
          )}
        </p>
      ) : (
        <>
          <label>
            <span>{label}</span>
            <NumberField
              label={label}
              value={average}
              step={0.01}
              onChange={(v) => {
                useIsotopeStore.setState({ average: v });
              }}
            />
          </label>
          {answer?.ok ? (
            <table className="chem-table">
              <tbody>
                <tr>
                  <th scope="row">{isotopeName(e, two[0])}</th>
                  <td className="num">{f.pct(answer.x1)} %</td>
                </tr>
                <tr>
                  <th scope="row">{isotopeName(e, two[1])}</th>
                  <td className="num">{f.pct(answer.x2)} %</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="chem-note chem-note--warn" role="note">
              {Lz(
                L(
                  `Không giải được: Ā phải nằm giữa ${two[0].a} và ${two[1].a} (số khối của hai đồng vị).`,
                  `No answer: Ā must lie between ${two[0].a} and ${two[1].a} (the two mass numbers).`,
                ),
              )}
            </p>
          )}
          <p className="small muted">
            {Lz(
              L(
                `x(${isotopeName(e, two[0])}) = 100 · (${two[1].a} − Ā) / (${two[1].a} − ${two[0].a}); dùng số khối như sách giáo khoa.`,
                `x(${isotopeName(e, two[0])}) = 100 · (${two[1].a} − Ā) / (${two[1].a} − ${two[0].a}); mass numbers, as in the textbook.`,
              ),
            )}
          </p>
        </>
      )}
    </div>
  );
}

/** The data table: mass number, neutrons, isotope mass, natural abundance. */
export function IsotopeBottom() {
  const Lz = useLocalized();
  const f = useNumbers();
  const sel = useSelected();
  if (!sel) return null;
  const { element: e, isotopes } = sel;
  return (
    <table className="chem-table iso-table">
      <thead>
        <tr>
          <th scope="col">{Lz(L('Đồng vị', 'Isotope'))}</th>
          <th scope="col">{Lz(L('Số khối A', 'Mass number A'))}</th>
          <th scope="col">{Lz(L('Số neutron N = A − Z', 'Neutrons N = A − Z'))}</th>
          <th scope="col">{Lz(L('Khối lượng đồng vị (u)', 'Isotope mass (u)'))}</th>
          <th scope="col">{Lz(L('Phần trăm số nguyên tử', 'Atom percentage'))}</th>
        </tr>
      </thead>
      <tbody>
        {isotopes.map((i) => (
          <tr key={i.a}>
            <th scope="row">{isotopeName(e, i)}</th>
            <td className="num">{i.a}</td>
            <td className="num">{i.a - e.z}</td>
            <td className="num">
              {formatNumber(f.locale, i.mass_u, { maximumFractionDigits: 12 })}
            </td>
            <td className="num">{f.raw(i.abundance_pct)} %</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
