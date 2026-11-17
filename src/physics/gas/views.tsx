import { useMemo } from 'react';
import { formatNumber, type Locale } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { sci } from '@/ui/sciNumber';
import { axes, dot, twoFrames } from '../common/chart2d';
import { ActionRow, ChoiceGroup, LabeledNumber } from '@/ui/ModuleControls';
import { L, TITLE, gasCard } from './card';
import {
  BOYLE_ROWS,
  CHARLES_ROWS,
  GASES,
  HELD,
  PROCESSES,
  UNKNOWNS,
  VALIDITY,
  gas,
  meanKineticEnergy,
  molarMassOf,
  moleculeMass,
  moles,
  numberDensity,
  processPath,
  rmsSpeed,
  spread,
  withinBookRange,
  type GasState,
  type Process,
  type Quantity,
} from './model';
import {
  DATA_SETS,
  LOADABLE,
  OFFSETS,
  TABS,
  loadExample,
  offsetOf,
  setGas,
  statesOf,
  useGasStore,
  type DataSet,
  type Loadable,
  type Offset,
  type Tab,
} from './store';
import './gas.css';

const TAB_NAME: Record<Tab, LocalizedText> = {
  process: L('Quá trình biến đổi', 'Changes of state'),
  data: L('Thí nghiệm SGK', 'Textbook experiments'),
  molecules: L('Phân tử khí', 'Gas molecules'),
};
const PROCESS_NAME: Record<Process, LocalizedText> = {
  isothermal: L('Đẳng nhiệt', 'Isothermal'),
  isobaric: L('Đẳng áp', 'Isobaric'),
  isochoric: L('Đẳng tích', 'Isochoric'),
  general: L('Cả ba thay đổi', 'All three change'),
};
const PROCESS_LAW: Record<Process, LocalizedText> = {
  isothermal: L('Định luật Boyle: p₁V₁ = p₂V₂', 'Boyle’s law: p₁V₁ = p₂V₂'),
  isobaric: L('Định luật Charles: V₁/T₁ = V₂/T₂', 'Charles’s law: V₁/T₁ = V₂/T₂'),
  isochoric: L('Đẳng tích: p₁/T₁ = p₂/T₂', 'Isochoric: p₁/T₁ = p₂/T₂'),
  general: L('Phương trình trạng thái: p₁V₁/T₁ = p₂V₂/T₂', 'Equation of state: p₁V₁/T₁ = p₂V₂/T₂'),
};
const DATA_NAME: Record<DataSet, LocalizedText> = {
  boyle: L('Bảng 9.1 (đẳng nhiệt)', 'Table 9.1 (isothermal)'),
  charles: L('Bảng 10.1 (đẳng áp)', 'Table 10.1 (isobaric)'),
};
const OFFSET_NAME: Record<Offset, LocalizedText> = {
  book: L('T = t + 273 (như SGK)', 'T = t + 273 (as the book)'),
  exact: L('T = t + 273,15', 'T = t + 273.15'),
};
const EXAMPLE_NAME: Record<Loadable, LocalizedText> = {
  boyle: L('Ví dụ tr. 39', 'Example p. 39'),
  ball: L('Câu 1 tr. 40', 'Question 1 p. 40'),
  pump: L('Ví dụ tr. 45', 'Example p. 45'),
};
const QTY_NAME: Record<Quantity, string> = { p: 'p₂', V: 'V₂', T: 'T₂' };

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 3) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}
/** Pressure as the book writes it (1,25·10⁵ Pa). */
const pa = (locale: Locale, p: number) => `${sci(locale, p)} Pa`;
/** Volume in litres (the book's examples use L and cm³). */
const litres = (locale: Locale, V: number) =>
  `${formatNumber(locale, Number((V * 1e3).toPrecision(4)))} L`;

function useStates() {
  const s = useGasStore();
  return useMemo(() => {
    const { s1, s2 } = statesOf(s);
    return { s1, s2, path: s2 ? processPath(s.process, s1, s2) : null };
  }, [s]);
}

