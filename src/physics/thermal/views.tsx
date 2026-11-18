import { lazy, Suspense, useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { Bio3DToolbar } from '@/biology/view3d/switch';
import { useShow3d } from '@/biology/view3d/support';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { sci } from '@/ui/sciNumber';
import { niceStep } from '../common/chart2d';
import { LabeledNumber } from '@/ui/ModuleControls';
import { L, TITLE, thermalCard } from './card';
import {
  PRESETS,
  REFERENCE,
  SUBSTANCES,
  THERMOMETERS,
  convert,
  deltaU,
  heatingPlan,
  inclineExample,
  presetDef,
  reach,
  stateAt,
  substance,
  totalTime,
  type Preset,
  type Stage,
  type Target,
} from './model';
import {
  TABS,
  TARGETS,
  UNITS,
  setThermal,
  useThermalStore,
  type Tab,
  type TargetKind,
} from './store';
import './thermal.css';

const TAB_NAME: Record<Tab, LocalizedText> = {
  heat: L('Đun nóng và chuyển thể', 'Heating and changes of state'),
  scale: L('Thang nhiệt độ', 'Temperature scales'),
  firstLaw: L('Định luật I', 'First law'),
};
const PRESET_NAME: Record<Preset, LocalizedText> = {
  ice: L('Nước đá', 'Ice'),
  water: L('Nước', 'Water'),
  iron: L('Sắt', 'Iron'),
  copper: L('Đồng', 'Copper'),
  lead: L('Chì', 'Lead'),
  mercury: L('Thủy ngân', 'Mercury'),
};
const STAGE_NAME: Record<Stage['kind'], LocalizedText> = {
  heatSolid: L('Đun nóng thể rắn', 'Heating the solid'),
  melt: L('Nóng chảy', 'Melting'),
  heatLiquid: L('Đun nóng thể lỏng', 'Heating the liquid'),
  boil: L('Sôi (hóa hơi)', 'Boiling'),
};
const STAGE_TOKEN: Record<Stage['kind'], string> = {
  heatSolid: '--chart-1',
  melt: '--chart-3',
  heatLiquid: '--chart-2',
  boil: '--chart-4',
};
const TARGET_NAME: Record<TargetKind, LocalizedText> = {
  temp: L('Đến nhiệt độ t₁', 'Up to a temperature t₁'),
  melted: L('Nóng chảy hết', 'Fully melted'),
  boiled: L('Hóa hơi hết', 'Fully boiled away'),
};
const UNIT_SIGN = { C: '°C', K: 'K', F: '°F' } as const;

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 2) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}

const Thermal3DView = lazy(() =>
  import('./Thermal3DView').then((m) => ({ default: m.Thermal3DView })),
);

function usePlan() {
  const { preset, m, t0, P, eff, target, t1 } = useThermalStore();
  return useMemo(() => {
    const stages = heatingPlan({ preset, m, t0, P, eff });
    const tg: Target = target === 'temp' ? { kind: 'temp', t: t1 } : { kind: target };
    return { stages, end: totalTime(stages), goal: reach(stages, tg) };
  }, [preset, m, t0, P, eff, target, t1]);
}

/** Heat in J, kJ or MJ, written with the book's decimal comma. */
function useEnergy() {
  const { n } = useFmt();
  return (q: number) =>
    Math.abs(q) >= 1e6
      ? `${n(q / 1e6, 3)} MJ`
      : Math.abs(q) >= 1e3
        ? `${n(q / 1e3, 2)} kJ`
        : `${n(q, 1)} J`;
}
function useDuration() {
  const { n } = useFmt();
  return (s: number) =>
    s >= 3600 ? `${n(s / 3600, 2)} h` : s >= 120 ? `${n(s / 60, 2)} min` : `${n(s, 1)} s`;
}

