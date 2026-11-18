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
import { axes, dot, twoFrames } from '../../common/chart2d';
import { ChoiceGroup, LabeledNumber } from '@/ui/ModuleControls';
import { BOOK_MASSES, FUSION_DD_MEV, PARTICLES, TABLE_21_1 } from '../data';
import {
  AMU_MEV,
  BOOK_REACTIONS,
  binding,
  fissionEnergy,
  missing,
  radius,
  symbolOf,
  totals,
  type Particle,
} from '../nucleusModel';
import { L, TITLE, nucleusCard } from './card';
import { REACTIONS, TABS, setNucleus, useNucleusStore, type Tab } from './store';
import '../nuclear.css';

const Nucleus3DView = lazy(() =>
  import('./Nucleus3DView').then((m) => ({ default: m.Nucleus3DView })),
);

const TAB_NAME: Record<Tab, LocalizedText> = {
  structure: L('Cấu tạo hạt nhân', 'Structure'),
  reactions: L('Phản ứng hạt nhân', 'Nuclear reactions'),
  binding: L('Năng lượng liên kết', 'Binding energy'),
};
const REACTION_NAME: Record<string, LocalizedText> = {
  rutherford: L('Rutherford, Blackett (tr. 96)', 'Rutherford, Blackett (p. 96)'),
  'uranium-alpha': L('²³⁸U phóng xạ (tr. 97)', '²³⁸U decay (p. 97)'),
  fission: L('Phân hạch ²³⁵U (tr. 100)', '²³⁵U fission (p. 100)'),
  fusion: L('Tổng hợp ²H + ²H (tr. 102)', '²H + ²H fusion (p. 102)'),
  question: L('Câu hỏi tr. 97: tìm X, Y', 'Question p. 97: find X, Y'),
};

const SUP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};
const SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '-': '₋',
};
const up = (n: number) => String(n).replace(/[-0-9]/g, (c) => SUP[c] ?? c);
const down = (n: number) => String(n).replace(/[-0-9]/g, (c) => SUB[c] ?? c);
/** ᴬ_Z X written with super/subscript digits, e.g. ²³⁵₉₂U; several as "3 ¹₀n". */
const nuclide = (p: Particle, symbol = symbolOf(p)) =>
  `${(p.count ?? 1) > 1 ? `${p.count} ` : ''}${up(p.A)}${down(p.Z)}${symbol}`;
const side = (ps: readonly Particle[]) => ps.map((p) => nuclide(p)).join(' + ');

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 3) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}

