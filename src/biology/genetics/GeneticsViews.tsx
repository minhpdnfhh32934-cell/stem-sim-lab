import { Dices } from 'lucide-react';
import { useMemo } from 'react';
import { create } from 'zustand';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { ScienceCardData } from '@/science-card/types';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { XYChart } from '@/ui/charts/XYChart';
import { cx } from '@/ui/cx';
import { BSRC, L, usePublishCard } from '../common';
import { useFmt } from '../fmt';
import { cross, ratio, sampleOffspring, type Dominance, type Locus } from './mendel';
import {
  expectedHeterozygosity,
  hardyWeinberg,
  randomMating,
  testHardyWeinberg,
  wrightFisher,
} from './population';
import { chiSquare, rng } from './stats';
import '../bio.css';

/* ───────────────────────────── Mendel ───────────────────────────── */

interface MendelState {
  loci: 1 | 2;
  dominance: [Dominance, Dominance];
  p1: string;
  p2: string;
  n: number;
  seed: number;
  ran: boolean;
}

const useMendel = create<MendelState>()(() => ({
  loci: 2,
  dominance: ['complete', 'complete'],
  p1: 'AaBb',
  p2: 'AaBb',
  n: 1000,
  seed: 1,
  ran: false,
}));

const LETTERS = ['A', 'B'];

function lociOf(st: MendelState): Locus[] {
  return LETTERS.slice(0, st.loci).map((letter, i) => ({
    letter,
    dominance: st.dominance[i] ?? 'complete',
  }));
}

function genotypeOptions(loci: Locus[]): string[] {
  let out = [''];
  for (const l of loci) {
    const u = l.letter;
    const d = u.toLowerCase();
    out = out.flatMap((g) => [g + u + u, g + u + d, g + d + d]);
  }
  return out;
}

