import { Fragment, useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import type { LocalizedText } from '@/core/data/dataset';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { sci } from '@/ui/sciNumber';
import { L } from '../common';
import { formatFormula } from '../formula';
import { CA_TITLE, HAP_TITLE, caCard, hapCard } from './card';
import {
  ACIDS,
  BONDS,
  COMPARISONS,
  COMPOUNDS,
  C_MAX,
  C_MIN,
  DER_REACTIONS,
  ELIMINATIONS,
  weakAcid,
  zaitsev,
  type Comparison,
  type Compound,
  type CompoundClass,
  type DerReaction,
} from './model';
import {
  CA_SERIES,
  CA_TABS,
  HAP_TABS,
  setCa,
  setHap,
  useCaStore,
  useHapStore,
  type CaSeries,
  type CaTab,
  type HapTab,
} from './store';
import './derivatives.css';

const CLASS_NAME: Record<CompoundClass, LocalizedText> = {
  alkane: L('Alkane', 'Alkane'),
  ether: L('Ether', 'Ether'),
  alcohol: L('Alcohol', 'Alcohol'),
  phenol: L('Phenol', 'Phenol'),
  aldehyde: L('Aldehyde', 'Aldehyde'),
  ketone: L('Ketone', 'Ketone'),
  acid: L('Carboxylic acid', 'Carboxylic acid'),
};
const CLASS_TOKEN: Record<CompoundClass, string> = {
  alcohol: '--chart-1',
  aldehyde: '--chart-2',
  phenol: '--chart-3',
  acid: '--chart-4',
  ketone: '--chart-5',
  ether: '--chart-6',
  alkane: '--chart-7',
};
const DEGREE = ['', 'I', 'II', 'III', 'IV'];

/** Subscripts the formulas inside a sentence ("NaOH/C2H5OH, t°" → "NaOH/C₂H₅OH, t°"). */
const chem = (text: string) =>
  text.replace(/(?<=[A-Za-z)\]])\d+/g, (d) =>
    d.replace(/\d/g, (x) => '₀₁₂₃₄₅₆₇₈₉'[Number(x)] ?? x),
  );

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, digits = 1) => formatNumber(locale, v, { maximumFractionDigits: digits }),
  };
}

/** "tan vô hạn" / "không tan" / "7,4 g/100 g nước" as the book writes it. */
function useSolubilityText() {
  const Lz = useLocalized();
  const { n } = useFmt();
  return (s: Compound['solubility']) =>
    s === null
      ? '—'
      : s.kind === 'miscible'
        ? Lz(L('tan vô hạn', 'miscible'))
        : s.kind === 'insoluble'
          ? Lz(L('không tan', 'insoluble'))
          : `${n(s.g ?? 0, 2)} g`;
}

const side = (terms: DerReaction['reactants']) =>
  terms.map((t) => `${t.coef > 1 ? String(t.coef) : ''}${formatFormula(t.formula)}`).join(' + ');

/** The book's side-by-side comparison: one bar per compound, boiling point from 0 °C. */
function CompareChart({ cmp }: { cmp: Comparison }) {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const solText = useSolubilityText();
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 56, r: 24, t: 72, b: 76 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const bps = cmp.rows.map((r) => r.bp_C);
      const lo = Math.min(0, Math.floor(Math.min(...bps) / 50) * 50);
      const hi = Math.ceil((Math.max(...bps) + 10) / 50) * 50;
      const Y = (t: number) => pad.t + h - ((t - lo) / (hi - lo)) * h;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      for (let t = lo; t <= hi; t += 50) {
        ctx.strokeStyle = css('--border');
        ctx.lineWidth = t === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(t));
        ctx.lineTo(pad.l + w, Y(t));
        ctx.stroke();
        ctx.fillStyle = css('--text-muted');
        ctx.fillText(formatNumber(locale, t), pad.l - 6, Y(t) + 4);
      }
      ctx.save();
      ctx.translate(14, pad.t + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(Lz(L('nhiệt độ sôi (°C)', 'boiling point (°C)')), 0, 0);
      ctx.restore();
      const slot = w / cmp.rows.length;
      const bw = Math.min(96, slot * 0.55);
      cmp.rows.forEach((r, i) => {
        const x = pad.l + slot * (i + 0.5);
        const y0 = Y(0);
        const y1 = Y(r.bp_C);
        ctx.fillStyle = css(CLASS_TOKEN[r.class]);
        ctx.fillRect(x - bw / 2, Math.min(y0, y1), bw, Math.max(2, Math.abs(y1 - y0)));
        ctx.fillStyle = css('--text');
        ctx.textAlign = 'center';
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillText(`${n(r.bp_C)} °C`, x, r.bp_C >= 0 ? y1 - 6 : y1 + 16);
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillText(formatFormula(r.formula), x, pad.t + h + 20);
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = css('--text-muted');
        ctx.fillText(`${r.name} (${Lz(CLASS_NAME[r.class])})`, x, pad.t + h + 37);
        const extra = [
          r.M === null ? '' : `M = ${String(r.M)}`,
          r.solubility === null ? '' : solText(r.solubility),
        ]
          .filter(Boolean)
          .join(' · ');
        if (extra) ctx.fillText(extra, x, pad.t + h + 54);
      });
    },
    false,
    [cmp, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={cmp.rows.map((r) => `${r.name}: ${n(r.bp_C)} °C`).join('; ')}
    />
  );
}

