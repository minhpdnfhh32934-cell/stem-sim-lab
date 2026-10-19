import { Suspense, lazy, useMemo, useRef } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import type { ScienceCardData } from '@/science-card/types';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { XYChart } from '@/ui/charts/XYChart';
import { BSRC, L, usePublishCard } from '../common';
import { rng } from '../genetics/stats';
import { useFmt } from '../fmt';
import { MoreInBasic, Range } from '../ui';
import { brownianStep, twoCompartment } from './transport';
import { useTransport, type TransportState } from './store';
import { useShow3d } from '../view3d/support';
import { Bio3DToolbar } from '../view3d/switch';
import { poreIntervals } from './particles3d';
import { TransportChips } from './chips';
import { useOsmosis } from './osmosisData';
import '../bio.css';

// three.js and the 3D apparatus load only when the 3D view is shown.
const Transport3D = lazy(() => import('./Transport3D').then((m) => ({ default: m.Transport3D })));

const DIFFUSION_CARD: ScienceCardData = {
  title: L('Khuếch tán qua màng', 'Diffusion across a membrane'),
  model: L(
    'Hai ngăn ngăn cách bởi màng có lỗ. Đồ thị dùng định luật Fick cho hai ngăn (nghiệm chính xác): hiệu nồng độ giảm theo hàm mũ tới khi hai bên bằng nhau. Các hạt chuyển động Brown trên hình chỉ minh họa cơ chế ngẫu nhiên.',
    "Two compartments separated by a porous membrane. The chart uses Fick's law for two compartments (exact solution): the concentration difference decays exponentially until both sides are equal. The Brownian particles only illustrate the random mechanism.",
  ),
  equations: [
    {
      tex: '\\dfrac{dC_1}{dt} = -\\dfrac{PA}{V_1}(C_1 - C_2),\\quad \\dfrac{dC_2}{dt} = \\dfrac{PA}{V_2}(C_1 - C_2)',
    },
    {
      tex: 'C_1 - C_2 = (C_1^0 - C_2^0)\\,e^{-kt},\\quad k = PA\\left(\\dfrac{1}{V_1} + \\dfrac{1}{V_2}\\right)',
    },
    {
      tex: '\\langle r^2 \\rangle = 4Dt\\ \\text{(2D)}',
      label: L('Chuyển động Brown', 'Brownian motion'),
    },
  ],
  assumptions: [
    L(
      'Mỗi ngăn được khuấy đều (nồng độ đồng nhất); màng chỉ cho chất tan đi qua lỗ.',
      'Each compartment is well mixed; solute crosses only through the pores.',
    ),
    L(
      'Hình các hạt là minh họa định tính: số hạt không được dùng để đọc kết quả.',
      'The particle picture is qualitative: do not read results from particle counts.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Nghiệm chính xác của mô hình Fick hai ngăn. Test tự động: bảo toàn lượng chất, cân bằng tại nồng độ trung bình; ⟨r²⟩ = 4Dt.',
    'Exact solution of the two-compartment Fick model. Automated tests: amount conserved, equilibrium at the mean; ⟨r²⟩ = 4Dt.',
  ),
  userIntervened: false,
  sources: [BSRC.sgk10, BSRC.campbell, BSRC.atkins],
};

const OSMOSIS_CARD: ScienceCardData = {
  title: L('Thẩm thấu (ống chữ U)', 'Osmosis (U-tube)'),
  model: L(
    "Nhánh trái chứa dung dịch, nhánh phải chứa nước cất, ngăn bởi màng bán thấm. Nước đi vào nhánh dung dịch cho tới khi áp suất thủy tĩnh ρgΔh cân bằng áp suất thẩm thấu Π = iCRT (van 't Hoff, dung dịch loãng); dung dịch bị pha loãng khi mực nước dâng.",
    "The left arm holds a solution, the right arm pure water, separated by a semipermeable membrane. Water flows into the solution until the hydrostatic pressure ρgΔh balances the osmotic pressure Π = iCRT (van 't Hoff, dilute solution); the solution is diluted as it rises.",
  ),
  equations: [
    { tex: '\\Pi = iCRT' },
    { tex: '\\rho g\\,(h_L - h_R) = i\\,\\dfrac{C_0 h_0}{h_L}\\,RT,\\quad h_L + h_R = 2h_0' },
  ],
  assumptions: [
    L(
      'Dung dịch loãng, lí tưởng; hệ số i lấy theo phân li hoàn toàn (NaCl: i = 2).',
      'Dilute ideal solution; i assumes complete dissociation (NaCl: i = 2).',
    ),
    L(
      'Hai nhánh cùng tiết diện; màng chỉ cho nước đi qua.',
      'Arms of equal cross-section; only water crosses the membrane.',
    ),
    L(
      'Tốc độ dâng (hệ số thấm Lp) chỉ để minh họa; độ cao cân bằng không phụ thuộc Lp.',
      'The rise speed (permeance Lp) is illustrative; the equilibrium height does not depend on Lp.',
    ),
    L(
      'Nhánh nước có hạn: nếu nhánh nước cạn (h_R = 0) khi ρgΔh vẫn nhỏ hơn Π thì mô hình dừng ở đó — ống này không đạt cân bằng (cần h₀ ≥ iC₀RT/(4ρg)).',
      'The water arm is finite: if it runs dry (h_R = 0) while ρgΔh is still below Π, the model stops there — this tube never reaches equilibrium (that needs h₀ ≥ iC₀RT/(4ρg)).',
    ),
  ],
  validity: L(
    'Nồng độ nhỏ (khoảng dưới 0,1 mol/L); dung dịch điện li đặc cần hệ số thẩm thấu thực nghiệm.',
    'Low concentrations (roughly below 0.1 mol/L); concentrated electrolytes need measured osmotic coefficients.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Độ cao cân bằng giải chính xác (phương trình bậc hai); đường Δh(t) giải số DOPRI5. Test tự động: ρgΔh = Π tại cân bằng.',
    'Equilibrium height solved exactly (quadratic); Δh(t) integrated with DOPRI5. Automated test: ρgΔh = Π at equilibrium.',
  ),
  userIntervened: false,
  sources: [BSRC.atkins, BSRC.sgk10],
};

/* ───────────────────────────── Diffusion particles ───────────────────────────── */

interface Particle {
  x: number;
  y: number;
}

function stepParticles(ps: Particle[], pores: [number, number][], rand: () => number) {
  const D = 0.02;
  const dt = 1 / 60;
  for (const p of ps) {
    const [dx, dy] = brownianStep(D, dt, rand);
    let nx = p.x + dx;
    let ny = p.y + dy;
    if (ny < 0) ny = -ny;
    if (ny > 1) ny = 2 - ny;
    if (nx < 0) nx = -nx;
    if (nx > 2) nx = 4 - nx;
    if ((p.x - 1) * (nx - 1) < 0) {
      // Crossing the membrane: allowed only through a pore (y at the crossing point).
      const f = (1 - p.x) / (nx - p.x);
      const yc = p.y + f * (ny - p.y);
      if (!pores.some(([a, b]) => yc >= a && yc <= b)) nx = 2 - nx;
    }
    p.x = nx;
    p.y = Math.min(1, Math.max(0, ny));
  }
}

function DiffusionCanvas() {
  const Lz = useLocalized();
  const st = useTransport();
  const state = useRef<{ key: string; ps: Particle[]; rand: () => number }>({
    key: '',
    ps: [],
    rand: rng(1),
  });
  const labels = {
    left: Lz(L('Ngăn 1', 'Side 1')),
    right: Lz(L('Ngăn 2', 'Side 2')),
    note: Lz(L('Minh họa chuyển động Brown', 'Brownian motion (illustration)')),
  };
  const pores = poreIntervals(st.pores);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      const key = `${st.run}|${st.particles}`;
      if (state.current.key !== key) {
        const rand = rng(7 + st.run);
        state.current = {
          key,
          rand,
          ps: Array.from({ length: st.particles }, () => ({ x: 0.02 + 0.96 * rand(), y: rand() })),
        };
      }
      const { ps, rand } = state.current;
      stepParticles(ps, pores, rand);
      const pad = 40;
      const top = 70;
      const w = width - 2 * pad;
      const h = Math.max(60, height - top - 40);
      const X = (x: number) => pad + (x / 2) * w;
      const Y = (y: number) => top + y * h;
      ctx.strokeStyle = css('--border-strong');
      ctx.lineWidth = 2;
      ctx.strokeRect(pad, top, w, h);
      // Membrane with gaps at the pores.
      ctx.strokeStyle = css('--chart-2');
      ctx.lineWidth = 5;
      let y0 = 0;
      for (const [a, b] of [...pores, [1, 1] as [number, number]]) {
        ctx.beginPath();
        ctx.moveTo(X(1), Y(y0));
        ctx.lineTo(X(1), Y(a));
        ctx.stroke();
        y0 = b;
      }
      ctx.fillStyle = css('--chart-1');
      let left = 0;
      for (const p of ps) {
        if (p.x < 1) left++;
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = css('--text');
      ctx.font = '13px sans-serif';
      ctx.fillText(`${labels.left}: ${String(left)}`, X(0.05), top - 10);
      ctx.fillText(`${labels.right}: ${String(ps.length - left)}`, X(1.05), top - 10);
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px sans-serif';
      ctx.fillText(labels.note, pad, top + h + 22);
    },
    true,
    [st.run, st.particles, st.pores, labels.left, labels.right, labels.note],
  );
  return <canvas ref={ref} className="chem-canvas" aria-label={labels.note} />;
}