function HeatCurve() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const tau = useThermalStore((s) => s.tau);
  const { stages, end, goal } = usePlan();
  const now = stateAt(stages, Math.min(tau, end));
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 64, r: 24, t: 70, b: 48 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const temps = stages.flatMap((s) => [s.from, s.to]);
      const tLo = Math.min(...temps);
      const tHi = Math.max(...temps);
      const span = Math.max(1, tHi - tLo);
      const yLo = tLo - span * 0.08;
      const yHi = tHi + span * 0.12;
      const X = (s: number) => pad.l + (end > 0 ? (s / end) * w : 0);
      const Y = (t: number) => pad.t + h - ((t - yLo) / (yHi - yLo)) * h;
      ctx.font = '12px system-ui, sans-serif';
      ctx.strokeStyle = css('--border');
      ctx.fillStyle = css('--text-muted');
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      const step = niceStep((yHi - yLo) / 6);
      for (let t = Math.ceil(yLo / step) * step; t <= yHi; t += step) {
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(t));
        ctx.lineTo(pad.l + w, Y(t));
        ctx.stroke();
        ctx.fillText(formatNumber(locale, t), pad.l - 6, Y(t) + 4);
      }
      ctx.textAlign = 'center';
      const tStep = niceStep(end / 6);
      for (let s = 0; s <= end + 1e-9; s += tStep)
        ctx.fillText(formatNumber(locale, Number(s.toPrecision(6))), X(s), pad.t + h + 16);
      ctx.fillText(Lz(L('Thời gian τ (s)', 'Time τ (s)')), pad.l + w / 2, pad.t + h + 34);
      ctx.save();
      ctx.translate(16, pad.t + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(Lz(L('Nhiệt độ t (°C)', 'Temperature t (°C)')), 0, 0);
      ctx.restore();
      ctx.lineWidth = 3;
      for (const s of stages) {
        ctx.strokeStyle = css(STAGE_TOKEN[s.kind]);
        ctx.beginPath();
        ctx.moveTo(X(s.start), Y(s.from));
        ctx.lineTo(X(s.start + s.dt), Y(s.to));
        ctx.stroke();
      }
      // Stage names along the curve.
      ctx.lineWidth = 1;
      ctx.font = '12px system-ui, sans-serif';
      for (const s of stages) {
        const mid = s.start + s.dt / 2;
        ctx.fillStyle = css(STAGE_TOKEN[s.kind]);
        // A rising stage gets its name above-left of the midpoint, clear of the line.
        const rising = s.to !== s.from;
        ctx.textAlign = rising ? 'right' : 'center';
        ctx.fillText(
          Lz(STAGE_NAME[s.kind]),
          X(mid) - (rising ? 10 : 0),
          Y((s.from + s.to) / 2) - 10,
        );
      }
      if (goal) {
        ctx.strokeStyle = css('--text-muted');
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(X(goal.time), pad.t);
        ctx.lineTo(X(goal.time), pad.t + h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // The time cursor.
      ctx.fillStyle = css('--text');
      ctx.beginPath();
      ctx.arc(X(Math.min(tau, end)), Y(now.t), 6, 0, 2 * Math.PI);
      ctx.fill();
    },
    false,
    [stages, end, goal, tau, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Đường đun nóng: ${stages.map((s) => `${Lz(STAGE_NAME[s.kind])} ${n(s.dt, 1)} s`).join(', ')}`,
          `Heating curve: ${stages.map((s) => `${Lz(STAGE_NAME[s.kind])} ${n(s.dt, 1)} s`).join(', ')}`,
        ),
      )}
    />
  );
}

function ScaleView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const { value, unit } = useThermalStore();
  const v = convert(value, unit);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const top = 64;
      const bottom = height - 30;
      const x = Math.min(width * 0.32, 260);
      // A compressed axis (log of K + 10) so 0 K and the Sun's surface both fit, like the book's
      // broken scale in Hình 3.3.
      const f = (k: number) => Math.log10(Math.max(0, k) + 10);
      const kMax = 6500;
      const Y = (k: number) => bottom - ((f(k) - f(0)) / (f(kMax) - f(0))) * (bottom - top);
      ctx.strokeStyle = css('--text-muted');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.font = '12px system-ui, sans-serif';
      // Thermometer ranges as bars left of the axis.
      THERMOMETERS.forEach((t, i) => {
        const bx = x - 30 - i * 16;
        ctx.strokeStyle = css(i === 0 ? '--chart-1' : '--chart-2');
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bx, Y(t.min_K));
        ctx.lineTo(bx, Y(t.max_K));
        ctx.stroke();
        // Name at the top end: the other bar never reaches that height on its left.
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Lz(t.name), bx - 8, Y(t.max_K) + 4);
      });
      ctx.lineWidth = 1;
      ctx.textAlign = 'left';
      let lastY = -1e9;
      for (const r of REFERENCE) {
        const k = r.kelvin ?? (r.celsius ?? 0) + 273;
        const y = Y(k);
        ctx.strokeStyle = css('--text-muted');
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        ctx.stroke();
        if (Math.abs(y - lastY) < 14) continue;
        lastY = y;
        ctx.fillStyle = css('--text');
        const head =
          r.kelvin !== null
            ? `${formatNumber(locale, r.kelvin)} K${r.celsius !== null ? ` = ${formatNumber(locale, r.celsius)} °C` : ''}`
            : `${formatNumber(locale, r.celsius ?? 0)} °C`;
        ctx.fillText(`${head}  ${Lz(r.label)}`, x + 12, y + 4);
      }
      // The value the learner typed.
      if (v.K >= 0 && v.K <= kMax) {
        ctx.fillStyle = css('--chart-4');
        ctx.beginPath();
        ctx.moveTo(x - 4, Y(v.K));
        ctx.lineTo(x - 18, Y(v.K) - 7);
        ctx.lineTo(x - 18, Y(v.K) + 7);
        ctx.fill();
      }
    },
    false,
    [v.K, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Thang nhiệt độ: ${n(v.C)} °C = ${n(v.K)} K = ${n(v.F)} °F`,
          `Temperature scales: ${n(v.C)} °C = ${n(v.K)} K = ${n(v.F)} °F`,
        ),
      )}
    />
  );
}

