/**
 * Science Cards of "Khuếch tán & thẩm thấu" (2D pictures); the 3D view builds its cards on these
 * (`transport3d/components.ts`). No React here: the 3D chunk imports it without the 2D views.
 */
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';

export const DIFFUSION_CARD: ScienceCardData = {
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

export const OSMOSIS_CARD: ScienceCardData = {
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