const MENDEL_CARD: ScienceCardData = {
  title: L('Di truyền Mendel', 'Mendelian genetics'),
  model: L(
    'Các gen phân li độc lập (không liên kết), giao tử có xác suất bằng nhau; tỉ lệ kiểu gen, kiểu hình tính chính xác bằng phân số. Mô phỏng Monte Carlo tạo ngẫu nhiên con lai và so sánh bằng kiểm định χ².',
    'Independently assorting genes (no linkage) and equally likely gametes; genotype/phenotype ratios are exact fractions. A Monte Carlo run draws random offspring and compares with a χ² test.',
  ),
  equations: [{ tex: '\\chi^2 = \\sum \\dfrac{(O - E)^2}{E},\\quad df = k - 1' }],
  assumptions: [
    L(
      'Trội hoàn toàn hoặc trội không hoàn toàn; không đột biến, không gây chết.',
      'Complete or incomplete dominance; no mutation or lethality.',
    ),
    L('Các cặp gen nằm trên các cặp NST khác nhau.', 'Genes on different chromosome pairs.'),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Test tự động: 3 : 1, 1 : 1, 9 : 3 : 3 : 1, 1 : 2 : 1; χ² tới hạn 3,841 / 5,991 / 7,815 ở α = 0,05.',
    'Automated tests: 3:1, 1:1, 9:3:3:1, 1:2:1; χ² critical values 3.841 / 5.991 / 7.815 at α = 0.05.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk12, BSRC.campbell],
};

export function MendelStage() {
  usePublishCard(MENDEL_CARD);
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useMendel();
  const loci = lociOf(st);
  const result = useMemo(() => {
    try {
      return cross(st.p1, st.p2, loci);
    } catch {
      return null;
    }
    // loci derives from st
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.p1, st.p2, st.loci, st.dominance]);
  if (!result) return null;
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
                  {result.punnett.cells[i]?.map((c, j) => {
                    const ph =
                      phenKeys.find(
                        (k) => result.phenotypes.has(k) && phenotypeOfCell(c, loci) === k,
                      ) ?? '';
                    return (
                      <td key={j} className={`punnett-cell punnett-cell--${hue(ph)}`}>
                        {c}
                      </td>
                    );
                  })}
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

function phenotypeOfCell(genotype: string, loci: Locus[]): string {
  return loci
    .map((l, i) => {
      const pair = genotype.slice(2 * i, 2 * i + 2);
      if (l.dominance === 'incomplete') return pair;
      return /[A-Z]/.test(pair) ? `${l.letter}_` : pair;
    })
    .join(' ');
}

function MonteCarlo() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useMendel();
  const loci = lociOf(st);
  const data = useMemo(() => {
    if (!st.ran) return null;
    try {
      const theory = cross(st.p1, st.p2, loci).phenotypes;
      const keys = [...theory.keys()].sort();
      const counts = sampleOffspring(st.p1, st.p2, loci, st.n, rng(st.seed));
      const obs = keys.map((k) => counts.get(k) ?? 0);
      const exp = keys.map((k) => (theory.get(k) ?? 0) * st.n);
      return { keys, obs, exp, test: chiSquare(obs, exp) };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.ran, st.seed, st.n, st.p1, st.p2, st.loci, st.dominance]);
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
        <Dices size={15} aria-hidden="true" />{' '}
        {Lz(L(`Tạo ngẫu nhiên ${st.n} con lai`, `Draw ${st.n} random offspring`))}
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
                <td className="num">{data.obs[i]}</td>
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
                  {data.test.p >= 0.05
                    ? Lz(L('phù hợp lí thuyết (α = 0,05)', 'consistent with theory (α = 0.05)'))
                    : Lz(L('khác lí thuyết (α = 0,05)', 'differs from theory (α = 0.05)'))}
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
              {n}
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

interface HwState {
  AA: number;
  Aa: number;
  aa: number;
  N: number;
  seed: number;
  sample: { AA: number; Aa: number; aa: number } | null;
}
const useHw = create<HwState>()(() => ({
  AA: 360,
  Aa: 480,
  aa: 160,
  N: 1000,
  seed: 1,
  sample: null,
}));

const HW_CARD: ScienceCardData = {
  title: L('Định luật Hardy–Weinberg', 'Hardy–Weinberg principle'),
  model: L(
    'Quần thể ngẫu phối, kích thước lớn, không đột biến, không chọn lọc, không di nhập gen: tần số kiểu gen đạt p², 2pq, q² sau một thế hệ.',
    'Large random-mating population, no mutation, selection or migration: genotype frequencies reach p², 2pq, q² after one generation.',
  ),
  equations: [
    { tex: 'p = \\dfrac{2N_{AA} + N_{Aa}}{2N},\\quad q = 1 - p' },
    { tex: 'p^2 + 2pq + q^2 = 1' },
    { tex: '\\chi^2 = \\sum \\dfrac{(O-E)^2}{E},\\ df = 1' },
  ],
  assumptions: [
    L('Gen có 2 alen trên NST thường.', 'One autosomal gene with two alleles.'),
    L(
      'Kiểm định χ² có df = 3 − 1 − 1 = 1 vì p được ước lượng từ số liệu.',
      'χ² has df = 3 − 1 − 1 = 1 because p is estimated from the data.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Công thức chính xác; mô phỏng ngẫu phối có sai số thống kê.',
    'Exact formulas; the random-mating run has statistical error.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk12, BSRC.hartl],
};

export function HardyWeinbergStage() {
  usePublishCard(HW_CARD);
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
      <div className="bio-grid">
        <div className="bio-chart">
          <XYChart
            x={curve.x}
            series={curve.series}
            xLabel={Lz(L('Tần số alen A (p)', 'Allele frequency p'))}
            yLabel={Lz(L('Tần số kiểu gen', 'Genotype frequency'))}
            marker={t.p}
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
            p = <strong className="mono">{f(t.p)}</strong> · q ={' '}
            <strong className="mono">{f(t.q)}</strong>
          </p>
          <p>
            χ² = <span className="mono">{f(t.test.chi2)}</span> (df = 1) · p-value ={' '}
            <span className="mono">{f(t.test.p, 3)}</span>
          </p>
          <p
            className={cx('bio-verdict', t.test.p >= 0.05 ? 'bio-verdict--ok' : 'bio-verdict--bad')}
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
          <button
            type="button"
            className="btn"
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
              {st.N}): AA {st.sample.AA} · Aa {st.sample.Aa} · aa {st.sample.aa} → χ² ={' '}
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
            useHw.setState({
              N: Math.max(10, Math.min(100000, Math.round(Number(e.target.value) || 10))),
            });
          }}
        />
      </label>
    </div>
  );
}

/* ───────────────────────────── Genetic drift ───────────────────────────── */

interface DriftState {
  N: number;
  p0: number;
  generations: number;
  runs: number;
  seed: number;
}
const useDrift = create<DriftState>()(() => ({
  N: 50,
  p0: 0.5,
  generations: 150,
  runs: 20,
  seed: 1,
}));

const DRIFT_CARD: ScienceCardData = {
  title: L('Phiêu bạt di truyền (Wright–Fisher)', 'Genetic drift (Wright–Fisher)'),
  model: L(
    'Mỗi thế hệ, 2N bản sao gen được lấy ngẫu nhiên (phân phối nhị thức) từ thế hệ trước; không chọn lọc, không đột biến.',
    'Each generation, 2N gene copies are drawn binomially from the previous one; no selection or mutation.',
  ),
  equations: [
    {
      tex: 'P_{\\text{fix}}(A) = p_0',
      label: L('Xác suất alen A được cố định', 'Fixation probability of allele A'),
    },
    { tex: 'H_t = H_0\\left(1 - \\tfrac{1}{2N}\\right)^t' },
  ],
  assumptions: [
    L(
      'Quần thể lưỡng bội kích thước N không đổi, thế hệ không gối nhau.',
      'Diploid population of constant size N, non-overlapping generations.',
    ),
  ],
  confidence: 'approx',
  confidenceNote: L(
    'Test tự động (3000 lần chạy): tỉ lệ cố định ≈ p₀ trong ±0,03; dị hợp trung bình khớp (1 − 1/2N)ᵗ.',
    'Automated test (3000 runs): fixation fraction ≈ p₀ within ±0.03; mean heterozygosity follows (1 − 1/2N)ᵗ.',
  ),
  userIntervened: false,
  sources: [BSRC.hartl, BSRC.sgk12],
};

function useDriftRuns() {
  const st = useDrift();
  return useMemo(() => {
    const rand = rng(st.seed);
    return Array.from({ length: st.runs }, () => wrightFisher(st.N, st.p0, st.generations, rand));
  }, [st.N, st.p0, st.generations, st.runs, st.seed]);
}

export function DriftStage() {
  usePublishCard(DRIFT_CARD);
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
  const fixed = runs.filter((r) => r.at(-1) === 1).length;
  const lost = runs.filter((r) => r.at(-1) === 0).length;
  return (
    <div className="bio-view">
      <canvas ref={canvasRef} className="chem-canvas" aria-label={Lz(DRIFT_CARD.title)} />
      <div className="chem-overlay">
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => {
            useDrift.setState((s) => ({ seed: s.seed + 1 }));
          }}
        >
          <Dices size={15} aria-hidden="true" /> {Lz(L('Chạy lại', 'Run again'))}
        </button>
        <span className="chem-chip">
          {Lz(L('Cố định A', 'A fixed'))}: {fixed} · {Lz(L('mất A', 'A lost'))}: {lost} ·{' '}
          {Lz(L('còn đa hình', 'still polymorphic'))}: {runs.length - fixed - lost}
        </span>
        <span className="chem-chip">
          {Lz(
            L('Lí thuyết: xác suất cố định A = p₀ = ', 'Theory: fixation probability of A = p₀ = '),
          )}
          {fmt(st.p0)}
        </span>
      </div>
    </div>
  );
}

export function DriftPanel() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useDrift();
  const range = (
    k: keyof DriftState,
    label: ReturnType<typeof L>,
    min: number,
    max: number,
    step: number,
  ) => (
    <label key={k}>
      <span>
        {Lz(label)} ({fmt(st[k], 4)})
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={st[k]}
        onChange={(e) => {
          useDrift.setState({ [k]: Number(e.target.value) });
        }}
      />
    </label>
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
        yMin={0}
        yMax={0.5}
      />
    </div>
  );
}
