import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { ScienceCardData } from '@/science-card/types';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { IconButton } from '@/ui/IconButton';
import { CSRC, L, usePublishCard } from '../common';
import { TYPE_A, TYPE_B, TYPE_C, TYPE_D } from './gas';
import { gasRuntime, resetGas, sample, useGasStore, type GasMode } from './gasStore';
import '../chem.css';

const TYPE_COLOR = ['--chart-1', '--chart-4', '--chart-3', '--chart-2'];

function cardFor(mode: GasMode): ScienceCardData {
  const common = [
    L(
      'Khí hai chiều gồm các đĩa cứng va chạm đàn hồi (động năng và động lượng bảo toàn); thành bình phản xạ gương.',
      'Two-dimensional gas of hard disks with elastic collisions (kinetic energy and momentum conserved); specular walls.',
    ),
    L(
      'Đơn vị rút gọn: đường kính đĩa = 1, khối lượng = 1, k_BT = 1. Tốc độ được đổi sang m/s bằng σ = √(RT/M).',
      'Reduced units: disk diameter = 1, mass = 1, k_BT = 1. Speeds are converted to m/s with σ = √(RT/M).',
    ),
  ];
  if (mode === 'maxwell') {
    return {
      title: L('Phân bố Maxwell–Boltzmann (khí 2D)', 'Maxwell–Boltzmann distribution (2D gas)'),
      model: L(
        'Mô phỏng động lực học phân tử; phân bố tốc độ tự thiết lập qua va chạm và được so với lý thuyết cho khí HAI chiều.',
        'Molecular dynamics; the speed distribution builds up through collisions and is compared with the theory for a TWO-dimensional gas.',
      ),
      equations: [
        {
          tex: 'f_{2D}(v) = \\dfrac{m v}{k_B T}\\, e^{-m v^2 / 2 k_B T}',
          label: L('Mô phỏng (2D)', 'Simulated (2D)'),
        },
        {
          tex: 'f_{3D}(v) = 4\\pi \\left(\\dfrac{m}{2\\pi k_B T}\\right)^{3/2} v^2 e^{-m v^2/2k_BT}',
          label: L(
            'Khí thật (3D, SGK) — chỉ để so sánh',
            'Real gas (3D, textbook) — for comparison',
          ),
        },
      ],
      assumptions: [
        ...common,
        L(
          'Phân bố 2D khác dạng 3D: đỉnh ở v = σ thay vì σ√2. Đừng dùng số đo trong mô phỏng làm số liệu của khí thật 3D.',
          'The 2D distribution differs from 3D: its peak is at v = σ, not σ√2. Do not read 3D gas values from this simulation.',
        ),
      ],
      confidence: 'approx',
      confidenceNote: L(
        'Test tự động: tốc độ trung bình khớp √(πkT/2m) trong 2 %, histogram lệch lý thuyết < 5 %.',
        'Automated test: mean speed within 2 % of √(πkT/2m); histogram within 5 % of theory.',
      ),
      userIntervened: false,
      method: L(
        'Bước thời gian cố định, ô lưới tìm va chạm',
        'Fixed time step, cell list for collisions',
      ),
      sources: [CSRC.atkins, CSRC.codata, CSRC.sgk10],
    };
  }
  return {
    title: L('Thuyết va chạm', 'Collision theory'),
    model: L(
      'Phản ứng A + B → C + D chỉ xảy ra khi va chạm có năng lượng theo phương nối tâm ≥ Eₐ (mô hình line-of-centres). Phản ứng giả định đẳng nhiệt (ΔH = 0) để khí giữ nguyên nhiệt độ.',
      'A + B → C + D happens only when the collision energy along the line of centres is ≥ Eₐ (line-of-centres model). The reaction is taken as thermoneutral (ΔH = 0) so the gas keeps its temperature.',
    ),
    equations: [
      { tex: '\\dfrac{\\text{số va chạm hiệu quả}}{\\text{tổng số va chạm}} = e^{-E_a/RT}' },
      { tex: 'k = A\\,e^{-E_a/RT}', label: L('Phương trình Arrhenius', 'Arrhenius equation') },
    ],
    assumptions: [
      ...common,
      L(
        'Phản ứng minh họa (A, B, C, D không phải chất cụ thể); không có yếu tố định hướng không gian.',
        'Illustrative reaction (A, B, C, D are not real substances); no steric factor.',
      ),
    ],
    confidence: 'approx',
    confidenceNote: L(
      'Test tự động: tỉ lệ va chạm hiệu quả khớp e^(−Eₐ/RT) trong ±0,03.',
      'Automated test: the energetic fraction matches e^(−Eₐ/RT) within ±0.03.',
    ),
    userIntervened: false,
    sources: [CSRC.atkins, CSRC.sgk10],
  };
}

