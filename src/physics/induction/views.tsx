import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { sci } from '@/ui/sciNumber';
import { axes, twoFrames, type Css, type Frame } from '../common/chart2d';
import { ChoiceGroup, LabeledNumber } from '../common/ModuleControls';
import { L, TITLE, inductionCard } from './card';
import {
  averageEmf,
  effectiveEmf,
  emfAt,
  flux,
  fluxAt,
  omega,
  peakEmf,
  period,
  phase0,
  threePhaseAt,
} from './model';
import { TABS, generatorOf, setInduction, useInductionStore, type Tab } from './store';
import './induction.css';

const TAB_NAME: Record<Tab, LocalizedText> = {
  flux: L('Từ thông và suất điện động', 'Flux and induced e.m.f.'),
  generator: L('Máy phát điện xoay chiều', 'AC generator'),
};
const PHASES = ['one', 'three'] as const;

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 3) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}

/**
 * Field lines across the frame (B⃗ to the right) and a coil seen edge-on whose normal n⃗ makes the
 * angle `deg` with B⃗.
 */
function drawCoil(ctx: CanvasRenderingContext2D, css: Css, f: Frame, deg: number, label: string) {
  ctx.strokeStyle = css('--chart-2');
  ctx.fillStyle = css('--chart-2');
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) {
    const y = f.y + ((k + 0.5) * f.h) / 6;
    ctx.beginPath();
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x + f.w, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(f.x + f.w, y);
    ctx.lineTo(f.x + f.w - 9, y - 4);
    ctx.lineTo(f.x + f.w - 9, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const r = Math.min(f.w, f.h) * 0.32;
  const a = (deg * Math.PI) / 180;
  // n⃗ = (cos α, sin α) in the page (y up); the coil is the segment across it.
  const nx = Math.cos(a);
  const ny = -Math.sin(a);
  ctx.strokeStyle = css('--chart-4');
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - ny * r, cy + nx * r);
  ctx.lineTo(cx + ny * r, cy - nx * r);
  ctx.stroke();
  ctx.strokeStyle = css('--accent');
  ctx.fillStyle = css('--accent');
  ctx.lineWidth = 2;
  const ex = cx + nx * r * 0.8;
  const ey = cy + ny * r * 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex + nx * 10, ey + ny * 10);
  ctx.lineTo(ex - ny * 6, ey + nx * 6);
  ctx.lineTo(ex + ny * 6, ey - nx * 6);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('n', ex + nx * 14 + 4, ey + ny * 14);
  ctx.fillStyle = css('--text');
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, f.y + f.h + 22);
}

