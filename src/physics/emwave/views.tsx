import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { wavelengthColor } from '@/chemistry/atom/spectrumColor';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { NumberField } from '@/ui/NumberField';
import { emCard, L, TITLE } from './card';
import {
  EM_BANDS,
  SCALE,
  bandsOf,
  frequencyOf,
  frequencyRange,
  lengthText,
  periodOf,
  sci,
  wavelengthOf,
  type Band,
} from './model';
import { F_UNITS, L_UNITS, UNIT_SI, setEm, useEmStore } from './store';
import './emwave.css';

/** Seconds the drawing takes for one oscillation (slowed down: an illustration). */
const SHOWN_PERIOD = 2;

const LOG_MIN = Math.log10(SCALE.min);
const LOG_SPAN = Math.log10(SCALE.max) - LOG_MIN;

/** Rows of the drawn scale: overlapping bands go on the second row. */
const ROW: Record<Band['id'], number> = {
  radio: 0,
  ir: 0,
  visible: 0,
  uv: 0,
  gamma: 0,
  microwave: 1,
  xray: 1,
};

export function EmStage() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const lambda = useEmStore((s) => s.lambda);
  const card = useMemo(() => emCard(), []);
  usePublishCard(card);
  const bands = bandsOf(lambda);
  const names = bands.map((b) => Lz(b.name)).join(', ');

  const ref = useCanvas(
    ({ ctx, width, height, time, css }) => {
      const pad = { l: 28, r: 28 };
      const w = width - pad.l - pad.r;
      // Upper part: the wave; lower part: the scale.
      const waveTop = 56;
      const waveH = Math.max(120, height * 0.52);
      const axisY = waveTop + waveH / 2;
      const amp = Math.min(waveH * 0.36, 90);
      const phase = (2 * Math.PI * time) / SHOWN_PERIOD;
      const waves = 2;
      const X = (u: number) => pad.l + 40 + (u / waves) * (w - 80);
      const eColor = css('--chart-4');
      const bColor = css('--chart-1');
      const text = css('--text');
      const muted = css('--text-muted');
      ctx.font = '13px system-ui, sans-serif';
      ctx.lineWidth = 1;
      // Propagation axis with the speed c.
      ctx.strokeStyle = muted;
      ctx.beginPath();
      ctx.moveTo(X(0) - 20, axisY);
      ctx.lineTo(X(waves) + 24, axisY);
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.beginPath();
      ctx.moveTo(X(waves) + 30, axisY);
      ctx.lineTo(X(waves) + 20, axisY - 5);
      ctx.lineTo(X(waves) + 20, axisY + 5);
      ctx.fill();
      ctx.fillText('c', X(waves) + 18, axisY - 10);
      // B is drawn along a slanted axis (depth), E straight up.
      const depth = { x: 0.55, y: 0.42 };
      const field = (u: number) => Math.sin(2 * Math.PI * u - phase);
      const curve = (colour: string, at: (u: number) => [number, number]) => {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        for (let i = 0; i <= 240; i++) {
          const [x, y] = at((waves * i) / 240);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let j = 0; j <= waves * 8; j++) {
          const u = j / 8;
          const [x, y] = at(u);
          ctx.beginPath();
          ctx.moveTo(X(u), axisY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      };
      curve(bColor, (u) => {
        const b = 0.8 * amp * field(u);
        return [X(u) - depth.x * b, axisY + depth.y * b];
      });
      curve(eColor, (u) => [X(u), axisY - amp * field(u)]);
      ctx.fillStyle = eColor;
      ctx.fillText('E', X(0.25) + 6, axisY - amp - 6);
      ctx.fillStyle = bColor;
      ctx.fillText('B', X(0.25) - depth.x * 0.8 * amp - 16, axisY + depth.y * 0.8 * amp + 14);
      // λ between two crests of E.
      const crest = (k: number) =>
        X(0.25 + k + phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI)));
      const c1 = crest(0) > X(waves - 1) ? crest(-1) : crest(0);
      const yl = axisY - amp - 22;
      ctx.strokeStyle = text;
      ctx.beginPath();
      ctx.moveTo(c1, yl);
      ctx.lineTo(c1 + (w - 80) / waves, yl);
      ctx.moveTo(c1, yl - 5);
      ctx.lineTo(c1, yl + 5);
      ctx.moveTo(c1 + (w - 80) / waves, yl - 5);
      ctx.lineTo(c1 + (w - 80) / waves, yl + 5);
      ctx.stroke();
      ctx.fillStyle = text;
      ctx.textAlign = 'center';
      ctx.fillText(`λ = ${lengthText(locale, lambda)}`, c1 + (w - 80) / (2 * waves), yl - 6);

      // The scale (Hình 11.3, Bảng 11.1): log of the wavelength, short waves on the left.
      const sTop = waveTop + waveH + 30;
      const rowH = 26;
      const SX = (m: number) => pad.l + ((Math.log10(m) - LOG_MIN) / LOG_SPAN) * w;
      ctx.textAlign = 'center';
      ctx.font = '12px system-ui, sans-serif';
      for (const b of EM_BANDS) {
        const x0 = SX(b.min);
        const x1 = SX(b.max);
        const y = sTop + ROW[b.id] * (rowH + 4);
        const on = bands.includes(b);
        if (b.id === 'visible') {
          const g = ctx.createLinearGradient(x0, 0, x1, 0);
          for (let nm = 380; nm <= 750; nm += 10)
            g.addColorStop((nm - 380) / 370, wavelengthColor(nm) ?? muted);
          ctx.fillStyle = g;
        } else ctx.fillStyle = on ? css('--accent-soft') : css('--bg-sunken');
        ctx.fillRect(x0, y, x1 - x0, rowH);
        ctx.strokeStyle = on ? css('--accent') : css('--border');
        ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, rowH - 1);
        ctx.fillStyle = on ? text : muted;
        const label = Lz(b.name);
        const mid = (x0 + x1) / 2;
        // The narrow visible band is named on the free second row, under its colours.
        if (b.id === 'visible') ctx.fillText(label, mid, y + rowH + 4 + 17);
        else if (ctx.measureText(label).width < x1 - x0 - 6) ctx.fillText(label, mid, y + 17);
        else ctx.fillText(label, mid, y + rowH + 16 + 14 * ROW[b.id]);
      }
      // Decades of wavelength below, of frequency above (f = c/λ).
      const tickY = sTop + 2 * (rowH + 4) + 30;
      ctx.fillStyle = muted;
      ctx.strokeStyle = muted;
      const step = w > 900 ? 2 : 3;
      for (let e = LOG_MIN; e <= LOG_MIN + LOG_SPAN; e += step) {
        const x = SX(10 ** e);
        ctx.beginPath();
        ctx.moveTo(x, tickY - 10);
        ctx.lineTo(x, tickY - 4);
        ctx.stroke();
        ctx.fillText(`${sci(locale, 10 ** e, 1)} m`, x, tickY + 8);
        ctx.fillText(`${sci(locale, frequencyOf(10 ** e), 1)} Hz`, x, sTop - 10);
      }
      ctx.textAlign = 'left';
      ctx.fillText(Lz(L('Tần số cao', 'High frequency')), pad.l, sTop - 26);
      ctx.textAlign = 'right';
      ctx.fillText(Lz(L('Tần số thấp', 'Low frequency')), pad.l + w, sTop - 26);
      // The wave the learner chose.
      const xm = SX(lambda);
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(xm, sTop - 6);
      ctx.lineTo(xm, sTop + 2 * (rowH + 4) + 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    },
    true,
    [lambda, locale, names],
  );

  return (
    <div className="chem-view emwave">
      <canvas
        ref={ref}
        className="chem-canvas"
        role="img"
        aria-label={Lz(
          L(
            `Sóng điện từ λ = ${lengthText('vi', lambda)}: ${names || 'ngoài các dải của SGK'}`,
            `Electromagnetic wave λ = ${lengthText('en', lambda)}: ${names || 'outside the textbook’s bands'}`,
          ),
        )}
      />
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip mono">λ = {lengthText(locale, lambda)}</span>
        <span className="chem-chip mono">f = {sci(locale, frequencyOf(lambda))} Hz</span>
        <span className="chem-chip">
          {names || Lz(L('Ngoài các dải trong SGK', 'Outside the textbook’s bands'))}
        </span>
        <span className="chem-chip chem-chip--approx">
          {Lz(L('Hình động minh họa, đã làm chậm', 'Illustration, slowed down'))}
        </span>
      </div>
    </div>
  );
}

