import { Minus, Plus } from 'lucide-react';
import { useContext, useMemo } from 'react';
import { BenchContext } from '@/app/bench/shellMode';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { XYChart } from '@/ui/charts/XYChart';
import { NumberField } from '@/ui/NumberField';
import { L, usePublishCard } from '../common';
import { titrationCard } from './card';
import { LIMITS, addedVolume, maxVolume, setTitration, useTitrationStore } from './store';
import {
  INDICATORS,
  curve,
  equivalenceVolume,
  indicatorAt,
  indicatorOf,
  pH,
  type Indicator,
} from './titration';
import '../chem.css';

const DEFAULT_INDICATOR = 'phenolphthalein';

type Colour = Indicator['colours'][number];
const colourAt = (ind: Indicator, i: number) => ind.colours[i] as Colour;
const rangeAt = (ind: Indicator, i: number) => ind.ranges[i] as [number, number];

/** Screen colour of the solution: two of the indicator's named colours blended by `mix`. */
function solutionColour(ind: Indicator, value: number): string {
  const { from, to, mix } = indicatorAt(ind, value);
  const pct = String(Math.round(mix * 100));
  return `color-mix(in oklab, ${colourAt(ind, to).css} ${pct}%, ${colourAt(ind, from).css})`;
}

function useFormat() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    // 'negative': a pH of −4·10⁻¹⁵ (1 mol/L HCl) prints "0,00", not "-0,00".
    fixed: (v: number, d = 2) =>
      formatNumber(locale, v, {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
        signDisplay: 'negative',
      }),
    sig: (v: number) => formatNumber(locale, v, { maximumSignificantDigits: 4 }),
  };
}

function phaseText(ind: Indicator, value: number, one: (v: number) => string): LocalizedText {
  const { from, to } = indicatorAt(ind, value);
  if (from !== to) {
    const [lo, hi] = rangeAt(ind, from);
    const a = colourAt(ind, from).name;
    const b = colourAt(ind, to).name;
    return L(
      `đang chuyển từ ${a.vi} sang ${b.vi} (pH ${one(lo)}–${one(hi)})`,
      `changing from ${a.en} to ${b.en} (pH ${one(lo)}–${one(hi)})`,
    );
  }
  const n = ind.ranges.length;
  const span =
    from === 0
      ? `pH < ${one(rangeAt(ind, 0)[0])}`
      : from === n
        ? `pH > ${one(rangeAt(ind, n - 1)[1])}`
        : `pH ${one(rangeAt(ind, from - 1)[1])}–${one(rangeAt(ind, from)[0])}`;
  const c = colourAt(ind, from).name;
  return L(`${c.vi} (${span})`, `${c.en} (${span})`);
}

function Flask({ colour, level, burette }: { colour: string; level: number; burette: number }) {
  const Lz = useLocalized();
  // Beaker liquid from y = 248 up; burette liquid from y = 20 down to its level.
  const liquidTop = 248 - 18 - 22 * level;
  return (
    <svg
      className="tit-figure"
      viewBox="0 0 200 270"
      role="img"
      aria-label={Lz(L('Buret và cốc dung dịch (minh họa)', 'Burette and beaker (illustration)'))}
    >
      <rect className="tit-glass" x="92" y="10" width="16" height="150" rx="3" />
      <rect
        className="tit-burette-liquid"
        x="94"
        y={20 + 138 * (1 - burette)}
        width="12"
        height={138 * burette}
      />
      <rect className="tit-stopcock" x="84" y="160" width="32" height="7" rx="2" />
      <path className="tit-glass" d="M96 167 L104 167 L101 182 L99 182 Z" />
      <text className="tit-label" x="114" y="30">
        NaOH
      </text>
      <rect className="tit-water" x="52" y={liquidTop} width="96" height={248 - liquidTop} />
      <rect
        className="tit-solution"
        x="52"
        y={liquidTop}
        width="96"
        height={248 - liquidTop}
        style={{ fill: colour }}
      />
      <path
        className="tit-glass tit-beaker"
        d="M46 190 L50 190 L52 248 Q52 252 56 252 L144 252 Q148 252 148 248 L150 190 L154 190"
      />
      <text className="tit-label" x="100" y="266" textAnchor="middle">
        HCl
      </text>
    </svg>
  );
}