function FluxView() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const { B1, B2, alpha1, alpha2, S, N, dt } = useInductionStore();
  const phi1 = flux(B1, S, alpha1);
  const phi2 = flux(B2, S, alpha2);
  const e = averageEmf(N, phi1, phi2, dt);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const top = 70;
      const w = (width - 3 * 32) / 2;
      const h = height - top - 60;
      drawCoil(
        ctx,
        css,
        { x: 32, y: top, w, h },
        alpha1,
        Lz(L(`Lúc đầu: Φ₁ = ${sci(locale, phi1)} Wb`, `Before: Φ₁ = ${sci(locale, phi1)} Wb`)),
      );
      drawCoil(
        ctx,
        css,
        { x: 64 + w, y: top, w, h },
        alpha2,
        Lz(L(`Sau Δt: Φ₂ = ${sci(locale, phi2)} Wb`, `After Δt: Φ₂ = ${sci(locale, phi2)} Wb`)),
      );
    },
    false,
    [alpha1, alpha2, phi1, phi2, locale, Lz],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Từ thông qua một vòng dây từ ${sci(locale, phi1)} Wb đến ${sci(locale, phi2)} Wb; suất điện động cảm ứng trung bình ${sci(locale, e)} V`,
          `Flux through one turn from ${sci(locale, phi1)} Wb to ${sci(locale, phi2)} Wb; mean induced e.m.f. ${sci(locale, e)} V`,
        ),
      )}
    />
  );
}

function GeneratorView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const s = useInductionStore();
  const g = useMemo(() => generatorOf(s), [s]);
  const { t, threePhase } = s;
  const E0 = peakEmf(g);
  const T = period(g);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa, fb] = twoFrames(width, height);
      const angle = ((omega(g) * t) / Math.PI) * 180 + g.alpha0;
      drawCoil(
        ctx,
        css,
        { x: 24, y: fa.y, w: fa.x + fa.w * 0.55 - 24, h: fa.h - 20 },
        angle,
        Lz(L(`t = ${n(t * 1e3, 2)} ms`, `t = ${n(t * 1e3, 2)} ms`)),
      );
      // e(t) over two periods, and N·Φ(t) below it.
      const x0 = fa.x + fa.w * 0.55 + 70;
      const right = fb.x + fb.w;
      const hTop = (fa.h - 50) * 0.6;
      const top = { x: x0, y: fa.y, w: right - x0, h: hTop };
      const bot = { x: x0, y: fa.y + hTop + 50, w: right - x0, h: fa.h - hTop - 50 };
      const span = 2 * T;
      const eMax = Math.max(E0, 1e-12) * 1.15;
      const a = axes(ctx, css, locale, top, [0, span], [-eMax, eMax], { x: '', y: 'e (V)' }, 1e3);
      const curve = (fn: (x: number) => number, token: string, dash: number[] = []) => {
        ctx.strokeStyle = css(token);
        ctx.lineWidth = 2;
        ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
          const x = (span * i) / 200;
          if (i === 0) ctx.moveTo(a.X(x), a.Y(fn(x)));
          else ctx.lineTo(a.X(x), a.Y(fn(x)));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (threePhase) {
        curve((x) => threePhaseAt(g, x)[0], '--chart-1');
        curve((x) => threePhaseAt(g, x)[1], '--chart-3');
        curve((x) => threePhaseAt(g, x)[2], '--chart-4');
      } else curve((x) => emfAt(g, x), '--chart-1');
      ctx.strokeStyle = css('--text-muted');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.X(0), a.Y(0));
      ctx.lineTo(a.X(span), a.Y(0));
      ctx.stroke();
      const phiMax = Math.max(g.N * g.B * g.S, 1e-12) * 1.15;
      const b = axes(
        ctx,
        css,
        locale,
        bot,
        [0, span],
        [-phiMax, phiMax],
        { x: 't (ms)', y: 'NΦ (Wb)' },
        1e3,
      );
      ctx.strokeStyle = css('--chart-2');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = (span * i) / 200;
        const y = g.N * fluxAt(g, x);
        if (i === 0) ctx.moveTo(b.X(x), b.Y(y));
        else ctx.lineTo(b.X(x), b.Y(y));
      }
      ctx.stroke();
      // The time cursor on both charts.
      ctx.strokeStyle = css('--accent');
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(a.X(t), top.y);
      ctx.lineTo(a.X(t), bot.y + bot.h);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    false,
    [g, t, threePhase, E0, T, locale, Lz],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Suất điện động xoay chiều: E₀ = ${n(E0, 2)} V, T = ${n(T * 1e3, 2)} ms; lúc t = ${n(t * 1e3, 2)} ms, e = ${n(emfAt(g, t), 2)} V`,
          `Alternating e.m.f.: E₀ = ${n(E0, 2)} V, T = ${n(T * 1e3, 2)} ms; at t = ${n(t * 1e3, 2)} ms, e = ${n(emfAt(g, t), 2)} V`,
        ),
      )}
    />
  );
}

export function InductionStage() {
  const Lz = useLocalized();
  const tab = useInductionStore((s) => s.tab);
  const card = useMemo(() => inductionCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view induction">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'flux' ? <FluxView /> : <GeneratorView />}
    </div>
  );
}

