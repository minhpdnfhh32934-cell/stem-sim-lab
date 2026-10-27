import { Dices } from 'lucide-react';
import { Suspense, lazy, useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { XYChart } from '@/ui/charts/XYChart';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../common';
import { useFmt } from '../fmt';
import { cross, phenotype, ratio, type Dominance, type Locus } from './mendel';
import { CHI_VERDICT, MENDEL_CARD, drawLabel } from './mendelCard';
import { mendelDraw } from './mendelRun';
import { InvalidGenotype } from './MendelNotice';
import { Mendel3DSwitch } from './mendel3d/Mendel3DSwitch';
import { useMendel3D } from './mendel3d/store';
import {
  expectedHeterozygosity,
  hardyWeinberg,
  randomMating,
  testHardyWeinberg,
} from './population';
import { rng } from './stats';
import { LETTERS, lociOf, useDrift, useHw, useMendel, type DriftState } from './store';
import { MoreInBasic, Range } from '../ui';
import { useNo3dNotice, useNo3dReason, useShow3d } from '../view3d/support';
import { Bio3DFigure, Bio3DToolbar } from '../view3d/switch';
import { DriftChips } from './driftChips';
import { DRIFT_CARD, DRIFT_CARD_3D } from './driftCard';
import { useDrift3D } from './drift3d/store';
import { HW_CARD, HW_CARD_3D } from './hwCard';
import { useDriftRuns } from './driftData';
import '../bio.css';

// three.js and the 3D pictures load only when a 3D view is shown.
const Drift3DView = lazy(() =>
  import('./drift3d/Drift3DView').then((m) => ({ default: m.Drift3DView })),
);
const Mendel3DView = lazy(() =>
  import('./mendel3d/Mendel3DView').then((m) => ({ default: m.Mendel3DView })),
);
const HardyWeinberg3DView = lazy(() =>
  import('./hw3d/HardyWeinberg3DView').then((m) => ({ default: m.HardyWeinberg3DView })),
);

/* ───────────────────────────── Mendel ───────────────────────────── */

function genotypeOptions(loci: Locus[]): string[] {
  let out = [''];
  for (const l of loci) {
    const u = l.letter;
    const d = u.toLowerCase();
    out = out.flatMap((g) => [g + u + u, g + u + d, g + d + d]);
  }
  return out;
}

/**
 * "Di truyền Mendel": the 3D view (default) or the 2D page, by the lesson store's saved
 * `view3d`. The 2D page takes over when WebGL is missing or lost, or on the Low quality tier.
 */
export function MendelStage() {
  const view3d = useMendel((s) => s.view3d);
  const reason = useNo3dReason(useMendel3D((s) => s.webglFailed));
  const notice = useNo3dNotice(view3d, reason);
  if (view3d && !reason) {
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Mendel3DView />
      </Suspense>
    );
  }
  return <MendelPage notice={notice} />;
}