/* ───────────────────────────── Osmosis U-tube ───────────────────────────── */

function OsmosisCanvas() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useTransport();
  const { p, eq, tEnd, traj } = useOsmosis();
  const labels = {
    sol: Lz(L('Dung dịch', 'Solution')),
    water: Lz(L('Nước cất', 'Pure water')),
    membrane: Lz(L('Màng bán thấm', 'Semipermeable membrane')),
    time: Lz(L('t', 't')),
  };
  const ref = useCanvas(
    ({ ctx, width, height, time, css }) => {
      // Play the whole trajectory in about 8 s, then hold at the final state.
      const tSim = Math.min(tEnd, (time * tEnd) / 8);
      const idx = Math.min(traj.t.length - 1, Math.floor((tSim / tEnd) * (traj.t.length - 1)));
      const hL = traj.hL[idx] ?? p.h0;
      // The model never lets the water arm go below empty (osmosisTrajectory stops there).
      const hR = Math.max(0, 2 * p.h0 - hL);
      const hMax = Math.max(eq.hL, p.h0) * 1.25;
      const armW = Math.min(90, width / 8);
      const bottomH = armW * 0.8;
      const base = height - bottomH - 28;
      const top = 70;
      const scale = (base - top) / hMax;
      const cx = width / 2;
      const lx = cx - 2.2 * armW;
      const rx = cx + 1.2 * armW;
      // Liquid.
      const solution = css('--chart-6');
      const water = css('--chart-1');
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = solution;
      ctx.fillRect(lx, base - hL * scale, armW, hL * scale + bottomH);
      ctx.fillRect(lx, base, cx - lx, bottomH);
      ctx.fillStyle = water;
      ctx.fillRect(rx, base - hR * scale, armW, hR * scale + bottomH);
      ctx.fillRect(cx, base, rx + armW - cx, bottomH);
      ctx.globalAlpha = 1;
      // Glass.
      ctx.strokeStyle = css('--border-strong');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, top);
      ctx.lineTo(lx, base + bottomH);
      ctx.lineTo(rx + armW, base + bottomH);
      ctx.lineTo(rx + armW, top);
      ctx.moveTo(lx + armW, top);
      ctx.lineTo(lx + armW, base);
      ctx.lineTo(rx, base);
      ctx.lineTo(rx, top);
      ctx.stroke();
      // Membrane.
      ctx.strokeStyle = css('--chart-2');
      ctx.lineWidth = 4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, base);
      ctx.lineTo(cx, base + bottomH);
      ctx.stroke();
      ctx.setLineDash([]);
      // Initial level and Δh bracket.
      ctx.strokeStyle = css('--text-faint');
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(lx - 20, base - p.h0 * scale);
      ctx.lineTo(rx + armW + 20, base - p.h0 * scale);
      ctx.stroke();
      ctx.setLineDash([]);
      const yl = base - hL * scale;
      const yr = base - hR * scale;
      ctx.strokeStyle = css('--text');
      ctx.beginPath();
      ctx.moveTo(rx + armW + 30, yl);
      ctx.lineTo(rx + armW + 30, yr);
      ctx.moveTo(rx + armW + 24, yl);
      ctx.lineTo(rx + armW + 36, yl);
      ctx.moveTo(rx + armW + 24, yr);
      ctx.lineTo(rx + armW + 36, yr);
      ctx.moveTo(lx + armW, yl);
      ctx.lineTo(rx + armW + 30, yl);
      ctx.stroke();
      ctx.fillStyle = css('--text');
      ctx.font = '13px sans-serif';
      ctx.fillText(`Δh = ${fmt((hL - hR) * 100)} cm`, rx + armW + 42, (yl + yr) / 2 + 4);
      ctx.fillText(labels.sol, lx, top - 10);
      ctx.fillText(labels.water, rx, top - 10);
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px sans-serif';
      ctx.fillText(labels.membrane, rx + armW + 12, base + bottomH / 2 + 4);
      ctx.fillText(`${labels.time} = ${fmt(tSim, 3)} s`, 12, height - 12);
    },
    true,
    [st.run, p, eq, tEnd, traj, labels.sol, labels.water, labels.membrane],
  );
  return <canvas ref={ref} className="chem-canvas" aria-label={labels.sol} />;
}

