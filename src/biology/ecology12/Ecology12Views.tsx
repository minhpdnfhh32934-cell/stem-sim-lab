import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { LabeledNumber } from '@/ui/ModuleControls';
import { L, usePublishCard } from '../common';
import { PYRAMID_CARD, PYRAMID_TITLE, TOLERANCE_CARD, TOLERANCE_TITLE } from './card';
import {
  EFFICIENCY_AVERAGE,
  EFFICIENCY_RANGE,
  PYRAMIDS,
  TOLERANCE,
  efficiencies,
  upright,
  zoneAt,
  type Zone,
} from './model';
import { restorePyramid, restoreTolerance, usePyramid, useTolerance } from './store';
import '../bio.css';
import '../heredity.css';
import './ecology12.css';

const ZONE_TEXT: Record<Zone, LocalizedText> = {
  below: L(
    'Dưới giới hạn dưới: cây ngừng quang hợp và hô hấp.',
    'Below the lower limit: the plant stops photosynthesising and respiring.',
  ),
  lowStress: L('Khoảng ức chế: quang hợp bị ức chế.', 'Stress range: photosynthesis is inhibited.'),
  optimum: L(
    'Khoảng thuận lợi: cây quang hợp tốt nhất.',
    'Optimum range: the plant photosynthesises best.',
  ),
  highStress: L(
    'Khoảng ức chế: quang hợp bị ức chế.',
    'Stress range: photosynthesis is inhibited.',
  ),
  above: L(
    'Trên giới hạn trên: cây ngừng quang hợp và hô hấp.',
    'Above the upper limit: the plant stops photosynthesising and respiring.',
  ),
};

const useN = () => {
  const locale = useSettingsStore((s) => s.locale);
  return (x: number, d = 1) => formatNumber(locale, x, { maximumFractionDigits: d });
};

/* ───────── Bài 23: the tolerance curve ───────── */

export function ToleranceStage() {
  const Lz = useLocalized();
  const n = useN();
  const t = useTolerance((s) => s.t);
  const zone = zoneAt(t);
  usePublishCard(TOLERANCE_CARD);
  const g = TOLERANCE;
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      // A bell shape between the limits, flat on top over the optimum (an illustration of
      // Hình 23.5); the zones and the marker carry the book's numbers.
      const lo = -10;
      const hi = 50;
      const x0 = 40;
      const x1 = width - 20;
      const base = height - 50;
      const top = 30;
      const X = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
      const zones: [number, number, string][] = [
        [g.lower_limit, g.optimum_from, '--chart-2'],
        [g.optimum_from, g.optimum_to, '--chart-1'],
        [g.optimum_to, g.upper_limit, '--chart-2'],
      ];
      ctx.globalAlpha = 0.15;
      for (const [a, b, c] of zones) {
        ctx.fillStyle = css(c);
        ctx.fillRect(X(a), top, X(b) - X(a), base - top);
      }
      ctx.globalAlpha = 1;
      const level = (v: number) => {
        if (v <= g.lower_limit || v >= g.upper_limit) return 0;
        if (v >= g.optimum_from && v <= g.optimum_to) return 1;
        const s =
          v < g.optimum_from
            ? (v - g.lower_limit) / (g.optimum_from - g.lower_limit)
            : (g.upper_limit - v) / (g.upper_limit - g.optimum_to);
        return Math.sin((s * Math.PI) / 2);
      };
      ctx.strokeStyle = css('--chart-4');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let v = g.lower_limit; v <= g.upper_limit; v += 0.25) {
        const y = base - level(v) * (base - top - 10);
        if (v === g.lower_limit) ctx.moveTo(X(v), y);
        else ctx.lineTo(X(v), y);
      }
      ctx.stroke();
      ctx.strokeStyle = css('--text-muted');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, base);
      ctx.lineTo(x1, base);
      ctx.stroke();
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const v of [g.lower_limit, g.optimum_from, g.optimum_to, g.upper_limit]) {
        ctx.fillText(`${n(v)} °C`, X(v), base + 18);
      }
      // The learner's temperature.
      const cx = X(Math.min(hi, Math.max(lo, t)));
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx, base);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css('--accent');
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`${n(t)} °C`, cx, base + 36);
    },
    false,
    [t],
  );
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TOLERANCE_TITLE)}</strong>
        </span>
      </div>
      <div className="bio-scroll heredity">
        <p className="heredity__cross">
          {Lz(
            L(
              'Giới hạn sinh thái về nhiệt độ đối với quang hợp của thực vật',
              'Tolerance range of temperature for plant photosynthesis',
            ),
          )}
        </p>
        <canvas
          ref={ref}
          className="eco-curve"
          role="img"
          aria-label={Lz(
            L(`${n(t)} °C: ${ZONE_TEXT[zone].vi}`, `${n(t)} °C: ${ZONE_TEXT[zone].en}`),
          )}
        />
        <p className="heredity__verdict eco-zone">{Lz(ZONE_TEXT[zone])}</p>
        <p className="heredity__note">
          {Lz(
            L(
              `Ví dụ của sách (tr. 125): thực vật quang hợp tốt ở ${n(g.optimum_from)} – ${n(g.optimum_to)} °C; cây ngừng quang hợp và hô hấp ở nhiệt độ thấp hơn ${n(g.lower_limit)} °C hoặc cao hơn ${n(g.upper_limit)} °C. Đường cong chỉ minh họa hình dạng của Hình 23.5.`,
              `The book’s example (p. 125): plants photosynthesise best at ${n(g.optimum_from)} – ${n(g.optimum_to)} °C and stop photosynthesising and respiring below ${n(g.lower_limit)} °C or above ${n(g.upper_limit)} °C. The curve only shows the shape of Figure 23.5.`,
            ),
          )}
        </p>
      </div>
    </div>
  );
}

