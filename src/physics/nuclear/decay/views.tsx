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
import { axes, twoFrames } from '../../common/chart2d';
import { ActionRow, ChoiceGroup, LabeledNumber } from '@/ui/ModuleControls';
import { COUNTS_23_1, DOSE, EXPOSURE, ISOTOPES, isotope } from '../data';
import {
  activity,
  doseAt,
  halfLifeFrom,
  lambdaOf,
  randomDecay,
  remaining,
  toCurie,
  toSeconds,
  type TimeUnit,
} from '../decayModel';
import { L, TITLE, decayCard } from './card';
import { SOURCES, TABS, UNITS, setDecay, useDecayStore, type Tab } from './store';
import '../nuclear.css';

const Decay3DView = lazy(() => import('./Decay3DView').then((m) => ({ default: m.Decay3DView })));

const TAB_NAME: Record<Tab, LocalizedText> = {
  law: L('Định luật phóng xạ', 'Decay law'),
  random: L('Tính ngẫu nhiên', 'Randomness'),
  safety: L('An toàn phóng xạ', 'Radiation safety'),
};
const UNIT_NAME: Record<TimeUnit, LocalizedText> = {
  second: L('giây', 's'),
  day: L('ngày', 'days'),
  year: L('năm', 'years'),
};
const QUESTIONS = ['rn220', 'f18', 'o15'] as const;
type Question = (typeof QUESTIONS)[number];
const QUESTION_NAME: Record<Question, LocalizedText> = {
  rn220: L('Rn-220 (tr. 107)', 'Rn-220 (p. 107)'),
  f18: L('F-18 (tr. 109)', 'F-18 (p. 109)'),
  o15: L('O-15 (tr. 108)', 'O-15 (p. 108)'),
};
const SLICE_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-4',
  '--chart-3',
  '--chart-5',
  '--text-muted',
];

function loadQuestion(q: Question) {
  if (q === 'rn220')
    setDecay({ tab: 'law', source: 'custom', unit: 'second', T: 55, t: 110, N0: 1e6 });
  // 10⁹ Bq in 1 mL at t = 0: N₀ = H₀/λ with T = 110 min (the panel shows H₀).
  else if (q === 'f18')
    setDecay({
      tab: 'law',
      source: 'custom',
      unit: 'second',
      T: 6600,
      t: 86400,
      N0: 1e9 / lambdaOf(6600),
    });
  else setDecay({ tab: 'law', leftPct: 25, after: 244, unit: 'second', source: 'custom', T: 120 });
}

function useFmt() {
  const locale = useSettingsStore((s) => s.locale);
  return {
    locale,
    n: (v: number, d = 3) => formatNumber(locale, v, { maximumFractionDigits: d }),
  };
}