function FirstLawView() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { A, Q } = useThermalStore();
  const dU = deltaU(A, Q);
  const arrow = (v: number, inLabel: LocalizedText, outLabel: LocalizedText) =>
    v > 0 ? Lz(inLabel) : v < 0 ? Lz(outLabel) : Lz(L('không có', 'none'));
  return (
    <div
      className="thermal-law"
      role="img"
      aria-label={`ΔU = A + Q = ${n(A)} J + ${n(Q)} J = ${n(dU)} J`}
    >
      <div className={`thermal-law__arrow thermal-law__arrow--${A >= 0 ? 'in' : 'out'}`}>
        <span className="mono">A = {n(A)} J</span>
        <span>
          {arrow(
            A,
            L('vật nhận công', 'the body receives work'),
            L('vật thực hiện công', 'the body does work'),
          )}
        </span>
      </div>
      <div className="thermal-law__body">
        <strong>{Lz(L('Vật', 'Body'))}</strong>
        <span className="mono">ΔU = {n(dU)} J</span>
        <span className="small">
          {dU > 0
            ? Lz(L('nội năng tăng', 'internal energy rises'))
            : dU < 0
              ? Lz(L('nội năng giảm', 'internal energy falls'))
              : Lz(L('nội năng không đổi', 'internal energy unchanged'))}
        </span>
      </div>
      <div className={`thermal-law__arrow thermal-law__arrow--${Q >= 0 ? 'in' : 'out'}`}>
        <span className="mono">Q = {n(Q)} J</span>
        <span>
          {arrow(
            Q,
            L('vật nhận nhiệt', 'the body receives heat'),
            L('vật truyền nhiệt', 'the body gives off heat'),
          )}
        </span>
      </div>
    </div>
  );
}