function StructureView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const symbol = useNucleusStore((s) => s.symbol);
  const row = TABLE_21_1.find((r) => r.symbol === symbol) ?? TABLE_21_1[0];
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa, fb] = twoFrames(width, height);
      const f = { ...fa, w: fb.x + fb.w - fa.x };
      const a = axes(
        ctx,
        css,
        locale,
        f,
        [0, 250],
        [0, 8e-15],
        { x: 'A', y: 'R (10⁻¹⁵ m)' },
        1,
        1e15,
      );
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let A = 1; A <= 250; A++) {
        if (A === 1) ctx.moveTo(a.X(A), a.Y(radius(A)));
        else ctx.lineTo(a.X(A), a.Y(radius(A)));
      }
      ctx.stroke();
      for (const r of TABLE_21_1) {
        const on = r.symbol === symbol;
        dot(ctx, a.X(r.A), a.Y(r.nucleus_radius), css(on ? '--chart-4' : '--chart-1'), r.symbol);
      }
      ctx.fillStyle = css('--accent');
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        Lz(L('R = 1,2·10⁻¹⁵·A^(1/3) m', 'R = 1.2·10⁻¹⁵·A^(1/3) m')),
        a.X(240),
        a.Y(radius(240)) - 12,
      );
    },
    false,
    [symbol, locale, Lz],
  );
  if (!row) return null;
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Bán kính hạt nhân ${row.symbol} (A = ${row.A}): Bảng 21.1 ${n(row.nucleus_radius * 1e15, 1)}·10⁻¹⁵ m, công thức ${n(radius(row.A) * 1e15, 2)}·10⁻¹⁵ m`,
          `Radius of the ${row.symbol} nucleus (A = ${row.A}): Table 21.1 ${n(row.nucleus_radius * 1e15, 1)}·10⁻¹⁵ m, formula ${n(radius(row.A) * 1e15, 2)}·10⁻¹⁵ m`,
        ),
      )}
    />
  );
}

/** The reaction (or the question's two steps) with its sums of A and Z. */
function reactionLines(id: string): { text: string; sums: ReturnType<typeof totals> }[] {
  if (id === 'question') {
    const X = missing(
      [
        { A: 1, Z: 0 },
        { A: 235, Z: 92 },
      ],
      [],
    );
    const Y = missing(
      [X],
      [
        { A: 99, Z: 42 },
        { A: 1, Z: 0, count: 3 },
      ],
    );
    const r1 = {
      id: 'q1',
      left: [
        { A: 1, Z: 0 },
        { A: 235, Z: 92 },
      ],
      right: [X],
    };
    const r2 = { id: 'q2', left: [X], right: [{ A: 99, Z: 42 }, { A: 1, Z: 0, count: 3 }, Y] };
    return [r1, r2].map((r) => ({ text: `${side(r.left)} → ${side(r.right)}`, sums: totals(r) }));
  }
  const r = BOOK_REACTIONS.find((x) => x.id === id);
  return r ? [{ text: `${side(r.left)} → ${side(r.right)}`, sums: totals(r) }] : [];
}

function ReactionsView() {
  const Lz = useLocalized();
  const reaction = useNucleusStore((s) => s.reaction);
  const lines = reactionLines(reaction);
  return (
    <div className="nuclear-reaction" role="img" aria-label={lines.map((l) => l.text).join('; ')}>
      {lines.map((l) => (
        <div key={l.text} className="nuclear-reaction__line">
          <p className="nuclear-reaction__eq">{l.text}</p>
          <p className="nuclear-reaction__sum">
            {Lz(
              L(
                `Số khối: ${l.sums.leftA} = ${l.sums.rightA} · Điện tích: ${l.sums.leftZ} = ${l.sums.rightZ}`,
                `Mass number: ${l.sums.leftA} = ${l.sums.rightA} · Charge: ${l.sums.leftZ} = ${l.sums.rightZ}`,
              ),
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function BindingView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const massOf = useNucleusStore((s) => s.massOf);
  const m = BOOK_MASSES.find((x) => x.symbol === massOf) ?? BOOK_MASSES[0];
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      if (!m) return;
      const parts = m.Z * PARTICLES.proton_amu + (m.A - m.Z) * PARTICLES.neutron_amu;
      const [fa] = twoFrames(width, height);
      const f = { ...fa, w: Math.min(fa.w, 420) };
      const lo = m.amu * 0.99;
      const hi = parts * 1.003;
      const a = axes(ctx, css, locale, f, [0, 3], [lo, hi], {
        x: '',
        y: Lz(L('Khối lượng (amu)', 'Mass (amu)')),
      });
      const bar = (x: number, v: number, token: string, label: string) => {
        ctx.fillStyle = css(token);
        ctx.fillRect(a.X(x) - 40, a.Y(v), 80, a.Y(lo) - a.Y(v));
        ctx.fillStyle = css('--text');
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, a.X(x), a.Y(lo) + 18);
      };
      bar(1, parts, '--chart-1', Lz(L('Các nucleon riêng lẻ', 'Separate nucleons')));
      bar(2, m.amu, '--chart-4', Lz(L('Hạt nhân', 'Nucleus')));
      ctx.strokeStyle = css('--accent');
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(a.X(1) + 40, a.Y(parts));
      ctx.lineTo(a.X(2) + 60, a.Y(parts));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css('--accent');
      ctx.textAlign = 'left';
      ctx.fillText(`Δm = ${n(parts - m.amu, 5)} amu`, a.X(2) + 48, (a.Y(parts) + a.Y(m.amu)) / 2);
    },
    false,
    [m, locale, Lz],
  );
  if (!m) return null;
  const b = binding(m.Z, m.A, m.amu);
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Hạt nhân ${m.symbol}-${m.A}: Δm = ${n(b.dm, 5)} amu, năng lượng liên kết ${n(b.E, 2)} MeV`,
          `Nucleus ${m.symbol}-${m.A}: Δm = ${n(b.dm, 5)} amu, binding energy ${n(b.E, 2)} MeV`,
        ),
      )}
    />
  );
}

