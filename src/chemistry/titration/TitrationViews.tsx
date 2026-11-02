import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { XYChart } from '@/ui/charts/XYChart';
import { NumberField } from '@/ui/NumberField';
import { L, usePublishCard } from '../common';
import { titrationCard } from './card';
import { LIMITS, maxVolume, setTitration, useTitrationStore } from './store';
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

/** Screen colour of the solution: the indicator's two named colours blended by `mix`. */
function solutionColour(ind: Indicator, mix: number): string {
  return `color-mix(in oklab, ${ind.base.css} ${String(Math.round(mix * 100))}%, ${ind.acid.css})`;
}

function useFormat() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    fixed: (v: number, d = 2) =>
      formatNumber(locale, v, { minimumFractionDigits: d, maximumFractionDigits: d }),
    sig: (v: number) => formatNumber(locale, v, { maximumSignificantDigits: 4 }),
  };
}

function phaseText(ind: Indicator, value: number, fixed: (v: number, d?: number) => string) {
  const [lo, hi] = ind.range;
  const { phase } = indicatorAt(ind, value);
  if (phase === 'acid')
    return L(
      `${ind.acid.name.vi} (pH < ${fixed(lo, 1)})`,
      `${ind.acid.name.en} (pH < ${fixed(lo, 1)})`,
    );
  if (phase === 'base')
    return L(
      `${ind.base.name.vi} (pH > ${fixed(hi, 1)})`,
      `${ind.base.name.en} (pH > ${fixed(hi, 1)})`,
    );
  return L(
    `đang chuyển từ ${ind.acid.name.vi} sang ${ind.base.name.vi} (pH ${fixed(lo, 1)}–${fixed(hi, 1)})`,
    `changing from ${ind.acid.name.en} to ${ind.base.name.en} (pH ${fixed(lo, 1)}–${fixed(hi, 1)})`,
  );
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
  const { locale, fixed, sig } = useFormat();
  usePublishCard(useMemo(() => titrationCard(locale), [locale]));
  const st = useTitrationStore();
  const ind = indicatorOf(st.indicator);
  const veq = equivalenceVolume(st);
  const vMax = maxVolume(st);
  const value = pH(st, st.vb);
  const { mix } = indicatorAt(ind, value);
  const step = vMax / 2000;
  const nudge = vMax / 200;
  const where =
    Math.abs(st.vb - veq) <= step / 2
      ? L(
          'Tại điểm tương đương: acid và base vừa đủ phản ứng.',
          'At the equivalence point: acid and base have just reacted completely.',
        )
      : st.vb < veq
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
          V<sub>tđ</sub> = {fixed(veq)} mL
        </span>
        <span className="chem-chip chem-chip--qual">
          {Lz(L('Màu minh họa', 'Illustrative colours'))}
        </span>
      </div>
      <div className="tit-stage">
        <Flask colour={solutionColour(ind, mix)} level={st.vb / vMax} burette={1 - st.vb / vMax} />
        <div className="tit-readout">
          <p className="tit-ph" aria-live="polite">
            pH = <strong className="mono">{fixed(value)}</strong>
          </p>
          <p>
            <strong>{Lz(ind.name)}</strong>: {Lz(phaseText(ind, value, fixed))}
          </p>
          <p className="small muted">{Lz(where)}</p>
          <label className="tit-volume">
            <span>
              {Lz(L('Thể tích NaOH đã thêm', 'NaOH added'))} V<sub>b</sub>:{' '}
              <strong className="mono">{fixed(st.vb)} mL</strong>
            </span>
            <input
              type="range"
              min={0}
              max={vMax}
              step={step}
              value={st.vb}
              onChange={(e) => {
                setTitration({ vb: Number(e.target.value) });
              }}
            />
          </label>
          <div className="tit-nudge">
            <button
              type="button"
              className="btn"
              disabled={st.vb <= 0}
              onClick={() => {
                setTitration({ vb: st.vb - nudge });
              }}
            >
              <Minus size={14} aria-hidden="true" /> {sig(nudge)} mL
            </button>
            <button
              type="button"
              className="btn"
              disabled={st.vb >= vMax}
              onClick={() => {
                setTitration({ vb: st.vb + nudge });
              }}
            >
              <Plus size={14} aria-hidden="true" /> {sig(nudge)} mL
            </button>
          </div>
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
  const { ca, va, cb, vb, indicator } = useTitrationStore();
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
        band(ind.range[0]),
        band(ind.range[1]),
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
        marker={vb}
        csvName={Lz(L('chuan-do', 'titration'))}
      />
    </div>
  );
}