function ProcessView() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const process = useGasStore((s) => s.process);
  const { s1, s2, path } = useStates();
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      if (!s2 || !path) return;
      const [fa, fb] = twoFrames(width, height);
      const all = [s1, s2, ...(path.mid ? [path.mid] : [])];
      const vMax = Math.max(...all.map((s) => s.V)) * 1.25;
      const pMax = Math.max(...all.map((s) => s.p)) * 1.25;
      const a = axes(
        ctx,
        css,
        locale,
        fa,
        [0, vMax],
        [0, pMax],
        { x: 'V (L)', y: Lz(L('p (10⁵ Pa)', 'p (10⁵ Pa)')) },
        1e3,
        1e-5,
      );
      // Isotherms through T₁ and T₂ (Hình 9.6), clipped to the frame.
      const c = (s1.p * s1.V) / s1.T;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      for (const [T, token] of [
        [s1.T, '--chart-1'],
        [s2.T, '--chart-4'],
      ] as const) {
        ctx.strokeStyle = css(token);
        ctx.beginPath();
        let started = false;
        for (let i = 1; i <= 120; i++) {
          const v = (vMax * i) / 120;
          const p = (c * T) / v;
          if (p > pMax) continue;
          if (started) ctx.lineTo(a.X(v), a.Y(p));
          else ctx.moveTo(a.X(v), a.Y(p));
          started = true;
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = css('--accent');
      ctx.beginPath();
      path.points.forEach(([v, p], i) => {
        if (i === 0) ctx.moveTo(a.X(v), a.Y(p));
        else ctx.lineTo(a.X(v), a.Y(p));
      });
      ctx.stroke();
      dot(ctx, a.X(s1.V), a.Y(s1.p), css('--chart-1'), '1');
      if (path.mid) dot(ctx, a.X(path.mid.V), a.Y(path.mid.p), css('--text-muted'), "1'", true);
      dot(ctx, a.X(s2.V), a.Y(s2.p), css('--chart-4'), '2');

      // The straight line through the origin each law gives.
      const lin: Record<
        Process,
        {
          x: (s: GasState) => number;
          y: (s: GasState) => number;
          xl: string;
          yl: string;
          xs: number;
          ys: number;
        }
      > = {
        isothermal: {
          x: (s) => 1 / s.V,
          y: (s) => s.p,
          xl: '1/V (L⁻¹)',
          yl: 'p (10⁵ Pa)',
          xs: 1e-3,
          ys: 1e-5,
        },
        isobaric: { x: (s) => s.T, y: (s) => s.V, xl: 'T (K)', yl: 'V (L)', xs: 1, ys: 1e3 },
        isochoric: { x: (s) => s.T, y: (s) => s.p, xl: 'T (K)', yl: 'p (10⁵ Pa)', xs: 1, ys: 1e-5 },
        general: { x: (s) => s.T, y: (s) => s.p * s.V, xl: 'T (K)', yl: 'pV (J)', xs: 1, ys: 1 },
      };
      const g = lin[process];
      const xMax = Math.max(g.x(s1), g.x(s2)) * 1.25;
      const yMax = Math.max(g.y(s1), g.y(s2)) * 1.25;
      const b = axes(ctx, css, locale, fb, [0, xMax], [0, yMax], { x: g.xl, y: g.yl }, g.xs, g.ys);
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      const slope = g.y(s1) / g.x(s1);
      const xEnd = Math.min(xMax, yMax / slope);
      ctx.beginPath();
      ctx.moveTo(b.X(0), b.Y(0));
      ctx.lineTo(b.X(xEnd), b.Y(slope * xEnd));
      ctx.stroke();
      ctx.setLineDash([]);
      dot(ctx, b.X(g.x(s1)), b.Y(g.y(s1)), css('--chart-1'), '1');
      dot(ctx, b.X(g.x(s2)), b.Y(g.y(s2)), css('--chart-4'), '2');
    },
    false,
    [s1, s2, path, process, locale, Lz],
  );
  if (!s2)
    return (
      <p className="gas-empty" role="status">
        {Lz(
          L(
            'Các số đã nhập không cho một trạng thái khí có p, V, T đều dương. Hãy sửa lại số liệu.',
            'These values give no gas state with positive p, V and T. Please change them.',
          ),
        )}
      </p>
    );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Đồ thị p–V: trạng thái 1 (${pa(locale, s1.p)}, ${litres(locale, s1.V)}, ${formatNumber(locale, s1.T)} K) đến trạng thái 2 (${pa(locale, s2.p)}, ${litres(locale, s2.V)}, ${formatNumber(locale, s2.T)} K)`,
          `p–V diagram: state 1 (${pa(locale, s1.p)}, ${litres(locale, s1.V)}, ${formatNumber(locale, s1.T)} K) to state 2 (${pa(locale, s2.p)}, ${litres(locale, s2.V)}, ${formatNumber(locale, s2.T)} K)`,
        ),
      )}
    />
  );
}

function DataView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const dataSet = useGasStore((s) => s.dataSet);
  const boyle = spread(BOYLE_ROWS.map((r) => r.pV));
  const charles = spread(CHARLES_ROWS.map((r) => r.VT));
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa, fb] = twoFrames(width, height);
      const pt = css('--chart-1');
      ctx.lineWidth = 2;
      if (dataSet === 'boyle') {
        const a = axes(
          ctx,
          css,
          locale,
          fa,
          [0, 3.5e-6],
          [0, 2.2e5],
          { x: 'V (cm³)', y: 'p (10⁵ Pa)' },
          1e6,
          1e-5,
        );
        ctx.strokeStyle = css('--accent');
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const v = 1.2e-6 + (2.3e-6 * i) / 80;
          if (i === 0) ctx.moveTo(a.X(v), a.Y(boyle.mean / v));
          else ctx.lineTo(a.X(v), a.Y(boyle.mean / v));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        for (const r of BOYLE_ROWS) dot(ctx, a.X(r.V), a.Y(r.p), pt);
        const b = axes(
          ctx,
          css,
          locale,
          fb,
          [0, 8e5],
          [0, 2.2e5],
          { x: '1/V (cm⁻³)', y: 'p (10⁵ Pa)' },
          1e-6,
          1e-5,
        );
        ctx.strokeStyle = css('--accent');
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(b.X(0), b.Y(0));
        ctx.lineTo(b.X(7.4e5), b.Y(boyle.mean * 7.4e5));
        ctx.stroke();
        ctx.setLineDash([]);
        for (const r of BOYLE_ROWS) dot(ctx, b.X(1 / r.V), b.Y(r.p), pt);
      } else {
        const a = axes(
          ctx,
          css,
          locale,
          fa,
          [0, 360],
          [0, 40e-6],
          { x: 'T (K)', y: 'V (mL)' },
          1,
          1e6,
        );
        ctx.strokeStyle = css('--accent');
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(a.X(0), a.Y(0));
        ctx.lineTo(a.X(360), a.Y(charles.mean * 360));
        ctx.stroke();
        ctx.setLineDash([]);
        for (const r of CHARLES_ROWS) dot(ctx, a.X(r.T), a.Y(r.V), pt);
        // Hình 10.1a: against °C the line meets V = 0 at −273 °C.
        const b = axes(
          ctx,
          css,
          locale,
          fb,
          [-300, 100],
          [0, 40e-6],
          { x: 't (°C)', y: 'V (mL)' },
          1,
          1e6,
        );
        ctx.strokeStyle = css('--accent');
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(b.X(-273), b.Y(0));
        ctx.lineTo(b.X(100), b.Y(charles.mean * 373));
        ctx.stroke();
        ctx.setLineDash([]);
        for (const r of CHARLES_ROWS) dot(ctx, b.X(r.t), b.Y(r.V), pt);
        ctx.fillStyle = css('--text-muted');
        ctx.textAlign = 'center';
        ctx.fillText('−273 °C', b.X(-273), b.Y(0) - 10);
      }
    },
    false,
    [dataSet, locale, boyle.mean, charles.mean],
  );
  const s = dataSet === 'boyle' ? boyle : charles;
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        dataSet === 'boyle'
          ? L(
              `Bảng 9.1: pV trung bình ${n(s.mean, 3)} J, lệch nhiều nhất ${n(s.worst * 100, 1)} %`,
              `Table 9.1: mean pV ${n(s.mean, 3)} J, largest departure ${n(s.worst * 100, 1)} %`,
            )
          : L(
              `Bảng 10.1: V/T trung bình ${n(s.mean * 1e6, 4)} mL/K, lệch nhiều nhất ${n(s.worst * 100, 1)} %`,
              `Table 10.1: mean V/T ${n(s.mean * 1e6, 4)} mL/K, largest departure ${n(s.worst * 100, 1)} %`,
            ),
      )}
    />
  );
}

/** Small deterministic generator for the illustration's positions and directions. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function MoleculesView() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { gasId, T } = useGasStore();
  const g = gas(gasId);
  const v = rmsSpeed(g, T);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const side = Math.min(width - 48, height - 110);
      const x0 = (width - side) / 2;
      const y0 = 80;
      ctx.strokeStyle = css('--text-muted');
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, side, side);
      const rnd = seeded(12);
      // Every arrow has the length of √(v̄²) on one scale: 1 000 m/s = 60 px (Hình 8.3 style).
      const len = Math.min(side / 4, (v / 1000) * 60);
      ctx.fillStyle = css('--chart-1');
      ctx.strokeStyle = css('--chart-1');
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 36; i++) {
        // Far enough from the walls that the arrow stays inside the box.
        const m = len + 8;
        const x = x0 + m + rnd() * (side - 2 * m);
        const y = y0 + m + rnd() * (side - 2 * m);
        const a = rnd() * Math.PI * 2;
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 6 * Math.cos(a - 0.4), ey - 6 * Math.sin(a - 0.4));
        ctx.lineTo(ex - 6 * Math.cos(a + 0.4), ey - 6 * Math.sin(a + 0.4));
        ctx.closePath();
        ctx.fill();
      }
    },
    false,
    [v],
  );
  return (
    <>
      <canvas
        ref={ref}
        className="chem-canvas"
        role="img"
        aria-label={Lz(
          L(
            `${Lz(g.name)} ở ${n(T, 1)} K: √(v̄²) = ${n(v, 0)} m/s`,
            `${Lz(g.name)} at ${n(T, 1)} K: √(v̄²) = ${n(v, 0)} m/s`,
          ),
        )}
      />
      <p className="gas-illustration small">
        {Lz(
          L(
            'Hình minh họa: vị trí và hướng là ngẫu nhiên; mọi mũi tên dài theo √(v̄²) (1 000 m/s = 60 px), phân tử thật có tốc độ khác nhau.',
            'Illustration: positions and directions are random; every arrow has the length of √(v̄²) (1,000 m/s = 60 px); real molecules have different speeds.',
          ),
        )}
      </p>
    </>
  );
}

export function GasStage() {
  const Lz = useLocalized();
  const tab = useGasStore((s) => s.tab);
  const process = useGasStore((s) => s.process);
  const card = useMemo(() => gasCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view gas">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
        {tab === 'process' && <span className="chem-chip">{Lz(PROCESS_LAW[process])}</span>}
      </div>
      {tab === 'process' && <ProcessView />}
      {tab === 'data' && <DataView />}
      {tab === 'molecules' && <MoleculesView />}
    </div>
  );
}

/* ───────── Panel ───────── */

function ProcessPanel() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const st = useGasStore();
  const { s1, s2 } = useStates();
  const held = HELD[st.process];
  const off = offsetOf(st.offset);
  const show = (q: Quantity) => q !== st.unknown && q !== held;
  const outside = !withinBookRange(s1) || (s2 !== null && !withinBookRange(s2));
  const result = (q: Quantity, s: GasState) =>
    q === 'p'
      ? pa(locale, s.p)
      : q === 'V'
        ? litres(locale, s.V)
        : `${n(s.T, 2)} K (${n(s.T - off, 2)} °C)`;
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Quá trình', 'Process'))}
        items={PROCESSES}
        value={st.process}
        name={(p) => Lz(PROCESS_NAME[p])}
        onPick={(p) => {
          setGas({ process: p });
        }}
      />
      <ChoiceGroup
        label={Lz(L('Đại lượng cần tìm', 'Quantity to find'))}
        items={UNKNOWNS[st.process]}
        value={st.unknown}
        name={(q) => Lz(L(`Tìm ${QTY_NAME[q]}`, `Find ${QTY_NAME[q]}`))}
        onPick={(q) => {
          setGas({ unknown: q });
        }}
        segmented
      />
      <h4 className="gas-panel__head">{Lz(L('Trạng thái 1', 'State 1'))}</h4>
      <LabeledNumber
        label={Lz(L('Áp suất p₁ (10⁵ Pa)', 'Pressure p₁ (10⁵ Pa)'))}
        value={st.p1 / 1e5}
        onChange={(v) => {
          setGas({ p1: v * 1e5 });
        }}
      />
      <LabeledNumber
        label={Lz(L('Thể tích V₁ (L)', 'Volume V₁ (L)'))}
        value={st.V1 * 1e3}
        onChange={(v) => {
          setGas({ V1: v / 1e3 });
        }}
      />
      <LabeledNumber
        label={Lz(L('Nhiệt độ t₁ (°C)', 'Temperature t₁ (°C)'))}
        value={st.t1}
        onChange={(v) => {
          setGas({ t1: v });
        }}
      />
      <h4 className="gas-panel__head">{Lz(L('Trạng thái 2', 'State 2'))}</h4>
      {show('p') && (
        <LabeledNumber
          label={Lz(L('Áp suất p₂ (10⁵ Pa)', 'Pressure p₂ (10⁵ Pa)'))}
          value={st.p2 / 1e5}
          onChange={(v) => {
            setGas({ p2: v * 1e5 });
          }}
        />
      )}
      {show('V') && (
        <LabeledNumber
          label={Lz(L('Thể tích V₂ (L)', 'Volume V₂ (L)'))}
          value={st.V2 * 1e3}
          onChange={(v) => {
            setGas({ V2: v / 1e3 });
          }}
        />
      )}
      {show('T') && (
        <LabeledNumber
          label={Lz(L('Nhiệt độ t₂ (°C)', 'Temperature t₂ (°C)'))}
          value={st.t2}
          onChange={(v) => {
            setGas({ t2: v });
          }}
        />
      )}
      {held && (
        <p className="small gas-panel__held">
          {Lz(
            L(
              `${held === 'T' ? 'Nhiệt độ' : held === 'p' ? 'Áp suất' : 'Thể tích'} giữ không đổi: ${result(held, s1)}.`,
              `${held === 'T' ? 'Temperature' : held === 'p' ? 'Pressure' : 'Volume'} kept constant: ${result(held, s1)}.`,
            ),
          )}
        </p>
      )}
      <dl className="gas-panel__facts">
        <dt>{QTY_NAME[st.unknown]}</dt>
        <dd className="mono gas-panel__answer">{s2 ? result(st.unknown, s2) : '—'}</dd>
        <dt>{Lz(L('pV/T', 'pV/T'))}</dt>
        <dd className="mono">{`${n((s1.p * s1.V) / s1.T, 4)} J/K`}</dd>
        <dt>{Lz(L('Lượng khí n', 'Amount n'))}</dt>
        <dd className="mono">{`${sci(locale, moles(s1))} mol`}</dd>
      </dl>
      <ChoiceGroup
        label={Lz(L('Đổi °C sang K', '°C to K'))}
        items={OFFSETS}
        value={st.offset}
        name={(o) => Lz(OFFSET_NAME[o])}
        onPick={(o) => {
          setGas({ offset: o });
        }}
        segmented
      />
      {outside && (
        <p className="small gas-note" role="note">
          {Lz(
            L(
              `Sách nêu các định luật Boyle, Charles được rút ra từ thí nghiệm ở p ≤ ${sci(locale, VALIDITY.p_max)} Pa, T ≥ ${n(VALIDITY.T_min)} K; ở điều kiện bình thường khí thực khác khí lí tưởng không nhiều, còn ở áp suất rất cao hoặc nhiệt độ rất thấp thì kết quả có thể lệch (tr. 44).`,
              `The book says Boyle’s and Charles’s laws were found from experiments at p ≤ ${sci(locale, VALIDITY.p_max)} Pa, T ≥ ${n(VALIDITY.T_min)} K; under ordinary conditions a real gas differs little from an ideal gas, but at very high pressure or very low temperature the result may be off (p. 44).`,
            ),
          )}
        </p>
      )}
      <ActionRow
        label={Lz(L('Bài tập trong sách', 'Questions in the book'))}
        items={LOADABLE}
        name={(e) => Lz(EXAMPLE_NAME[e])}
        onPick={loadExample}
      />
    </>
  );
}

function DataPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const dataSet = useGasStore((s) => s.dataSet);
  const boyle = spread(BOYLE_ROWS.map((r) => r.pV));
  const charles = spread(CHARLES_ROWS.map((r) => r.VT));
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Bảng số liệu', 'Data table'))}
        items={DATA_SETS}
        value={dataSet}
        name={(d) => Lz(DATA_NAME[d])}
        onPick={(d) => {
          setGas({ dataSet: d });
        }}
        segmented
      />
      <dl className="gas-panel__facts">
        {dataSet === 'boyle' ? (
          <>
            <dt>{Lz(L('pV trung bình', 'Mean pV'))}</dt>
            <dd className="mono">{`${n(boyle.mean, 4)} J`}</dd>
            <dt>{Lz(L('Lệch nhiều nhất', 'Largest departure'))}</dt>
            <dd className="mono">{`${n(boyle.worst * 100, 1)} %`}</dd>
          </>
        ) : (
          <>
            <dt>{Lz(L('V/T trung bình', 'Mean V/T'))}</dt>
            <dd className="mono">{`${n(charles.mean * 1e6, 4)} mL/K`}</dd>
            <dt>{Lz(L('Lệch nhiều nhất', 'Largest departure'))}</dt>
            <dd className="mono">{`${n(charles.worst * 100, 1)} %`}</dd>
          </>
        )}
      </dl>
      <p className="small">
        {Lz(
          dataSet === 'boyle'
            ? L(
                'Điểm: số đo in trong Bảng 9.1. Nét đứt: p = (pV trung bình)/V, nên đồ thị p theo 1/V là đường thẳng qua gốc tọa độ.',
                'Points: the measurements printed in Table 9.1. Dashed: p = (mean pV)/V, so p against 1/V is a straight line through the origin.',
              )
            : L(
                'Điểm: số đo in trong Bảng 10.1. Nét đứt: V = (V/T trung bình)·T, cắt trục nhiệt độ Celsius tại −273 °C (Hình 10.1).',
                'Points: the measurements printed in Table 10.1. Dashed: V = (mean V/T)·T, which meets the Celsius axis at −273 °C (Figure 10.1).',
              ),
        )}
      </p>
    </>
  );
}

function MoleculesPanel() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const { gasId, T, p } = useGasStore();
  const g = gas(gasId);
  const v = rmsSpeed(g, T);
  const mu = numberDensity(p, T);
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Chất khí', 'Gas'))}
        items={GASES.map((x) => x.id)}
        value={gasId}
        name={(id) => Lz(gas(id).name)}
        onPick={(id) => {
          setGas({ gasId: id });
        }}
      />
      <LabeledNumber
        label={Lz(L('Nhiệt độ T (K)', 'Temperature T (K)'))}
        value={T}
        min={1}
        onChange={(x) => {
          setGas({ T: x });
        }}
      />
      <LabeledNumber
        label={Lz(L('Áp suất p (10⁵ Pa)', 'Pressure p (10⁵ Pa)'))}
        value={p / 1e5}
        onChange={(x) => {
          setGas({ p: x * 1e5 });
        }}
      />
      <dl className="gas-panel__facts">
        <dt>{Lz(L('Khối lượng mol M', 'Molar mass M'))}</dt>
        <dd className="mono">{`${n(molarMassOf(g) * 1e3, 3)} g/mol`}</dd>
        <dt>{Lz(L('Khối lượng phân tử m', 'Molecule mass m'))}</dt>
        <dd className="mono">{`${sci(locale, moleculeMass(g))} kg`}</dd>
        <dt>{Lz(L('Động năng trung bình Ēđ', 'Mean kinetic energy Ēk'))}</dt>
        <dd className="mono gas-panel__energy">{`${sci(locale, meanKineticEnergy(T))} J`}</dd>
        <dt>√(v̄²)</dt>
        <dd className="mono gas-panel__speed">{`${n(v, 0)} m/s`}</dd>
        <dt>{Lz(L('Mật độ phân tử μ', 'Number density μ'))}</dt>
        <dd className="mono">{`${sci(locale, mu)} m⁻³`}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            'Cùng nhiệt độ thì mọi chất khí có cùng Ēđ = 3/2 kT; phân tử nhẹ hơn chuyển động nhanh hơn. Sách nói phân tử oxygen ở 273 K có tốc độ trung bình khoảng 400 m/s (tr. 35); √(v̄²) lớn hơn tốc độ trung bình một chút.',
            'At the same temperature every gas has the same Ēk = 3/2 kT; lighter molecules move faster. The book says oxygen molecules at 273 K move at about 400 m/s on average (p. 35); √(v̄²) is a little larger than the mean speed.',
          ),
        )}
      </p>
    </>
  );
}

export function GasPanel() {
  const Lz = useLocalized();
  const tab = useGasStore((s) => s.tab);
  return (
    <div className="chem-form gas-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setGas({ tab: t });
        }}
        segmented
      />
      {tab === 'process' && <ProcessPanel />}
      {tab === 'data' && <DataPanel />}
      {tab === 'molecules' && <MoleculesPanel />}
    </div>
  );
}

/* ───────── Bottom ───────── */

export function GasBottom() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const offset = useGasStore((s) => s.offset);
  const { s1, s2, path } = useStates();
  const off = offsetOf(offset);
  const rows: [string, GasState][] = [
    ['1', s1],
    ...(path?.mid ? ([["1'", path.mid]] as [string, GasState][]) : []),
    ...(s2 ? ([['2', s2]] as [string, GasState][]) : []),
  ];
  return (
    <div className="gas-tables">
      <table className="gas-table">
        <caption>{Lz(L('Các trạng thái', 'The states'))}</caption>
        <thead>
          <tr>
            <th scope="col">{Lz(L('Trạng thái', 'State'))}</th>
            <th scope="col">p (10⁵ Pa)</th>
            <th scope="col">V (L)</th>
            <th scope="col">T (K)</th>
            <th scope="col">t (°C)</th>
            <th scope="col">pV/T (J/K)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, s]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td className="mono">{n(s.p / 1e5, 4)}</td>
              <td className="mono">{n(s.V * 1e3, 4)}</td>
              <td className="mono">{n(s.T, 2)}</td>
              <td className="mono">{n(s.T - off, 2)}</td>
              <td className="mono">{n((s.p * s.V) / s.T, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="gas-table">
        <caption>{Lz(L('Bảng 9.1 (SGK) và pV', 'Table 9.1 (textbook) and pV'))}</caption>
        <thead>
          <tr>
            <th scope="col">V (cm³)</th>
            <th scope="col">p (10⁵ Pa)</th>
            <th scope="col">pV (J)</th>
          </tr>
        </thead>
        <tbody>
          {BOYLE_ROWS.map((r) => (
            <tr key={r.V}>
              <td className="mono">{n(r.V * 1e6, 1)}</td>
              <td className="mono">{n(r.p / 1e5, 2)}</td>
              <td className="mono">{n(r.pV, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="gas-table">
        <caption>{Lz(L('Bảng 10.1 (SGK) và V/T', 'Table 10.1 (textbook) and V/T'))}</caption>
        <thead>
          <tr>
            <th scope="col">t (°C)</th>
            <th scope="col">T (K)</th>
            <th scope="col">V (mL)</th>
            <th scope="col">V/T (mL/K)</th>
          </tr>
        </thead>
        <tbody>
          {CHARLES_ROWS.map((r) => (
            <tr key={r.t}>
              <td className="mono">{n(r.t, 1)}</td>
              <td className="mono">{n(r.T, 1)}</td>
              <td className="mono">{n(r.V * 1e6, 0)}</td>
              <td className="mono">{n(r.VT * 1e6, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
