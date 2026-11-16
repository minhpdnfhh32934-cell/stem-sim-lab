import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { openTopic } from '@/app/topics';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { NumberField } from '@/ui/NumberField';
import { sci } from '@/ui/sciNumber';
import { L } from '../common';
import { aqueousCard, TITLE } from './card';
import {
  EVERYDAY,
  LITMUS,
  PHENOLPHTHALEIN,
  PH_RANGES,
  hOf,
  litmusOf,
  mediumOf,
  ohOf,
  paperColourOf,
  phenolphthaleinOf,
  type LitmusColour,
  type Medium,
  type PhenolColour,
} from './model';
import { C_RANGE, setAqueous, setFromH, setFromOH, useAqueousStore, type Given } from './store';
import './aqueous.css';

const MEDIUM: Record<Medium, LocalizedText> = {
  acid: L('Môi trường acid (pH < 7)', 'Acidic (pH < 7)'),
  neutral: L('Môi trường trung tính (pH = 7)', 'Neutral (pH = 7)'),
  base: L('Môi trường base (pH > 7)', 'Basic (pH > 7)'),
};
const LITMUS_NAME: Record<LitmusColour, LocalizedText> = {
  red: L('Quỳ đỏ', 'Litmus red'),
  violet: L('Quỳ tím', 'Litmus violet'),
  blue: L('Quỳ xanh', 'Litmus blue'),
  between: L('Sách không ghi màu quỳ ở pH này', 'The book names no litmus colour at this pH'),
};
const PHENOL_NAME: Record<PhenolColour, LocalizedText> = {
  colourless: L('Phenolphthalein không màu', 'Phenolphthalein colourless'),
  pink: L('Phenolphthalein màu hồng', 'Phenolphthalein pink'),
  edge: L(
    'Ranh giới đổi màu của phenolphthalein (pH = 8)',
    'Phenolphthalein’s turning point (pH = 8)',
  ),
};
const litmusCss = (c: LitmusColour) => (c === 'between' ? 'transparent' : LITMUS.colours[c]);
const phenolCss = (c: PhenolColour) =>
  c === 'pink' ? PHENOLPHTHALEIN.colours.pink : PHENOLPHTHALEIN.colours.colourless;