/** Boiling point against the number of C atoms for the book's series (filled: open-chain members). */
function SeriesChart({
  classes,
  strong,
}: {
  classes: readonly CompoundClass[];
  strong?: CompoundClass;
}) {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const rows = COMPOUNDS.filter((c) => classes.includes(c.class));
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 56, r: 24, t: 80, b: 48 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const ns = rows.map((r) => r.carbons);
      const nLo = Math.min(...ns) - 0.5;
      const nHi = Math.max(...ns) + 0.5;
      const ts = rows.map((r) => r.bp_C);
      const tLo = Math.floor(Math.min(0, ...ts) / 50) * 50;
      const tHi = Math.ceil(Math.max(...ts) / 50) * 50;
      const X = (v: number) => pad.l + ((v - nLo) / (nHi - nLo)) * w;
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
      for (let v = Math.ceil(nLo); v <= nHi; v++) ctx.fillText(String(v), X(v), pad.t + h + 16);
      ctx.fillText(Lz(L('Số nguyên tử C', 'Number of C atoms')), pad.l + w / 2, pad.t + h + 34);
      ctx.save();
      ctx.translate(14, pad.t + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(Lz(L('nhiệt độ sôi (°C)', 'boiling point (°C)')), 0, 0);
      ctx.restore();
      let lx = pad.l + 8;
      for (const cls of classes) {
        const colour = css(CLASS_TOKEN[cls]);
        const mine = rows.filter((r) => r.class === cls).sort((a, b) => a.carbons - b.carbons);
        const bold = strong === undefined || strong === cls;
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.globalAlpha = bold ? 1 : 0.45;
        ctx.lineWidth = bold ? 2.5 : 1.5;
        ctx.beginPath();
        mine
          .filter((r) => r.series)
          .forEach((r, i) => {
            if (i === 0) ctx.moveTo(X(r.carbons), Y(r.bp_C));
            else ctx.lineTo(X(r.carbons), Y(r.bp_C));
          });
        ctx.stroke();
        ctx.lineWidth = 1.5;
        for (const r of mine) {
          ctx.beginPath();
          ctx.arc(X(r.carbons), Y(r.bp_C), 4.5, 0, 2 * Math.PI);
          if (r.series) ctx.fill();
          else {
            ctx.stroke();
            // Hollow dots are compounds outside the series: name them.
            ctx.textAlign = r.carbons >= nHi - 1 ? 'right' : 'left';
            ctx.fillText(
              r.name,
              X(r.carbons) + (ctx.textAlign === 'right' ? -9 : 9),
              Y(r.bp_C) + 4,
            );
          }
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.font = bold ? '600 12px system-ui, sans-serif' : '12px system-ui, sans-serif';
        const label = `● ${Lz(CLASS_NAME[cls])}`;
        ctx.fillText(label, lx, pad.t - 12);
        lx += ctx.measureText(label).width + 18;
        ctx.font = '12px system-ui, sans-serif';
      }
    },
    false,
    [classes, strong, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={rows.map((r) => `${r.name}: ${n(r.bp_C)} °C`).join('; ')}
    />
  );
}

function ZaitsevView() {
  const Lz = useLocalized();
  const id = useHapStore((s) => s.elimination);
  const e = ELIMINATIONS.find((x) => x.id === id) ?? ELIMINATIONS[0];
  if (!e) return null;
  const z = zaitsev(e);
  const lost = e.kind === 'H2O' ? 'H₂O' : `H${e.group}`;
  return (
    <div className="der-stage__body">
      <h3 className="der-title">
        {e.name} <span className="mono">{formatFormula(e.formula)}</span>
      </h3>
      <p className="der-text">
        {Lz(
          L(
            `${e.group === 'OH' ? 'Nhóm –OH' : `Nguyên tử ${e.group}`} gắn với C${String(e.x_carbon)}. Đun nóng (${chem(e.conditions.vi)}) thì tách ${lost} cùng một nguyên tử H ở carbon bên cạnh:`,
            `${e.group === 'OH' ? 'The –OH group' : `The ${e.group} atom`} is on C${String(e.x_carbon)}. Heated (${chem(e.conditions.en)}), ${lost} leaves with an H atom of a neighbouring carbon:`,
          ),
        )}
      </p>
      <ul className="der-options">
        {e.options.map((o) => {
          const main = !z.single && o.name === z.main?.name;
          return (
            <li key={o.carbon} className={main ? 'der-option der-option--main' : 'der-option'}>
              <span className="der-option__carbon">
                C{o.carbon} · {Lz(L('bậc', 'degree'))} {DEGREE[o.degree]}
              </span>
              <span className="mono der-option__product">{formatFormula(o.formula)}</span>
              <span>{o.name}</span>
              <strong className="der-option__tag">
                {z.single
                  ? Lz(L('sản phẩm duy nhất', 'only product'))
                  : main
                    ? Lz(L('sản phẩm chính', 'main product'))
                    : Lz(L('sản phẩm phụ', 'minor product'))}
              </strong>
            </li>
          );
        })}
      </ul>
      <p className="der-text">
        {z.single
          ? Lz(
              L(
                'Mọi carbon bên cạnh đều cho cùng một alkene, nên chỉ có một sản phẩm.',
                'Every neighbouring carbon gives the same alkene, so there is one product.',
              ),
            )
          : Lz(
              L(
                `Theo quy tắc Zaitsev, H bị tách ưu tiên ở carbon bên cạnh có bậc cao hơn (bậc ${DEGREE[z.top] ?? ''}): sản phẩm chính là ${z.main?.name ?? ''}.`,
                `By Zaitsev’s rule the H leaves preferably from the neighbouring carbon of higher degree (degree ${DEGREE[z.top] ?? ''}): the main product is ${z.main?.name ?? ''}.`,
              ),
            )}
      </p>
      <p className="der-text muted small">
        {e.book_main
          ? Lz(
              L(
                `Ví dụ của sách (tr. ${String(e.page)}): sản phẩm chính là ${e.book_main}.`,
                `The book’s example (p. ${String(e.page)}): the main product is ${e.book_main}.`,
              ),
            )
          : Lz(
              L(
                `Câu hỏi trong sách (tr. ${String(e.page)}); sách không in đáp án, SimLab trả lời bằng quy tắc của sách.`,
                `A question in the book (p. ${String(e.page)}); the book prints no answer, SimLab answers with the book’s rule.`,
              ),
            )}
      </p>
    </div>
  );
}

/** Percentage dissociated against the concentration (log scale) for the acids of Bảng 24.3. */
function AcidChart() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const { acid, C } = useCaStore();
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const pad = { l: 56, r: 24, t: 80, b: 48 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const xLo = Math.log10(C_MIN);
      const xHi = Math.log10(C_MAX);
      const yHi = 40;
      const X = (c: number) => pad.l + ((Math.log10(c) - xLo) / (xHi - xLo)) * w;
      const Y = (p: number) => pad.t + h - (p / yHi) * h;
      ctx.font = '12px system-ui, sans-serif';
      ctx.strokeStyle = css('--border');
      ctx.fillStyle = css('--text-muted');
      ctx.textAlign = 'right';
      for (let p = 0; p <= yHi; p += 10) {
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(p));
        ctx.lineTo(pad.l + w, Y(p));
        ctx.stroke();
        ctx.fillText(`${formatNumber(locale, p)} %`, pad.l - 6, Y(p) + 4);
      }
      ctx.textAlign = 'center';
      for (let e = Math.round(xLo); e <= Math.round(xHi); e++)
        ctx.fillText(formatNumber(locale, 10 ** e), X(10 ** e), pad.t + h + 16);
      ctx.fillText(
        Lz(L('Nồng độ C (mol/L)', 'Concentration C (mol/L)')),
        pad.l + w / 2,
        pad.t + h + 34,
      );
      ctx.save();
      ctx.translate(14, pad.t + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(Lz(L('phần trăm phân li', 'percent dissociated')), 0, 0);
      ctx.restore();
      let lx = pad.l + 8;
      ACIDS.forEach((a, i) => {
        const colour = css(`--chart-${String(i + 1)}`);
        const bold = a.formula === acid;
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.lineWidth = bold ? 3 : 1.5;
        ctx.beginPath();
        for (let k = 0; k <= 120; k++) {
          const c = 10 ** (xLo + ((xHi - xLo) * k) / 120);
          const p = 100 * weakAcid(a.Ka, c).alpha;
          if (k === 0) ctx.moveTo(X(c), Y(p));
          else ctx.lineTo(X(c), Y(p));
        }
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.font = bold ? '600 12px system-ui, sans-serif' : '12px system-ui, sans-serif';
        const label = `● ${formatFormula(a.formula)}`;
        ctx.fillText(label, lx, pad.t - 12);
        lx += ctx.measureText(label).width + 18;
      });
      const sel = ACIDS.find((a) => a.formula === acid);
      ctx.strokeStyle = css('--text-muted');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(X(C), pad.t);
      ctx.lineTo(X(C), pad.t + h);
      ctx.stroke();
      ctx.setLineDash([]);
      if (sel) {
        const p = 100 * weakAcid(sel.Ka, C).alpha;
        ctx.fillStyle = css('--text');
        ctx.beginPath();
        ctx.arc(X(C), Y(p), 5, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.font = '12px system-ui, sans-serif';
    },
    false,
    [acid, C, locale],
  );
  const sel = ACIDS.find((a) => a.formula === acid);
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={
        sel
          ? Lz(
              L(
                `${sel.name}, C = ${sci(locale, C)} mol/L: phân li ${n(100 * weakAcid(sel.Ka, C).alpha, 2)} %`,
                `${sel.name}, C = ${sci(locale, C)} mol/L: ${n(100 * weakAcid(sel.Ka, C).alpha, 2)} % dissociated`,
              ),
            )
          : ''
      }
    />
  );
}

