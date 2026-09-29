import { useMemo } from 'react';
import { create } from 'zustand';
import { useLocalized } from '@/app/i18n/localized';
import type { ScienceCardData } from '@/science-card/types';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { XYChart } from '@/ui/charts/XYChart';
import { BSRC, L, usePublishCard } from '../common';
import { niceStep, useFmt } from '../fmt';
import { Range } from '../ui';
import { exponential, logistic, lotkaVolterra, lvEquilibrium, lvInvariant } from './ecology';
import '../bio.css';

/* ───────────────────────────── Logistic growth ───────────────────────────── */

interface LogisticState {
  N0: number;
  r: number;
  K: number;
  tEnd: number;
}

const useLogistic = create<LogisticState>()(() => ({ N0: 10, r: 0.5, K: 1000, tEnd: 30 }));

const LOGISTIC_CARD: ScienceCardData = {
  title: L('Tăng trưởng quần thể (logistic)', 'Population growth (logistic)'),
  model: L(
    'Quần thể tăng theo phương trình logistic: tốc độ tăng giảm dần khi số cá thể tiến tới sức chứa K của môi trường. Nghiệm được tính chính xác bằng công thức; đường hàm mũ (không giới hạn) vẽ để so sánh.',
    'The population follows the logistic equation: growth slows as N approaches the carrying capacity K. The curve uses the exact solution; unlimited exponential growth is drawn for comparison.',
  ),
  equations: [
    { tex: '\\dfrac{dN}{dt} = rN\\left(1 - \\dfrac{N}{K}\\right)' },
    { tex: 'N(t) = \\dfrac{K}{1 + \\left(\\dfrac{K}{N_0} - 1\\right)e^{-rt}}' },
    {
      tex: 't^{*} = \\dfrac{1}{r}\\ln\\!\\left(\\dfrac{K}{N_0} - 1\\right),\\quad \\left(\\dfrac{dN}{dt}\\right)_{\\max} = \\dfrac{rK}{4}',
    },
  ],
  assumptions: [
    L(
      'r và K không đổi theo thời gian; không có di cư, không có độ trễ.',
      'Constant r and K; no migration, no time lag.',
    ),
    L(
      'N là biến liên tục (thích hợp cho quần thể lớn).',
      'N is treated as continuous (suitable for large populations).',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Công thức nghiệm chính xác; test tự động so sánh với DOPRI5 và kiểm tra điểm uốn tại N = K/2.',
    'Exact closed form; automated tests compare with DOPRI5 and check the inflection at N = K/2.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk12, BSRC.murray, BSRC.campbell],
};

function useLogisticData() {
  const st = useLogistic();
  return useMemo(() => {
    const n = 300;
    const t = Array.from({ length: n + 1 }, (_, i) => (i * st.tEnd) / n);
    const logi = t.map((x) => logistic(st.N0, st.r, st.K, x));
    // The exponential curve leaves the chart quickly; cut it above 1.3 K so the axis stays readable.
    const expo = t.map((x) => {
      const v = exponential(st.N0, st.r, x);
      return v > 1.3 * st.K ? null : v;
    });
    const tStar = st.N0 < st.K ? Math.log(st.K / st.N0 - 1) / st.r : NaN;
    return { t, logi, expo, tStar };
  }, [st.N0, st.r, st.K, st.tEnd]);
}

export function LogisticStage() {
  usePublishCard(LOGISTIC_CARD);
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useLogistic();
  const d = useLogisticData();
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <span className="chem-chip">
          {Lz(L('Sức chứa K', 'Carrying capacity K'))} = {fmt(st.K, 4)}
        </span>
        <span className="chem-chip">
          {Lz(L('Điểm uốn (N = K/2) tại t* = ', 'Inflection (N = K/2) at t* = '))}
          {Number.isFinite(d.tStar)
            ? fmt(d.tStar)
            : Lz(L('— (N₀ ≥ K, không có điểm uốn)', '— (N₀ ≥ K, no inflection)'))}
        </span>
        <span className="chem-chip">
          {Lz(L('Tốc độ tăng lớn nhất rK/4 = ', 'Maximum growth rate rK/4 = '))}
          {fmt((st.r * st.K) / 4)} {Lz(L('cá thể/đơn vị t', 'individuals/time unit'))}
        </span>
      </div>
      <div className="bio-stage-chart">
        <XYChart
          x={d.t}
          series={[
            { label: Lz(L('Logistic N(t)', 'Logistic N(t)')), y: d.logi },
            {
              label: Lz(L('Hàm mũ N₀eʳᵗ (không giới hạn)', 'Exponential N₀eʳᵗ (unlimited)')),
              y: d.expo,
              dash: true,
              color: 1,
            },
            {
              label: Lz(L('Sức chứa K', 'Carrying capacity K')),
              y: d.t.map(() => st.K),
              dash: true,
              color: 2,
            },
          ]}
          marker={Number.isFinite(d.tStar) && d.tStar <= st.tEnd ? d.tStar : null}
          xLabel={Lz(L('Thời gian t', 'Time t'))}
          yLabel={Lz(L('Số cá thể N', 'Population size N'))}
          yMin={0}
          yMax={1.3 * st.K}
        />
      </div>
    </div>
  );
}

export function LogisticPanel() {
  const Lz = useLocalized();
  const st = useLogistic();
  const set = (patch: Partial<LogisticState>) => {
    useLogistic.setState(patch);
  };
  return (
    <div className="chem-form">
      <Range
        label={L('Số cá thể ban đầu N₀', 'Initial size N₀')}
        value={st.N0}
        min={1}
        max={1500}
        step={1}
        digits={4}
        onChange={(N0) => {
          set({ N0 });
        }}
      />
      <Range
        label={L('Tốc độ tăng nội tại r', 'Intrinsic rate r')}
        value={st.r}
        min={0.05}
        max={2}
        step={0.05}
        onChange={(r) => {
          set({ r });
        }}
      />
      <Range
        label={L('Sức chứa K', 'Carrying capacity K')}
        value={st.K}
        min={50}
        max={2000}
        step={50}
        digits={4}
        onChange={(K) => {
          set({ K });
        }}
      />
      <Range
        label={L('Thời gian mô phỏng', 'Time span')}
        value={st.tEnd}
        min={5}
        max={100}
        step={5}
        onChange={(tEnd) => {
          set({ tEnd });
        }}
      />
      <p className="small muted">
        {Lz(
          L(
            'Nếu N₀ > K, quần thể giảm dần về K. Đơn vị thời gian tùy chọn (ngày, năm…) — r tính theo cùng đơn vị.',
            'If N₀ > K the population decreases towards K. The time unit is arbitrary (days, years…) — r uses the same unit.',
          ),
        )}
      </p>
    </div>
  );
}

export function LogisticBottom() {
  const Lz = useLocalized();
  const st = useLogistic();
  const data = useMemo(() => {
    const n = 200;
    const top = Math.max(st.K, st.N0) * 1.1;
    const x = Array.from({ length: n + 1 }, (_, i) => (i * top) / n);
    return { x, y: x.map((N) => st.r * N * (1 - N / st.K)) };
  }, [st.K, st.N0, st.r]);
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={data.x}
        series={[{ label: Lz(L('dN/dt = rN(1 − N/K)', 'dN/dt = rN(1 − N/K)')), y: data.y }]}
        marker={st.K / 2}
        xLabel={Lz(L('Số cá thể N', 'Population size N'))}
        yLabel="dN/dt"
      />
    </div>
  );
}

