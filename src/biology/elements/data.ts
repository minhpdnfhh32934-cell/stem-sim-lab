/**
 * "Các nguyên tố hoá học và nước" (SH10 KNTT Bài 4, #255): the shares of the human body by mass
 * from the textbook's figure 4.1 and water's constants, both in data/cell_elements.json
 * (scripts/data/gen_cell_elements.py; DATA_REVIEW SH10-ELEM-*). Pure functions, no state.
 */
import { z } from 'zod';
import raw from '@data/cell_elements.json';
import {
  loadDataset,
  ReviewStatusSchema,
  SourceSchema,
  type LocalizedText,
  type Source,
} from '@/core/data/dataset';
import { elementBySymbol } from '@/chemistry/data/elements';
import { L } from '../common';

const SliceSchema = z.object({
  id: z.string().min(1),
  /** Elements in this slice of the figure (several: one combined slice; none: trace elements). */
  symbols: z.array(z.string().min(1).max(2)),
  share_pct: z.number().positive().max(100),
  group: z.enum(['macro', 'trace']),
  review_status: ReviewStatusSchema,
});
export type Slice = z.infer<typeof SliceSchema>;
export type ElementGroup = Slice['group'];

const WaterSchema = z.object({
  source: SourceSchema,
  molar_mass_g_mol: z.number().positive(),
  t_ref_k: z.number().positive(),
  cp_molar_j_mol_k: z.number().positive(),
  c_specific_j_g_k: z.number().positive(),
  df_h_gas_kj_mol: z.number(),
  df_h_liquid_kj_mol: z.number(),
  dvap_h_kj_mol: z.number().positive(),
  l_vap_j_g: z.number().positive(),
  review_status: ReviewStatusSchema,
});
export type WaterData = z.infer<typeof WaterSchema>;

const dataset = loadDataset('cell_elements', SliceSchema, raw);

/** The slices of figure 4.1, largest first (as the data lists them). */
export const SLICES: readonly Slice[] = dataset.items;
export const ELEMENTS_SOURCE: Source = dataset.source;
export const WATER: WaterData = WaterSchema.parse(raw.water);
/** "Nước chiếm khoảng 70% khối lượng cơ thể người" (tr. 25). */
export const BODY_WATER_PCT: number = z.number().positive().max(100).parse(raw.body_water_pct);

/** Sum of the shares (%) of the slices whose id is listed. */
export function shareOf(ids: readonly string[]): number {
  return SLICES.filter((s) => ids.includes(s.id)).reduce((sum, s) => sum + s.share_pct, 0);
}

/** Sum of the shares (%) of one group. */
export function groupShare(group: ElementGroup): number {
  return SLICES.filter((s) => s.group === group).reduce((sum, s) => sum + s.share_pct, 0);
}

/** C, H, O and N: "khoảng 96% khối lượng vật chất sống" (tr. 24). */
export const CHON = ['C', 'H', 'O', 'N'] as const;

/** Heat (J) to warm m grams of liquid water by ΔT (°C, = K): Q = m·c·ΔT, c at 25 °C. */
export function heatToWarm(mass: number, dT: number): number {
  return mass * WATER.c_specific_j_g_k * dT;
}

/** Heat (J) to evaporate m grams of water at 25 °C: Q = m·L. */
export function heatToEvaporate(mass: number): number {
  return mass * WATER.l_vap_j_g;
}

/** Grams of water that the heat taken by evaporating 1 g would warm by 1 °C: L / c. */
export function evaporationWarmEquivalent(): number {
  return WATER.l_vap_j_g / WATER.c_specific_j_g_k;
}

export const GROUP_NAME: Record<ElementGroup, LocalizedText> = {
  macro: L('Nguyên tố đa lượng', 'Macroelements'),
  trace: L('Nguyên tố vi lượng', 'Trace elements'),
};

/** What each group does (SGK tr. 24, 27), paraphrased; teaching text, DATA_REVIEW SH10-ELEM-3. */
export const GROUP_ROLE: Record<ElementGroup, LocalizedText> = {
  macro: L(
    'Hầu hết các loại tế bào đều cần với một lượng lớn. Chúng là thành phần chủ chốt cấu tạo nên mọi phân tử sinh học và mọi thành phần hoá học của tế bào.',
    'Nearly every kind of cell needs them in large amounts. They are the key building blocks of every biological molecule and every chemical component of the cell.',
  ),
  trace: L(
    'Sinh vật chỉ cần một lượng rất nhỏ, nhưng chúng thường cấu tạo nên enzyme và nhiều hợp chất quan trọng tham gia hoạt động sống. Thiếu chúng, hoạt động sống bị rối loạn: ví dụ ở người, thiếu iodine thì tuyến giáp phát triển bất thường, gây bệnh bướu cổ.',
    'Living things need only very small amounts, but they often build enzymes and many important compounds of life processes. Without them life processes go wrong: in humans, for example, too little iodine makes the thyroid grow abnormally (goitre).',
  ),
};

/** Why carbon matters (SGK tr. 24–25), paraphrased. */
export const CARBON_ROLE: LocalizedText = L(
  'Nguyên tử carbon có 4 electron hoá trị ở vòng ngoài nên tạo được bốn liên kết cộng hoá trị. Các nguyên tử carbon liên kết với nhau thành bộ khung mạch thẳng, mạch vòng, phân nhánh hoặc không phân nhánh; bộ khung gắn với các nhóm chức khác nhau tạo nên carbohydrate, lipid, protein và nucleic acid.',
  'A carbon atom has 4 valence electrons in its outer shell, so it forms four covalent bonds. Carbon atoms join into chains, rings, branched or unbranched skeletons; with different functional groups attached, these skeletons make carbohydrates, lipids, proteins and nucleic acids.',
);

/** Name of a slice as figure 4.1 labels it: "Oxygen (O)", "K, S, Na, Mg, Cl", trace elements. */
export function sliceName(s: Slice): LocalizedText {
  const [only, ...more] = s.symbols;
  if (only === undefined) return L('Các nguyên tố vi lượng', 'Trace elements');
  const text = more.length
    ? s.symbols.join(', ')
    : `${elementBySymbol(only)?.name ?? only} (${only})`;
  return L(text, text);
}