export function NucleusStage() {
  const Lz = useLocalized();
  const tab = useNucleusStore((s) => s.tab);
  const card = useMemo(() => nucleusCard(), []);
  usePublishCard(card);
  const { show3d } = useShow3d('nucleus');
  const chips = (
    <>
      <span className="chem-chip">
        <strong className="stage__hud-title">{Lz(TITLE)}</strong>
      </span>
      <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
    </>
  );
  // The nucleus in space (3D on request); the reactions and the binding energy stay 2D.
  if (tab === 'structure' && show3d)
    return (
      <Suspense fallback={<div className="chem-view nuclear" />}>
        <Nucleus3DView top={chips} />
      </Suspense>
    );
  return (
    <div className="chem-view nuclear">
      {tab === 'structure' && <StructureView />}
      {tab === 'reactions' && <ReactionsView />}
      {tab === 'binding' && <BindingView />}
      {/* After the canvas, so the 3D / 2D switch is above it and can be clicked. */}
      <div className="chem-overlay">
        {chips}
        {tab === 'structure' && <Bio3DToolbar lesson="nucleus" />}
      </div>
    </div>
  );
}

function StructurePanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const symbol = useNucleusStore((s) => s.symbol);
  const row = TABLE_21_1.find((r) => r.symbol === symbol);
  if (!row) return null;
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Nguyên tố (Bảng 21.1)', 'Element (Table 21.1)'))}
        items={TABLE_21_1.map((r) => r.symbol)}
        value={symbol}
        name={(s) => Lz(TABLE_21_1.find((r) => r.symbol === s)?.name ?? L(s, s))}
        onPick={(s) => {
          setNucleus({ symbol: s });
        }}
      />
      <dl className="nuclear-panel__facts">
        <dt>{Lz(L('Kí hiệu', 'Symbol'))}</dt>
        <dd className="mono">{nuclide({ A: row.A, Z: row.Z }, row.symbol)}</dd>
        <dt>{Lz(L('Số proton Z', 'Protons Z'))}</dt>
        <dd className="mono">{row.Z}</dd>
        <dt>{Lz(L('Số neutron N = A − Z', 'Neutrons N = A − Z'))}</dt>
        <dd className="mono">{row.A - row.Z}</dd>
        <dt>{Lz(L('R theo Bảng 21.1', 'R in Table 21.1'))}</dt>
        <dd className="mono">{`${n(row.nucleus_radius * 1e15, 1)}·10⁻¹⁵ m`}</dd>
        <dt>{Lz(L('R theo công thức (21.1)', 'R by formula (21.1)'))}</dt>
        <dd className="mono nuclear-panel__radius">{`${n(radius(row.A) * 1e15, 2)}·10⁻¹⁵ m`}</dd>
        <dt>{Lz(L('Bán kính nguyên tử / hạt nhân', 'Atom / nucleus radius'))}</dt>
        <dd className="mono">{n(row.atom_radius / row.nucleus_radius, 0)}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            'Điểm: bán kính hạt nhân in trong Bảng 21.1. Đường: công thức gần đúng (21.1). Các số trong bảng nhỏ hơn công thức khoảng 10–30 %; đây là chỗ cần giáo viên xem (DATA_REVIEW).',
            'Points: the nuclear radii printed in Table 21.1. Line: the approximate formula (21.1). The table’s values are about 10–30 % below the formula; this is flagged for teacher review (DATA_REVIEW).',
          ),
        )}
      </p>
    </>
  );
}

function ReactionsPanel() {
  const Lz = useLocalized();
  const reaction = useNucleusStore((s) => s.reaction);
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Phản ứng trong sách', 'Reaction in the book'))}
        items={REACTIONS}
        value={reaction}
        name={(r) => Lz(REACTION_NAME[r] ?? L(r, r))}
        onPick={(r) => {
          setNucleus({ reaction: r });
        }}
      />
      <p className="small">
        {Lz(
          reaction === 'question'
            ? L(
                'Neutron bắn vào ²³⁵U tạo hạt nhân X, rồi X vỡ thành ⁹⁹Mo, ba neutron và hạt nhân Y. Bảo toàn số khối và điện tích cho A, Z của X và Y; tên nguyên tố tra theo Z.',
                'A neutron hits ²³⁵U and makes a nucleus X, which breaks into ⁹⁹Mo, three neutrons and a nucleus Y. Conserving A and Z gives X and Y; the element follows from Z.',
              )
            : L(
                'Tổng số nucleon (số khối) và tổng điện tích ở hai vế bằng nhau.',
                'The total number of nucleons (mass number) and the total charge are the same on both sides.',
              ),
        )}
      </p>
    </>
  );
}

