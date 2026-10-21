/**
 * Texts of the 3D view of "Khuếch tán & thẩm thấu": names of the parts on the picture, what is
 * illustration, the two 3D Science Cards and the selection type. Vietnamese is the source of
 * truth; every new text is listed in docs/DATA_REVIEW.md (TRA3D-*, review_status: pending) —
 * sources: SGK Sinh học 10; Campbell Biology; Atkins' Physical Chemistry.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../../common';
import { MOTION } from '../../view3d/texts';
import { DIFFUSION_CARD, OSMOSIS_CARD } from '../transportCards';
import { SOLUTE_DRAWN } from './osmosis';

export type TransportPart =
  | 'compartment1'
  | 'compartment2'
  | 'membrane'
  | 'pore'
  | 'particle'
  | 'solution'
  | 'water'
  | 'semipermeable'
  | 'solute'
  | 'waterMolecule'
  | 'ruler'
  | 'startLevel';

/** What the learner picked on the picture. */
export type TransportSelection =
  | { kind: 'membrane' }
  | { kind: 'pore'; index: number }
  | { kind: 'particle'; index: number }
  | { kind: 'compartment'; side: 1 | 2 }
  | { kind: 'column'; side: 'solution' | 'water' }
  | { kind: 'solute'; index: number }
  | { kind: 'water'; index: number };

/** The required illustration label of the diffusion view. */
export const DIFFUSION_ILLUSTRATION = L(
  'Đường đi của từng hạt là minh họa; số hạt mỗi ngăn theo định luật Fick.',
  'Each particle’s path is illustration; the number of particles on each side follows Fick’s law.',
);

/** The only spatial scale of the diffusion picture. */
export const VOLUME_NOTE = L(
  'Bề rộng hai ngăn theo tỉ lệ V₁ : V₂ (tỉ lệ không gian duy nhất trên hình); kích thước hạt và lỗ là minh họa.',
  'The two sides’ widths are in the ratio V₁ : V₂ (the picture’s only spatial scale); particle and pore sizes are illustration.',
);

/** The pores are the picture's, not the model's. */
export const PORES_NOTE = L(
  'Số lỗ trên màng không có trong mô hình Fick: tốc độ khuếch tán do PA (độ thấm × diện tích) quyết định.',
  'The number of pores is not in the Fick model: the rate is set by PA (permeability × area).',
);

/** Only the net crossings are drawn. */
export const NET_NOTE = L(
  'Thật ra hạt đi qua màng theo cả hai chiều; hình chỉ vẽ số hạt đi qua thực (chiều nhiều trừ chiều ít).',
  'Particles really cross both ways; the picture draws only the net crossings (one way minus the other).',
);

/** The faint water dots of the High tier. */
export const WATER_DOTS_NOTE = L(
  'Ở chất lượng hiển thị Cao, các chấm nhỏ mờ là phân tử nước — chỉ là minh họa: không đếm, không theo số lượng thật.',
  'On High display quality the small faint dots are water molecules — illustration only: not counted, not their real number.',
);

/** A membrane without pores. */
export const BLOCKED_NOTE = L(
  'Màng không có lỗ: trên hình không hạt nào qua được, số hạt giữ như lúc đầu. Đồ thị vẫn theo định luật Fick với PA đã chọn.',
  'A membrane without pores: no particle can cross on the picture, the counts stay as they started. The chart still follows Fick’s law with the PA chosen.',
);

/** The required illustration labels of the osmosis view. */
export const OSMOSIS_SCALE_NOTE = L(
  'Chiều cao hai cột chất lỏng đúng tỉ lệ (theo thước cm); bề rộng ống và kích thước phân tử là minh họa.',
  'The two liquid columns’ heights are to scale (see the cm ruler); the tube’s width and the molecules’ size are illustration.',
);

export const WATER_NOTE = L(
  'Phân tử nước đi qua màng là minh họa: chúng dịch chuyển theo lượng nước đã qua màng, không theo số lượng thật.',
  'The water molecules crossing the membrane are illustration: they move with the amount of water that has crossed, not in real numbers.',
);

export const SOLUTE_NOTE = L(
  `${String(SOLUTE_DRAWN)} hạt chất tan là mẫu đại diện; số hạt không đổi vì chất tan không qua được màng bán thấm. Cột dung dịch dâng lên nên các hạt giãn ra, như nồng độ C = C₀h₀/h_L.`,
  `The ${String(SOLUTE_DRAWN)} solute particles are a representative sample; their number never changes because the solute cannot cross the semipermeable membrane. As the solution column rises they spread out, as the concentration C = C₀h₀/h_L.`,
);

/** "Minh họa — không phải tỉ lệ/hình dạng thật" (the same words as the other 3D views). */
export const SCALE_NOTE = L(
  'Minh họa — không phải tỉ lệ/hình dạng thật.',
  'Illustration — not to scale or true shape.',
);

