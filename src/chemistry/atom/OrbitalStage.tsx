import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useResolvedTheme } from '@/app/theme/useApplyTheme';
import { useTierConfig } from '@/perf/perfStore';
import type { ScienceCardData } from '@/science-card/types';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { CSRC, L, usePublishCard } from '../common';
import { orbitalById, psi, radiusContaining } from './hydrogen';
import { useOrbitalStore } from './orbitalStore';
import { Equation } from '@/science-card/Equation';
import '../chem.css';

const CARD: ScienceCardData = {
  title: L('Orbital của nguyên tử hydro', 'Hydrogen atom orbitals'),
  model: L(
    'Nghiệm giải tích của phương trình Schrödinger cho nguyên tử hydro: ψ = R_nl(r)·Y_lm(θ, φ) (dạng orbital thực). Hình là lát cắt qua hạt nhân.',
    'Analytic solution of the Schrödinger equation for hydrogen: ψ = R_nl(r)·Y_lm(θ, φ) (real orbitals). The picture is a slice through the nucleus.',
  ),
  equations: [
    {
      tex: 'R_{nl}(r) = \\sqrt{\\left(\\tfrac{2}{n a_0}\\right)^3 \\tfrac{(n-l-1)!}{2n (n+l)!}}\\, e^{-\\rho/2} \\rho^l L_{n-l-1}^{2l+1}(\\rho),\\quad \\rho = \\tfrac{2r}{n a_0}',
    },
    { tex: 'P(r) = r^2 R_{nl}(r)^2' },
  ],
  assumptions: [
    L(
      'Chỉ chính xác cho hydro (1 electron), bỏ qua hiệu chỉnh tương đối tính và khối lượng hạt nhân hữu hạn trong hình dạng.',
      'Exact only for hydrogen (one electron); relativistic and finite-nuclear-mass corrections are neglected in the shape.',
    ),
    L(
      'Với nguyên tử nhiều electron, hình dạng orbital chỉ mang tính định tính (giống hydro), kích thước không đúng.',
      'For many-electron atoms, orbital shapes are only qualitative (hydrogen-like); sizes are not correct.',
    ),
    L(
      'Màu sắc thể hiện dấu (pha) của ψ, không phải điện tích.',
      'Colours show the sign (phase) of ψ, not charge.',
    ),
  ],
  confidence: 'exact',
  confidenceNote: L(
    'Kiểm chứng: chuẩn hóa ∫R²r²dr = 1, ⟨r⟩ = (3n² − l(l+1))a₀/2, số nút xuyên tâm n − l − 1, trực chuẩn của Y (test tự động).',
    'Checked: normalisation, ⟨r⟩ = (3n² − l(l+1))a₀/2, n − l − 1 radial nodes, orthonormal Y (automated tests).',
  ),
  userIntervened: false,
  sources: [CSRC.griffiths, CSRC.atkins],
};

type RGB = [number, number, number];
function parseColor(c: string): RGB {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (hex?.[1]) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m?.[1]) {
    const [r, g, b] = m[1].split(/[ ,]+/).map(Number);
    return [r ?? 0, g ?? 0, b ?? 0];
  }
  return [128, 128, 128];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** 2D cross-section of a hydrogen orbital: sign of ψ (diverging) or |ψ|² (sequential). */
