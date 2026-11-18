import { lazy, Suspense, useMemo } from 'react';
import { Bio3DToolbar } from '@/biology/view3d/switch';
import { useShow3d } from '@/biology/view3d/support';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { L } from '../common';
import { formatFormula } from '../formula';
import { hcCard, TITLE } from './card';
import {
  CLASSES,
  HC_REACTIONS,
  MEMBERS,
  SHAPES,
  classOf,
  combustion,
  formulaOf,
  hydrogens,
  molarMass,
  type HcReaction,
} from './model';
import { N_MAX, setHc, useHcStore } from './store';
import './hydrocarbons.css';

const Hc3DView = lazy(() => import('./Hc3DView').then((m) => ({ default: m.Hc3DView })));

const side = (terms: HcReaction['reactants']) =>
  terms.map((t) => `${t.coef > 1 ? String(t.coef) : ''}${formatFormula(t.formula)}`).join(' + ');

/** Boiling and melting points of the class's members against their carbon count (the book's table). */
function TableChart() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const cls = useHcStore((s) => s.cls);
  const rows = MEMBERS.filter((m) => m.class === cls);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 56, r: 24, t: 72, b: 48 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const ns = rows.map((r) => r.carbons);
      const nLo = Math.min(...ns) - 0.5;
      const nHi = Math.max(...ns) + 0.5;
      const ts = rows.flatMap((r) => [r.mp_C, r.bp_C]);
      const tLo = Math.floor(Math.min(...ts) / 50) * 50;
      const tHi = Math.ceil(Math.max(...ts) / 50) * 50;
      const X = (n: number) => pad.l + ((n - nLo) / (nHi - nLo)) * w;
      const Y = (t: number) => pad.t + h - ((t - tLo) / (tHi - tLo)) * h;
      ctx.font = '12px system-ui, sans-serif';
      ctx.strokeStyle = css('--border');
      ctx.fillStyle = css('--text-muted');
      ctx.textAlign = 'right';
      for (let t = tLo; t <= tHi; t += 50) {
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(t));
        ctx.lineTo(pad.l + w, Y(t));
        ctx.stroke();
        ctx.fillText(formatNumber(locale, t), pad.l - 6, Y(t) + 4);
      }
      ctx.textAlign = 'center';
      for (let n = Math.ceil(nLo); n <= nHi; n++) ctx.fillText(String(n), X(n), pad.t + h + 16);
      ctx.fillText(Lz(L('Số nguyên tử C', 'Number of C atoms')), pad.l + w / 2, pad.t + h + 34);
      ctx.save();
      ctx.translate(14, pad.t + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('t (°C)', 0, 0);
      ctx.restore();
      const series = [
        { key: 'bp_C' as const, colour: css('--chart-4') },
        { key: 'mp_C' as const, colour: css('--chart-1') },
      ];
      for (const s of series) {
        const pts = rows.filter((r) => r.straight).map((r) => [X(r.carbons), Y(r[s.key])] as const);
        ctx.strokeStyle = s.colour;
        ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = s.colour;
        for (const r of rows) {
          ctx.beginPath();
          // Straight-chain members are filled; branched or isomers are hollow.
          ctx.arc(X(r.carbons), Y(r[s.key]), 4, 0, 2 * Math.PI);
          if (r.straight) ctx.fill();
          else {
            ctx.strokeStyle = s.colour;
            ctx.stroke();
          }
        }
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = css('--chart-4');
      ctx.fillText(Lz(L('— nhiệt độ sôi', '— boiling point')), pad.l + 8, pad.t - 8);
      ctx.fillStyle = css('--chart-1');
      ctx.fillText(Lz(L('— nhiệt độ nóng chảy', '— melting point')), pad.l + 140, pad.t - 8);
    },
    false,
    [cls, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Nhiệt độ sôi và nóng chảy theo số nguyên tử C: ${Lz(classOf(cls).name)}`,
          `Boiling and melting points against the number of C atoms: ${Lz(classOf(cls).name)}`,
        ),
      )}
    />
  );
}

export function HcStage() {
  const Lz = useLocalized();
  const cls = useHcStore((s) => s.cls);
  const card = useMemo(() => hcCard(), []);
  usePublishCard(card);
  const c = classOf(cls);
  const { show3d } = useShow3d('hydrocarbons');
  const chips = (
    <>
      <span className="chem-chip">
        <strong className="stage__hud-title">{Lz(TITLE)}</strong>
      </span>
      <span className="chem-chip mono">
        {Lz(c.name)}: C<sub>n</sub>H
        <sub>{`2n${c.b > 0 ? `+${String(c.b)}` : c.b < 0 ? `−${String(-c.b)}` : ''}`}</sub> (n ≥{' '}
        {c.n_min})
      </span>
      <Bio3DToolbar lesson="hydrocarbons" />
    </>
  );
  if (show3d)
    return (
      <Suspense fallback={<div className="chem-view" />}>
        <Hc3DView top={chips} />
      </Suspense>
    );
  return (
    <div className="chem-view hydrocarbons">
      <TableChart />
      {/* After the chart: the canvas would otherwise take the clicks meant for the switch. */}
      <div className="chem-overlay">{chips}</div>
    </div>
  );
}

export function HcPanel() {
  const Lz = useLocalized();
  const { cls, n } = useHcStore();
  const c = classOf(cls);
  const burn = combustion(c, n);
  const shape = SHAPES.find((s) => s.class === cls);
  return (
    <div className="chem-form hc-panel">
      <div className="segmented" role="radiogroup" aria-label={Lz(L('Dãy đồng đẳng', 'Series'))}>
        {CLASSES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={cls === x.id}
            className="segmented__item"
            onClick={() => {
              setHc({ cls: x.id });
            }}
          >
            {Lz(x.name)}
          </button>
        ))}
      </div>
      <label>
        <span>
          {Lz(L('Số nguyên tử carbon n', 'Number of carbon atoms n'))}:{' '}
          <strong className="mono">{n}</strong>
        </span>
        <input
          type="range"
          min={c.n_min}
          max={N_MAX}
          step={1}
          value={n}
          onChange={(e) => {
            setHc({ n: Number(e.target.value) });
          }}
        />
      </label>
      <dl className="hc-panel__facts">
        <dt>{Lz(L('Công thức phân tử', 'Molecular formula'))}</dt>
        <dd className="mono">{formatFormula(formulaOf(c, n))}</dd>
        <dt>{Lz(L('Phân tử khối', 'Molar mass'))}</dt>
        <dd className="mono">{molarMass(c, n)}</dd>
        <dt>{Lz(L('Số nguyên tử H', 'H atoms'))}</dt>
        <dd className="mono">{hydrogens(c, n)}</dd>
        <dt>{Lz(L('Đốt cháy hoàn toàn', 'Complete combustion'))}</dt>
        <dd className="mono hc-panel__eq">
          {burn.fuel > 1 ? burn.fuel : ''}
          {formatFormula(burn.formula)} + {burn.o2}O₂ → {burn.co2}CO₂ + {burn.h2o}H₂O
        </dd>
      </dl>
      {shape && (
        <p className="small">
          {Lz(shape.text)} <span className="muted">(tr. {shape.page})</span>
        </p>
      )}
    </div>
  );
}

export function HcBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const cls = useHcStore((s) => s.cls);
  const n = (v: number | null) => (v === null ? '—' : formatNumber(locale, v));
  return (
    <div className="hc-tables">
      <table className="hc-table">
        <caption>
          {Lz(L('Tính chất vật lí theo SGK', 'Physical properties from the textbook'))}
        </caption>
        <thead>
          <tr>
            <th scope="col">{Lz(L('Chất', 'Compound'))}</th>
            <th scope="col">{Lz(L('Công thức', 'Formula'))}</th>
            <th scope="col">t°nc (°C)</th>
            <th scope="col">t°s (°C)</th>
            <th scope="col">D (g/cm³)</th>
          </tr>
        </thead>
        <tbody>
          {MEMBERS.filter((m) => m.class === cls).map((m) => (
            <tr key={m.name}>
              <th scope="row">{m.name}</th>
              <td className="mono">{formatFormula(m.formula)}</td>
              <td className="mono">{n(m.mp_C)}</td>
              <td className="mono">{n(m.bp_C)}</td>
              <td className="mono">{n(m.density)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="hc-table">
        <caption>{Lz(L('Phản ứng trong SGK', 'Reactions in the textbook'))}</caption>
        <tbody>
          {HC_REACTIONS.filter((r) => r.class === cls).map((r) => (
            <tr key={`${r.page}-${side(r.reactants)}`}>
              <th scope="row">{Lz(r.kind)}</th>
              <td className="mono">
                {side(r.reactants)} → {side(r.products)}
              </td>
              <td>{Lz(r.conditions)}</td>
              <td className="mono">{r.dH_kJ === null ? '' : `ΔᵣH° = ${n(r.dH_kJ)} kJ`}</td>
              <td className="muted small">tr. {r.page}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