/** The 2D page: the Punnett table, the ratios and the Monte Carlo table. */
function MendelPage({ notice }: { notice: string | undefined }) {
  usePublishCard(MENDEL_CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useMendel();
  const loci = lociOf(st);
  const read = useMemo(() => {
    try {
      return { ok: true as const, result: cross(st.p1, st.p2, loci) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
    // loci derives from st
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.p1, st.p2, st.loci, st.dominance]);
  const toolbar = (
    <div className="chem-toolbar">
      <Mendel3DSwitch />
      {notice && <span className="chem-chip chem-chip--qual">{notice}</span>}
    </div>
  );
  if (!read.ok) {
    return (
      <div className="bio-scroll">
        {toolbar}
        <InvalidGenotype error={read.error} />
      </div>
    );
  }
  const { result } = read;
  const phenKeys = [...result.phenotypes.keys()].sort();
  const phenRatio = ratio(phenKeys.map((k) => result.phenotypes.get(k) ?? 0));
  const genKeys = [...result.genotypes.keys()].sort();
  const genRatio = ratio(genKeys.map((k) => result.genotypes.get(k) ?? 0));
  const hue = (ph: string) => phenKeys.indexOf(ph) % 5;
  // |v| < 1e-12 is floating-point noise (e.g. χ² of a perfect fit), shown as 0.
  const f = (v: number, d = 3) =>
    formatNumber(locale, Math.abs(v) < 1e-12 ? 0 : v, { maximumSignificantDigits: d });

  return (
    <div className="bio-scroll">
      {toolbar}
      <p className="rx-eq rx-eq--big">
        P: {st.p1} × {st.p2}
      </p>
      <div className="bio-grid">
        <div>
          <p className="econf__label">{Lz(L('Bảng Punnett', 'Punnett square'))}</p>
          <table className="punnett">
            <thead>
              <tr>
                <th scope="col">♀ \ ♂</th>
                {result.punnett.cols.map((g, j) => (
                  <th key={j} scope="col">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.punnett.rows.map((g, i) => (
                <tr key={i}>
                  <th scope="row">{g}</th>
                  {result.punnett.cells[i]?.map((c, j) => (
                    <td key={j} className={`punnett-cell punnett-cell--${hue(phenotype(c, loci))}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="econf__label">{Lz(L('Tỉ lệ kiểu gen', 'Genotype ratio'))}</p>
          <p className="mono">{genKeys.map((k, i) => `${genRatio[i] ?? 0} ${k}`).join(' : ')}</p>
          <p className="econf__label">{Lz(L('Tỉ lệ kiểu hình', 'Phenotype ratio'))}</p>
          <ul className="mendel-list">
            {phenKeys.map((k, i) => (
              <li key={k}>
                <span className={`punnett-cell punnett-cell--${hue(k)} mendel-swatch`} />{' '}
                <span className="mono">{k}</span>: <strong>{phenRatio[i]}</strong> (
                {f((result.phenotypes.get(k) ?? 0) * 100, 4)} %)
              </li>
            ))}
          </ul>
          <p className="small muted">
            {Lz(L('Tỉ lệ rút gọn: ', 'Reduced ratio: '))}
            <strong className="mono">{phenRatio.join(' : ')}</strong>
          </p>
        </div>
      </div>
      <MonteCarlo />
    </div>
  );
}

function MonteCarlo() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useMendel();
  // The same draw as the 3D offspring field (same function, same seed).
  const data = useMemo(
    () => mendelDraw(st),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st.ran, st.seed, st.n, st.p1, st.p2, st.loci, st.dominance],
  );
  // |v| < 1e-12 is floating-point noise (e.g. χ² of a perfect fit), shown as 0.
  const f = (v: number, d = 3) =>
    formatNumber(locale, Math.abs(v) < 1e-12 ? 0 : v, { maximumSignificantDigits: d });
  return (
    <section className="mendel-mc">
      <p className="econf__label">{Lz(L('Mô phỏng Monte Carlo', 'Monte Carlo simulation'))}</p>
      <button
        type="button"
        className="btn btn--accent"
        onClick={() => {
          useMendel.setState((s) => ({ ran: true, seed: s.seed + 1 }));
        }}
      >
        <Dices size={15} aria-hidden="true" /> {Lz(drawLabel(formatNumber(locale, st.n)))}
      </button>
      {data && (
        <table className="chem-table">
          <thead>
            <tr>
              <th scope="col">{Lz(L('Kiểu hình', 'Phenotype'))}</th>
              <th scope="col" className="num">
                {Lz(L('Quan sát O', 'Observed O'))}
              </th>
              <th scope="col" className="num">
                {Lz(L('Kì vọng E', 'Expected E'))}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.keys.map((k, i) => (
              <tr key={k}>
                <th scope="row" className="mono">
                  {k}
                </th>
                <td className="num">{formatNumber(locale, data.obs[i] ?? 0)}</td>
                <td className="num">{f(data.exp[i] ?? 0, 5)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">χ² (df = {data.test.df})</th>
              <td className="num" colSpan={2}>
                {f(data.test.chi2, 4)} · p = {f(data.test.p, 3)}{' '}
                <span
                  className={cx(
                    'bio-verdict',
                    data.test.p >= 0.05 ? 'bio-verdict--ok' : 'bio-verdict--bad',
                  )}
                >
                  {Lz(data.test.p >= 0.05 ? CHI_VERDICT.ok : CHI_VERDICT.bad)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

export function MendelPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useMendel();
  const options = genotypeOptions(lociOf(st));
  return (
    <div className="chem-form">
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Số cặp tính trạng', 'Number of traits'))}
      >
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={st.loci === n}
            className="segmented__item"
            onClick={() => {
              useMendel.setState({
                loci: n,
                p1: n === 1 ? 'Aa' : 'AaBb',
                p2: n === 1 ? 'Aa' : 'AaBb',
                ran: false,
              });
            }}
          >
            {Lz(
              L(
                n === 1 ? 'Lai 1 cặp tính trạng' : 'Lai 2 cặp tính trạng',
                n === 1 ? 'Monohybrid' : 'Dihybrid',
              ),
            )}
          </button>
        ))}
      </div>
      {(['p1', 'p2'] as const).map((k, i) => (
        <label key={k}>
          <span>
            {Lz(L(i === 0 ? 'Cây/con mẹ ♀' : 'Cây/con bố ♂', i === 0 ? 'Mother ♀' : 'Father ♂'))}
          </span>
          <select
            value={st[k]}
            onChange={(e) => {
              useMendel.setState({ [k]: e.target.value, ran: false });
            }}
          >
            {options.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      ))}
      {/* Basic: complete dominance (the textbook case) unless the learner changed it. */}
      <MoreInBasic
        count={st.loci}
        changed={st.dominance.slice(0, st.loci).some((d) => d !== 'complete')}
      >
        {LETTERS.slice(0, st.loci).map((letter, i) => (
          <label key={letter}>
            <span>
              {Lz(L('Gen', 'Gene'))} {letter}/{letter.toLowerCase()}
            </span>
            <select
              value={st.dominance[i]}
              onChange={(e) => {
                const d = [...st.dominance] as [Dominance, Dominance];
                d[i] = e.target.value as Dominance;
                useMendel.setState({ dominance: d, ran: false });
              }}
            >
              <option value="complete">{Lz(L('Trội hoàn toàn', 'Complete dominance'))}</option>
              <option value="incomplete">
                {Lz(L('Trội không hoàn toàn', 'Incomplete dominance'))}
              </option>
            </select>
          </label>
        ))}
      </MoreInBasic>
      <label>
        <span>{Lz(L('Số con lai (Monte Carlo)', 'Offspring (Monte Carlo)'))}</span>
        <select
          value={st.n}
          onChange={(e) => {
            useMendel.setState({ n: Number(e.target.value), ran: false });
          }}
        >
          {[16, 100, 1000, 10000].map((n) => (
            <option key={n} value={n}>
              {formatNumber(locale, n)}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">
        {Lz(
          L(
            'Với số con lai ít (16), tỉ lệ quan sát thường lệch xa lí thuyết — đó là dao động ngẫu nhiên, không phải sai.',
            'With few offspring (16) the observed ratio often deviates — that is random variation, not an error.',
          ),
        )}
      </p>
    </div>
  );
}

/* ─────────────────────────── Hardy–Weinberg ─────────────────────────── */

/**
 * An empty population (AA = Aa = aa = 0): no gene pool, so no p, q (shown as "—": the model's
 * p = 0 is a guard against 0 / 0), no verdict and no mating.
 */
const HW_EMPTY = L(
  'Chưa có cá thể nào: nhập số cá thể AA, Aa, aa để có vốn gen rồi mới tính p, q và ngẫu phối được.',
  'No individuals yet: enter the numbers of AA, Aa and aa to have a gene pool before p, q and random mating.',
);

export function HardyWeinbergStage() {
  // The 3D habitat adds its notes to the card while it is on screen.
  usePublishCard(useShow3d('hardyWeinberg').show3d ? HW_CARD_3D : HW_CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useHw();
  const t = testHardyWeinberg(st.AA, st.Aa, st.aa);
  // |v| < 1e-12 is floating-point noise (e.g. χ² of a perfect fit), shown as 0.
  const f = (v: number, d = 4) =>
    formatNumber(locale, Math.abs(v) < 1e-12 ? 0 : v, { maximumSignificantDigits: d });
  const curve = useMemo(() => {
    const x = Array.from({ length: 101 }, (_, i) => i / 100);
    return {
      x,
      series: [
        { label: 'AA = p²', y: x.map((p) => hardyWeinberg(p).AA) },
        { label: 'Aa = 2pq', y: x.map((p) => hardyWeinberg(p).Aa) },
        { label: 'aa = q²', y: x.map((p) => hardyWeinberg(p).aa) },
      ],
    };
  }, []);
  return (
    <div className="bio-scroll">
      <Bio3DFigure lesson="hardyWeinberg" figure={<HardyWeinberg3DView />} />
      <div className="bio-grid">
        <div className="bio-chart">
          <XYChart
            x={curve.x}
            series={curve.series}
            xLabel={Lz(L('Tần số alen A (p)', 'Allele frequency p'))}
            yLabel={Lz(L('Tần số kiểu gen', 'Genotype frequency'))}
            {...(t.n > 0 ? { marker: t.p } : {})}
            yMin={0}
            yMax={1}
          />
        </div>
        <div>
          <table className="chem-table">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="num">
                  AA
                </th>
                <th scope="col" className="num">
                  Aa
                </th>
                <th scope="col" className="num">
                  aa
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{Lz(L('Quan sát', 'Observed'))}</th>
                <td className="num">{st.AA}</td>
                <td className="num">{st.Aa}</td>
                <td className="num">{st.aa}</td>
              </tr>
              <tr>
                <th scope="row">{Lz(L('Kì vọng (H–W)', 'Expected (H–W)'))}</th>
                {t.expected.map((e, i) => (
                  <td key={i} className="num">
                    {f(e)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p>
            p = <strong className="mono">{t.n > 0 ? f(t.p) : '—'}</strong> · q ={' '}
            <strong className="mono">{t.n > 0 ? f(t.q) : '—'}</strong>
          </p>
          <p>
            χ² = <span className="mono">{t.n > 0 ? f(t.test.chi2) : '—'}</span> (df = 1) · p-value ={' '}
            <span className="mono">{t.n > 0 ? f(t.test.p, 3) : '—'}</span>
          </p>
          {t.n === 0 ? (
            <p className="bio-verdict">{Lz(HW_EMPTY)}</p>
          ) : (
            <p
              className={cx(
                'bio-verdict',
                t.test.p >= 0.05 ? 'bio-verdict--ok' : 'bio-verdict--bad',
              )}
            >
              {t.test.p >= 0.05
                ? Lz(
                    L(
                      'Quần thể phù hợp trạng thái cân bằng Hardy–Weinberg (α = 0,05).',
                      'Consistent with Hardy–Weinberg equilibrium (α = 0.05).',
                    ),
                  )
                : Lz(
                    L(
                      'Quần thể KHÔNG ở trạng thái cân bằng Hardy–Weinberg (α = 0,05).',
                      'NOT in Hardy–Weinberg equilibrium (α = 0.05).',
                    ),
                  )}
            </p>
          )}
          <button
            type="button"
            className="btn"
            // No individuals, no gene pool: there is nothing to mate.
            disabled={t.n === 0}
            onClick={() => {
              useHw.setState((s) => ({
                seed: s.seed + 1,
                sample: randomMating(s.N, t.p, rng(s.seed + 1)),
              }));
            }}
          >
            <Dices size={15} aria-hidden="true" />{' '}
            {Lz(L('Cho ngẫu phối 1 thế hệ', 'Random mating for one generation'))}
          </button>
          {st.sample && (
            <p className="small">
              {Lz(L('Thế hệ sau (mô phỏng, N = ', 'Next generation (simulated, N = '))}
              {formatNumber(locale, st.N)}): AA {formatNumber(locale, st.sample.AA)} · Aa{' '}
              {formatNumber(locale, st.sample.Aa)} · aa {formatNumber(locale, st.sample.aa)} → χ² ={' '}
              {f(testHardyWeinberg(st.sample.AA, st.sample.Aa, st.sample.aa).test.chi2, 3)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function HardyWeinbergPanel() {
  const Lz = useLocalized();
  const st = useHw();
  const field = (k: 'AA' | 'Aa' | 'aa') => (
    <label key={k}>
      <span>
        {Lz(L('Số cá thể', 'Individuals'))} {k}
      </span>
      <input
        type="number"
        min={0}
        value={st[k]}
        onChange={(e) => {
          useHw.setState({
            [k]: Math.max(0, Math.round(Number(e.target.value) || 0)),
            sample: null,
          });
        }}
      />
    </label>
  );
  return (
    <div className="chem-form">
      {field('AA')}
      {field('Aa')}
      {field('aa')}
      <label>
        <span>{Lz(L('N khi mô phỏng ngẫu phối', 'N for random mating'))}</span>
        <input
          type="number"
          min={10}
          max={100000}
          value={st.N}
          onChange={(e) => {
            // A sample drawn with another N no longer belongs to these inputs.
            useHw.setState({
              N: Math.max(10, Math.min(100000, Math.round(Number(e.target.value) || 10))),
              sample: null,
            });
          }}
        />
      </label>
    </div>
  );
}

/* ───────────────────────────── Genetic drift ───────────────────────────── */

export function DriftStage() {
  const { show3d } = useShow3d('drift');
  // The 3D archipelago adds its notes to the card while it is on screen.
  usePublishCard(show3d ? DRIFT_CARD_3D : DRIFT_CARD);
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Drift3DView />
      </Suspense>
    );
  return <Drift2D />;
}

function Drift2D() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const runs = useDriftRuns();
  const st = useDrift();
  const canvasRef = useCanvas(
    ({ ctx, width, height, css }) => {
      const x0 = 56;
      const y0 = 64;
      const w = width - x0 - 20;
      const h = height - y0 - 50;
      ctx.strokeStyle = css('--border-strong');
      ctx.strokeRect(x0, y0, w, h);
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px sans-serif';
      for (const v of [0, 0.5, 1]) {
        const y = y0 + h * (1 - v);
        ctx.fillText(fmt(v), x0 - 28, y + 4);
        ctx.strokeStyle = css('--stage-grid-major');
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + w, y);
        ctx.stroke();
      }
      ctx.fillText(Lz(L('thế hệ', 'generation')), x0 + w - 60, y0 + h + 30);
      ctx.fillText('0', x0, y0 + h + 16);
      ctx.fillText(String(st.generations), x0 + w - 20, y0 + h + 16);
      ctx.save();
      ctx.translate(16, y0 + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(Lz(L('tần số alen A', 'frequency of A')), -40, 0);
      ctx.restore();
      ctx.lineWidth = 1.5;
      const colors = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'].map(css);
      runs.forEach((traj, k) => {
        ctx.strokeStyle = colors[k % colors.length] ?? '#888';
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        traj.forEach((p, t) => {
          const x = x0 + (t / st.generations) * w;
          const y = y0 + h * (1 - p);
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    },
    false,
    [runs, st.generations, fmt],
  );
  return (
    <div className="bio-view">
      <canvas ref={canvasRef} className="chem-canvas" aria-label={Lz(DRIFT_CARD.title)} />
      <div className="chem-overlay">
        <DriftChips />
        <Bio3DToolbar lesson="drift" />
      </div>
    </div>
  );
}

export function DriftPanel() {
  const Lz = useLocalized();
  const st = useDrift();
  // The lessons' shared slider (value in bold after the label), not a bracketed value (UI-50).
  const range = (
    k: keyof DriftState,
    label: ReturnType<typeof L>,
    min: number,
    max: number,
    step: number,
  ) => (
    <Range
      key={k}
      label={label}
      value={st[k]}
      min={min}
      max={max}
      step={step}
      digits={4}
      onChange={(v) => {
        useDrift.setState({ [k]: v });
      }}
    />
  );
  return (
    <div className="chem-form">
      {range('N', L('Kích thước quần thể N', 'Population size N'), 5, 500, 5)}
      {range('p0', L('Tần số ban đầu p₀', 'Initial frequency p₀'), 0.05, 0.95, 0.05)}
      {range('generations', L('Số thế hệ', 'Generations'), 20, 500, 10)}
      {range('runs', L('Số quần thể', 'Populations'), 1, 30, 1)}
      <p className="small muted">
        {Lz(
          L(
            'Quần thể càng nhỏ, phiêu bạt càng mạnh: alen bị cố định hoặc mất nhanh hơn.',
            'The smaller the population, the stronger the drift: alleles fix or disappear faster.',
          ),
        )}
      </p>
    </div>
  );
}

export function DriftBottom() {
  const Lz = useLocalized();
  const runs = useDriftRuns();
  const st = useDrift();
  // The generation the 3D archipelago shows (marked on the chart while it is on screen).
  const shown = useDrift3D((s) => (s.active ? s.t : null));
  const data = useMemo(() => {
    const x = Array.from({ length: st.generations + 1 }, (_, t) => t);
    const mean = x.map(
      (t) =>
        runs.reduce((s, r) => s + 2 * (r[t] ?? 0) * (1 - (r[t] ?? 0)), 0) /
        Math.max(1, runs.length),
    );
    const h0 = 2 * st.p0 * (1 - st.p0);
    return {
      x,
      series: [
        { label: Lz(L('H trung bình (mô phỏng)', 'Mean H (simulated)')), y: mean },
        {
          label: Lz(L('Lí thuyết H₀(1 − 1/2N)ᵗ', 'Theory H₀(1 − 1/2N)ᵗ')),
          y: x.map((t) => expectedHeterozygosity(h0, st.N, t)),
          dash: true,
          color: 3,
        },
      ],
    };
  }, [runs, st.generations, st.p0, st.N, Lz]);
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={data.x}
        series={data.series}
        xLabel={Lz(L('Thế hệ', 'Generation'))}
        yLabel="H = 2pq"
        marker={shown}
        yMin={0}
        yMax={0.5}
      />
    </div>
  );
}
