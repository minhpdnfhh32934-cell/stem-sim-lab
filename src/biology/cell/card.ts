import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { CELL_KIND_NAME, SGK_SH10_KNTT, type CellKind } from './parts';

/**
 * The lesson's own caption (not the 3D kit's sentence, which says counts come from a model):
 * here nothing is measured or counted.
 */
export const CELL_ILLUSTRATION = L(
  'Minh hoạ — không theo tỉ lệ; số lượng bào quan chỉ để minh hoạ.',
  'Illustration — not to scale; the number of organelles drawn is only illustrative.',
);

const MODEL: Record<CellKind, LocalizedText> = {
  bacterium: L(
    'Sơ đồ định tính một tế bào vi khuẩn điển hình (nhân sơ): chưa có màng nhân; bào quan duy nhất trong tế bào chất là ribosome, không có bào quan có màng bao bọc.',
    'A qualitative diagram of a typical bacterial (prokaryotic) cell: no nuclear envelope; the only organelles in the cytoplasm are ribosomes — no membrane-bound organelles.',
  ),
  animal: L(
    'Sơ đồ định tính một tế bào động vật (nhân thực): có nhân với màng nhân, hệ thống nội màng và các bào quan có màng bao bọc; không có thành tế bào, lục lạp.',
    'A qualitative diagram of an animal (eukaryotic) cell: a nucleus with its envelope, the endomembrane system and membrane-bound organelles; no cell wall or chloroplasts.',
  ),
  plant: L(
    'Sơ đồ định tính một tế bào thực vật (nhân thực): có nhân với màng nhân và các bào quan có màng bao bọc, cùng thành tế bào, lục lạp và không bào trung tâm.',
    'A qualitative diagram of a plant (eukaryotic) cell: a nucleus with its envelope and membrane-bound organelles, plus a cell wall, chloroplasts and a central vacuole.',
  ),
};

/** Science Card: qualitative, no equations (MASTER_PROMPT §2.4). */
export function cellCard(kind: CellKind): ScienceCardData {
  return {
    title: CELL_KIND_NAME[kind],
    model: MODEL[kind],
    equations: [],
    assumptions: [
      CELL_ILLUSTRATION,
      L(
        'Tên và chức năng các bộ phận diễn đạt ngắn gọn theo sách giáo khoa; vị trí, hình dạng và màu sắc chỉ để dễ phân biệt.',
        'Part names and functions are short paraphrases of the textbook; positions, shapes and colours are only there to tell the parts apart.',
      ),
    ],
    validity: L(
      'Tế bào điển hình theo sách giáo khoa. Tế bào thật rất đa dạng: không phải vi khuẩn nào cũng có lông, roi, màng ngoài hay plasmid, và tế bào nhân thực khác nhau tuỳ loại mô.',
      'A typical cell as in the textbook. Real cells vary: not every bacterium has pili, flagella, an outer membrane or plasmids, and eukaryotic cells differ from tissue to tissue.',
    ),
    confidence: 'qualitative',
    confidenceNote: L(
      'Hình định tính: không đọc kích thước hay số lượng từ hình.',
      'Qualitative picture: do not read sizes or counts from it.',
    ),
    userIntervened: false,
    sources: [SGK_SH10_KNTT],
    reviewStatus: 'pending',
  };
}
