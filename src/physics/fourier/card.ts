import type { LocalizedText, Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { SRC } from '../common/sources';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

/** Fourier series of the square and sawtooth waves, and the Gibbs overshoot (DATA_REVIEW FOU-1). */
export const KREYSZIG: Source = {
  id: 'kreyszig-aem',
  citation:
    'E. Kreyszig — Advanced Engineering Mathematics, 10th ed., Wiley 2011, chương 11 (chuỗi Fourier, hiện tượng Gibbs)',
};

export const TITLE = L('Hoạ âm và chuỗi Fourier', 'Harmonics and Fourier series');

export function fourierCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Một sóng tuần hoàn (sóng vuông hoặc răng cưa, biên độ 1, chu kì T = 1/f₁) được dựng lại bằng tổng các dao động điều hoà có tần số f₁, 2f₁, 3f₁… (các hoạ âm). Tổng riêng S_N giữ các hoạ âm từ bậc 1 đến bậc N.',
      'A periodic wave (square or sawtooth, amplitude 1, period T = 1/f₁) is rebuilt as a sum of harmonic oscillations at f₁, 2f₁, 3f₁… (the harmonics). The partial sum S_N keeps harmonics 1 to N.',
    ),
    equations: [
      {
        tex: 'S_N(t) = \\frac{4}{\\pi}\\sum_{n=1,3,5,\\ldots}^{N}\\frac{\\sin(n\\omega t)}{n}',
        label: L('Sóng vuông (chỉ có hoạ âm bậc lẻ)', 'Square wave (odd harmonics only)'),
      },
      {
        tex: 'S_N(t) = \\frac{2}{\\pi}\\sum_{n=1}^{N}(-1)^{n+1}\\frac{\\sin(n\\omega t)}{n}',
        label: L('Sóng răng cưa', 'Sawtooth wave'),
      },
      {
        tex: 'f_n = n f_1,\\quad \\omega = 2\\pi f_1',
        label: L('Tần số hoạ âm bậc n', 'Frequency of harmonic n'),
      },
    ],
    assumptions: [
      L(
        'Sóng lí tưởng, biên độ tương đối 1; hệ số mỗi hoạ âm theo công thức chính xác và được kiểm lại bằng tích phân số.',
        'Ideal waves, relative amplitude 1; each harmonic’s coefficient is the exact formula, checked by numerical integration.',
      ),
      L(
        'Gần chỗ sóng nhảy, tổng riêng luôn vượt quá sóng một đoạn không nhỏ đi khi thêm hoạ âm (hiện tượng Gibbs); con số trên màn hình do SimLab tính từ chính tổng đang vẽ.',
        'Near a jump the partial sum always overshoots the wave by an amount that does not shrink as harmonics are added (the Gibbs phenomenon); the figure on screen is computed from the drawn sum.',
      ),
      L(
        '“Nghe” phát đúng các hoạ âm đang vẽ ở tần số f₁, âm lượng nhỏ và được trình duyệt chuẩn hoá theo đỉnh; không mô phỏng loa hay tai người.',
        '“Nghe” plays exactly the drawn harmonics at f₁, quietly, normalised to its peak by the browser; loudspeakers and hearing are not modelled.',
      ),
    ],
    validity: L(
      'Toán học chính xác cho hai sóng lí tưởng; âm nghe được còn phụ thuộc loa và tai.',
      'Exact mathematics for the two ideal waves; what you hear also depends on the speaker and the ear.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Tổng riêng tính trực tiếp từ công thức; hệ số kiểm lại bằng tích phân số.',
      'Partial sums computed straight from the formula; coefficients checked by numerical integration.',
    ),
    userIntervened: false,
    sources: [KREYSZIG, SRC.sgk11kntt],
    reviewStatus: 'pending',
  };
}