export function ThermalStage() {
  const Lz = useLocalized();
  const tab = useThermalStore((s) => s.tab);
  const card = useMemo(() => thermalCard(), []);
  usePublishCard(card);
  const { show3d } = useShow3d('heatAndPhase');
  const chips = (
    <>
      <span className="chem-chip">
        <strong className="stage__hud-title">{Lz(TITLE)}</strong>
      </span>
      <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
    </>
  );
  // The sample's particles in space (3D on request); the scales and the first law stay 2D.
  if (tab === 'heat' && show3d)
    return (
      <Suspense fallback={<div className="chem-view thermal" />}>
        <Thermal3DView top={chips} />
      </Suspense>
    );
  return (
    <div className="chem-view thermal">
      {tab === 'heat' && <HeatCurve />}
      {tab === 'scale' && <ScaleView />}
      {tab === 'firstLaw' && <FirstLawView />}
      {/* After the canvas, so the 3D / 2D switch is above it and can be clicked. */}
      <div className="chem-overlay">
        {chips}
        {tab === 'heat' && <Bio3DToolbar lesson="heatAndPhase" />}
      </div>
    </div>
  );
}

function HeatPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const energy = useEnergy();
  const duration = useDuration();
  const { preset, m, t0, P, eff, target, t1, tau } = useThermalStore();
  const { stages, end, goal } = usePlan();
  const s = substance(presetDef(preset).substance);
  const [lo, hi] = presetDef(preset).t0;
  const now = stateAt(stages, Math.min(tau, end));
  const offered = TARGETS.filter(
    (t) =>
      t === 'temp' ||
      stages.some((st) => (t === 'melted' ? st.kind === 'melt' : st.kind === 'boil')),
  );
  return (
    <>
      <div
        className="thermal-panel__list"
        role="radiogroup"
        aria-label={Lz(L('Chất được đun', 'What is heated'))}
      >
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={preset === p}
            className="btn btn--ghost"
            onClick={() => {
              setThermal({
                preset: p,
                tau: 0,
                target: p === 'ice' || p === 'water' || p === 'mercury' ? 'boiled' : 'melted',
              });
            }}
          >
            {Lz(PRESET_NAME[p])}
          </button>
        ))}
      </div>
      <LabeledNumber
        label={Lz(L('Khối lượng m (kg)', 'Mass m (kg)'))}
        value={m}
        min={0.001}
        onChange={(v) => {
          setThermal({ m: v });
        }}
      />
      <LabeledNumber
        label={Lz(
          L(
            `Nhiệt độ ban đầu t₀ (°C), từ ${n(lo)} đến ${n(hi)}`,
            `Initial temperature t₀ (°C), ${n(lo)} to ${n(hi)}`,
          ),
        )}
        value={t0}
        min={lo}
        max={hi}
        onChange={(v) => {
          setThermal({ t0: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Công suất nguồn 𝒫 (W)', 'Heater power 𝒫 (W)'))}
        value={P}
        min={1}
        onChange={(v) => {
          setThermal({ P: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Hiệu suất H (%)', 'Efficiency H (%)'))}
        value={Math.round(eff * 1000) / 10}
        min={1}
        max={100}
        onChange={(v) => {
          setThermal({ eff: v / 100 });
        }}
      />
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Mốc cần tính', 'Point to reach'))}
      >
        {offered.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={target === t}
            className="segmented__item"
            onClick={() => {
              setThermal({ target: t });
            }}
          >
            {Lz(TARGET_NAME[t])}
          </button>
        ))}
      </div>
      {target === 'temp' && (
        <LabeledNumber
          label={Lz(L('Nhiệt độ t₁ (°C)', 'Temperature t₁ (°C)'))}
          value={t1}
          onChange={(v) => {
            setThermal({ t1: v });
          }}
        />
      )}
      <dl className="thermal-panel__facts">
        <dt>{Lz(L('Nhiệt lượng cần', 'Heat needed'))}</dt>
        <dd className="mono thermal-panel__q">
          {goal ? energy(goal.Q) : Lz(L('không đạt được', 'not reached'))}
        </dd>
        <dt>{Lz(L('Thời gian', 'Time'))}</dt>
        <dd className="mono thermal-panel__time">{goal ? duration(goal.time) : '—'}</dd>
      </dl>
      <label className="thermal-panel__range">
        <span>
          {Lz(L('Thời điểm τ', 'Time τ'))}:{' '}
          <strong className="mono">{duration(Math.min(tau, end))}</strong> ·{' '}
          <span className="mono">{n(now.t, 1)} °C</span> · {Lz(STAGE_NAME[now.stage.kind])}
          {now.done > 0 && now.done < 1 ? ` ${n(now.done * 100, 0)} %` : ''}
        </span>
        <input
          type="range"
          min={0}
          max={end}
          step={end / 400}
          value={Math.min(tau, end)}
          aria-label={Lz(L('Thời điểm τ', 'Time τ'))}
          onChange={(e) => {
            setThermal({ tau: Number(e.target.value) });
          }}
        />
      </label>
      <p className="small muted">
        {Lz(
          L(
            `${Lz(s.name)}: số liệu theo Bảng 4.1, 5.1, 6.1 của sách.`,
            `${Lz(s.name)}: values from the book’s Tables 4.1, 5.1, 6.1.`,
          ),
        )}
      </p>
    </>
  );
}

function ScalePanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { value, unit } = useThermalStore();
  const v = convert(value, unit);
  return (
    <>
      <div className="thermal-panel__value">
        <LabeledNumber
          label={Lz(L('Nhiệt độ', 'Temperature'))}
          value={value}
          onChange={(x) => {
            setThermal({ value: x });
          }}
        />
        <select
          aria-label={Lz(L('Đơn vị', 'Unit'))}
          value={unit}
          onChange={(e) => {
            setThermal({ unit: e.target.value });
          }}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_SIGN[u]}
            </option>
          ))}
        </select>
      </div>
      <dl className="thermal-panel__facts">
        <dt>Celsius</dt>
        <dd className="mono thermal-panel__c">{n(v.C)} °C</dd>
        <dt>Kelvin</dt>
        <dd className="mono thermal-panel__k">{n(v.K)} K</dd>
        <dt>{Lz(L('Kelvin (sách làm tròn + 273)', 'Kelvin (book’s rounding + 273)'))}</dt>
        <dd className="mono">{n(v.Krounded)} K</dd>
        <dt>Fahrenheit</dt>
        <dd className="mono">{n(v.F)} °F</dd>
      </dl>
      <p className="small muted">
        {Lz(
          L(
            'Nhiệt độ thấp hơn độ không tuyệt đối (0 K) không được nhận.',
            'A temperature below absolute zero (0 K) is not accepted.',
          ),
        )}
      </p>
    </>
  );
}

function FirstLawPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { A, Q } = useThermalStore();
  const ex = inclineExample(1, 21, 30, 4.1, 9.8);
  return (
    <>
      <LabeledNumber
        label={Lz(L('Công A (J)', 'Work A (J)'))}
        value={A}
        onChange={(v) => {
          setThermal({ A: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Nhiệt lượng Q (J)', 'Heat Q (J)'))}
        value={Q}
        onChange={(v) => {
          setThermal({ Q: v });
        }}
      />
      <ul className="small thermal-panel__signs">
        <li>
          {Lz(
            L(
              'Q > 0: vật nhận nhiệt; Q < 0: vật truyền nhiệt.',
              'Q > 0: the body receives heat; Q < 0: it gives off heat.',
            ),
          )}
        </li>
        <li>
          {Lz(
            L(
              'A > 0: vật nhận công; A < 0: vật thực hiện công.',
              'A > 0: the body receives work; A < 0: it does work.',
            ),
          )}
        </li>
      </ul>
      <h4 className="thermal-panel__ex">{Lz(L('Câu hỏi 2, tr. 14', 'Question 2, p. 14'))}</h4>
      <p className="small">
        {Lz(
          L(
            `Vật 1 kg trượt không vận tốc đầu trên mặt phẳng nghiêng dài 21 m, nghiêng 30°, tới chân dốc với tốc độ 4,1 m/s (g = 9,8 m/s²). Công của lực ma sát A = ${n(ex.friction)} J; bỏ qua trao đổi nhiệt với mặt phẳng nghiêng thì ΔU = ${n(ex.dU)} J.`,
            `A 1 kg body slides from rest down a 21 m incline at 30° and reaches the bottom at 4.1 m/s (g = 9.8 m/s²). The friction work is A = ${n(ex.friction)} J; with no heat exchanged with the incline, ΔU = ${n(ex.dU)} J.`,
          ),
        )}
      </p>
    </>
  );
}

export function ThermalPanel() {
  const Lz = useLocalized();
  const tab = useThermalStore((s) => s.tab);
  return (
    <div className="chem-form thermal-panel">
      <div className="segmented" role="radiogroup" aria-label={Lz(L('Phần bài học', 'Part'))}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tab === t}
            className="segmented__item"
            onClick={() => {
              setThermal({ tab: t });
            }}
          >
            {Lz(TAB_NAME[t])}
          </button>
        ))}
      </div>
      {tab === 'heat' && <HeatPanel />}
      {tab === 'scale' && <ScalePanel />}
      {tab === 'firstLaw' && <FirstLawPanel />}
    </div>
  );
}

