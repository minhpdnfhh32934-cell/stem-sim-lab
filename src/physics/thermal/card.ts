import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { sgkVl12 } from '../common/sources';
import { THERMAL_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L(
  'Nội năng, nhiệt độ và nhiệt lượng',
  'Internal energy, temperature and heat',
);

export function thermalCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Nội năng là tổng động năng và thế năng của các phân tử. Nó thay đổi khi vật nhận công hoặc nhận nhiệt: ΔU = A + Q. Khi vật nhận nhiệt mà không đổi thể, nhiệt độ tăng theo Q = mcΔT; khi vật đang nóng chảy hay đang sôi, nhiệt độ không đổi và nhiệt lượng dùng để chuyển thể: Q = λm, Q = Lm. Với một nguồn nhiệt công suất P mà vật nhận được phần H, thời gian của mỗi giai đoạn là Q/(H·P).',
      'Internal energy is the sum of the molecules’ kinetic and potential energies. It changes when the body receives work or heat: ΔU = A + Q. While a body takes heat without changing state its temperature rises by Q = mcΔT; while it melts or boils the temperature stays put and the heat changes its state: Q = λm, Q = Lm. With a heater of power P of which the body takes a share H, each stage lasts Q/(H·P).',
    ),
    equations: [
      {
        tex: '\\Delta U = A + Q',
        label: L('Định luật I (Bài 2, tr. 12)', 'First law (lesson 2, p. 12)'),
      },
      {
        tex: 'T\\,(\\mathrm{K}) = t\\,(^{\\circ}\\mathrm{C}) + 273{,}15',
        label: L('Thang Kelvin (Bài 3, tr. 17)', 'Kelvin scale (lesson 3, p. 17)'),
      },
      { tex: 'Q = mc\\Delta T', label: L('Nhiệt dung riêng (Bài 4)', 'Specific heat (lesson 4)') },
      {
        tex: 'Q = \\lambda m',
        label: L('Nhiệt nóng chảy riêng (Bài 5)', 'Latent heat of fusion (lesson 5)'),
      },
      {
        tex: 'Q = Lm',
        label: L('Nhiệt hóa hơi riêng (Bài 6)', 'Latent heat of vaporisation (lesson 6)'),
      },
      { tex: '\\tau = \\dfrac{Q}{H\\,\\mathscr{P}}', label: L('Thời gian đun', 'Heating time') },
    ],
    assumptions: [
      L(
        'Nhiệt dung riêng, nhiệt nóng chảy riêng, nhiệt hóa hơi riêng là giá trị gần đúng của Bảng 4.1, 5.1, 6.1, coi như không đổi trong mỗi thể; nhiệt độ nóng chảy và nhiệt độ sôi ở áp suất tiêu chuẩn.',
        'Specific heats and latent heats are the approximate values of Tables 4.1, 5.1 and 6.1, taken as constant within each state; melting and boiling points are at standard pressure.',
      ),
      L(
        'Vật nhận đều phần H của công suất nguồn; phần còn lại mất ra môi trường. Nhiệt độ trong vật coi là như nhau ở mọi chỗ.',
        'The body takes a steady share H of the heater’s power; the rest is lost. The temperature is taken as the same throughout the body.',
      ),
      L(
        'Sách không cho nhiệt dung riêng của kim loại lỏng và của hơi nước, nên đường đun nóng dừng khi kim loại nóng chảy hết, khi nước (hay thủy ngân) hóa hơi hết.',
        'The book gives no specific heat for liquid metals or for steam, so the heating curve stops once a metal has fully melted, or water (or mercury) has fully boiled away.',
      ),
      L(
        'Đổi nhiệt độ: T = t + 273,15 (sách thường làm tròn + 273); t (°F) = 32 + 1,8 t (°C).',
        'Converting temperatures: T = t + 273.15 (the book usually rounds to + 273); t (°F) = 32 + 1.8 t (°C).',
      ),
    ],
    validity: L(
      'Áp suất tiêu chuẩn; các chất và khoảng nhiệt độ có trong bảng của sách.',
      'Standard pressure; the substances and temperature ranges of the book’s tables.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Các hệ thức là chính xác với hằng số coi như không đổi; số liệu đọc từ bảng của sách, chờ giáo viên duyệt.',
      'The relations are exact with the constants taken as constant; the values are read from the book’s tables, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [sgkVl12(2), sgkVl12(3), sgkVl12(4), sgkVl12(5), sgkVl12(6), THERMAL_SOURCE],
    reviewStatus: 'pending',
  };
}