export function TolerancePanel() {
  const Lz = useLocalized();
  const t = useTolerance((s) => s.t);
  return (
    <div className="chem-form">
      <LabeledNumber
        label={Lz(L('Nhiệt độ môi trường (°C)', 'Temperature (°C)'))}
        value={t}
        step={1}
        min={-10}
        max={50}
        onChange={(v) => {
          restoreTolerance({ t: v });
        }}
      />
      <p className="small">
        {Lz(
          L(
            'Các quy luật sinh thái (tr. 125–126): quy luật giới hạn sinh thái, quy luật tác động tổng hợp và quy luật tác động không đồng đều của các nhân tố sinh thái.',
            'The ecological laws (pp. 125–126): the law of tolerance, the law of combined action and the law of uneven action of ecological factors.',
          ),
        )}
      </p>
    </div>
  );
}

/* ───────── Bài 29: ecological pyramids ───────── */

const KIND_NAME: Record<string, LocalizedText> = {
  number: L('Tháp số lượng', 'Pyramid of numbers'),
  biomass: L('Tháp sinh khối', 'Pyramid of biomass'),
  energy: L('Tháp năng lượng', 'Pyramid of energy'),
};
const LEVEL_TOKEN = ['--chart-3', '--chart-6', '--chart-2', '--chart-4'];

export function PyramidStage() {
  const Lz = useLocalized();
  const n = useN();
  const id = usePyramid((s) => s.pyramid);
  const p = PYRAMIDS.find((x) => x.id === id);
  usePublishCard(PYRAMID_CARD);
  if (!p) return null;
  const max = Math.max(...p.levels.map((l) => l.value));
  const eff = p.kind === 'energy' ? efficiencies(p) : [];
  const pct = (x: number) => `${n(100 * x)} %`;
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(PYRAMID_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(KIND_NAME[p.kind] ?? L(p.kind, p.kind))}</span>
      </div>
      <div className="bio-scroll heredity">
        <p className="heredity__cross">{`${Lz(p.place)} (${p.unit})`}</p>
        <ol className="eco-pyramid" aria-label={Lz(KIND_NAME[p.kind] ?? L(p.kind, p.kind))}>
          {[...p.levels].reverse().map((l) => (
            <li key={l.level} className="eco-pyramid__row">
              <span
                className="eco-pyramid__bar"
                style={{
                  width: `max(6px, ${(100 * l.value) / max}%)`,
                  background: `var(${LEVEL_TOKEN[l.level - 1] ?? '--chart-1'})`,
                }}
              />
              <span className="eco-pyramid__label">{`${Lz(l.name)}: ${n(l.value, 0)}`}</span>
            </li>
          ))}
        </ol>
        <p className="heredity__verdict eco-shape">
          {Lz(
            upright(p)
              ? L(
                  'Tháp có dạng điển hình (đáy rộng, đỉnh hẹp).',
                  'An upright pyramid (wide base, narrow top).',
                )
              : L(
                  'Tháp có dạng ngược (ở ít nhất một bậc).',
                  'An inverted pyramid (at one level or more).',
                ),
          )}
        </p>
        {eff.length > 0 && (
          <ul className="heredity__result eco-efficiency">
            {eff.map((e, i) => (
              <li key={i}>
                {`${Lz(L('Bậc', 'Level'))} ${i + 1} → ${i + 2}: H = ${n(p.levels[i + 1]?.value ?? 0, 0)} / ${n(p.levels[i]?.value ?? 0, 0)} ≈ ${pct(e)}`}
              </li>
            ))}
          </ul>
        )}
        <p className="heredity__note">
          {Lz(
            L(
              `Hiệu suất sinh thái trung bình khoảng ${pct(EFFICIENCY_AVERAGE)}, thực tế dao động khoảng ${pct(EFFICIENCY_RANGE[0])} – ${pct(EFFICIENCY_RANGE[1])} (tr. 158–159).`,
              `Ecological efficiency averages about ${pct(EFFICIENCY_AVERAGE)}, in practice ${pct(EFFICIENCY_RANGE[0])} – ${pct(EFFICIENCY_RANGE[1])} (pp. 158–159).`,
            ),
          )}
        </p>
      </div>
    </div>
  );
}

export function PyramidPanel() {
  const Lz = useLocalized();
  const id = usePyramid((s) => s.pyramid);
  return (
    <div className="chem-form">
      <label>
        <span>{Lz(L('Tháp sinh thái (Hình 29.6)', 'Ecological pyramid (Figure 29.6)'))}</span>
        <select
          value={id}
          onChange={(e) => {
            restorePyramid({ pyramid: e.target.value });
          }}
        >
          {PYRAMIDS.map((p) => (
            <option key={p.id} value={p.id}>
              {`${Lz(KIND_NAME[p.kind] ?? L(p.kind, p.kind))}: ${Lz(p.place)}`}
            </option>
          ))}
        </select>
      </label>
      <p className="small">
        {Lz(
          L(
            'Bậc dinh dưỡng cấp 1 là sinh vật sản xuất (đáy tháp), cấp 2 là sinh vật tiêu thụ bậc 1, … Chỉ tháp năng lượng mới tính được hiệu suất sinh thái.',
            'Level 1 is the producers (the base), level 2 the primary consumers, … Only an energy pyramid gives the ecological efficiency.',
          ),
        )}
      </p>
    </div>
  );
}
