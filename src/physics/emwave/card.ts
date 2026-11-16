import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { SRC, sgkVl11 } from '../common/sources';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L('Sóng điện từ', 'Electromagnetic waves');

export function emCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Sóng điện từ là điện từ trường lan truyền trong không gian; nó là sóng ngang: vectơ cường độ điện trường E và vectơ cảm ứng từ B vuông góc với nhau và cùng vuông góc với phương truyền. Trong chân không mọi sóng điện từ truyền với cùng tốc độ c, nên mỗi bước sóng ứng với đúng một tần số. Thang sóng điện từ xếp các loại bức xạ theo bước sóng.',
      'An electromagnetic wave is an electromagnetic field travelling through space; it is transverse: the electric field E and the magnetic field B are at right angles to each other and to the direction of travel. In vacuum every EM wave travels at the same speed c, so each wavelength goes with exactly one frequency. The electromagnetic spectrum orders the kinds of radiation by wavelength.',
    ),
    equations: [
      {
        tex: '\\lambda = cT = \\frac{c}{f}',
        label: L('Bước sóng trong chân không', 'Wavelength in vacuum'),
      },
      {
        tex: 'c = 3\\cdot 10^{8}\\ \\mathrm{m/s}',
        label: L('Tốc độ ánh sáng (SGK)', 'Speed of light (textbook)'),
      },
      {
        tex: '\\vec E \\perp \\vec B,\\quad \\vec E \\perp \\vec c,\\quad \\vec B \\perp \\vec c',
        label: L('Sóng ngang', 'A transverse wave'),
      },
    ],
    assumptions: [
      L(
        'Sóng truyền trong chân không. SimLab dùng c = 3·10⁸ m/s như SGK; giá trị đúng theo định nghĩa SI là 299 792 458 m/s, làm tròn như vậy chỉ lệch 0,07 %.',
        'The wave travels in vacuum. SimLab uses c = 3·10⁸ m/s as the textbook does; the exact SI value is 299 792 458 m/s, so the rounding is off by only 0.07 %.',
      ),
      L(
        'Phạm vi bước sóng của các dải lấy theo SGK: Bảng 11.1 (tr. 47) và mục 6 về tia gamma (tr. 47). Ranh giới giữa các dải không rõ ràng (SGK tr. 45): một bước sóng có thể thuộc hai dải, ví dụ sóng vi ba nằm trong dải sóng vô tuyến.',
        'The bands’ wavelength ranges follow the textbook: Table 11.1 (p. 47) and section 6 on gamma rays (p. 47). The borders are not sharp (p. 45): a wavelength can belong to two bands, for example microwaves lie inside the radio band.',
      ),
      L(
        'Hình động chỉ minh họa: sóng được làm chậm để nhìn thấy (một dao động khoảng 2 s) và biên độ E, B vẽ theo tỉ lệ tùy ý; con số λ, f, T là số tính đúng.',
        'The animation is an illustration: the wave is slowed down to be seen (about 2 s per oscillation) and E and B are drawn to an arbitrary scale; the numbers λ, f, T are computed exactly.',
      ),
    ],
    validity: L(
      `Chân không (hoặc gần đúng là không khí); bước sóng trong khoảng của thang sóng trong SGK, từ 10⁻¹⁴ m đến 100 km.`,
      `Vacuum (air is close); wavelengths across the textbook’s scale, from 10⁻¹⁴ m to 100 km.`,
    ),
    confidence: 'exact',
    confidenceNote: L(
      'λ = c/f là hệ thức đúng trong chân không; tên dải đọc từ bảng của SGK.',
      'λ = c/f holds exactly in vacuum; band names are read from the textbook’s table.',
    ),
    userIntervened: false,
    sources: [sgkVl11(11), SRC.hallidayEm, SRC.codata],
    reviewStatus: 'pending',
  };
}
