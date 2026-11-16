import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { XYChart } from '@/ui/charts/XYChart';
import { L, usePublishCard } from '../common';
import { formatFormula } from '../formula';
import { HALOGENS_CARD } from './cards';
import { deg, num, outerShell, STATE } from './format';
import { HALOGEN_ROWS, type HalogenRow } from './halogens';
import {
  HALOGEN_PROPERTIES,
  selectHalogen,
  selectHalogenProperty,
  useHalogenStore,
  type HalogenProperty,
} from './store';
import '../chem.css';
import './halogen.css';

/** The book's t_nc, t_s; English readers get m.p., b.p. */
const T_NC = L('tnc', 'm.p.');
const T_S = L('ts', 'b.p.');

const PROPERTY: Record<
  HalogenProperty,
  {
    label: LocalizedText;
    short: LocalizedText | string;
    unit: string;
    value: (r: HalogenRow) => number | null;
  }
> = {
  radius: {
    label: L('Bán kính nguyên tử (SGK Hình 6.2)', 'Atomic radius (SGK Figure 6.2)'),
    short: 'r',
    unit: 'pm',
    value: (r) => r.radius_pm,
  },
  en: {
    label: L('Độ âm điện Pauling (SGK Bảng 6.2)', 'Pauling electronegativity (SGK Table 6.2)'),
    short: 'χ',
    unit: '',
    value: (r) => r.en_pauling,
  },
  ie: {
    label: L('Năng lượng ion hoá thứ nhất (NIST)', 'First ionisation energy (NIST)'),
    short: 'I₁',
    unit: 'kJ/mol',
    value: (r) => r.ie_kj_mol,
  },
  melting: {
    label: L('Nhiệt độ nóng chảy (SGK Bảng 21.2)', 'Melting point (SGK Table 21.2)'),
    short: T_NC,
    unit: '°C',
    value: (r) => r.melting_c,
  },
  boiling: {
    label: L('Nhiệt độ sôi (SGK Bảng 21.2)', 'Boiling point (SGK Table 21.2)'),
    short: T_S,
    unit: '°C',
    value: (r) => r.boiling_c,
  },
};