/* ───────────────────────────── Module views ───────────────────────────── */

export function DiffusionOsmosisStage() {
  const st = useTransport();
  usePublishCard(st.mode === 'diffusion' ? DIFFUSION_CARD : OSMOSIS_CARD);
  const { show3d } = useShow3d('transport');
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Transport3D />
      </Suspense>
    );
  return (
    <div className="bio-view">
      {st.mode === 'diffusion' ? <DiffusionCanvas /> : <OsmosisCanvas />}
      <div className="chem-overlay">
        <TransportChips />
        <Bio3DToolbar lesson="transport" />
      </div>
    </div>
  );
}

export function DiffusionOsmosisPanel() {
  const Lz = useLocalized();
  const st = useTransport();
  const initial = useTransport.getInitialState();
  const set = (patch: Partial<TransportState>) => {
    useTransport.setState(patch);
  };
  if (st.mode === 'diffusion')
    return (
      <div className="chem-form">
        <p className="econf__label">{Lz(L('Hình minh họa', 'Illustration'))}</p>
        <Range
          label={L('Số lỗ trên màng', 'Pores in the membrane')}
          value={st.pores}
          min={0}
          max={8}
          step={1}
          onChange={(pores) => {
            set({ pores });
          }}
        />
        <Range
          label={L('Số hạt chất tan', 'Solute particles')}
          value={st.particles}
          min={20}
          max={400}
          step={20}
          onChange={(particles) => {
            set({ particles });
          }}
        />
        <p className="econf__label">{Lz(L('Mô hình Fick (đồ thị)', 'Fick model (chart)'))}</p>
        <Range
          label={L('C₁ ban đầu', 'Initial C₁')}
          unit="mM"
          value={st.c1}
          min={0}
          max={20}
          step={0.5}
          onChange={(c1) => {
            set({ c1 });
          }}
        />
        <Range
          label={L('C₂ ban đầu', 'Initial C₂')}
          unit="mM"
          value={st.c2}
          min={0}
          max={20}
          step={0.5}
          onChange={(c2) => {
            set({ c2 });
          }}
        />
        {/* Basic: the volumes and the membrane's permeability keep their defaults. */}
        <MoreInBasic
          count={3}
          changed={st.v1 !== initial.v1 || st.v2 !== initial.v2 || st.pa !== initial.pa}
        >
          <Range
            label={L('Thể tích ngăn 1, V₁', 'Volume V₁')}
            unit="mL"
            value={st.v1}
            min={0.5}
            max={5}
            step={0.5}
            onChange={(v1) => {
              set({ v1 });
            }}
          />
          <Range
            label={L('Thể tích ngăn 2, V₂', 'Volume V₂')}
            unit="mL"
            value={st.v2}
            min={0.5}
            max={5}
            step={0.5}
            onChange={(v2) => {
              set({ v2 });
            }}
          />
          <Range
            label={L('Độ thấm × diện tích, PA', 'Permeability × area, PA')}
            unit="mL/min"
            value={st.pa}
            min={0.02}
            max={1}
            step={0.02}
            onChange={(pa) => {
              set({ pa });
            }}
          />
        </MoreInBasic>
      </div>
    );
  return (
    <div className="chem-form">
      <Range
        label={L('Nồng độ ban đầu C₀', 'Initial concentration C₀')}
        unit="mmol/L"
        value={st.c0}
        min={0.1}
        max={5}
        step={0.1}
        onChange={(c0) => {
          set({ c0 });
        }}
      />
      <label>
        <span>{Lz(L('Chất tan (hệ số i)', "Solute (van 't Hoff i)"))}</span>
        <select
          value={st.i}
          onChange={(e) => {
            set({ i: Number(e.target.value) });
          }}
        >
          <option value={1}>
            {Lz(L('Glucozơ / saccarozơ (i = 1)', 'Glucose / sucrose (i = 1)'))}
          </option>
          <option value={2}>NaCl (i = 2)</option>
          <option value={3}>CaCl₂ (i = 3)</option>
        </select>
      </label>
      <Range
        label={L('Nhiệt độ', 'Temperature')}
        unit="°C"
        value={st.tC}
        min={0}
        max={40}
        step={1}
        onChange={(tC) => {
          set({ tC });
        }}
      />
      <Range
        label={L('Mực chất lỏng ban đầu h₀', 'Initial level h₀')}
        unit="m"
        value={st.h0}
        min={0.05}
        max={0.5}
        step={0.05}
        onChange={(h0) => {
          set({ h0 });
        }}
      />
      <p className="small muted">
        {Lz(
          L(
            '1 mmol/L = 1 mol/m³. Áp suất thẩm thấu lớn: chỉ 1 mmol/L đã nâng cột nước lên hàng chục cm.',
            '1 mmol/L = 1 mol/m³. Osmotic pressure is large: just 1 mmol/L lifts the water by tens of cm.',
          ),
        )}
      </p>
    </div>
  );
}