/** Names on the picture ("Hiện tên"). */
export const PART_NAMES: Record<TransportPart, LocalizedText> = {
  compartment1: L('Ngăn 1', 'Side 1'),
  compartment2: L('Ngăn 2', 'Side 2'),
  membrane: L('Màng có lỗ', 'Porous membrane'),
  pore: L('Lỗ màng', 'Pore'),
  particle: L('Hạt chất tan', 'Solute particle'),
  solution: L('Dung dịch', 'Solution'),
  water: L('Nước cất', 'Pure water'),
  semipermeable: L('Màng bán thấm', 'Semipermeable membrane'),
  solute: L('Chất tan', 'Solute'),
  waterMolecule: L('Phân tử nước', 'Water molecule'),
  ruler: L('Thước (cm)', 'Ruler (cm)'),
  startLevel: L('Mực ban đầu h₀', 'Starting level h₀'),
};

/** The diffusion 3D Science Card: the lesson's card with what the 3D picture adds. */
export function diffusionCard3d(): ScienceCardData {
  const base = DIFFUSION_CARD;
  return {
    ...base,
    title: L('Khuếch tán qua màng 3D', 'Diffusion across a membrane in 3D'),
    model: L(
      'Hai ngăn ngăn cách bởi màng có lỗ. Định luật Fick cho hai ngăn (nghiệm chính xác): hiệu nồng độ giảm theo hàm mũ tới khi hai bên bằng nhau. Trên hình 3D, số hạt mỗi ngăn lấy từ nghiệm này ở từng thời điểm (làm tròn); đường đi của từng hạt là minh họa.',
      "Two compartments separated by a porous membrane. Fick's law for two compartments (exact solution): the concentration difference decays exponentially until both sides are equal. In the 3D picture the particles on each side come from this solution at every moment (rounded); each particle's path is illustration.",
    ),
    equations: [
      ...base.equations.filter((e) => !e.tex.includes('r^2')),
      {
        tex: 'N_1(t) = N\\,\\dfrac{C_1(t)\\,V_1}{C_1^0V_1 + C_2^0V_2},\\quad N_1 + N_2 = N',
        label: L('Số hạt ngăn 1 trên hình (làm tròn)', 'Particles drawn on side 1 (rounded)'),
      },
    ],
    assumptions: [
      ...base.assumptions.slice(0, 1),
      DIFFUSION_ILLUSTRATION,
      SCALE_NOTE,
      VOLUME_NOTE,
      PORES_NOTE,
      NET_NOTE,
      WATER_DOTS_NOTE,
      MOTION,
      L(
        'N hạt là lượng chất tan C₁⁰V₁ + C₂⁰V₂ (mM × mL = µmol), không đổi; mỗi hạt ứng với lượng đó chia cho N. Số hạt hai ngăn chia theo phần dư lớn nhất nên luôn cộng lại đúng N; mỗi lần N₁ đổi 1 thì đúng 1 hạt đi qua một lỗ.',
        'The N particles stand for the solute amount C₁⁰V₁ + C₂⁰V₂ (mM × mL = µmol), which never changes; each particle is that amount divided by N. The two sides share the particles by largest remainders, so they always add up to N; each time N₁ changes by 1, exactly one particle passes through a pore.',
      ),
      L(
        'Hạt chuyển động Brown (bước ngẫu nhiên theo mô hình bước Gauss của bài, gieo theo nút "Chạy lại"); khi máy bật giảm chuyển động, hạt chỉ di chuyển lúc đi qua màng.',
        'The particles jitter by Brownian steps (the lesson’s Gaussian step, seeded by "Chạy lại"); with reduced motion they move only when they cross.',
      ),
      BLOCKED_NOTE,
      L(
        'Chính xác (lấy từ mô hình): C₁(t), C₂(t), nồng độ cân bằng, số hạt mỗi ngăn (chỉ làm tròn).',
        'Exact (from the model): C₁(t), C₂(t), the equilibrium concentration, the particles on each side (only rounded).',
      ),
    ],
    reviewStatus: 'pending',
  };
}

/** The osmosis 3D Science Card: the lesson's card with what the 3D picture adds. */
export function osmosisCard3d(): ScienceCardData {
  const base = OSMOSIS_CARD;
  return {
    ...base,
    title: L('Thẩm thấu 3D (ống chữ U)', 'Osmosis in 3D (U-tube)'),
    assumptions: [
      ...base.assumptions,
      OSMOSIS_SCALE_NOTE,
      WATER_NOTE,
      SOLUTE_NOTE,
      MOTION,
      L(
        'Mỗi thời điểm hiện mẫu gần nhất (không sau thời điểm đó) của nghiệm DOPRI5 — đúng các mẫu của đồ thị Δh(t). Độ cao tính từ mặt trên của ống nối ở đáy, như hình 2D.',
        'Each moment shows the nearest sample (not after it) of the DOPRI5 solution — the same samples as the Δh(t) chart. Heights are measured from the top of the bottom channel, as in the 2D picture.',
      ),
      L(
        'Ở cân bằng, nước vẫn đi qua màng theo cả hai chiều với tốc độ bằng nhau nên mực chất lỏng đứng yên.',
        'At equilibrium water still crosses the membrane both ways at equal rates, so the levels stay still.',
      ),
      L(
        'Chính xác (lấy từ mô hình): h_L, h_R, Δh, C = C₀h₀/h_L, Π = iCRT và ρgΔh ở từng thời điểm; Δh và Π cân bằng.',
        'Exact (from the model): h_L, h_R, Δh, C = C₀h₀/h_L, Π = iCRT and ρgΔh at every moment; the equilibrium Δh and Π.',
      ),
    ],
    reviewStatus: 'pending',
  };
}