/* ───────────────────────────── Lotka–Volterra ───────────────────────────── */

interface LvState {
  alpha: number;
  beta: number;
  delta: number;
  gamma: number;
  x0: number;
  y0: number;
  tEnd: number;
}

const useLv = create<LvState>()(() => ({
  alpha: 1,
  beta: 0.1,
  delta: 0.075,
  gamma: 1.5,
  x0: 10,
  y0: 5,
  tEnd: 30,
}));

const LV_CARD: ScienceCardData = {
  title: L('Con mồi – vật ăn thịt (Lotka–Volterra)', 'Predator–prey (Lotka–Volterra)'),
  model: L(
    'Mô hình Lotka–Volterra: con mồi x sinh sản theo hàm mũ và bị ăn tỉ lệ với số lần gặp xy; vật ăn thịt y tăng nhờ ăn mồi và chết với tốc độ không đổi. Hệ được giải số bằng DOPRI5 (sai số tương đối 10⁻¹⁰); đại lượng bảo toàn V được theo dõi để kiểm tra độ chính xác.',
    'Lotka–Volterra model: prey x grows exponentially and is eaten in proportion to encounters xy; predators y grow by eating prey and die at a constant rate. Integrated with DOPRI5 (relative tolerance 10⁻¹⁰); the conserved quantity V is monitored to check accuracy.',
  ),
  equations: [
    {
      tex: '\\dfrac{dx}{dt} = \\alpha x - \\beta xy,\\qquad \\dfrac{dy}{dt} = \\delta xy - \\gamma y',
    },
    { tex: 'V = \\delta x - \\gamma\\ln x + \\beta y - \\alpha \\ln y = \\text{const}' },
    {
      tex: '(x^{*}, y^{*}) = \\left(\\dfrac{\\gamma}{\\delta}, \\dfrac{\\alpha}{\\beta}\\right),\\quad T \\approx \\dfrac{2\\pi}{\\sqrt{\\alpha\\gamma}}',
    },
  ],
  assumptions: [
    L(
      'Con mồi có thức ăn không giới hạn; vật ăn thịt chỉ ăn loài mồi này.',
      'Prey have unlimited food; predators eat only this prey.',
    ),
    L(
      'Các hệ số không đổi; không có tuổi, không có độ trễ, không có yếu tố ngẫu nhiên.',
      'Constant coefficients; no age structure, delays or randomness.',
    ),
    L(
      'Chu kì T = 2π/√(αγ) chỉ đúng với dao động nhỏ quanh điểm cân bằng.',
      'The period T = 2π/√(αγ) holds only for small oscillations around the equilibrium.',
    ),
  ],
  validity: L(
    'Mô hình định tính kinh điển; quần thể thật chịu thêm nhiều yếu tố khác.',
    'A classic qualitative model; real populations are affected by many other factors.',
  ),
  confidence: 'approx',
  confidenceNote: L(
    'Nghiệm số (DOPRI5). Test tự động: V bảo toàn tới 10⁻⁷, điểm cân bằng đứng yên, chu kì dao động nhỏ khớp 2π/√(αγ).',
    'Numerical solution (DOPRI5). Automated tests: V conserved to 10⁻⁷, equilibrium stays put, small-oscillation period matches 2π/√(αγ).',
  ),
  userIntervened: false,
  sources: [BSRC.murray, BSRC.sgk12],
};