export function DiffusionOsmosisBottom() {
  const Lz = useLocalized();
  const st = useTransport();
  const osm = useOsmosis();
  const fick = useMemo(() => {
    const k = st.pa * (1 / st.v1 + 1 / st.v2);
    const tEnd = 5 / k;
    const x = Array.from({ length: 201 }, (_, i) => (i * tEnd) / 200);
    const c = x.map((t) => twoCompartment(st.c1, st.c2, st.v1, st.v2, st.pa, t));
    const ceq = (st.c1 * st.v1 + st.c2 * st.v2) / (st.v1 + st.v2);
    return { x, c1: c.map((v) => v.c1), c2: c.map((v) => v.c2), eq: x.map(() => ceq) };
  }, [st.c1, st.c2, st.v1, st.v2, st.pa]);
  if (st.mode === 'diffusion')
    return (
      <div className="gas-bottom gas-bottom--single">
        <XYChart
          x={fick.x}
          series={[
            { label: 'C₁', y: fick.c1 },
            { label: 'C₂', y: fick.c2, color: 3 },
            { label: Lz(L('Cân bằng', 'Equilibrium')), y: fick.eq, dash: true, color: 2 },
          ]}
          xLabel={Lz(L('Thời gian', 'Time'))}
          xUnit={Lz(L('phút', 'min'))}
          yLabel={Lz(L('Nồng độ', 'Concentration'))}
          yUnit="mM"
          yMin={0}
        />
      </div>
    );
  const dh = osm.traj.hL.map((h) => (2 * h - 2 * osm.p.h0) * 100);
  const finalLabel = osm.eq.dry
    ? L('Δh khi nhánh nước cạn (chưa cân bằng)', 'Δh when the water arm is empty (not balanced)')
    : L('Δh cân bằng', 'Equilibrium Δh');
  return (
    <div className="gas-bottom gas-bottom--single">
      <XYChart
        x={osm.traj.t}
        series={[
          { label: 'Δh(t)', y: dh },
          {
            label: Lz(finalLabel),
            y: osm.traj.t.map(() => osm.eq.dh * 100),
            dash: true,
            color: 2,
          },
        ]}
        xLabel={Lz(L('Thời gian (minh họa)', 'Time (illustrative)'))}
        xUnit="s"
        yLabel="Δh"
        yUnit="cm"
        yMin={0}
      />
    </div>
  );
}
