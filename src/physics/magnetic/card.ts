import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { sgkVl12 } from '../common/sources';
import { MAGNETISM_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L('Lực từ và cảm ứng từ', 'Magnetic force and magnetic field');

export function magneticCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Một đoạn dây dẫn thẳng dài L mang dòng điện I đặt trong từ trường đều có cảm ứng từ B chịu lực từ đặt tại trung điểm đoạn dây, vuông góc với dây và với B, có chiều theo quy tắc bàn tay trái và độ lớn F = BIL sinα, với α là góc giữa dây và vectơ cảm ứng từ. Ngược lại, đo F, I, L, α thì tính được B = F/(IL sinα).',
      'A straight wire of length L carrying a current I in a uniform field B feels a force at its midpoint, perpendicular to the wire and to B, whose direction follows the left-hand rule and whose size is F = BIL sinα, α being the angle between the wire and the field. Conversely, measuring F, I, L and α gives B = F/(IL sinα).',
    ),
    equations: [
      {
        tex: 'F = BIL\\sin\\alpha',
        label: L('Định luật Ampère (15.2)', 'Ampère’s force law (15.2)'),
      },
      {
        tex: 'B = \\dfrac{F}{IL\\sin\\alpha}',
        label: L('Độ lớn cảm ứng từ (15.1)', 'Magnetic field strength (15.1)'),
      },
      {
        tex: '\\vec F = I\\,\\vec L \\times \\vec B',
        label: L('Phương, chiều (quy tắc bàn tay trái)', 'Direction (left-hand rule)'),
      },
      {
        tex: '1\\,\\mathrm{T} = \\dfrac{1\\,\\mathrm{N}}{1\\,\\mathrm{m}\\cdot 1\\,\\mathrm{A}}',
        label: L('Đơn vị tesla (tr. 63)', 'The tesla (p. 63)'),
      },
    ],
    assumptions: [
      L(
        'Từ trường đều; đoạn dây thẳng nằm trọn trong từ trường.',
        'Uniform field; the straight wire lies wholly inside the field.',
      ),
      L(
        'Trên hình, vectơ B hướng sang phải, dây nằm trong mặt phẳng hình; lực từ vuông góc với mặt phẳng hình (⊗ hướng vào, ⊙ hướng ra).',
        'In the picture B points right and the wire lies in the page; the force is perpendicular to the page (⊗ into it, ⊙ out of it).',
      ),
      L(
        'Ở phần "Đo cảm ứng từ", số liệu là Bảng 15.1 (α = 90°, L = nl = 20 m); app tính B cho từng lần đo, giá trị trung bình, sai số tuyệt đối trung bình và đường thẳng qua gốc gần nhất các điểm.',
        'In “Measuring B” the data are Table 15.1 (α = 90°, L = nl = 20 m); the app computes B for each run, the mean, the mean absolute error and the best line through the origin.',
      ),
    ],
    validity: L(
      'Từ trường đều, dây thẳng; với dây cong hay từ trường không đều phải chia nhỏ đoạn dây.',
      'Uniform field and a straight wire; a bent wire or a non-uniform field needs the wire cut into small pieces.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Hệ thức là chính xác trong từ trường đều; số liệu thí nghiệm lấy từ sách, chờ giáo viên duyệt.',
      'The relation is exact in a uniform field; the experiment’s data come from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [sgkVl12(14), sgkVl12(15), MAGNETISM_SOURCE],
    reviewStatus: 'pending',
  };
}