export function EmPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { lambda, given, lUnit, fUnit } = useEmStore();
  const unit = given === 'lambda' ? lUnit : fUnit;
  const per = UNIT_SI[unit] ?? 1;
  const shown = given === 'lambda' ? lambda / per : frequencyOf(lambda) / per;
  const f = frequencyOf(lambda);
  return (
    <div className="chem-form emwave-panel">
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Đại lượng cho trước', 'Given quantity'))}
      >
        {(['lambda', 'f'] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={given === g}
            className="segmented__item"
            onClick={() => {
              setEm({ given: g });
            }}
          >
            {g === 'lambda'
              ? Lz(L('Cho bước sóng λ', 'Given wavelength λ'))
              : Lz(L('Cho tần số f', 'Given frequency f'))}
          </button>
        ))}
      </div>
      <div className="emwave-panel__value">
        <NumberField
          label={
            given === 'lambda' ? Lz(L('Bước sóng', 'Wavelength')) : Lz(L('Tần số', 'Frequency'))
          }
          value={shown}
          onChange={(v) => {
            if (!(v > 0)) return;
            setEm({ lambda: given === 'lambda' ? v * per : wavelengthOf(v * per) });
          }}
        />
        <select
          aria-label={Lz(L('Đơn vị', 'Unit'))}
          value={unit}
          onChange={(e) => {
            setEm(given === 'lambda' ? { lUnit: e.target.value } : { fUnit: e.target.value });
          }}
        >
          {(given === 'lambda' ? L_UNITS : F_UNITS).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <label>
        <span>{Lz(L('Kéo dọc thang sóng', 'Slide along the spectrum'))}</span>
        <input
          type="range"
          min={LOG_MIN}
          max={LOG_MIN + LOG_SPAN}
          step={0.01}
          value={Math.log10(lambda)}
          aria-valuetext={`λ = ${lengthText(locale, lambda)}`}
          onChange={(e) => {
            setEm({ lambda: 10 ** Number(e.target.value) });
          }}
        />
      </label>
      <dl className="emwave-panel__results">
        <dt>{Lz(L('Bước sóng', 'Wavelength'))}</dt>
        <dd className="mono">λ = {lengthText(locale, lambda)}</dd>
        <dt>{Lz(L('Tần số', 'Frequency'))}</dt>
        <dd className="mono">f = c/λ = {sci(locale, f)} Hz</dd>
        <dt>{Lz(L('Chu kì', 'Period'))}</dt>
        <dd className="mono">T = 1/f = {sci(locale, periodOf(lambda))} s</dd>
        <dt>{Lz(L('Thuộc dải', 'Band'))}</dt>
        <dd>
          {bandsOf(lambda)
            .map((b) => Lz(b.name))
            .join(', ') || Lz(L('Ngoài các dải trong SGK', 'Outside the textbook’s bands'))}
        </dd>
      </dl>
    </div>
  );
}