function useLvData() {
  const st = useLv();
  return useMemo(() => {
    const p = { alpha: st.alpha, beta: st.beta, delta: st.delta, gamma: st.gamma };
    const traj = lotkaVolterra(p, st.x0, st.y0, st.tEnd, 800);
    const v0 = lvInvariant(p, st.x0, st.y0);
    let drift = 0;
    for (let i = 0; i < traj.t.length; i++) {
      const v = lvInvariant(p, traj.x[i] ?? 0, traj.y[i] ?? 0);
      drift = Math.max(drift, Math.abs(v - v0) / Math.max(1e-12, Math.abs(v0)));
    }
    return { p, traj, drift, eq: lvEquilibrium(p) };
  }, [st.alpha, st.beta, st.delta, st.gamma, st.x0, st.y0, st.tEnd]);
}

const PAD = { l: 60, r: 20, t: 64, b: 48 };

export function LotkaVolterraStage() {
  usePublishCard(LV_CARD);
  const Lz = useLocalized();
  const fmt = useFmt();
  const { traj, drift, eq } = useLvData();
  const xMax = Math.max(...traj.x, eq.x) * 1.1;
  const yMax = Math.max(...traj.y, eq.y) * 1.1;
  const labels = {
    x: Lz(L('Con mồi x', 'Prey x')),
    y: Lz(L('Vật ăn thịt y', 'Predators y')),
    eq: Lz(L('cân bằng', 'equilibrium')),
    start: Lz(L('bắt đầu', 'start')),
  };
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const w = width - PAD.l - PAD.r;
      const h = height - PAD.t - PAD.b;
      const X = (x: number) => PAD.l + (x / xMax) * w;
      const Y = (y: number) => PAD.t + h * (1 - y / yMax);
      ctx.font = '12px sans-serif';
      ctx.strokeStyle = css('--stage-grid-major');
      ctx.fillStyle = css('--text-muted');
      ctx.lineWidth = 1;
      const sx = niceStep(xMax);
      const sy = niceStep(yMax);
      for (let gx = 0; gx <= xMax; gx += sx) {
        ctx.beginPath();
        ctx.moveTo(X(gx), PAD.t);
        ctx.lineTo(X(gx), PAD.t + h);
        ctx.stroke();
        ctx.fillText(fmt(gx, 3), X(gx) - 8, PAD.t + h + 16);
      }
      for (let gy = 0; gy <= yMax; gy += sy) {
        ctx.beginPath();
        ctx.moveTo(PAD.l, Y(gy));
        ctx.lineTo(PAD.l + w, Y(gy));
        ctx.stroke();
        ctx.fillText(fmt(gy, 3), PAD.l - 36, Y(gy) + 4);
      }
      ctx.fillText(labels.x, PAD.l + w - 70, PAD.t + h + 34);
      ctx.save();
      ctx.translate(18, PAD.t + h / 2 + 40);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(labels.y, 0, 0);
      ctx.restore();
      // Nullclines: dx/dt = 0 on y = α/β, dy/dt = 0 on x = γ/δ.
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = css('--text-faint');
      ctx.beginPath();
      ctx.moveTo(X(eq.x), PAD.t);
      ctx.lineTo(X(eq.x), PAD.t + h);
      ctx.moveTo(PAD.l, Y(eq.y));
      ctx.lineTo(PAD.l + w, Y(eq.y));
      ctx.stroke();
      ctx.setLineDash([]);
      // Trajectory.
      ctx.strokeStyle = css('--chart-1');
      ctx.lineWidth = 2;
      ctx.beginPath();
      traj.x.forEach((x, i) => {
        const y = traj.y[i] ?? 0;
        if (i === 0) ctx.moveTo(X(x), Y(y));
        else ctx.lineTo(X(x), Y(y));
      });
      ctx.stroke();
      // Direction arrow a quarter of the way along.
      const i = Math.floor(traj.x.length / 12);
      const ax = X(traj.x[i] ?? 0);
      const ay = Y(traj.y[i] ?? 0);
      const bx = X(traj.x[i + 1] ?? 0);
      const by = Y(traj.y[i + 1] ?? 0);
      const ang = Math.atan2(by - ay, bx - ax);
      ctx.fillStyle = css('--chart-1');
      ctx.beginPath();
      ctx.moveTo(ax + 9 * Math.cos(ang), ay + 9 * Math.sin(ang));
      ctx.lineTo(ax + 7 * Math.cos(ang + 2.5), ay + 7 * Math.sin(ang + 2.5));
      ctx.lineTo(ax + 7 * Math.cos(ang - 2.5), ay + 7 * Math.sin(ang - 2.5));
      ctx.fill();
      // Equilibrium and start.
      ctx.fillStyle = css('--chart-4');
      ctx.beginPath();
      ctx.arc(X(eq.x), Y(eq.y), 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = css('--text');
      ctx.fillText(labels.eq, X(eq.x) + 8, Y(eq.y) - 8);
      ctx.fillStyle = css('--chart-3');
      ctx.beginPath();
      ctx.arc(X(traj.x[0] ?? 0), Y(traj.y[0] ?? 0), 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = css('--text');
      ctx.fillText(labels.start, X(traj.x[0] ?? 0) + 8, Y(traj.y[0] ?? 0) + 16);
    },
    false,
    [traj, xMax, yMax, eq, labels.x, labels.y, labels.eq, fmt],
  );
  return (
    <div className="bio-view">
      <canvas
        ref={ref}
        className="chem-canvas"
        aria-label={Lz(L('Mặt phẳng pha x–y', 'Phase plane x–y'))}
        onClick={(e) => {
          // Click sets a new starting point (an initial condition, not an intervention).
          const rect = e.currentTarget.getBoundingClientRect();
          const w = rect.width - PAD.l - PAD.r;
          const h = rect.height - PAD.t - PAD.b;
          const x = ((e.clientX - rect.left - PAD.l) / w) * xMax;
          const y = (1 - (e.clientY - rect.top - PAD.t) / h) * yMax;
          if (x > 0 && y > 0 && x <= xMax && y <= yMax)
            useLv.setState({ x0: Number(x.toPrecision(3)), y0: Number(y.toPrecision(3)) });
        }}
      />
      <div className="chem-overlay">
        <span className="chem-chip">
          {Lz(L('Cân bằng', 'Equilibrium'))} (x*, y*) = ({fmt(eq.x)}; {fmt(eq.y)})
        </span>
        <span className="chem-chip">
          {Lz(L('Chu kì dao động nhỏ', 'Small-oscillation period'))} ≈ {fmt(eq.period)}
        </span>
        <span className="chem-chip" title={Lz(L('Kiểm tra độ chính xác', 'Accuracy check'))}>
          {Lz(L('Sai lệch của V', 'Drift of V'))}: {fmt(drift, 2)}
        </span>
        <span className="chem-chip">
          {Lz(L('Bấm vào đồ thị để chọn điểm bắt đầu', 'Click the plot to pick a start point'))}
        </span>
      </div>
    </div>
  );
}