function BindingPanel() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const { massOf, fuelKg } = useNucleusStore();
  const m = BOOK_MASSES.find((x) => x.symbol === massOf);
  if (!m) return null;
  const b = binding(m.Z, m.A, m.amu);
  const fuel = fissionEnergy(fuelKg);
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Hạt nhân', 'Nucleus'))}
        items={BOOK_MASSES.map((x) => x.symbol)}
        value={massOf}
        name={(s) => {
          const x = BOOK_MASSES.find((y) => y.symbol === s);
          return x ? nuclide({ A: x.A, Z: x.Z }, x.symbol) : s;
        }}
        onPick={(s) => {
          setNucleus({ massOf: s });
        }}
        segmented
      />
      <dl className="nuclear-panel__facts">
        <dt>{Lz(L('Khối lượng hạt nhân (sách)', 'Nucleus mass (book)'))}</dt>
        <dd className="mono">{`${n(m.amu, 5)} amu`}</dd>
        <dt>Δm</dt>
        <dd className="mono nuclear-panel__defect">{`${n(b.dm, 5)} amu`}</dd>
        <dt>{Lz(L('1 amu·c²', '1 amu·c²'))}</dt>
        <dd className="mono">{`${n(AMU_MEV, 1)} MeV`}</dd>
        <dt>E_lk</dt>
        <dd className="mono nuclear-panel__binding">{`${n(b.E, 2)} MeV`}</dd>
        <dt>E_lk/A</dt>
        <dd className="mono">{`${n(b.perNucleon, 2)} MeV/nucleon`}</dd>
      </dl>
      <h4 className="nuclear-panel__head">
        {Lz(L('Phân hạch ²³⁵U (câu hỏi tr. 101)', '²³⁵U fission (question p. 101)'))}
      </h4>
      <LabeledNumber
        label={Lz(L('Khối lượng ²³⁵U (kg)', 'Mass of ²³⁵U (kg)'))}
        value={fuelKg}
        onChange={(v) => {
          setNucleus({ fuelKg: v });
        }}
      />
      <dl className="nuclear-panel__facts">
        <dt>{Lz(L('Số hạt nhân', 'Nuclei'))}</dt>
        <dd className="mono">{sci(locale, fuel.nuclei)}</dd>
        <dt>{Lz(L('Năng lượng tỏa ra', 'Energy released'))}</dt>
        <dd className="mono nuclear-panel__fission">{`${sci(locale, fuel.joules)} J`}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            `Mỗi phân hạch ²³⁵U tỏa khoảng 200 MeV; phản ứng tổng hợp ²H + ²H → ³He + n tỏa khoảng ${n(FUSION_DD_MEV)} MeV (tr. 102).`,
            `Each ²³⁵U fission releases about 200 MeV; the fusion ²H + ²H → ³He + n about ${n(FUSION_DD_MEV)} MeV (p. 102).`,
          ),
        )}
      </p>
    </>
  );
}

export function NucleusPanel() {
  const Lz = useLocalized();
  const tab = useNucleusStore((s) => s.tab);
  return (
    <div className="chem-form nuclear-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setNucleus({ tab: t });
        }}
        segmented
      />
      {tab === 'structure' && <StructurePanel />}
      {tab === 'reactions' && <ReactionsPanel />}
      {tab === 'binding' && <BindingPanel />}
    </div>
  );
}

export function NucleusBottom() {
  const Lz = useLocalized();
  const { n } = useFmt();
  return (
    <table className="nuclear-table">
      <caption>
        {Lz(L('Bảng 21.1 (SGK) và công thức (21.1)', 'Table 21.1 (textbook) and formula (21.1)'))}
      </caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Nguyên tố', 'Element'))}</th>
          <th scope="col">A</th>
          <th scope="col">{Lz(L('Bán kính nguyên tử (10⁻¹⁰ m)', 'Atom radius (10⁻¹⁰ m)'))}</th>
          <th scope="col">{Lz(L('Bán kính hạt nhân (10⁻¹⁵ m)', 'Nucleus radius (10⁻¹⁵ m)'))}</th>
          <th scope="col">{Lz(L('Công thức (10⁻¹⁵ m)', 'Formula (10⁻¹⁵ m)'))}</th>
        </tr>
      </thead>
      <tbody>
        {TABLE_21_1.map((r) => (
          <tr key={r.symbol}>
            <th scope="row">{Lz(r.name)}</th>
            <td className="mono">{r.A}</td>
            <td className="mono">{n(r.atom_radius * 1e10, 1)}</td>
            <td className="mono">{n(r.nucleus_radius * 1e15, 1)}</td>
            <td className="mono">{n(radius(r.A) * 1e15, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