export function TitrationStage() {
  const Lz = useLocalized();
  // The bench adds and removes NaOH from its edge (TitrationDriver).
  const bench = useContext(BenchContext);
  const { locale, fixed, sig } = useFormat();
  usePublishCard(useMemo(() => titrationCard(locale), [locale]));
  const st = useTitrationStore();
  const ind = indicatorOf(st.indicator);
  const veq = equivalenceVolume(st);
  const vMax = maxVolume(st);
  const vb = addedVolume(st);
  const value = pH(st, vb);
  const step = vMax / 2000;
  const nudge = vMax / 200;
  // Volumes to the slider's resolution (6 decimals at V_eq = 0,001 mL, none at 10⁵ mL).
  const vol = (v: number) => fixed(v, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
  // Equivalence from the chemistry (floating-point tolerance only): V_eq is always on the grid.
  const where =
    Math.abs(vb - veq) <= 1e-9 * veq
      ? L(
          'Tại điểm tương đương: acid và base vừa đủ phản ứng.',
          'At the equivalence point: acid and base have just reacted completely.',
        )
      : vb < veq
        ? L(
            'Trước điểm tương đương: HCl còn dư.',
            'Before the equivalence point: HCl is in excess.',
          )
        : L('Sau điểm tương đương: NaOH dư.', 'After the equivalence point: NaOH is in excess.');

  return (
    <div className="chem-view">
      <div className="chem-toolbar">
        <span className="chem-chip">
          HCl {sig(st.ca)} M · {sig(st.va)} mL · NaOH {sig(st.cb)} M
        </span>
        <span className="chem-chip">
          {/* One text run: as separate flex items the subscript floated up, gaps around it. */}
          <span>
            V<sub>{Lz(L('tđ', 'eq'))}</sub> = {vol(veq)} mL
          </span>
        </span>
        <span className="chem-chip chem-chip--qual">
          {Lz(
            L(
              'Hình và màu minh họa, không theo tỉ lệ',
              'Illustration, not to scale; colours illustrative',
            ),
          )}
        </span>
      </div>
      <div className="tit-stage">
        <Flask colour={solutionColour(ind, value)} level={vb / vMax} burette={1 - vb / vMax} />
        <div className="tit-readout">
          <p className="tit-ph" aria-live="polite">
            pH = <strong className="mono">{fixed(value)}</strong>
          </p>
          <p>
            <strong>{Lz(ind.name)}</strong>: {Lz(phaseText(ind, value, (v) => fixed(v, 1)))}
          </p>
          <p className="small muted">{Lz(where)}</p>
          {!bench && (
            <>
              <label className="tit-volume">
                <span>
                  {Lz(L('Thể tích NaOH đã thêm', 'NaOH added'))} V<sub>b</sub>:{' '}
                  <strong className="mono">{vol(vb)} mL</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={vMax}
                  step={step}
                  value={vb}
                  onChange={(e) => {
                    setTitration({ vb: Number(e.target.value) });
                  }}
                />
              </label>
              <div className="tit-nudge">
                <button
                  type="button"
                  className="btn"
                  disabled={vb <= 0}
                  aria-label={Lz(L(`Bớt ${sig(nudge)} mL NaOH`, `Remove ${sig(nudge)} mL of NaOH`))}
                  onClick={() => {
                    setTitration({ vb: vb - nudge });
                  }}
                >
                  <Minus size={14} aria-hidden="true" /> {sig(nudge)} mL
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={vb >= vMax}
                  aria-label={Lz(L(`Thêm ${sig(nudge)} mL NaOH`, `Add ${sig(nudge)} mL of NaOH`))}
                  onClick={() => {
                    setTitration({ vb: vb + nudge });
                  }}
                >
                  <Plus size={14} aria-hidden="true" /> {sig(nudge)} mL
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TitrationPanel() {
  const Lz = useLocalized();
  const st = useTitrationStore();
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const field = (label: LocalizedText, unit: string, value: number, key: 'ca' | 'va' | 'cb') => {
    const lim = key === 'va' ? LIMITS.va : LIMITS.c;
    const text = `${Lz(label)} (${unit})`;
    return (
      <label>
        <span>{text}</span>
        <NumberField
          label={text}
          value={value}
          min={lim.min}
          max={lim.max}
          step={key === 'va' ? 1 : 0.01}
          onChange={(v) => {
            setTitration({ [key]: v });
          }}
        />
      </label>
    );
  };
  return (
    <div className="chem-form tit-form">
      {field(L('Nồng độ HCl', 'HCl concentration'), 'mol/L', st.ca, 'ca')}
      {field(L('Thể tích HCl', 'HCl volume'), 'mL', st.va, 'va')}
      {field(L('Nồng độ NaOH', 'NaOH concentration'), 'mol/L', st.cb, 'cb')}
      {/* Basic mode shows only concentrations and volumes (plan #54 item 4); a changed choice stays visible. */}
      {(advanced || st.indicator !== DEFAULT_INDICATOR) && (
        <label>
          <span>{Lz(L('Chất chỉ thị', 'Indicator'))}</span>
          <select
            value={st.indicator}
            onChange={(e) => {
              setTitration({ indicator: e.target.value });
            }}
          >
            {INDICATORS.map((i) => (
              <option key={i.id} value={i.id}>
                {Lz(i.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="small muted">
        {Lz(
          L(
            'Nồng độ từ 0,001 đến 1 mol/L, thể tích HCl từ 1 đến 100 mL. Buret chạy tới hai lần thể tích tương đương.',
            'Concentrations from 0.001 to 1 mol/L, HCl volume from 1 to 100 mL. The burette runs to twice the equivalence volume.',
          ),
        )}
      </p>
    </div>
  );
}

export function TitrationBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useTitrationStore();
  const { ca, va, cb, indicator } = st;
  const data = useMemo(() => {
    const t = { ca, va, cb };
    const ind = indicatorOf(indicator);
    const veq = equivalenceVolume(t);
    const c = curve(t, maxVolume(t));
    const band = (v: number) => ({
      label: `${Lz(ind.name)} ${formatNumber(locale, v, { minimumFractionDigits: 1 })}`,
      y: c.v.map(() => v),
      dash: true,
    });
    return {
      x: c.v,
      series: [
        { label: 'pH', y: c.pH },
        {
          label: Lz(L('Điểm tương đương', 'Equivalence point')),
          y: c.v.map((v, i) => (v === veq ? (c.pH[i] ?? null) : null)),
          points: true,
        },
        ...ind.ranges.flat().map(band),
      ],
    };
  }, [ca, va, cb, indicator, Lz, locale]);
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={data.x}
        series={data.series}
        xLabel={Lz(L('Thể tích NaOH đã thêm (mL)', 'NaOH added (mL)'))}
        yLabel="pH"
        yMin={0}
        yMax={14}
        marker={addedVolume(st)}
        csvName={Lz(L('chuan-do', 'titration'))}
      />
    </div>
  );
}