function Overlay({ title, chip }: { title: LocalizedText; chip: string }) {
  const Lz = useLocalized();
  return (
    <div className="chem-overlay">
      <span className="chem-chip">
        <strong className="stage__hud-title">{Lz(title)}</strong>
      </span>
      <span className="chem-chip">{chip}</span>
    </div>
  );
}

const CMP5 = COMPARISONS.find((c) => c.chapter === 5);
const CMP6 = COMPARISONS.find((c) => c.chapter === 6);
const CH5_SERIES: readonly CompoundClass[] = ['alcohol', 'phenol'];
const CH6_SERIES: readonly CompoundClass[] = ['aldehyde', 'ketone', 'acid'];

export function HapStage() {
  const Lz = useLocalized();
  const tab = useHapStore((s) => s.tab);
  const card = useMemo(() => hapCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view derivatives">
      <Overlay
        title={HAP_TITLE}
        chip={Lz(
          tab === 'compare'
            ? L(
                `Phân tử khối gần bằng nhau (tr. ${String(CMP5?.page ?? '')})`,
                `Similar molar mass (p. ${String(CMP5?.page ?? '')})`,
              )
            : tab === 'alcohols'
              ? L('Bảng 20.3 và phenol (tr. 130)', 'Table 20.3 and phenol (p. 130)')
              : L('Quy tắc Zaitsev (tr. 116, 124)', 'Zaitsev’s rule (pp. 116, 124)'),
        )}
      />
      {tab === 'compare' && CMP5 && <CompareChart cmp={CMP5} />}
      {tab === 'alcohols' && <SeriesChart classes={CH5_SERIES} />}
      {tab === 'zaitsev' && <ZaitsevView />}
    </div>
  );
}

