import { useMemo } from 'react';
import { formatNumber, type Locale } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { ChoiceGroup, LabeledNumber } from '@/ui/ModuleControls';
import { formatFormula } from '../formula';
import { BarList, type Bar } from '@/ui/charts/BarList';
import { TM_TITLE, tmCard } from './card';
import {
  BE_MELTING_POINT,
  HEAVY_METAL_MIN_DENSITY,
  S_BLOCK_COMPARE,
  TITRATION,
  TRANSITION,
  feso4Concentration,
  ionConfiguration,
  type TransitionMetal,
} from './model';
import { TM_PROPS, TM_TABS, setTm, useTmStore, type TmProp, type TmTab } from './store';
import { L, configText } from './text';
import './groups.css';

const TAB_NAME: Record<TmTab, LocalizedText> = {
  trends: L('Tính chất vật lí', 'Physical properties'),
  ions: L('Ion và số oxi hóa', 'Ions and oxidation states'),
  titration: L('Chuẩn độ FeSO₄', 'FeSO₄ titration'),
};
const PROP_NAME: Record<TmProp, LocalizedText> = {
  mp: L('Nhiệt độ nóng chảy', 'Melting point'),
  density: L('Khối lượng riêng', 'Density'),
  conductivity: L('Độ dẫn điện ở 20 °C (Hg = 1)', 'Electrical conductivity at 20 °C (Hg = 1)'),
  thermal: L('Độ dẫn nhiệt ở 25 °C (Hg = 1)', 'Thermal conductivity at 25 °C (Hg = 1)'),
  hardness: L('Độ cứng (kim cương = 10)', 'Hardness (diamond = 10)'),
};
const CHARGES = ['2', '3'] as const;

const useLocale = () => useSettingsStore((s) => s.locale);

function propValue(m: TransitionMetal, p: TmProp): number | null {
  return p === 'mp'
    ? m.mp_C
    : p === 'density'
      ? m.density
      : p === 'conductivity'
        ? m.conductivity
        : p === 'thermal'
          ? m.thermal
          : m.hardness;
}

function unit(locale: Locale, p: TmProp, v: number): string {
  const n = formatNumber(locale, v, { maximumFractionDigits: 2 });
  return p === 'mp' ? `${n} °C` : p === 'density' ? `${n} g/cm³` : n;
}

function TrendsView() {
  const Lz = useLocalized();
  const locale = useLocale();
  const prop = useTmStore((s) => s.prop);
  const bars: Bar[] = TRANSITION.flatMap((m) => {
    const v = propValue(m, prop);
    if (v === null) return [];
    const strong =
      prop === 'mp'
        ? v > BE_MELTING_POINT
        : prop === 'density'
          ? v >= HEAVY_METAL_MIN_DENSITY
          : false;
    return [{ id: m.id, label: m.id, value: v, text: unit(locale, prop, v), strong }];
  });
  // Question 2 (tr. 130): K and Ca beside Fe and Cu.
  if (prop === 'conductivity' || prop === 'hardness') {
    for (const [id, c] of Object.entries(S_BLOCK_COMPARE)) {
      bars.push({
        id,
        label: Lz(L(`${id} (họ s)`, `${id} (s-block)`)),
        value: c[prop],
        text: unit(locale, prop, c[prop]),
      });
    }
  }
  const mark =
    prop === 'mp'
      ? {
          value: BE_MELTING_POINT,
          text: Lz(
            L(
              `Vạch: Be nóng chảy ở ${unit(locale, 'mp', BE_MELTING_POINT)} (câu 1a). Thanh đậm: khó nóng chảy hơn Be.`,
              `Line: Be melts at ${unit(locale, 'mp', BE_MELTING_POINT)} (question 1a). Bold bars: harder to melt than Be.`,
            ),
          ),
        }
      : prop === 'density'
        ? {
            value: HEAVY_METAL_MIN_DENSITY,
            text: Lz(
              L(
                `Vạch: ${unit(locale, 'density', HEAVY_METAL_MIN_DENSITY)}. Thanh đậm: kim loại nặng, D ≥ ${unit(locale, 'density', HEAVY_METAL_MIN_DENSITY)} (câu 1b).`,
                `Line: ${unit(locale, 'density', HEAVY_METAL_MIN_DENSITY)}. Bold bars: heavy metals, D ≥ ${unit(locale, 'density', HEAVY_METAL_MIN_DENSITY)} (question 1b).`,
              ),
            ),
          }
        : undefined;
  return (
    <div className="groups-view">
      <h3 className="groups-view__head">{Lz(PROP_NAME[prop])}</h3>
      <BarList bars={bars} label={Lz(PROP_NAME[prop])} {...(mark ? { mark } : {})} />
      {prop === 'hardness' && (
        <p className="groups-note">
          {Lz(L('Sách không có độ cứng của Sc.', 'The book gives no hardness for Sc.'))}
        </p>
      )}
    </div>
  );
}