export function LotkaVolterraPanel() {
  const st = useLv();
  const set = (patch: Partial<LvState>) => {
    useLv.setState(patch);
  };
  return (
    <div className="chem-form">
      <Range
        label={L('α — tốc độ sinh của con mồi', 'α — prey birth rate')}
        value={st.alpha}
        min={0.1}
        max={3}
        step={0.05}
        onChange={(alpha) => {
          set({ alpha });
        }}
      />
      <Range
        label={L('β — tốc độ bị ăn', 'β — predation rate')}
        value={st.beta}
        min={0.01}
        max={0.5}
        step={0.005}
        onChange={(beta) => {
          set({ beta });
        }}
      />
      <Range
        label={L('δ — hiệu suất chuyển hóa mồi', 'δ — predator efficiency')}
        value={st.delta}
        min={0.005}
        max={0.3}
        step={0.005}
        onChange={(delta) => {
          set({ delta });
        }}
      />
      <Range
        label={L('γ — tốc độ chết của vật ăn thịt', 'γ — predator death rate')}
        value={st.gamma}
        min={0.1}
        max={3}
        step={0.05}
        onChange={(gamma) => {
          set({ gamma });
        }}
      />
      <Range
        label={L('Con mồi ban đầu x₀', 'Initial prey x₀')}
        value={st.x0}
        min={1}
        max={100}
        step={1}
        onChange={(x0) => {
          set({ x0 });
        }}
      />
      <Range
        label={L('Vật ăn thịt ban đầu y₀', 'Initial predators y₀')}
        value={st.y0}
        min={1}
        max={50}
        step={1}
        onChange={(y0) => {
          set({ y0 });
        }}
      />
      <Range
        label={L('Thời gian mô phỏng', 'Time span')}
        value={st.tEnd}
        min={5}
        max={100}
        step={5}
        onChange={(tEnd) => {
          set({ tEnd });
        }}
      />
    </div>
  );
}

export function LotkaVolterraBottom() {
  const Lz = useLocalized();
  const { traj } = useLvData();
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={traj.t}
        series={[
          { label: Lz(L('Con mồi x', 'Prey x')), y: traj.x },
          { label: Lz(L('Vật ăn thịt y', 'Predators y')), y: traj.y, color: 3 },
        ]}
        xLabel={Lz(L('Thời gian t', 'Time t'))}
        yLabel={Lz(L('Số cá thể', 'Population'))}
        yMin={0}
      />
    </div>
  );
}