function LawView() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const { T, t, unit } = useDecayStore();
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa, fb] = twoFrames(width, height);
      const f = { ...fa, w: fb.x + fb.w - fa.x };
      const span = 5 * T;
      const a = axes(ctx, css, locale, f, [0, span], [0, 1.05], {
        x: `t (${Lz(UNIT_NAME[unit])})`,
        y: 'N/N₀',
      });
      // Hình 23.5: the halvings at T, 2T, 3T.
      ctx.strokeStyle = css('--text-muted');
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      for (let k = 1; k <= 4; k++) {
        const y = 2 ** -k;
        ctx.beginPath();
        ctx.moveTo(a.X(0), a.Y(y));
        ctx.lineTo(a.X(k * T), a.Y(y));
        ctx.lineTo(a.X(k * T), a.Y(0));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = (span * i) / 200;
        if (i === 0) ctx.moveTo(a.X(x), a.Y(remaining(x, T)));
        else ctx.lineTo(a.X(x), a.Y(remaining(x, T)));
      }
      ctx.stroke();
      const tc = Math.min(t, span);
      ctx.fillStyle = css('--chart-4');
      ctx.beginPath();
      ctx.arc(a.X(tc), a.Y(remaining(tc, T)), 6, 0, Math.PI * 2);
      ctx.fill();
    },
    false,
    [T, t, unit, locale, Lz],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Sau t = ${n(t)} ${UNIT_NAME[unit].vi}, còn lại ${n(remaining(t, T) * 100, 3)} % số hạt nhân`,
          `After t = ${n(t)} ${UNIT_NAME[unit].en}, ${n(remaining(t, T) * 100, 3)} % of the nuclei are left`,
        ),
      )}
    />
  );
}

function RandomView() {
  const Lz = useLocalized();
  const { locale } = useFmt();
  const { T, seed } = useDecayStore();
  const N0 = 200;
  const steps = 50;
  const left = useMemo(() => randomDecay(N0, T, (5 * T) / steps, steps, seed), [T, seed]);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const [fa, fb] = twoFrames(width, height);
      // Bảng 23.1: counts in each 5 s.
      const a = axes(ctx, css, locale, fb, [0, 30], [0, 4], {
        x: 't (s)',
        y: Lz(L('Số tia', 'Counts')),
      });
      ctx.fillStyle = css('--chart-2');
      COUNTS_23_1.forEach((c, k) => {
        ctx.fillRect(a.X(k * 5) + 3, a.Y(c), a.X(5) - a.X(0) - 6, a.Y(0) - a.Y(c));
      });
      // Random decay of 200 nuclei against the law.
      const span = 5 * T;
      const b = axes(ctx, css, locale, fa, [0, span], [0, N0 * 1.05], { x: 't', y: 'N' });
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = (span * i) / 200;
        if (i === 0) ctx.moveTo(b.X(x), b.Y(N0 * remaining(x, T)));
        else ctx.lineTo(b.X(x), b.Y(N0 * remaining(x, T)));
      }
      ctx.stroke();
      ctx.strokeStyle = css('--chart-4');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      left.forEach((v, k) => {
        const x0 = (span * k) / steps;
        const x1 = (span * (k + 1)) / steps;
        if (k === 0) ctx.moveTo(b.X(x0), b.Y(v));
        else ctx.lineTo(b.X(x0), b.Y(v));
        if (k < steps) ctx.lineTo(b.X(x1), b.Y(v));
      });
      ctx.stroke();
    },
    false,
    [T, left, locale, Lz],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Minh họa ngẫu nhiên: 200 hạt nhân, sau 5 chu kì còn ${left[steps] ?? 0}; Bảng 23.1: ${COUNTS_23_1.join(', ')} tia trong mỗi 5 s`,
          `Random illustration: 200 nuclei, ${left[steps] ?? 0} left after 5 half-lives; Table 23.1: ${COUNTS_23_1.join(', ')} counts in each 5 s`,
        ),
      )}
    />
  );
}

function SafetyView() {
  const Lz = useLocalized();
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      // Hình 23.10 as a ring; the legend is in the panel.
      const r = Math.min(width, height - 90) * 0.36;
      const cx = width / 2;
      const cy = 80 + r;
      let start = -Math.PI / 2;
      EXPOSURE.forEach((e, k) => {
        const end = start + (e.percent / 100) * Math.PI * 2;
        ctx.fillStyle = css(SLICE_TOKENS[k] ?? '--text-muted');
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fill();
        const mid = (start + end) / 2;
        if (e.percent >= 5) {
          ctx.fillStyle = css('--bg-panel');
          ctx.font = 'bold 14px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${e.percent} %`,
            cx + Math.cos(mid) * r * 0.65,
            cy + Math.sin(mid) * r * 0.65 + 5,
          );
        }
        start = end;
      });
    },
    false,
    [],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          `Hình 23.10: ${EXPOSURE.map((e) => `${e.name.vi} ${e.percent} %`).join(', ')}`,
          `Figure 23.10: ${EXPOSURE.map((e) => `${e.name.en} ${e.percent} %`).join(', ')}`,
        ),
      )}
    />
  );
}

export function DecayStage() {
  const Lz = useLocalized();
  const tab = useDecayStore((s) => s.tab);
  const card = useMemo(() => decayCard(), []);
  usePublishCard(card);
  const { show3d } = useShow3d('radioactivity');
  const chips = (
    <>
      <span className="chem-chip">
        <strong className="stage__hud-title">{Lz(TITLE)}</strong>
      </span>
      <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
    </>
  );
  // A sample of nuclei in space (3D on request); safety stays 2D.
  if (tab !== 'safety' && show3d)
    return (
      <Suspense fallback={<div className="chem-view nuclear" />}>
        <Decay3DView top={chips} tab={tab} />
      </Suspense>
    );
  return (
    <div className="chem-view nuclear">
      {tab === 'law' && <LawView />}
      {tab === 'random' && <RandomView />}
      {tab === 'safety' && <SafetyView />}
      {/* After the canvas, so the 3D / 2D switch is above it and can be clicked. */}
      <div className="chem-overlay">
        {chips}
        {tab !== 'safety' && <Bio3DToolbar lesson="radioactivity" />}
      </div>
    </div>
  );
}