function IonsView() {
  const Lz = useLocalized();
  const { metal, charge } = useTmStore();
  const m = TRANSITION.find((x) => x.id === metal);
  if (!m) return null;
  const ion = ionConfiguration(m.configuration, charge);
  const sup = charge === 2 ? '²⁺' : '³⁺';
  return (
    <div className="groups-view">
      <p className="groups-ion">
        <span className="mono">{`${m.id}: ${configText(m.configuration)}`}</span>
        <span aria-hidden="true">→</span>
        <span className="mono groups-ion__result">
          {ion ? `${m.id}${sup}: ${configText(ion)}` : '—'}
        </span>
      </p>
      <p className="groups-note">
        {Lz(
          L(
            'Khi tạo ion, nguyên tử kim loại chuyển tiếp dãy thứ nhất nhường electron ở phân lớp 4s trước rồi đến electron ở phân lớp 3d (tr. 131).',
            'Forming an ion, a first-row transition metal atom loses its 4s electrons first, then 3d electrons (p. 131).',
          ),
        )}
      </p>
      <table className="groups-table">
        <caption>
          {Lz(L('Bảng 27.4: số oxi hóa thường gặp', 'Table 27.4: common oxidation states'))}
        </caption>
        <tbody>
          {TRANSITION.filter((x) => x.oxidation_states.length > 0).map((x) => (
            <tr key={x.id}>
              <th scope="row">{x.id}</th>
              <td className="mono">{x.oxidation_states.map((s) => `+${s}`).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TitrationView() {
  const Lz = useLocalized();
  const locale = useLocale();
  const v = useTmStore((s) => s.v);
  const n = (x: number, d = 4) => formatNumber(locale, x, { maximumFractionDigits: d });
  const t = TITRATION;
  const nMn = (t.kmno4_M * v) / 1000;
  const nFe = t.ratio_fe_per_mno4 * nMn;
  const c = feso4Concentration(v);
  return (
    <div className="groups-view">
      <p className="groups-eq">
        {formatFormula(t.equation.split(' -> ')[0] ?? '')} →{' '}
        {formatFormula(t.equation.split(' -> ')[1] ?? '')}
      </p>
      <dl className="groups-steps">
        <dt>{`n(KMnO₄)`}</dt>
        <dd className="mono">{`${n(t.kmno4_M)} M × ${n(v, 2)} mL = ${n(nMn * 1000, 4)} mmol`}</dd>
        <dt>{`n(FeSO₄)`}</dt>
        <dd className="mono">{`${t.ratio_fe_per_mno4} × n(KMnO₄) = ${n(nFe * 1000, 4)} mmol`}</dd>
        <dt>{`C(FeSO₄)`}</dt>
        <dd className="mono groups-steps__result">{`${n(nFe * 1000, 4)} mmol : ${n(t.feso4_mL, 1)} mL = ${n(c, 4)} M`}</dd>
      </dl>
      <p className="groups-note">
        {Lz(
          L(
            `Theo phương trình, 2 mol KMnO₄ phản ứng với 10 mol FeSO₄ (tỉ lệ 1 : ${t.ratio_fe_per_mno4}). Sách dùng ${n(t.feso4_mL, 1)} mL dung dịch FeSO₄ và KMnO₄ ${n(t.kmno4_M)} M (tr. 132).`,
            `By the equation, 2 mol KMnO₄ react with 10 mol FeSO₄ (1 : ${t.ratio_fe_per_mno4}). The book uses ${n(t.feso4_mL, 1)} mL of FeSO₄ and ${n(t.kmno4_M)} M KMnO₄ (p. 132).`,
          ),
        )}
      </p>
    </div>
  );
}

export function TmStage() {
  const Lz = useLocalized();
  const tab = useTmStore((s) => s.tab);
  const card = useMemo(() => tmCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view groups">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TM_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'trends' ? <TrendsView /> : tab === 'ions' ? <IonsView /> : <TitrationView />}
    </div>
  );
}

export function TmPanel() {
  const Lz = useLocalized();
  const { tab, prop, metal, charge, v } = useTmStore();
  return (
    <div className="chem-form groups-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TM_TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setTm({ tab: t });
        }}
        segmented
      />
      {tab === 'trends' && (
        <ChoiceGroup
          label={Lz(L('Đại lượng', 'Quantity'))}
          items={TM_PROPS}
          value={prop}
          name={(p) => Lz(PROP_NAME[p])}
          onPick={(p) => {
            setTm({ prop: p });
          }}
        />
      )}
      {tab === 'ions' && (
        <>
          <label>
            <span>{Lz(L('Kim loại', 'Metal'))}</span>
            <select
              value={metal}
              onChange={(e) => {
                setTm({ metal: e.target.value });
              }}
            >
              {TRANSITION.map((m) => (
                <option key={m.id} value={m.id}>{`${m.id} (Z = ${m.Z})`}</option>
              ))}
            </select>
          </label>
          <ChoiceGroup
            label={Lz(L('Điện tích ion', 'Ion charge'))}
            items={CHARGES}
            value={charge === 3 ? '3' : '2'}
            name={(c) => `${c}+`}
            onPick={(c) => {
              setTm({ charge: Number(c) });
            }}
            segmented
          />
        </>
      )}
      {tab === 'titration' && (
        <LabeledNumber
          label={Lz(L('Thể tích KMnO₄ đã dùng (mL)', 'Volume of KMnO₄ used (mL)'))}
          value={v}
          step={0.1}
          min={0}
          max={25}
          onChange={(x) => {
            setTm({ v: x });
          }}
        />
      )}
    </div>
  );
}

export function TmBottom() {
  const Lz = useLocalized();
  const locale = useLocale();
  const n = (x: number) => formatNumber(locale, x, { maximumFractionDigits: 2 });
  return (
    <table className="groups-table">
      <caption>{Lz(L('Bảng 27.1, 27.2 (SGK)', 'Tables 27.1, 27.2 (textbook)'))}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Kim loại', 'Metal'))}</th>
          <th scope="col">Z</th>
          <th scope="col">{Lz(L('Cấu hình electron', 'Configuration'))}</th>
          <th scope="col">{Lz(L('t° nóng chảy (°C)', 'm.p. (°C)'))}</th>
          <th scope="col">D (g/cm³)</th>
          <th scope="col">{Lz(L('Dẫn điện (Hg = 1)', 'Electrical (Hg = 1)'))}</th>
          <th scope="col">{Lz(L('Dẫn nhiệt (Hg = 1)', 'Thermal (Hg = 1)'))}</th>
          <th scope="col">{Lz(L('Độ cứng', 'Hardness'))}</th>
        </tr>
      </thead>
      <tbody>
        {TRANSITION.map((m) => (
          <tr key={m.id}>
            <th scope="row">{m.id}</th>
            <td className="mono">{m.Z}</td>
            <td className="mono">{configText(m.configuration)}</td>
            <td className="mono">{n(m.mp_C)}</td>
            <td className="mono">{n(m.density)}</td>
            <td className="mono">{n(m.conductivity)}</td>
            <td className="mono">{n(m.thermal)}</td>
            <td className="mono">{m.hardness === null ? '—' : n(m.hardness)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