export function AqueousStage() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const pH = useAqueousStore((s) => s.pH);
  const card = useMemo(() => aqueousCard(), []);
  usePublishCard(card);
  const litmus = litmusOf(pH);
  const phenol = phenolphthaleinOf(pH);

  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 36, r: 36 };
      const w = width - pad.l - pad.r;
      const X = (p: number) => pad.l + (p / 14) * w;
      const text = css('--text');
      const muted = css('--text-muted');
      const barTop = Math.max(140, height * 0.36);
      const barH = 30;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      // The pH paper scale (Bảng 2.1), one colour per whole pH.
      for (let p = 0; p < 14; p++) {
        ctx.fillStyle = paperColourOf(p + 0.5);
        ctx.fillRect(X(p), barTop, X(p + 1) - X(p) + 0.5, barH);
      }
      ctx.strokeStyle = css('--border');
      ctx.strokeRect(X(0) + 0.5, barTop + 0.5, w - 1, barH - 1);
      ctx.fillStyle = muted;
      for (let p = 0; p <= 14; p++) ctx.fillText(String(p), X(p), barTop + barH + 14);
      ctx.fillText('acid', X(3.5), barTop + barH + 30);
      ctx.fillText(Lz(L('trung tính', 'neutral')), X(7), barTop + barH + 30);
      ctx.fillText('base', X(10.5), barTop + barH + 30);
      // Everyday solutions above the bar (Hình 2.1), on three alternating rows.
      EVERYDAY.forEach((e, i) => {
        const y = barTop - 12 - (i % 3) * 30;
        ctx.strokeStyle = muted;
        ctx.beginPath();
        ctx.moveTo(X(e.pH), barTop);
        ctx.lineTo(X(e.pH), y + 4);
        ctx.stroke();
        ctx.fillStyle = text;
        // Names near the ends stay inside the canvas.
        const half = ctx.measureText(Lz(e.name)).width / 2 + 2;
        ctx.fillText(Lz(e.name), Math.min(width - half, Math.max(half, X(e.pH))), y);
      });
      // Body fluids, fish ponds, soils (Hình 2.4, tr. 22) below, in rows where no band or name
      // meets another (packed by their width on screen).
      const rowTop = barTop + barH + 46;
      const ends: number[] = [];
      const rows: (typeof PH_RANGES)[number][][] = [];
      for (const it of [...PH_RANGES].sort((a, b) => a.low - b.low)) {
        const right = X(it.high) + 8 + ctx.measureText(Lz(it.name)).width;
        const r = ends.findIndex((end) => end < X(it.low) - 4);
        const k = r < 0 ? ends.length : r;
        ends[k] = right;
        (rows[k] ??= []).push(it);
      }
      rows.forEach((row, r) => {
        const y = rowTop + r * 26;
        for (const it of row) {
          ctx.fillStyle = css('--bg-sunken');
          ctx.fillRect(X(it.low), y, X(it.high) - X(it.low), 18);
          ctx.strokeStyle = css('--border');
          ctx.strokeRect(X(it.low) + 0.5, y + 0.5, X(it.high) - X(it.low) - 1, 17);
          ctx.fillStyle = text;
          ctx.textAlign = 'left';
          ctx.fillText(Lz(it.name), X(it.high) + 4, y + 13);
          ctx.textAlign = 'center';
        }
      });
      // The solution's pH.
      const xm = X(pH);
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xm, barTop - 4);
      ctx.lineTo(xm, rowTop + rows.length * 26);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = css('--accent');
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(
        `pH = ${formatNumber(locale, Number(pH.toFixed(2)))}`,
        xm,
        rowTop + rows.length * 26 + 16,
      );
    },
    false,
    [pH, locale],
  );

  return (
    <div className="chem-view aqueous">
      <canvas
        ref={ref}
        className="chem-canvas"
        role="img"
        aria-label={Lz(
          L(
            `Thang pH: dung dịch có pH ${formatNumber('vi', Number(pH.toFixed(2)))}`,
            `pH scale: the solution has pH ${formatNumber('en', Number(pH.toFixed(2)))}`,
          ),
        )}
      />
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(MEDIUM[mediumOf(pH)])}</span>
      </div>
      <div className="aqueous__indicators" aria-live="polite">
        <span className="aqueous__swatch-row">
          <span
            className="aqueous__swatch"
            style={{ background: litmusCss(litmus) }}
            aria-hidden="true"
          />
          {Lz(LITMUS_NAME[litmus])}
        </span>
        <span className="aqueous__swatch-row">
          <span
            className="aqueous__swatch aqueous__swatch--flask"
            style={{ background: phenolCss(phenol) }}
            aria-hidden="true"
          />
          {Lz(PHENOL_NAME[phenol])}
        </span>
      </div>
    </div>
  );
}

const GIVEN: { id: Given; label: LocalizedText }[] = [
  { id: 'pH', label: L('Cho pH', 'Given pH') },
  { id: 'H', label: L('Cho [H⁺]', 'Given [H⁺]') },
  { id: 'OH', label: L('Cho [OH⁻]', 'Given [OH⁻]') },
  { id: 'solution', label: L('Acid, base mạnh', 'Strong acid, base') },
];

