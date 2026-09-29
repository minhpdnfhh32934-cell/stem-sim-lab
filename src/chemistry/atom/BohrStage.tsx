import { useLocalized } from '@/app/i18n/localized';
import type { ScienceCardData } from '@/science-card/types';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { ELEMENTS_SOURCE, electronsPerShell, elementByZ } from '../data/elements';
import { CSRC, L, usePublishCard } from '../common';
import { ElementPicker } from '../periodic/ElementPicker';
import { usePeriodicStore } from '../periodic/store';
import { useBohrStore } from './bohrStore';
import { transitionWavelength } from './hydrogen';
import { wavelengthColor } from './spectrumColor';
import '../chem.css';

const CARD: ScienceCardData = {
  title: L('Mô hình Bohr', 'Bohr model'),
  model: L(
    'Mô hình Bohr — mang tính lịch sử, giản lược: electron chuyển động trên quỹ đạo tròn. Với nguyên tử nhiều electron, hình chỉ minh họa số electron trên mỗi lớp (lấy từ bảng dữ liệu). Với hydro, năng lượng mức và bước sóng được tính chính xác theo công thức Rydberg.',
    'Bohr model — historical and simplified: electrons on circular orbits. For many-electron atoms the picture only shows electrons per shell (from the data table). For hydrogen, level energies and wavelengths are computed from the Rydberg formula.',
  ),
  equations: [
    { tex: 'E_n = -\\dfrac{R_H h c}{n^2} \\approx -\\dfrac{13{,}6\\ \\text{eV}}{n^2}' },
    {
      tex: '\\dfrac{1}{\\lambda} = R_H\\left(\\dfrac{1}{n_1^2} - \\dfrac{1}{n_2^2}\\right),\\quad R_H = \\dfrac{R_\\infty}{1 + m_e/m_p}',
    },
  ],
  assumptions: [
    L(
      'Quỹ đạo tròn không tồn tại trong cơ học lượng tử; electron được mô tả bằng orbital (xem chủ đề Hình dạng orbital).',
      'Circular orbits do not exist in quantum mechanics; electrons are described by orbitals (see Orbital shapes).',
    ),
    L(
      'Bước sóng của hydro bỏ qua cấu trúc tinh tế và dịch chuyển Lamb (sai lệch cỡ 10⁻⁵).',
      'Hydrogen wavelengths neglect fine structure and the Lamb shift (≈10⁻⁵ relative).',
    ),
    L('Bước sóng là bước sóng trong chân không.', 'Wavelengths are vacuum wavelengths.'),
    L(
      'Kích thước các quỹ đạo trên hình không theo tỉ lệ.',
      'Orbit sizes in the picture are not to scale.',
    ),
  ],
  validity: L(
    'Công thức năng lượng chỉ đúng cho hydro và ion giống hydro (1 electron).',
    'The energy formula holds only for hydrogen and hydrogen-like ions (one electron).',
  ),
  confidence: 'approx',
  estimatedError: 1e-4,
  confidenceNote: L(
    'Hình vẽ: định tính. Số liệu hydro: công thức Rydberg với hằng số CODATA 2022.',
    'Picture: qualitative. Hydrogen numbers: Rydberg formula with CODATA 2022 constants.',
  ),
  userIntervened: false,
  sources: [CSRC.codata, CSRC.atkins, ELEMENTS_SOURCE, CSRC.sgk10],
  reviewStatus: 'pending',
};