/** Particle view shared by the Maxwell–Boltzmann and collision-theory modules. */
export function GasStage({ mode }: { mode: GasMode }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const st = useGasStore(
    useShallow((s) => ({ running: s.running, version: s.version, T: s.T, eaKJ: s.eaKJ, n: s.n })),
  );
  const card = useMemo(() => cardFor(mode), [mode]);
  usePublishCard(card);

  useEffect(() => {
    useGasStore.setState({ mode, running: true });
    resetGas();
  }, [mode]);

  // Simulation loop: ~6 reduced time units per real second, sampled 5×/unit.
  useEffect(() => {
    if (!st.running) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const g = gasRuntime.gas;
      if (g && document.visibilityState === 'visible') {
        g.advance(dt * 6);
        acc += dt * 6;
        if (acc >= 0.2) {
          acc = 0;
          sample();
        }
        if (now - lastUi > 250) {
          lastUi = now;
          useGasStore.setState((s) => ({ version: s.version + 1 }));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [st.running]);

  const canvasRef = useCanvas(
    ({ ctx, width, height, css }) => {
      const g = gasRuntime.gas;
      if (!g) return;
      const size = Math.min(width - 32, height - 90);
      const x0 = (width - size) / 2;
      const y0 = (height - size) / 2 + 28;
      const k = size / g.box;
      ctx.strokeStyle = css('--border-strong');
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, size, size);
      const colors = TYPE_COLOR.map((c) => css(c));
      const fast = css('--chart-1');
      const r = Math.max(1.5, 0.5 * k);
      for (let i = 0; i < g.n; i++) {
        const px = x0 + (g.x[i] ?? 0) * k;
        const py = y0 + size - (g.y[i] ?? 0) * k;
        if (mode === 'maxwell') {
          ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, g.speed(i) / 3);
          ctx.fillStyle = fast;
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors[g.type[i] ?? 0] ?? '#888';
        }
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    true,
    [mode],
  );

  const g = gasRuntime.gas;
  const f = (v: number, d = 3) => formatNumber(locale, v, { maximumSignificantDigits: d });
  return (
    <div className="chem-view chem-view--flush">
      <canvas ref={canvasRef} className="chem-canvas" aria-label={Lz(card.title)} />
      <div className="chem-overlay">
        <IconButton
          icon={st.running ? Pause : Play}
          label={st.running ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Chạy', 'Run'))}
          variant="solid"
          onClick={() => {
            useGasStore.setState((s) => ({ running: !s.running }));
          }}
        />
        <IconButton
          icon={RotateCcw}
          label={Lz(L('Làm lại từ đầu', 'Restart'))}
          onClick={() => {
            resetGas();
          }}
        />
        {g && (
          <span className="chem-chip">
            {Lz(L('Nhiệt độ động học', 'Kinetic temperature'))}: {f(g.temperature() * st.T, 4)} K ·{' '}
            {Lz(L('thời gian', 'time'))} {f(g.time, 3)} τ
          </span>
        )}
        {mode === 'collision' && g && (
          <span className="chem-chip">
            <span className="rx-swatch" style={{ background: 'var(--chart-1)' }} /> A{' '}
            {g.count(TYPE_A)}
            <span className="rx-swatch" style={{ background: 'var(--chart-4)' }} /> B{' '}
            {g.count(TYPE_B)}
            <span className="rx-swatch" style={{ background: 'var(--chart-3)' }} /> C{' '}
            {g.count(TYPE_C)}
            <span className="rx-swatch" style={{ background: 'var(--chart-2)' }} /> D{' '}
            {g.count(TYPE_D)}
          </span>
        )}
        <span className="chem-chip chem-chip--approx">
          {mode === 'maxwell'
            ? Lz(L('Khí 2 chiều — độ đậm màu theo tốc độ', '2D gas — colour intensity shows speed'))
            : Lz(L('Mô hình minh họa, đơn vị rút gọn', 'Illustrative model, reduced units'))}
        </span>
      </div>
    </div>
  );
}
