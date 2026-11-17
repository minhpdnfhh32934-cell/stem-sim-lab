import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { sci } from '@/ui/sciNumber';
import { axes, dot, twoFrames } from '../common/chart2d';
import { ActionRow, ChoiceGroup, LabeledNumber } from '@/ui/ModuleControls';
import { L, TITLE, magneticCard } from './card';
import { COIL, TABLE_15_1, force, forceDirection, measure, type Out } from './model';
import {
  LOADABLE,
  TABS,
  loadExample,
  setMagnetic,
  useMagneticStore,
  type Loadable,
  type Tab,
} from './store';
import './magnetic.css';

const TAB_NAME: Record<Tab, LocalizedText> = {
  force: L('Lực từ', 'Magnetic force'),
  measure: L('Đo cảm ứng từ', 'Measuring B'),
};
const DIRECTION: Record<Out, LocalizedText> = {
  into: L(
    'vuông góc với mặt phẳng hình, hướng vào trong (⊗)',
    'perpendicular to the page, into it (⊗)',
  ),
  outOf: L(
    'vuông góc với mặt phẳng hình, hướng ra ngoài (⊙)',
    'perpendicular to the page, out of it (⊙)',
  ),
  none: L('không có lực từ (dây song song với B)', 'no force (the wire is along B)'),
};
const EXAMPLE_NAME: Record<Loadable, LocalizedText> = {
  'wire-60': L('Câu 1 tr. 63', 'Question 1 p. 63'),
  electrons: L('Câu 2 tr. 63', 'Question 2 p. 63'),
};
const CURRENT = ['forward', 'reversed'] as const;

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 3) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}

function ForceView() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const { B, I, L: len, alpha, reversed } = useMagneticStore();
  const F = force(B, I, len, alpha);
  const dir = forceDirection(alpha, reversed);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa, fb] = twoFrames(width, height);
      // Field lines: B⃗ points right.
      ctx.strokeStyle = css('--chart-2');
      ctx.fillStyle = css('--chart-2');
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) {
        const y = fa.y + ((k + 0.5) * fa.h) / 7;
        ctx.beginPath();
        ctx.moveTo(fa.x, y);
        ctx.lineTo(fa.x + fa.w, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fa.x + fa.w, y);
        ctx.lineTo(fa.x + fa.w - 10, y - 5);
        ctx.lineTo(fa.x + fa.w - 10, y + 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('B', fa.x + fa.w - 26, fa.y + fa.h / 14 - 8);
      // The wire at α to B⃗, the current along it.
      const cx = fa.x + fa.w / 2;
      const cy = fa.y + fa.h / 2;
      const half = Math.min(fa.w, fa.h) * 0.4;
      const a = (alpha * Math.PI) / 180;
      const s = reversed ? -1 : 1;
      const ux = Math.cos(a);
      const uy = -Math.sin(a);
      ctx.strokeStyle = css('--chart-4');
      ctx.fillStyle = css('--chart-4');
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - ux * half, cy - uy * half);
      ctx.lineTo(cx + ux * half, cy + uy * half);
      ctx.stroke();
      const hx = cx + s * ux * half * 0.75;
      const hy = cy + s * uy * half * 0.75;
      ctx.beginPath();
      ctx.moveTo(hx + s * ux * 14, hy + s * uy * 14);
      ctx.lineTo(hx - s * ux * 4 - uy * 9, hy - s * uy * 4 + ux * 9);
      ctx.lineTo(hx - s * ux * 4 + uy * 9, hy - s * uy * 4 - ux * 9);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('I', hx - uy * 18, hy + ux * 18);
      // The force at the midpoint: ⊗ into the page, ⊙ out of it.
      if (dir !== 'none') {
        ctx.strokeStyle = css('--accent');
        ctx.fillStyle = css('--accent');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.stroke();
        if (dir === 'into') {
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy - 10);
          ctx.lineTo(cx + 10, cy + 10);
          ctx.moveTo(cx + 10, cy - 10);
          ctx.lineTo(cx - 10, cy + 10);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`F = ${sci(locale, F)} N`, cx + 24, cy - 20);
      }
      // F against α (0–180°): F = BIL sinα.
      const fMax = Math.max(B * I * len, 1e-12) * 1.2;
      const b = axes(ctx, css, locale, fb, [0, 180], [0, fMax], { x: 'α (°)', y: 'F (N)' });
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let d = 0; d <= 180; d += 2) {
        const y = force(B, I, len, d);
        if (d === 0) ctx.moveTo(b.X(d), b.Y(y));
        else ctx.lineTo(b.X(d), b.Y(y));
      }
      ctx.stroke();
      dot(ctx, b.X(alpha), b.Y(F), css('--chart-4'));
    },
    false,
    [B, I, len, alpha, reversed, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Lực từ F = ${sci(locale, F)} N, ${DIRECTION[dir].vi}`,
          `Magnetic force F = ${sci(locale, F)} N, ${DIRECTION[dir].en}`,
        ),
      )}
    />
  );
}

function MeasureView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const m = useMemo(() => measure(), []);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa] = twoFrames(width, height);
      const f = { ...fa, w: Math.min(width - fa.x - 32, fa.w * 1.5) };
      const a = axes(ctx, css, locale, f, [0, 0.5], [0, 0.11], { x: 'I (A)', y: 'F (N)' });
      ctx.strokeStyle = css('--accent');
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.X(0), a.Y(0));
      ctx.lineTo(a.X(0.46), a.Y(m.slope * 0.46));
      ctx.stroke();
      ctx.setLineDash([]);
      for (const r of TABLE_15_1) dot(ctx, a.X(r.I), a.Y(r.F), css('--chart-1'));
    },
    false,
    [locale, m.slope],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Bảng 15.1: B trung bình ${n(m.mean, 4)} T, sai số ${n(m.error, 4)} T`,
          `Table 15.1: mean B ${n(m.mean, 4)} T, error ${n(m.error, 4)} T`,
        ),
      )}
    />
  );
}