/** Shell picture of the selected atom; for hydrogen, the selected transition is drawn. */
export function BohrStage() {
  usePublishCard(CARD);
  const Lz = useLocalized();
  const z = usePeriodicStore((s) => s.selected);
  const { nLower, nUpper } = useBohrStore();
  const e = elementByZ(z);
  const shells = e ? electronsPerShell(e) : [];
  const hydrogen = z === 1;

  const canvasRef = useCanvas(
    ({ ctx, width, height, time, css }) => {
      const cx = width / 2;
      const cy = height / 2 + 16;
      const count = hydrogen ? Math.max(nUpper, 4) : shells.length;
      const rMax = Math.min(width, height) / 2 - 40;
      const r0 = Math.max(18, rMax * 0.12);
      const radius = (i: number) => r0 + ((rMax - r0) * (i + 1)) / count;
      const text = css('--text');
      const muted = css('--text-muted');
      const faint = css('--border-strong');
      const electron = css('--chart-1');
      const nucleus = css('--chart-4');

      // Orbits
      for (let i = 0; i < count; i++) {
        const active = hydrogen && (i + 1 === nLower || i + 1 === nUpper);
        ctx.strokeStyle = active ? css('--accent') : faint;
        ctx.lineWidth = active ? 2 : 1;
        ctx.setLineDash(active ? [] : [4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, radius(i), 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = muted;
        ctx.font = '11px var(--font-sans), sans-serif';
        ctx.fillText(`n = ${i + 1}`, cx + radius(i) * 0.707 + 4, cy - radius(i) * 0.707 - 4);
      }

      // Nucleus
      ctx.fillStyle = nucleus;
      ctx.beginPath();
      ctx.arc(cx, cy, r0 * 0.7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.round(r0 * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${z}+`, cx, cy);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      // Electrons: evenly spaced on each shell, slow rotation (illustration only).
      const drawElectron = (x: number, y: number) => {
        ctx.fillStyle = electron;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
        ctx.fill();
      };
      if (hydrogen) {
        const a = time * 0.6;
        drawElectron(cx + radius(nLower - 1) * Math.cos(a), cy + radius(nLower - 1) * Math.sin(a));
        // Transition arrow nUpper → nLower with the photon colour.
        const lam = transitionWavelength(nLower, nUpper) * 1e9;
        const col = wavelengthColor(lam) ?? muted;
        const ang = -Math.PI / 4;
        const x1 = cx + radius(nUpper - 1) * Math.cos(ang);
        const y1 = cy + radius(nUpper - 1) * Math.sin(ang);
        const x2 = cx + radius(nLower - 1) * Math.cos(ang);
        const y2 = cy + radius(nLower - 1) * Math.sin(ang);
        ctx.strokeStyle = css('--accent');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const h = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 9 * Math.cos(h - 0.4), y2 - 9 * Math.sin(h - 0.4));
        ctx.lineTo(x2 - 9 * Math.cos(h + 0.4), y2 - 9 * Math.sin(h + 0.4));
        ctx.closePath();
        ctx.fillStyle = css('--accent');
        ctx.fill();
        // Emitted photon: a wavy line leaving the atom.
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let s = 0; s <= 90; s++) {
          const d = s * 1.4;
          const px =
            mx +
            d * Math.cos(Math.PI / 4) +
            5 * Math.sin(s * 0.5 - time * 8) * Math.cos(-Math.PI / 4);
          const py =
            my +
            d * Math.sin(Math.PI / 4) +
            5 * Math.sin(s * 0.5 - time * 8) * Math.sin(-Math.PI / 4);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        shells.forEach((count2, i) => {
          const w = 0.5 / (i + 1);
          for (let k = 0; k < count2; k++) {
            const a = (2 * Math.PI * k) / count2 + time * w;
            drawElectron(cx + radius(i) * Math.cos(a), cy + radius(i) * Math.sin(a));
          }
          ctx.fillStyle = text;
          ctx.font = '600 12px sans-serif';
          ctx.fillText(String(count2), cx - 4, cy - radius(i) - 8);
        });
      }
    },
    true,
    [z, nLower, nUpper, shells.join(',')],
  );

  return (
    <div className="chem-view chem-view--flush">
      <canvas
        ref={canvasRef}
        className="chem-canvas"
        aria-label={Lz(L('Mô hình Bohr', 'Bohr model'))}
      />
      <div className="chem-overlay">
        <ElementPicker />
        <span className="chem-chip chem-chip--qual">
          {Lz(
            L('Mô hình Bohr — giản lược, mang tính lịch sử', 'Bohr model — simplified, historical'),
          )}
        </span>
        {!hydrogen && (
          <span className="chem-chip">
            {Lz(L('Số electron mỗi lớp: ', 'Electrons per shell: '))}
            {shells.join(' · ')}
          </span>
        )}
        {hydrogen && (
          <span className="chem-chip">
            {Lz(
              L(
                `Chuyển mức n = ${nUpper} → n = ${nLower}`,
                `Transition n = ${nUpper} → n = ${nLower}`,
              ),
            )}
          </span>
        )}
      </div>
    </div>
  );
}