export function AqueousPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { given, pH, solute, c } = useAqueousStore();
  const h = hOf(pH);
  return (
    <div className="chem-form aqueous-panel">
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Đại lượng cho trước', 'Given quantity'))}
      >
        {GIVEN.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={given === g.id}
            className="segmented__item"
            onClick={() => {
              setAqueous({ given: g.id });
            }}
          >
            {Lz(g.label)}
          </button>
        ))}
      </div>
      {given === 'pH' && (
        <label>
          <span>pH</span>
          <input
            type="range"
            min={0}
            max={14}
            step={0.01}
            value={pH}
            onChange={(e) => {
              setAqueous({ pH: Number(e.target.value) });
            }}
          />
          <NumberField
            label="pH"
            value={Number(pH.toFixed(4))}
            step={0.01}
            min={0}
            max={14}
            onChange={(v) => {
              setAqueous({ pH: v });
            }}
          />
        </label>
      )}
      {given === 'H' && (
        <label>
          <span>[H⁺] (mol/L)</span>
          <NumberField label="[H⁺]" value={h} onChange={setFromH} />
        </label>
      )}
      {given === 'OH' && (
        <label>
          <span>[OH⁻] (mol/L)</span>
          <NumberField label="[OH⁻]" value={ohOf(h)} onChange={setFromOH} />
        </label>
      )}
      {given === 'solution' && (
        <>
          <div className="segmented" role="radiogroup" aria-label={Lz(L('Chất tan', 'Solute'))}>
            {(['HCl', 'NaOH'] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={solute === x}
                className="segmented__item"
                onClick={() => {
                  setAqueous({ solute: x });
                }}
              >
                {x}
              </button>
            ))}
          </div>
          <label>
            <span>{Lz(L('Nồng độ (mol/L)', 'Concentration (mol/L)'))}</span>
            <NumberField
              label={Lz(L('Nồng độ', 'Concentration'))}
              value={c}
              min={C_RANGE.min}
              max={C_RANGE.max}
              onChange={(v) => {
                setAqueous({ c: v });
              }}
            />
          </label>
        </>
      )}
      <dl className="aqueous-panel__results">
        <dt>pH</dt>
        <dd className="mono">{formatNumber(locale, Number(pH.toFixed(2)))}</dd>
        <dt>[H⁺]</dt>
        <dd className="mono">{sci(locale, h)} mol/L</dd>
        <dt>[OH⁻]</dt>
        <dd className="mono">{sci(locale, ohOf(h))} mol/L</dd>
        <dt>{Lz(L('Môi trường', 'Medium'))}</dt>
        <dd>{Lz(MEDIUM[mediumOf(pH)])}</dd>
      </dl>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          void openTopic('acidBaseTitration');
        }}
      >
        {Lz(
          L(
            'Xác định nồng độ bằng chuẩn độ: mở bài Chuẩn độ acid – base',
            'Finding a concentration by titration: open Acid–base titration',
          ),
        )}
      </button>
    </div>
  );
}

export function AqueousBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const pH = useAqueousStore((s) => s.pH);
  const n = (v: number) => formatNumber(locale, v);
  return (
    <div className="aqueous-tables">
      <table className="aqueous-table">
        <caption>
          {Lz(
            L(
              'Bảng 2.1 (tr. 23): màu chất chỉ thị theo pH',
              'Table 2.1 (p. 23): indicator colours by pH',
            ),
          )}
        </caption>
        <tbody>
          <tr>
            <th scope="row">{Lz(L('Giấy quỳ', 'Litmus'))}</th>
            <td>{Lz(L(`Đỏ: pH ≤ ${n(LITMUS.red_max)}`, `Red: pH ≤ ${n(LITMUS.red_max)}`))}</td>
            <td>{Lz(L(`Tím: pH = ${n(LITMUS.violet)}`, `Violet: pH = ${n(LITMUS.violet)}`))}</td>
            <td>{Lz(L(`Xanh: pH ≥ ${n(LITMUS.blue_min)}`, `Blue: pH ≥ ${n(LITMUS.blue_min)}`))}</td>
          </tr>
          <tr>
            <th scope="row">Phenolphthalein</th>
            <td colSpan={2}>
              {Lz(
                L(
                  `Không màu: pH < ${n(PHENOLPHTHALEIN.colourless_below)}`,
                  `Colourless: pH < ${n(PHENOLPHTHALEIN.colourless_below)}`,
                ),
              )}
            </td>
            <td>
              {Lz(
                L(
                  `Hồng: pH > ${n(PHENOLPHTHALEIN.pink_above)}`,
                  `Pink: pH > ${n(PHENOLPHTHALEIN.pink_above)}`,
                ),
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <table className="aqueous-table">
        <caption>
          {Lz(
            L(
              'Khoảng pH thích hợp (Hình 2.4 và tr. 22)',
              'Suitable pH ranges (Figure 2.4 and p. 22)',
            ),
          )}
        </caption>
        <tbody>
          {PH_RANGES.map((r) => (
            <tr key={r.id} aria-current={(pH >= r.low && pH <= r.high) || undefined}>
              <th scope="row">{Lz(r.name)}</th>
              <td className="mono">
                {n(r.low)} – {n(r.high)}
              </td>
              <td>{r.book}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