export function EmBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const lambda = useEmStore((s) => s.lambda);
  const on = bandsOf(lambda);
  return (
    <table className="emwave-table">
      <caption className="sr-only">
        {Lz(
          L(
            'Bước sóng và tần số các dải của thang sóng điện từ',
            'Wavelength and frequency of each band',
          ),
        )}
      </caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Loại bức xạ', 'Radiation'))}</th>
          <th scope="col">{Lz(L('Phạm vi bước sóng (SGK)', 'Wavelength range (textbook)'))}</th>
          <th scope="col">{Lz(L('Phạm vi tần số f = c/λ', 'Frequency range f = c/λ'))}</th>
          <th scope="col">{Lz(L('Nguồn trong SGK', 'Where in the textbook'))}</th>
        </tr>
      </thead>
      <tbody>
        {EM_BANDS.map((b) => {
          const r = frequencyRange(b);
          return (
            <tr key={b.id} aria-current={on.includes(b) || undefined}>
              <th scope="row">{Lz(b.name)}</th>
              <td className="mono">
                {lengthText(locale, b.min)} – {lengthText(locale, b.max)}
              </td>
              <td className="mono">
                {sci(locale, r.min)} – {sci(locale, r.max)} Hz
              </td>
              <td>{Lz(b.where)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