export function MagneticStage() {
  const Lz = useLocalized();
  const tab = useMagneticStore((s) => s.tab);
  const card = useMemo(() => magneticCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view magnetic">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
        {tab === 'force' && <span className="chem-chip">F = BIL sinα</span>}
      </div>
      {tab === 'force' ? <ForceView /> : <MeasureView />}
    </div>
  );
}

function ForcePanel() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const { B, I, L: len, alpha, reversed } = useMagneticStore();
  const F = force(B, I, len, alpha);
  return (
    <>
      <LabeledNumber
        label={Lz(L('Cảm ứng từ B (T)', 'Magnetic field B (T)'))}
        value={B}
        min={0}
        onChange={(v) => {
          setMagnetic({ B: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Cường độ dòng điện I (A)', 'Current I (A)'))}
        value={I}
        min={0}
        onChange={(v) => {
          setMagnetic({ I: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Chiều dài đoạn dây L (m)', 'Wire length L (m)'))}
        value={len}
        min={0}
        onChange={(v) => {
          setMagnetic({ L: v });
        }}
      />
      <LabeledNumber
        label={Lz(
          L('Góc α giữa dây và B (°), từ 0 đến 180', 'Angle α between wire and B (°), 0 to 180'),
        )}
        value={alpha}
        min={0}
        max={180}
        step={5}
        onChange={(v) => {
          setMagnetic({ alpha: v });
        }}
      />
      <ChoiceGroup
        label={Lz(L('Chiều dòng điện', 'Current direction'))}
        items={CURRENT}
        value={reversed ? 'reversed' : 'forward'}
        name={(c) =>
          Lz(c === 'forward' ? L('Chiều như hình', 'As drawn') : L('Đảo chiều', 'Reversed'))
        }
        onPick={(c) => {
          setMagnetic({ reversed: c === 'reversed' });
        }}
        segmented
      />
      <dl className="magnetic-panel__facts">
        <dt>F</dt>
        <dd className="mono magnetic-panel__force">{`${sci(locale, F)} N`}</dd>
        <dt>{Lz(L('Phương, chiều', 'Direction'))}</dt>
        <dd>{Lz(DIRECTION[forceDirection(alpha, reversed)])}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            'Quy tắc bàn tay trái: đặt bàn tay trái sao cho vectơ B hướng vào lòng bàn tay, chiều từ cổ tay đến các ngón tay là chiều dòng điện; ngón tay cái choãi ra 90° chỉ chiều lực từ (tr. 62).',
            'Left-hand rule: hold the left hand so that B goes into the palm and the fingers point along the current; the thumb, stretched out at 90°, gives the force (p. 62).',
          ),
        )}
      </p>
      <ActionRow
        label={Lz(L('Bài tập trong sách', 'Questions in the book'))}
        items={LOADABLE}
        name={(e) => Lz(EXAMPLE_NAME[e])}
        onPick={loadExample}
      />
    </>
  );
}

function MeasurePanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const m = useMemo(() => measure(), []);
  return (
    <>
      <dl className="magnetic-panel__facts">
        <dt>{Lz(L('B trung bình', 'Mean B'))}</dt>
        <dd className="mono magnetic-panel__mean">{`${n(m.mean, 4)} T`}</dd>
        <dt>{Lz(L('Sai số tuyệt đối ΔB', 'Absolute error ΔB'))}</dt>
        <dd className="mono">{`${n(m.error, 4)} T`}</dd>
        <dt>{Lz(L('Sai số tương đối', 'Relative error'))}</dt>
        <dd className="mono">{`${n(m.relative * 100, 1)} %`}</dd>
        <dt>{Lz(L('B từ đường thẳng', 'B from the line'))}</dt>
        <dd className="mono">{`${n(m.fromSlope, 4)} T`}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            `Điểm: số đo in trong Bảng 15.1 (α = 90°, L = nl = ${n(COIL.length_m)} m). Với mỗi lần đo, app tính B = F/(IL); sai số tuyệt đối là trung bình của |B − B̄|. Nét đứt: đường thẳng qua gốc tọa độ gần nhất các điểm (Hình 15.6), độ dốc chia cho L cho B.`,
            `Points: the measurements printed in Table 15.1 (α = 90°, L = nl = ${n(COIL.length_m)} m). For each run the app computes B = F/(IL); the absolute error is the mean of |B − B̄|. Dashed: the best line through the origin (Figure 15.6); its slope divided by L gives B.`,
          ),
        )}
      </p>
    </>
  );
}