export function CaStage() {
  const Lz = useLocalized();
  const { tab, series } = useCaStore();
  const card = useMemo(() => caCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view derivatives">
      <Overlay
        title={CA_TITLE}
        chip={Lz(
          tab === 'compare'
            ? L(
                `Phân tử khối gần bằng nhau (tr. ${String(CMP6?.page ?? '')})`,
                `Similar molar mass (p. ${String(CMP6?.page ?? '')})`,
              )
            : tab === 'series'
              ? L('Bảng 23.1 và 24.2', 'Tables 23.1 and 24.2')
              : L('Hằng số Kₐ của Bảng 24.3', 'Kₐ of Table 24.3'),
        )}
      />
      {tab === 'compare' && CMP6 && <CompareChart cmp={CMP6} />}
      {tab === 'series' && <SeriesChart classes={CH6_SERIES} strong={series} />}
      {tab === 'acid' && <AcidChart />}
    </div>
  );
}

const HAP_TAB_NAME: Record<HapTab, LocalizedText> = {
  compare: L('So sánh nhiệt độ sôi', 'Boiling points compared'),
  alcohols: L('Dãy alcohol', 'Alcohol series'),
  zaitsev: L('Phản ứng tách', 'Elimination'),
};
const CA_TAB_NAME: Record<CaTab, LocalizedText> = {
  compare: L('So sánh nhiệt độ sôi', 'Boiling points compared'),
  series: L('Theo số C', 'By carbon count'),
  acid: L('Tính acid', 'Acidity'),
};

