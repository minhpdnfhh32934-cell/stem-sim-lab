import { useMemo } from 'react';
import { formatNumber, type Locale } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { ChoiceGroup } from '@/ui/ModuleControls';
import { formatFormula } from '../formula';
import { BarList, type Bar } from './BarList';
import { IA_TITLE, IIA_TITLE, iaCard, iiaCard } from './card';
import {
  ANIONS,
  CARBONATE_DH,
  GROUP_IA,
  GROUP_IIA,
  IIA_SALT_METALS,
  INSOLUBLE_MAX,
  NITRATE_DH,
  SLIGHTLY_SOLUBLE_MAX,
  SOLUBILITY_AT_30C,
  compoundFormula,
  solubility,
  solubilityClass,
  trend,
  type SBlockMetal,
  type SolubilityClass,
} from './model';
import {
  IA_PROPS,
  IIA_PROPS,
  IIA_TABS,
  SALTS,
  setIa,
  setIia,
  useIaStore,
  useIiaStore,
  type IaProp,
  type IiaTab,
  type Salt,
} from './store';
import { L, configText, trendText } from './text';
import './groups.css';

const PROP_NAME: Record<IaProp, LocalizedText> = {
  radius: L('Bán kính nguyên tử', 'Atomic radius'),
  E: L('Thế điện cực chuẩn', 'Standard electrode potential'),
  mp: L('Nhiệt độ nóng chảy', 'Melting point'),
  bp: L('Nhiệt độ sôi', 'Boiling point'),
  density: L('Khối lượng riêng', 'Density'),
  hardness: L('Độ cứng (kim cương = 10)', 'Hardness (diamond = 10)'),
};

function value(m: SBlockMetal, p: IaProp): number | null {
  switch (p) {
    case 'radius':
      return m.radius_pm;
    case 'E':
      return m.E_V;
    case 'mp':
      return m.mp_C;
    case 'bp':
      return m.bp_C;
    case 'density':
      return m.density;
    case 'hardness':
      return m.hardness;
  }
}

function show(locale: Locale, p: IaProp, v: number): string {
  const n = (x: number, d = 3) => formatNumber(locale, x, { maximumFractionDigits: d });
  switch (p) {
    case 'radius':
      return `${n(v)} pm`;
    case 'E':
      return `${n(v)} V`;
    case 'mp':
    case 'bp':
      return `${n(v, 1)} °C`;
    case 'density':
      return `${n(v)} g/cm³`;
    case 'hardness':
      return n(v, 2);
  }
}

const useLocale = () => useSettingsStore((s) => s.locale);

/** A property down group IA or IIA, with the trend in words. */
function TrendView({ metals, prop }: { metals: readonly SBlockMetal[]; prop: IaProp }) {
  const Lz = useLocalized();
  const locale = useLocale();
  const rows = metals.flatMap((m) => {
    const v = value(m, prop);
    return v === null ? [] : [{ m, v }];
  });
  const bars: Bar[] = rows.map(({ m, v }) => ({
    id: m.id,
    label: `${m.id} · ${m.name}`,
    value: v,
    text: show(locale, prop, v),
  }));
  const first = rows[0]?.m.id ?? '';
  const last = rows.at(-1)?.m.id ?? '';
  const words = trendText(trend(rows.map((r) => r.v)), first, last);
  return (
    <div className="groups-view">
      <h3 className="groups-view__head">{`${Lz(PROP_NAME[prop])}: ${Lz(words)}`}</h3>
      <BarList bars={bars} label={Lz(PROP_NAME[prop])} />
      {prop === 'E' && (
        <p className="groups-note">
          {Lz(
            L(
              'Thanh dài hơn là thế điện cực âm hơn: dạng khử có tính khử mạnh hơn.',
              'A longer bar is a more negative potential: a stronger reductant.',
            ),
          )}
        </p>
      )}
    </div>
  );
}