export function MagneticPanel() {
  const Lz = useLocalized();
  const tab = useMagneticStore((s) => s.tab);
  return (
    <div className="chem-form magnetic-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setMagnetic({ tab: t });
        }}
        segmented
      />
      {tab === 'force' ? <ForcePanel /> : <MeasurePanel />}
    </div>
  );
}

export function MagneticBottom() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const m = useMemo(() => measure(), []);
  return (
    <table className="magnetic-table">
      <caption>
        {Lz(
          L('Bảng 15.1 (SGK) và B do app tính', 'Table 15.1 (textbook) and B computed by the app'),
        )}
      </caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Lần đo', 'Run'))}</th>
          <th scope="col">I (A)</th>
          <th scope="col">F (N)</th>
          <th scope="col">{Lz(L('F/(IL) in trong sách (T)', 'F/(IL) printed (T)'))}</th>
          <th scope="col">{Lz(L('F/(IL) app tính (T)', 'F/(IL) computed (T)'))}</th>
        </tr>
      </thead>
      <tbody>
        {TABLE_15_1.map((r, i) => (
          <tr key={r.id}>
            <th scope="row">{i + 1}</th>
            <td className="mono">{n(r.I, 2)}</td>
            <td className="mono">{n(r.F, 2)}</td>
            <td className="mono">
              {formatNumber(locale, r.B_printed, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            </td>
            <td className="mono">{n(m.values[i] ?? NaN, 5)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