function Tabs<T extends string>({
  tabs,
  names,
  value,
  onPick,
}: {
  tabs: readonly T[];
  names: Record<T, LocalizedText>;
  value: T;
  onPick: (t: T) => void;
}) {
  const Lz = useLocalized();
  return (
    <div className="segmented" role="radiogroup" aria-label={Lz(L('Phần bài học', 'Part'))}>
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          className="segmented__item"
          onClick={() => {
            onPick(t);
          }}
        >
          {Lz(names[t])}
        </button>
      ))}
    </div>
  );
}

export function HapPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { tab, elimination } = useHapStore();
  return (
    <div className="chem-form der-panel">
      <Tabs
        tabs={HAP_TABS}
        names={HAP_TAB_NAME}
        value={tab}
        onPick={(t) => {
          setHap({ tab: t });
        }}
      />
      {tab === 'zaitsev' && (
        <div
          className="der-panel__list"
          role="radiogroup"
          aria-label={Lz(L('Chất ban đầu', 'Starting compound'))}
        >
          {ELIMINATIONS.map((e) => (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={elimination === e.id}
              className="btn btn--ghost"
              onClick={() => {
                setHap({ elimination: e.id });
              }}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'compare' && (
        <p className="small">
          {Lz(
            L(
              'Ba chất có phân tử khối gần bằng nhau. Phân tử ethanol tạo liên kết hydrogen với nhau và với nước, nên ethanol sôi cao hơn hẳn và tan vô hạn trong nước.',
              'Three compounds of similar molar mass. Ethanol molecules form hydrogen bonds with each other and with water, so ethanol boils far higher and mixes with water in all proportions.',
            ),
          )}
        </p>
      )}
      {tab === 'alcohols' && (
        <p className="small">
          {Lz(
            L(
              'Dãy alcohol no, đơn chức, mạch hở: nhiệt độ sôi tăng theo số C; từ C3 đến C5 độ tan giảm vì gốc hydrocarbon kị nước lớn dần (câu hỏi 4, tr. 123). Chấm rỗng: ethylene glycol, glycerol và phenol.',
              'Saturated monohydric open-chain alcohols: the boiling point rises with the carbon count; from C3 to C5 the solubility falls as the water-repelling hydrocarbon part grows (question 4, p. 123). Hollow dots: ethylene glycol, glycerol and phenol.',
            ),
          )}
        </p>
      )}
      <table className="der-table">
        <caption>
          {Lz(L('Năng lượng liên kết C–X (tr. 114)', 'C–X bond energies (p. 114)'))}
        </caption>
        <tbody>
          {BONDS.map((b) => (
            <tr key={b.bond}>
              <th scope="row">{b.bond}</th>
              <td className="mono">{n(b.energy_kJ, 0)} kJ/mol</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">
        {Lz(
          L(
            'Năng lượng liên kết giảm từ C–F đến C–I: liên kết C–I dễ bị phân cắt nhất.',
            'The bond energy falls from C–F to C–I: the C–I bond breaks most easily.',
          ),
        )}
      </p>
    </div>
  );
}

const SERIES_NAME: Record<CaSeries, LocalizedText> = {
  aldehyde: L('Aldehyde', 'Aldehydes'),
  ketone: L('Ketone', 'Ketones'),
  acid: L('Carboxylic acid', 'Carboxylic acids'),
};

export function CaPanel() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const { tab, series, acid, C } = useCaStore();
  const sel = ACIDS.find((a) => a.formula === acid);
  const r = sel ? weakAcid(sel.Ka, C) : null;
  const lgC = Math.log10(C);
  return (
    <div className="chem-form der-panel">
      <Tabs
        tabs={CA_TABS}
        names={CA_TAB_NAME}
        value={tab}
        onPick={(t) => {
          setCa({ tab: t });
        }}
      />
      {tab === 'compare' && (
        <p className="small">
          {Lz(
            L(
              'Bốn chất có phân tử khối gần bằng nhau. Aldehyde phân cực nên sôi cao hơn alkane; alcohol tạo liên kết hydrogen; carboxylic acid tạo liên kết hydrogen bền hơn (dạng dimer), nên sôi cao nhất.',
              'Four compounds of similar molar mass. The aldehyde is polar, so it boils above the alkane; the alcohol forms hydrogen bonds; the carboxylic acid forms stronger ones (dimers), so it boils highest.',
            ),
          )}
        </p>
      )}
      {tab === 'series' && (
        <div className="der-panel__list" role="radiogroup" aria-label={Lz(L('Dãy chất', 'Series'))}>
          {CA_SERIES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={series === s}
              className="btn btn--ghost"
              onClick={() => {
                setCa({ series: s });
              }}
            >
              {Lz(SERIES_NAME[s])}
            </button>
          ))}
        </div>
      )}
      {tab === 'acid' && (
        <>
          <div className="der-panel__list" role="radiogroup" aria-label={Lz(L('Acid', 'Acid'))}>
            {ACIDS.map((a) => (
              <button
                key={a.formula}
                type="button"
                role="radio"
                aria-checked={acid === a.formula}
                className="btn btn--ghost mono"
                onClick={() => {
                  setCa({ acid: a.formula });
                }}
              >
                {formatFormula(a.formula)}
              </button>
            ))}
          </div>
          <label className="der-panel__range">
            <span>
              {Lz(L('Nồng độ C', 'Concentration C'))}:{' '}
              <strong className="mono">{sci(locale, C)} M</strong>
            </span>
            <input
              type="range"
              min={Math.log10(C_MIN)}
              max={Math.log10(C_MAX)}
              step={0.05}
              value={lgC}
              aria-label={Lz(L('Nồng độ C (thang log)', 'Concentration C (log scale)'))}
              onChange={(e) => {
                const v = 10 ** Number(e.target.value);
                // Snap to the book's 0,1 M when the slider passes it.
                setCa({ C: Math.abs(Math.log10(v) + 1) < 0.026 ? 0.1 : Number(v.toPrecision(2)) });
              }}
            />
          </label>
          {sel && r && (
            <dl className="der-facts">
              <dt>Kₐ</dt>
              <dd className="mono">{sci(locale, sel.Ka)}</dd>
              <dt>{Lz(L('Phần trăm phân li', 'Percent dissociated'))}</dt>
              <dd className="mono">{n(100 * r.alpha, 2)} %</dd>
              <dt>[H⁺]</dt>
              <dd className="mono">{sci(locale, r.h)} M</dd>
              <dt>pH</dt>
              <dd className="mono">{n(r.pH, 2)}</dd>
            </dl>
          )}
          {sel && C === 0.1 && r && (
            <p className="small">
              {Lz(
                L(
                  `Bảng 24.3 ghi ${n(sel.percent_01M)} % ở 0,1 M; SimLab tính từ Kₐ được ${n(100 * r.alpha, 2)} %.`,
                  `Table 24.3 prints ${n(sel.percent_01M)} % at 0.1 M; SimLab computes ${n(100 * r.alpha, 2)} % from Kₐ.`,
                ),
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CompoundTable({ caption, rows }: { caption: LocalizedText; rows: readonly Compound[] }) {
  const Lz = useLocalized();
  const { n } = useFmt();
  const solText = useSolubilityText();
  const t = rows[0]?.solubility_T_C ?? 20;
  return (
    <table className="der-table">
      <caption>{Lz(caption)}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Chất', 'Compound'))}</th>
          <th scope="col">{Lz(L('Công thức', 'Formula'))}</th>
          {rows.some((r) => r.mp_C !== null) && <th scope="col">t°nc (°C)</th>}
          <th scope="col">t°s (°C)</th>
          <th scope="col">
            {Lz(
              L(
                `Độ tan (g/100 g nước, ${String(t)} °C)`,
                `Solubility (g/100 g water, ${String(t)} °C)`,
              ),
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row">{r.name}</th>
            <td className="mono">{formatFormula(r.formula)}</td>
            {rows.some((x) => x.mp_C !== null) && (
              <td className="mono">{r.mp_C === null ? '—' : n(r.mp_C)}</td>
            )}
            <td className="mono">{n(r.bp_C)}</td>
            <td className="mono">{solText(r.solubility)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CLASS_GROUP: Record<string, LocalizedText> = {
  halide: L('Dẫn xuất halogen', 'Halogen derivatives'),
  alcohol: L('Alcohol', 'Alcohols'),
  phenol: L('Phenol', 'Phenol'),
  carbonyl: L('Hợp chất carbonyl', 'Carbonyl compounds'),
  acid: L('Carboxylic acid', 'Carboxylic acids'),
};

function ReactionTable({ chapter }: { chapter: 5 | 6 }) {
  const Lz = useLocalized();
  const { n } = useFmt();
  const rows = DER_REACTIONS.filter((r) => r.chapter === chapter);
  const groups = [...new Set(rows.map((r) => r.class))];
  return (
    <table className="der-table">
      <caption>{Lz(L('Phản ứng trong SGK', 'Reactions in the textbook'))}</caption>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g}>
            <tr>
              <th scope="rowgroup" colSpan={5} className="der-table__group">
                {Lz(CLASS_GROUP[g] ?? L(g, g))}
              </th>
            </tr>
            {rows
              .filter((r) => r.class === g)
              .map((r) => (
                <tr key={`${String(r.page)}-${side(r.reactants)}`}>
                  <th scope="row">{chem(Lz(r.kind))}</th>
                  <td className="mono">
                    {side(r.reactants)} {r.reversible ? '⇌' : '→'} {side(r.products)}
                    {r.note && <div className="der-table__note">{chem(Lz(r.note))}</div>}
                  </td>
                  <td>{chem(Lz(r.conditions))}</td>
                  <td className="mono">{r.dH_kJ === null ? '' : `ΔᵣH° = ${n(r.dH_kJ, 0)} kJ`}</td>
                  <td className="muted small">tr. {r.page}</td>
                </tr>
              ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function HapBottom() {
  return (
    <div className="der-tables">
      <CompoundTable
        caption={L('Bảng 20.3 và phenol (tr. 123, 130)', 'Table 20.3 and phenol (pp. 123, 130)')}
        rows={COMPOUNDS.filter((c) => c.class === 'alcohol' || c.class === 'phenol')}
      />
      <ReactionTable chapter={5} />
    </div>
  );
}

export function CaBottom() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const series = useCaStore((s) => s.series);
  const carbonyl = series !== 'acid';
  return (
    <div className="der-tables">
      <CompoundTable
        caption={
          carbonyl
            ? L('Bảng 23.1 (tr. 139)', 'Table 23.1 (p. 139)')
            : L('Bảng 24.2 (tr. 148)', 'Table 24.2 (p. 148)')
        }
        rows={COMPOUNDS.filter((c) =>
          carbonyl ? c.class === 'aldehyde' || c.class === 'ketone' : c.class === 'acid',
        )}
      />
      <table className="der-table">
        <caption>{Lz(L('Bảng 24.3 (tr. 148)', 'Table 24.3 (p. 148)'))}</caption>
        <thead>
          <tr>
            <th scope="col">Acid</th>
            <th scope="col">Kₐ</th>
            <th scope="col">{Lz(L('% phân li ở 0,1 M (SGK)', '% dissociated at 0.1 M (book)'))}</th>
            <th scope="col">{Lz(L('Tính từ Kₐ', 'From Kₐ'))}</th>
          </tr>
        </thead>
        <tbody>
          {ACIDS.map((a) => (
            <tr key={a.formula}>
              <th scope="row" className="mono">
                {formatFormula(a.formula)}
              </th>
              <td className="mono">{sci(locale, a.Ka)}</td>
              <td className="mono">{n(a.percent_01M)}</td>
              <td className="mono">{n(100 * weakAcid(a.Ka, 0.1).alpha, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReactionTable chapter={6} />
    </div>
  );
}