export function ThermalBottom() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const energy = useEnergy();
  const duration = useDuration();
  const { stages } = usePlan();
  const val = (v: number | null) =>
    v === null ? '—' : v >= 1e4 ? sci(locale, v) : formatNumber(locale, v);
  return (
    <div className="thermal-tables">
      <table className="thermal-table">
        <caption>{Lz(L('Các giai đoạn', 'The stages'))}</caption>
        <thead>
          <tr>
            <th scope="col">{Lz(L('Giai đoạn', 'Stage'))}</th>
            <th scope="col">t (°C)</th>
            <th scope="col">Q</th>
            <th scope="col">{Lz(L('Thời gian', 'Time'))}</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.kind}>
              <th scope="row">{Lz(STAGE_NAME[s.kind])}</th>
              <td className="mono">
                {s.from === s.to ? n(s.from, 1) : `${n(s.from, 1)} → ${n(s.to, 1)}`}
              </td>
              <td className="mono">{energy(s.Q)}</td>
              <td className="mono">{duration(s.dt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="thermal-table">
        <caption>{Lz(L('Bảng 4.1, 5.1, 6.1 (SGK)', 'Tables 4.1, 5.1, 6.1 (textbook)'))}</caption>
        <thead>
          <tr>
            <th scope="col">{Lz(L('Chất', 'Substance'))}</th>
            <th scope="col">
              {Lz(L('c rắn / lỏng / khí (J/kg·K)', 'c solid / liquid / gas (J/kg·K)'))}
            </th>
            <th scope="col">t°nc (°C)</th>
            <th scope="col">λ (J/kg)</th>
            <th scope="col">t°s (°C)</th>
            <th scope="col">L (J/kg)</th>
          </tr>
        </thead>
        <tbody>
          {SUBSTANCES.map((s) => (
            <tr key={s.id}>
              <th scope="row">{Lz(s.name)}</th>
              <td className="mono">
                {[s.c_solid, s.c_liquid, s.c_gas]
                  .filter((c): c is number => c !== null)
                  .map((c) => formatNumber(locale, c))
                  .join(' / ') || '—'}
              </td>
              <td className="mono">{val(s.melt_C)}</td>
              <td className="mono">{val(s.lambda)}</td>
              <td className="mono">{val(s.boil_C)}</td>
              <td className="mono">{val(s.L)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