/** F, Cl, Br, I side by side with the book's values. */
export function HalogenStage() {
  usePublishCard(HALOGENS_CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const z = useHalogenStore((s) => s.z);
  return (
    <div className="chem-view">
      <h3 className="hh10-title">{Lz(L('Nhóm VIIA: F, Cl, Br, I', 'Group VIIA: F, Cl, Br, I'))}</h3>
      <ol className="hal-row">
        {HALOGEN_ROWS.map((r) => (
          <li key={r.z} className={`hal-card${r.z === z ? ' is-active' : ''}`}>
            <button
              type="button"
              className="hal-card__pick"
              aria-pressed={r.z === z}
              onClick={() => {
                selectHalogen(r.z);
              }}
            >
              <span className="hal-card__el">{r.symbol}</span>
              <span className="hal-card__sub">{outerShell(r.z)}</span>
              <span className="hal-card__sub">
                {formatFormula(`${r.symbol}2`)} · {Lz(STATE[r.state])} · {Lz(r.colour)}
              </span>
            </button>
            <dl className="hal-card__facts">
              <dt>r</dt>
              <dd>{num(locale, r.radius_pm)} pm</dd>
              <dt>χ</dt>
              <dd>{num(locale, r.en_pauling)}</dd>
              <dt>I₁</dt>
              <dd>{r.ie_kj_mol === null ? '—' : `${num(locale, r.ie_kj_mol)} kJ/mol`}</dd>
              <dt>{Lz(T_NC)}</dt>
              <dd>{deg(locale, r.melting_c)} °C</dd>
              <dt>{Lz(T_S)}</dt>
              <dd>{deg(locale, r.boiling_c)} °C</dd>
            </dl>
          </li>
        ))}
      </ol>
      <ul className="hal-trends">
        <li>
          {Lz(
            L(
              'Từ F đến I: bán kính nguyên tử tăng; độ âm điện và năng lượng ion hoá thứ nhất giảm.',
              'From F to I: the atomic radius grows; electronegativity and first ionisation energy fall.',
            ),
          )}
        </li>
        <li>
          {Lz(
            L(
              'Tính oxi hoá giảm dần từ fluorine đến iodine (SGK tr. 107).',
              'Oxidising power falls from fluorine to iodine (SGK p. 107).',
            ),
          )}
        </li>
        <li>
          {Lz(
            L(
              'Nhiệt độ nóng chảy, nhiệt độ sôi tăng từ F₂ đến I₂ do tương tác van der Waals giữa các phân tử tăng và khối lượng phân tử tăng (SGK tr. 107).',
              'Melting and boiling points rise from F₂ to I₂ as the van der Waals interactions and the molecular mass increase (SGK p. 107).',
            ),
          )}
        </li>
      </ul>
    </div>
  );
}

/** The halogen and the quantity drawn in the bottom chart. */
export function HalogenPanel() {
  const Lz = useLocalized();
  const z = useHalogenStore((s) => s.z);
  const property = useHalogenStore((s) => s.property);
  const locale = useSettingsStore((s) => s.locale);
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const r = HALOGEN_ROWS.find((x) => x.z === z);
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Nguyên tố', 'Element'))}</span>
        <select
          value={z}
          onChange={(e) => {
            selectHalogen(Number(e.target.value));
          }}
        >
          {HALOGEN_ROWS.map((x) => (
            <option key={x.z} value={x.z}>
              {x.z} · {x.symbol}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{Lz(L('Đồ thị', 'Chart'))}</span>
        <select
          value={property}
          onChange={(e) => {
            selectHalogenProperty(e.target.value);
          }}
        >
          {HALOGEN_PROPERTIES.map((p) => (
            <option key={p} value={p}>
              {Lz(PROPERTY[p].label)}
            </option>
          ))}
        </select>
      </label>
      {r && (
        <p className="small">
          {Lz(
            L(
              `${r.symbol}: lớp ngoài cùng ${outerShell(r.z)}, 7 electron, dễ nhận thêm 1 electron; số oxi hoá đặc trưng trong hợp chất là −1${r.symbol === 'F' ? ', fluorine luôn có số oxi hoá −1 trong mọi hợp chất' : ', có thể dương (+1, +3, +5, +7) khi liên kết với nguyên tố có độ âm điện lớn hơn'} (SGK tr. 106).`,
              `${r.symbol}: outer shell ${outerShell(r.z)}, 7 electrons, gains 1 electron easily; its usual oxidation number in compounds is −1${r.symbol === 'F' ? ', and fluorine is −1 in every compound' : ', positive (+1, +3, +5, +7) with more electronegative elements'} (SGK p. 106).`,
            ),
          )}
        </p>
      )}
      {r && advanced && (
        <table className="chem-table">
          <caption className="econf__label">
            {Lz(L('Đối chiếu nguồn khác', 'Cross-check with other sources'))}
          </caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">SGK</th>
              <th scope="col">{Lz(L('Nguồn khác', 'Other'))}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">r (pm)</th>
              <td className="num">{num(locale, r.radius_pm)}</td>
              <td className="num">
                {r.other.radius_pm === null ? '—' : num(locale, r.other.radius_pm)}
              </td>
            </tr>
            <tr>
              <th scope="row">{Lz(T_NC)} (°C)</th>
              <td className="num">{deg(locale, r.melting_c)}</td>
              <td className="num">
                {r.other.melting_c === null ? '—' : num(locale, r.other.melting_c, 5)}
              </td>
            </tr>
            <tr>
              <th scope="row">{Lz(T_S)} (°C)</th>
              <td className="num">{deg(locale, r.boiling_c)}</td>
              <td className="num">
                {r.other.boiling_c === null ? '—' : num(locale, r.other.boiling_c, 5)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {r && advanced && (
        <p className="small muted">
          {Lz(
            L(
              'Nguồn khác: bán kính cộng hoá trị (Cordero 2008), nhiệt độ nóng chảy và sôi theo CRC Handbook, qua thư viện mendeleev.',
              'Other: covalent radius (Cordero 2008), melting and boiling points from the CRC Handbook, via the mendeleev library.',
            ),
          )}
        </p>
      )}
    </div>
  );
}

/** The chosen quantity from F to I against Z (bottom panel). */
export function HalogenBottom() {
  const Lz = useLocalized();
  const z = useHalogenStore((s) => s.z);
  const property = useHalogenStore((s) => s.property);
  const p = PROPERTY[property];
  const x = useMemo(() => HALOGEN_ROWS.map((r) => r.z), []);
  const series = useMemo(() => [{ label: Lz(p.label), y: HALOGEN_ROWS.map(p.value) }], [Lz, p]);
  return (
    <XYChart
      x={x}
      series={series}
      xLabel="Z"
      yLabel={typeof p.short === 'string' ? p.short : Lz(p.short)}
      yUnit={p.unit}
      marker={z}
      csvName={property}
    />
  );
}