export function OrbitalStage() {
  usePublishCard(CARD);
  const Lz = useLocalized();
  const theme = useResolvedTheme();
  const tier = useTierConfig();
  const { n, orbital: orbitalId, mode } = useOrbitalStore();
  const orbital = orbitalById(orbitalId);
  const extent = useMemo(() => radiusContaining(n, orbital.l, 0.99) * 1.05, [n, orbital.l]);

  // Rasterise the slice once per orbital / mode / theme / quality tier.
  const image = useMemo(() => {
    const res = tier.sphereSegments >= 24 ? 320 : tier.sphereSegments >= 16 ? 240 : 170;
    const cs = getComputedStyle(document.documentElement);
    const col = (v: string) => parseColor(cs.getPropertyValue(v));
    const bg = col('--bg-stage');
    const pos = col('--chart-1');
    const neg = col('--chart-4');
    const seq = col('--chart-1');
    const vals = new Float64Array(res * res);
    let vmax = 0;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const u = ((i + 0.5) / res) * 2 * extent - extent;
        const v = extent - ((j + 0.5) / res) * 2 * extent;
        const [x, y, z] =
          orbital.plane === 'xz' ? [u, 0, v] : orbital.plane === 'xy' ? [u, v, 0] : [0, u, v];
        const p = psi(n, orbital, x, y, z);
        const val = mode === 'density' ? p * p : p;
        vals[j * res + i] = val;
        vmax = Math.max(vmax, Math.abs(val));
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(res, res);
    for (let k = 0; k < vals.length; k++) {
      const t = (vals[k] ?? 0) / (vmax || 1);
      // Square-root scaling keeps the outer lobes visible; the legend says so.
      const a = Math.sqrt(Math.abs(t));
      const c = mode === 'density' ? mix(bg, seq, a) : mix(bg, t >= 0 ? pos : neg, a);
      img.data[4 * k] = c[0];
      img.data[4 * k + 1] = c[1];
      img.data[4 * k + 2] = c[2];
      img.data[4 * k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
    // theme is a dependency because the colours come from the theme tokens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, orbital, mode, extent, theme, tier.sphereSegments]);

  const axes: [string, string] =
    orbital.plane === 'xz' ? ['x', 'z'] : orbital.plane === 'xy' ? ['x', 'y'] : ['y', 'z'];

  const canvasRef = useCanvas(
    ({ ctx, width, height, css }) => {
      if (!image) return;
      const size = Math.min(width - 40, height - 70);
      const x0 = (width - size) / 2;
      const y0 = (height - size) / 2 + 22;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, x0, y0, size, size);
      ctx.strokeStyle = css('--border-strong');
      ctx.strokeRect(x0, y0, size, size);
      // Axes through the nucleus
      ctx.strokeStyle = css('--text-faint');
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0 + size / 2);
      ctx.lineTo(x0 + size, y0 + size / 2);
      ctx.moveTo(x0 + size / 2, y0);
      ctx.lineTo(x0 + size / 2, y0 + size);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px sans-serif';
      ctx.fillText(axes[0], x0 + size - 12, y0 + size / 2 - 6);
      ctx.fillText(axes[1], x0 + size / 2 + 6, y0 + 14);
      // Scale bar: a round number of a₀
      const perA0 = size / (2 * extent);
      const nice = [1, 2, 5, 10, 20, 50].find((v) => v * perA0 > size / 6) ?? 50;
      const bx = x0 + 10;
      const by = y0 + size - 12;
      ctx.strokeStyle = css('--text');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + nice * perA0, by);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = css('--text');
      ctx.fillText(`${nice} a₀`, bx, by - 6);
    },
    false,
    [image, extent, axes.join()],
  );

  const nodesRadial = n - orbital.l - 1;
  return (
    <div className="chem-view chem-view--flush">
      <canvas
        ref={canvasRef}
        className="chem-canvas"
        aria-label={Lz(L('Lát cắt orbital', 'Orbital slice'))}
      />
      <div className="chem-overlay">
        <span className="chem-chip">
          <Equation tex={`\\psi_{${n}${orbital.label}}`} display={false} />
          {Lz(
            L(
              ` · mặt phẳng ${axes.join('')} · ${nodesRadial} nút xuyên tâm, ${orbital.l} mặt nút góc`,
              ` · ${axes.join('')} plane · ${nodesRadial} radial, ${orbital.l} angular nodes`,
            ),
          )}
        </span>
        <span className="chem-chip">
          {mode === 'psi'
            ? Lz(
                L(
                  'Xanh: ψ > 0 · Cam: ψ < 0 (thang căn bậc hai)',
                  'Blue: ψ > 0 · Orange: ψ < 0 (square-root scale)',
                ),
              )
            : Lz(L('Đậm: |ψ|² lớn (thang căn bậc hai)', 'Dark: high |ψ|² (square-root scale)'))}
        </span>
      </div>
    </div>
  );
}