function SBlockTable({
  metals,
  caption,
}: {
  metals: readonly SBlockMetal[];
  caption: LocalizedText;
}) {
  const Lz = useLocalized();
  const locale = useLocale();
  const n = (x: number, d = 3) => formatNumber(locale, x, { maximumFractionDigits: d });
  const hasHardness = metals.some((m) => m.hardness !== null);
  return (
    <table className="groups-table">
      <caption>{Lz(caption)}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Nguyên tử', 'Atom'))}</th>
          <th scope="col">Z</th>
          <th scope="col">{Lz(L('Cấu hình electron', 'Configuration'))}</th>
          <th scope="col">{Lz(L('Bán kính (pm)', 'Radius (pm)'))}</th>
          <th scope="col">E° (V)</th>
          <th scope="col">{Lz(L('t° nóng chảy (°C)', 'm.p. (°C)'))}</th>
          <th scope="col">{Lz(L('t° sôi (°C)', 'b.p. (°C)'))}</th>
          <th scope="col">{Lz(L('D (g/cm³)', 'D (g/cm³)'))}</th>
          {hasHardness && <th scope="col">{Lz(L('Độ cứng', 'Hardness'))}</th>}
          <th scope="col">{Lz(L('Với nước', 'With water'))}</th>
          <th scope="col">{Lz(L('Màu ngọn lửa', 'Flame colour'))}</th>
        </tr>
      </thead>
      <tbody>
        {metals.map((m) => (
          <tr key={m.id}>
            <th scope="row">{`${m.id} (${m.name})`}</th>
            <td className="mono">{m.Z}</td>
            <td className="mono">{configText(m.configuration)}</td>
            <td className="mono">{n(m.radius_pm)}</td>
            <td className="mono">{n(m.E_V)}</td>
            <td className="mono">{n(m.mp_C, 1)}</td>
            <td className="mono">{n(m.bp_C, 1)}</td>
            <td className="mono">{n(m.density)}</td>
            {hasHardness && (
              <td className="mono">{m.hardness === null ? '—' : n(m.hardness, 2)}</td>
            )}
            <td>{m.water ? Lz(m.water) : '—'}</td>
            <td>{m.flame ? Lz(m.flame) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────── Group IA (Bài 24) ───────── */

export function IaStage() {
  const Lz = useLocalized();
  const prop = useIaStore((s) => s.prop);
  const card = useMemo(() => iaCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view groups">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(IA_TITLE)}</strong>
        </span>
      </div>
      <TrendView metals={GROUP_IA} prop={prop} />
    </div>
  );
}

export function IaPanel() {
  const Lz = useLocalized();
  const prop = useIaStore((s) => s.prop);
  return (
    <div className="chem-form groups-panel">
      <ChoiceGroup
        label={Lz(L('Đại lượng', 'Quantity'))}
        items={IA_PROPS}
        value={prop}
        name={(p) => Lz(PROP_NAME[p])}
        onPick={(p) => {
          setIa({ prop: p });
        }}
      />
      <ul className="groups-panel__list">
        <li>
          {Lz(
            L(
              'Câu hỏi tr. 109: nhận xét xu hướng biến đổi bán kính nguyên tử và tính khử từ Li đến Cs.',
              'Questions p. 109: how the atomic radius and the reducing power change from Li to Cs.',
            ),
          )}
        </li>
        <li>
          {Lz(
            L(
              'Mức độ phản ứng với nước, chlorine, oxygen tăng dần trong dãy lithium, sodium, potassium (tr. 115).',
              'The reactions with water, chlorine and oxygen get stronger from lithium to sodium to potassium (p. 115).',
            ),
          )}
        </li>
        <li>
          {Lz(
            L(
              'Kim loại nhóm IA được bảo quản trong dầu hỏa, trong chân không hoặc trong khí hiếm (tr. 112).',
              'Group IA metals are kept under kerosene, in a vacuum or under a noble gas (p. 112).',
            ),
          )}
        </li>
      </ul>
    </div>
  );
}

export function IaBottom() {
  return (
    <SBlockTable
      metals={GROUP_IA}
      caption={L('Bảng 24.1, 24.2, 24.3 (SGK)', 'Tables 24.1–24.3 (textbook)')}
    />
  );
}

/* ───────── Group IIA (Bài 25) ───────── */

const IIA_TAB_NAME: Record<IiaTab, LocalizedText> = {
  trends: L('Xu hướng', 'Trends'),
  solubility: L('Độ tan', 'Solubility'),
  thermal: L('Độ bền nhiệt', 'Thermal stability'),
};
const CLASS_NAME: Record<SolubilityClass, LocalizedText> = {
  T: L('dễ tan', 'soluble'),
  I: L('ít tan', 'slightly soluble'),
  K: L('không tan', 'insoluble'),
};
const SALT_NAME: Record<Salt, LocalizedText> = {
  carbonate: L('Muối carbonate', 'Carbonates'),
  nitrate: L('Muối nitrate', 'Nitrates'),
};
const ANION_TEXT: Record<string, string> = {
  CO3: 'CO3^2-',
  SO4: 'SO4^2-',
  NO3: 'NO3^-',
  OH: 'OH^-',
};

function SolubilityView() {
  const Lz = useLocalized();
  const locale = useLocale();
  const { metal, anion } = useIiaStore();
  const n = (x: number) => formatNumber(locale, x, { maximumSignificantDigits: 4 });
  const s = solubility(metal, anion);
  const at30 = SOLUBILITY_AT_30C.some(([a, m]) => a === anion && m === metal);
  return (
    <div className="groups-view">
      <table className="groups-grid">
        <caption>
          {Lz(
            L(
              'Độ tan (g/100 g nước) ở 20 °C — chọn một ô',
              'Solubility (g/100 g water) at 20 °C — pick a cell',
            ),
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">{Lz(L('Anion', 'Anion'))}</th>
            {IIA_SALT_METALS.map((m) => (
              <th key={m} scope="col">
                {formatFormula(`${m}^2+`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ANIONS.map((a) => (
            <tr key={a}>
              <th scope="row">{formatFormula(ANION_TEXT[a] ?? a)}</th>
              {IIA_SALT_METALS.map((m) => {
                const v = solubility(m, a);
                if (v === undefined) return <td key={m}>—</td>;
                const c = solubilityClass(v);
                const on = m === metal && a === anion;
                return (
                  <td key={m}>
                    <button
                      type="button"
                      className={`groups-cell groups-cell--${c}${on ? ' groups-cell--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => {
                        setIia({ metal: m, anion: a });
                      }}
                    >
                      <span className="mono">{n(v)}</span>
                      <span className="groups-cell__class">{c}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {s !== undefined && (
        <p className="groups-view__head groups-solubility__verdict">
          {Lz(
            L(
              `${formatFormula(compoundFormula(metal, anion))}: ${n(s)} g/100 g nước → ${CLASS_NAME[solubilityClass(s)].vi}`,
              `${formatFormula(compoundFormula(metal, anion))}: ${n(s)} g/100 g water → ${CLASS_NAME[solubilityClass(s)].en}`,
            ),
          )}
          {at30 ? Lz(L(' (đo ở 30 °C)', ' (measured at 30 °C)')) : ''}
        </p>
      )}
      <p className="groups-note">
        {Lz(
          L(
            `T: dễ tan (lớn hơn ${n(SLIGHTLY_SOLUBLE_MAX)}); I: ít tan (lớn hơn ${n(INSOLUBLE_MAX)}, không quá ${n(SLIGHTLY_SOLUBLE_MAX)}); K: không tan (không quá ${n(INSOLUBLE_MAX)}). Các chữ này trùng với Bảng 25.4 của sách.`,
            `T: soluble (above ${n(SLIGHTLY_SOLUBLE_MAX)}); I: slightly soluble (above ${n(INSOLUBLE_MAX)}, up to ${n(SLIGHTLY_SOLUBLE_MAX)}); K: insoluble (up to ${n(INSOLUBLE_MAX)}). The letters match the book’s Table 25.4.`,
          ),
        )}
      </p>
    </div>
  );
}

function ThermalView() {
  const Lz = useLocalized();
  const locale = useLocale();
  const salt = useIiaStore((s) => s.salt);
  const dh = salt === 'carbonate' ? CARBONATE_DH : NITRATE_DH;
  const values = IIA_SALT_METALS.map((m) => dh[m] ?? NaN);
  const bars: Bar[] = IIA_SALT_METALS.map((m, i) => ({
    id: m,
    label: formatFormula(salt === 'carbonate' ? `${m}CO3` : `${m}(NO3)2`),
    value: values[i] ?? 0,
    text: `${formatNumber(locale, values[i] ?? 0, { maximumFractionDigits: 1 })} kJ`,
  }));
  const eq =
    salt === 'carbonate'
      ? `${formatFormula('MCO3')} → ${formatFormula('MO + CO2')}`
      : `${formatFormula('M(NO3)2')} → ${formatFormula('MO + 2NO2')} + ½${formatFormula('O2')}`;
  return (
    <div className="groups-view">
      <h3 className="groups-view__head">
        {`ΔrH°298 ${Lz(L('của phản ứng', 'of'))} ${eq}: ${Lz(trendText(trend(values), 'Mg', 'Ba'))}`}
      </h3>
      <BarList bars={bars} label={Lz(SALT_NAME[salt])} />
      <p className="groups-note">
        {Lz(
          L(
            'Biến thiên enthalpy chuẩn càng lớn thì muối càng khó bị nhiệt phân: độ bền nhiệt của muối carbonate và nitrate tăng dần từ Mg đến Ba (tr. 125).',
            'The larger the standard enthalpy change, the harder the salt is to decompose: carbonates and nitrates get more stable to heat from Mg to Ba (p. 125).',
          ),
        )}
      </p>
    </div>
  );
}

export function IiaStage() {
  const Lz = useLocalized();
  const { tab, prop } = useIiaStore();
  const card = useMemo(() => iiaCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view groups">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(IIA_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(IIA_TAB_NAME[tab])}</span>
      </div>
      {tab === 'trends' ? (
        <TrendView metals={GROUP_IIA} prop={prop} />
      ) : tab === 'solubility' ? (
        <SolubilityView />
      ) : (
        <ThermalView />
      )}
    </div>
  );
}

export function IiaPanel() {
  const Lz = useLocalized();
  const { tab, prop, salt } = useIiaStore();
  return (
    <div className="chem-form groups-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={IIA_TABS}
        value={tab}
        name={(t) => Lz(IIA_TAB_NAME[t])}
        onPick={(t) => {
          setIia({ tab: t });
        }}
        segmented
      />
      {tab === 'trends' && (
        <ChoiceGroup
          label={Lz(L('Đại lượng', 'Quantity'))}
          items={IIA_PROPS}
          value={prop}
          name={(p) => Lz(PROP_NAME[p])}
          onPick={(p) => {
            setIia({ prop: p });
          }}
        />
      )}
      {tab === 'thermal' && (
        <ChoiceGroup
          label={Lz(L('Loại muối', 'Salt'))}
          items={SALTS}
          value={salt}
          name={(s) => Lz(SALT_NAME[s])}
          onPick={(s) => {
            setIia({ salt: s });
          }}
        />
      )}
      {tab === 'solubility' && (
        <p className="small">
          {Lz(
            L(
              'Độ tan của hydroxide tăng dần từ Mg(OH)₂ đến Ba(OH)₂; sản phẩm càng dễ tan thì kim loại càng dễ tiếp tục phản ứng với nước (tr. 119).',
              'Hydroxides dissolve more from Mg(OH)₂ to Ba(OH)₂; the more soluble the product, the more easily the metal keeps reacting with water (p. 119).',
            ),
          )}
        </p>
      )}
    </div>
  );
}

export function IiaBottom() {
  return (
    <SBlockTable
      metals={GROUP_IIA}
      caption={L('Bảng 25.1, 25.2, 25.3 (SGK)', 'Tables 25.1–25.3 (textbook)')}
    />
  );
}