function LawPanel() {
  const Lz = useLocalized();
  const { locale, n } = useFmt();
  const s = useDecayStore();
  const Ts = toSeconds(s.T, s.unit);
  const ts = toSeconds(s.t, s.unit);
  const left = remaining(ts, Ts);
  const H0 = activity(s.N0, Ts);
  const foundT = halfLifeFrom(s.leftPct / 100, s.after);
  return (
    <>
      <ChoiceGroup
        label={Lz(L('Đồng vị (Bảng 23.2)', 'Isotope (Table 23.2)'))}
        items={SOURCES}
        value={s.source}
        name={(id) =>
          id === 'custom' ? Lz(L('Tự nhập T', 'Type T')) : `${isotope(id).symbol}-${isotope(id).A}`
        }
        onPick={(id) => {
          setDecay({ source: id });
        }}
      />
      {s.source === 'custom' && (
        <>
          <LabeledNumber
            label={Lz(L('Chu kì bán rã T', 'Half-life T'))}
            value={s.T}
            onChange={(v) => {
              setDecay({ T: v });
            }}
          />
          <ChoiceGroup
            label={Lz(L('Đơn vị thời gian', 'Time unit'))}
            items={UNITS}
            value={s.unit}
            name={(u) => Lz(UNIT_NAME[u])}
            onPick={(u) => {
              setDecay({ unit: u });
            }}
            segmented
          />
        </>
      )}
      <LabeledNumber
        label={Lz(L(`Thời gian t (${UNIT_NAME[s.unit].vi})`, `Time t (${UNIT_NAME[s.unit].en})`))}
        value={s.t}
        min={0}
        onChange={(v) => {
          setDecay({ t: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Số hạt nhân ban đầu N₀', 'Nuclei at the start N₀'))}
        value={s.N0}
        onChange={(v) => {
          setDecay({ N0: v });
        }}
      />
      <dl className="nuclear-panel__facts">
        <dt>T</dt>
        <dd className="mono">{`${n(s.T)} ${Lz(UNIT_NAME[s.unit])}`}</dd>
        <dt>λ = ln2/T</dt>
        <dd className="mono">{`${sci(locale, lambdaOf(Ts))} s⁻¹`}</dd>
        <dt>{Lz(L('Còn lại N/N₀', 'Left N/N₀'))}</dt>
        <dd className="mono nuclear-panel__left">{`${n(left * 100, 3)} %`}</dd>
        <dt>N</dt>
        <dd className="mono">{sci(locale, s.N0 * left)}</dd>
        <dt>{Lz(L('Độ phóng xạ ban đầu H₀', 'Initial activity H₀'))}</dt>
        <dd className="mono">{`${sci(locale, H0)} Bq = ${sci(locale, toCurie(H0))} Ci`}</dd>
        <dt>{Lz(L('Độ phóng xạ lúc t', 'Activity at t'))}</dt>
        <dd className="mono">{`${sci(locale, H0 * left)} Bq`}</dd>
      </dl>
      <h4 className="nuclear-panel__head">{Lz(L('Tìm chu kì bán rã', 'Find the half-life'))}</h4>
      <LabeledNumber
        label={Lz(L('Phần còn lại (%)', 'Share left (%)'))}
        value={s.leftPct}
        onChange={(v) => {
          setDecay({ leftPct: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Sau thời gian (s)', 'After a time (s)'))}
        value={s.after}
        onChange={(v) => {
          setDecay({ after: v });
        }}
      />
      <dl className="nuclear-panel__facts">
        <dt>T</dt>
        <dd className="mono nuclear-panel__found">{`${n(foundT, 2)} s`}</dd>
      </dl>
      <ActionRow
        label={Lz(L('Câu hỏi trong sách', 'Questions in the book'))}
        items={QUESTIONS}
        name={(q) => Lz(QUESTION_NAME[q])}
        onPick={loadQuestion}
      />
    </>
  );
}

function RandomPanel() {
  const Lz = useLocalized();
  const seed = useDecayStore((s) => s.seed);
  return (
    <>
      <p className="small">
        {Lz(
          L(
            'Bên phải: số tia phóng xạ đếm được trong mỗi 5 s (Bảng 23.1) thay đổi thất thường, không đoán trước được. Bên trái: minh họa 200 hạt nhân phân rã ngẫu nhiên (đường bậc thang) so với định luật N₀·2^(−t/T) (đường trơn) của chu kì bán rã đang chọn.',
            'Right: the counts in each 5 s (Table 23.1) jump about unpredictably. Left: an illustration of 200 nuclei decaying at random (the steps) against the law N₀·2^(−t/T) (the smooth line) for the chosen half-life.',
          ),
        )}
      </p>
      <ActionRow
        label={Lz(L('Minh họa', 'Illustration'))}
        items={['again'] as const}
        name={() => Lz(L('Thử lần khác', 'Another run'))}
        onPick={() => {
          setDecay({ seed: seed + 1 });
        }}
      />
    </>
  );
}

function SafetyPanel() {
  const Lz = useLocalized();
  const { n } = useFmt();
  const { dose1, d1, d2 } = useDecayStore();
  return (
    <>
      <ul className="nuclear-legend">
        {EXPOSURE.map((e, k) => (
          <li key={e.id}>
            <span
              className="nuclear-legend__swatch"
              style={{ background: `var(${SLICE_TOKENS[k] ?? '--text-muted'})` }}
            />
            {`${Lz(e.name)}: ${e.percent} %`}
          </li>
        ))}
      </ul>
      <dl className="nuclear-panel__facts">
        <dt>{Lz(L('Liều từ nguồn thụ động', 'Dose from passive sources'))}</dt>
        <dd className="mono">{`${n(DOSE.background_mSv)} mSv/${Lz(L('năm', 'year'))}`}</dd>
        <dt>{Lz(L('Giới hạn cho mỗi người', 'Limit for everyone'))}</dt>
        <dd className="mono">{`${n(DOSE.public_mSv)} mSv/${Lz(L('năm', 'year'))}`}</dd>
        <dt>{Lz(L('Học sinh 16–18 tuổi thực hành', 'Learners aged 16–18 in practice'))}</dt>
        <dd className="mono">{`${n(DOSE.learner_16_18_mSv)} mSv/${Lz(L('năm', 'year'))}`}</dd>
        <dt>{Lz(L('Người làm việc bức xạ', 'Radiation workers'))}</dt>
        <dd className="mono">{`${n(DOSE.worker_mSv)} mSv/${Lz(L('năm', 'year'))}`}</dd>
      </dl>
      <h4 className="nuclear-panel__head">{Lz(L('Giữ khoảng cách', 'Keep your distance'))}</h4>
      <LabeledNumber
        label={Lz(L('Liều ở khoảng cách d₁ (đơn vị bất kì)', 'Dose at d₁ (any unit)'))}
        value={dose1}
        onChange={(v) => {
          setDecay({ dose1: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Khoảng cách d₁ (m)', 'Distance d₁ (m)'))}
        value={d1}
        onChange={(v) => {
          setDecay({ d1: v });
        }}
      />
      <LabeledNumber
        label={Lz(L('Khoảng cách d₂ (m)', 'Distance d₂ (m)'))}
        value={d2}
        onChange={(v) => {
          setDecay({ d2: v });
        }}
      />
      <dl className="nuclear-panel__facts">
        <dt>{Lz(L('Liều ở d₂', 'Dose at d₂'))}</dt>
        <dd className="mono nuclear-panel__dose">{n(doseAt(dose1, d1, d2), 4)}</dd>
      </dl>
      <p className="small">
        {Lz(
          L(
            'Theo Thông tư 19/2012/TT-BKHCN (sách tr. 113). Ba nguyên tắc an toàn: giữ khoảng cách đủ xa, dùng tấm chắn đủ tốt, giảm thời gian phơi nhiễm.',
            'From Circular 19/2012/TT-BKHCN (book p. 113). Three safety rules: keep far enough away, use good shielding, cut the exposure time.',
          ),
        )}
      </p>
    </>
  );
}

export function DecayPanel() {
  const Lz = useLocalized();
  const tab = useDecayStore((s) => s.tab);
  return (
    <div className="chem-form nuclear-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setDecay({ tab: t });
        }}
        segmented
      />
      {tab === 'law' && <LawPanel />}
      {tab === 'random' && <RandomPanel />}
      {tab === 'safety' && <SafetyPanel />}
    </div>
  );
}

export function DecayBottom() {
  const Lz = useLocalized();
  const { n } = useFmt();
  return (
    <table className="nuclear-table">
      <caption>
        {Lz(L('Bảng 23.2 (SGK): chu kì bán rã', 'Table 23.2 (textbook): half-lives'))}
      </caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Đồng vị phóng xạ', 'Isotope'))}</th>
          <th scope="col">T</th>
        </tr>
      </thead>
      <tbody>
        {ISOTOPES.map((i) => (
          <tr key={i.id}>
            <th scope="row">{`${Lz(i.name)} (${i.symbol}-${i.A})`}</th>
            <td className="mono">{`${n(i.half_life)} ${Lz(UNIT_NAME[i.unit])}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