function FluxPanel() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const { B1, B2, alpha1, alpha2, S, N, dt } = useInductionStore();
  const phi1 = flux(B1, S, alpha1);
  const phi2 = flux(B2, S, alpha2);
  const e = averageEmf(N, phi1, phi2, dt);
  return (
    <>
      <LabeledNumber
        label={Lz(L('Số vòng dây N', 'Turns N'))}
        value={N}
        min={1}
        onChange={(v) => {
          setInduction({ N: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Diện tích một vòng S (cm²)', 'Area of one turn S (cm²)'))}
        value={S * 1e4}
        onChange={(v) => {
          setInduction({ S: v / 1e4 });
        }}
      />
      <h4 className="induction-panel__head">{Lz(L('Lúc đầu', 'Before'))}</h4>
      <LabeledNumber
        label={Lz(L('Cảm ứng từ B₁ (T)', 'Field B₁ (T)'))}
        value={B1}
        onChange={(v) => {
          setInduction({ B1: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Góc α₁ giữa B và n (°)', 'Angle α₁ between B and n (°)'))}
        value={alpha1}
        step={15}
        onChange={(v) => {
          setInduction({ alpha1: v });
        }}
      />
      <h4 className="induction-panel__head">
        {Lz(L('Sau khoảng thời gian Δt', 'After a time Δt'))}
      </h4>
      <LabeledNumber
        label={Lz(L('Cảm ứng từ B₂ (T)', 'Field B₂ (T)'))}
        value={B2}
        onChange={(v) => {
          setInduction({ B2: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Góc α₂ giữa B và n (°)', 'Angle α₂ between B and n (°)'))}
        value={alpha2}
        step={15}
        onChange={(v) => {
          setInduction({ alpha2: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Khoảng thời gian Δt (s)', 'Time Δt (s)'))}
        value={dt}
        onChange={(v) => {
          setInduction({ dt: v });
        }}
      />
      <dl className="induction-panel__facts">
        <dt>ΔΦ</dt>
        <dd className="mono">{`${sci(locale, phi2 - phi1)} Wb`}</dd>
        <dt>{Lz(L('Suất điện động cảm ứng e', 'Induced e.m.f. e'))}</dt>
        <dd className="mono induction-panel__emf">{`${sci(locale, e)} V`}</dd>
      </dl>
      <p className="small">
        {Lz(
          phi2 === phi1
            ? L(
                'Từ thông không đổi nên không có dòng điện cảm ứng.',
                'The flux does not change, so there is no induced current.',
              )
            : phi2 > phi1
              ? L(
                  'Từ thông tăng: dòng điện cảm ứng sinh ra từ trường ngược chiều để chống lại sự tăng đó (định luật Lenz), nên e < 0.',
                  'The flux grows: the induced current makes a field that opposes the growth (Lenz’s law), so e < 0.',
                )
              : L(
                  'Từ thông giảm: dòng điện cảm ứng sinh ra từ trường cùng chiều để chống lại sự giảm đó (định luật Lenz), nên e > 0.',
                  'The flux falls: the induced current makes a field along it that opposes the fall (Lenz’s law), so e > 0.',
                ),
        )}
      </p>
    </>
  );
}

function GeneratorPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const s = useInductionStore();
  const g = generatorOf(s);
  const T = period(g);
  return (
    <>
      <LabeledNumber
        label={Lz(L('Số vòng dây N', 'Turns N'))}
        value={s.gN}
        min={1}
        onChange={(v) => {
          setInduction({ gN: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Cảm ứng từ B (T)', 'Field B (T)'))}
        value={s.gB}
        min={0}
        onChange={(v) => {
          setInduction({ gB: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Diện tích một vòng S (cm²)', 'Area of one turn S (cm²)'))}
        value={s.gS * 1e4}
        onChange={(v) => {
          setInduction({ gS: v / 1e4 });
        }}
      />
      <LabeledNumber
        label={Lz(L('Tần số f (Hz)', 'Frequency f (Hz)'))}
        value={s.f}
        onChange={(v) => {
          setInduction({ f: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Góc giữa B và n lúc t = 0 (°)', 'Angle between B and n at t = 0 (°)'))}
        value={s.alpha0}
        step={15}
        onChange={(v) => {
          setInduction({ alpha0: v });
        }}
      />
      <label className="induction-panel__range">
        <span>
          {Lz(L(`Thời điểm t = ${n(s.t * 1e3, 2)} ms`, `Time t = ${n(s.t * 1e3, 2)} ms`))}
        </span>
        <input
          type="range"
          min={0}
          max={2 * T}
          step={T / 100}
          value={s.t}
          aria-label={Lz(L('Thời điểm t', 'Time t'))}
          onChange={(e) => {
            setInduction({ t: Number(e.target.value) });
          }}
        />
      </label>
      <ChoiceGroup
        label={Lz(L('Số pha', 'Phases'))}
        items={PHASES}
        value={s.threePhase ? 'three' : 'one'}
        name={(p) => Lz(p === 'one' ? L('Một pha', 'Single phase') : L('Ba pha', 'Three-phase'))}
        onPick={(p) => {
          setInduction({ threePhase: p === 'three' });
        }}
        segmented
      />
      <dl className="induction-panel__facts">
        <dt>ω</dt>
        <dd className="mono">{`${n(omega(g), 2)} rad/s`}</dd>
        <dt>T</dt>
        <dd className="mono">{`${n(T * 1e3, 3)} ms`}</dd>
        <dt>E₀ = NBSω</dt>
        <dd className="mono induction-panel__peak">{`${n(peakEmf(g), 2)} V`}</dd>
        <dt>{Lz(L('Hiệu dụng E = E₀/√2', 'Effective E = E₀/√2'))}</dt>
        <dd className="mono">{`${n(effectiveEmf(g), 2)} V`}</dd>
        <dt>φ₀</dt>
        <dd className="mono">{`${n(phase0(g), 3)} rad`}</dd>
        <dt>{Lz(L('e lúc t', 'e at t'))}</dt>
        <dd className="mono">{`${n(emfAt(g, s.t), 2)} V`}</dd>
      </dl>
    </>
  );
}

export function InductionPanel() {
  const Lz = useLocalized();
  const tab = useInductionStore((s) => s.tab);
  return (
    <div className="chem-form induction-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setInduction({ tab: t });
        }}
        segmented
      />
      {tab === 'flux' ? <FluxPanel /> : <GeneratorPanel />}
    </div>
  );
}

export function InductionBottom() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const s = useInductionStore();
  const g = generatorOf(s);
  const T = period(g);
  const times = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((k) => k * T);
  return (
    <table className="induction-table">
      <caption>{Lz(L('Một chu kì của máy phát', 'One period of the generator'))}</caption>
      <thead>
        <tr>
          <th scope="col">t (ms)</th>
          <th scope="col">NΦ (Wb)</th>
          <th scope="col">e (V)</th>
        </tr>
      </thead>
      <tbody>
        {times.map((t) => (
          <tr key={t}>
            <td className="mono">{n(t * 1e3, 3)}</td>
            <td className="mono">{n(g.N * fluxAt(g, t), 4)}</td>
            <td className="mono">{n(emfAt(g, t), 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
