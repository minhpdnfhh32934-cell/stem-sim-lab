import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { sgkVl12 } from '../../common/sources';
import { NUCLEAR_SOURCE } from '../data';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const TITLE = L('Hiện tượng phóng xạ', 'Radioactivity');

export function decayCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Phóng xạ là quá trình tự phát và ngẫu nhiên: không đoán được một hạt nhân sẽ phân rã lúc nào, nhưng với rất nhiều hạt nhân thì cứ sau một chu kì bán rã T, số hạt nhân còn lại giảm một nửa: N = N₀·2^(−t/T) = N₀e^(−λt), với hằng số phóng xạ λ = ln2/T. Độ phóng xạ là số hạt nhân phân rã trong một giây: H = λN, đơn vị becơren (Bq).',
      'Radioactive decay is spontaneous and random: no one can tell when a given nucleus decays, but for very many nuclei half of those left decay in every half-life T: N = N₀·2^(−t/T) = N₀e^(−λt), with the decay constant λ = ln2/T. The activity is the number of decays per second: H = λN, in becquerels (Bq).',
    ),
    equations: [
      {
        tex: 'N_t = N_0\\, 2^{-t/T} = N_0 e^{-\\lambda t}',
        label: L('Định luật phóng xạ (23.1), (23.3)', 'Decay law (23.1), (23.3)'),
      },
      {
        tex: '\\lambda = \\dfrac{\\ln 2}{T}',
        label: L('Hằng số phóng xạ', 'Decay constant'),
      },
      {
        tex: 'H_t = \\lambda N_t = H_0 e^{-\\lambda t}',
        label: L('Độ phóng xạ (23.2), (23.4)', 'Activity (23.2), (23.4)'),
      },
      {
        tex: '1\\,\\mathrm{Ci} = 3{,}7\\cdot 10^{10}\\,\\mathrm{Bq}',
        label: L('Đơn vị curi (tr. 108)', 'The curie (p. 108)'),
      },
    ],
    assumptions: [
      L(
        'Chu kì bán rã lấy từ Bảng 23.2 (hoặc do người học nhập); một năm tính là 365,25 ngày khi đổi ra giây.',
        'Half-lives come from Table 23.2 (or are typed in); a year is taken as 365.25 days when converting to seconds.',
      ),
      L(
        'Hình ở phần "Tính ngẫu nhiên" là minh họa: mỗi hạt nhân phân rã ngẫu nhiên với xác suất đúng theo định luật, dùng hạt giống cố định nên mở lại vẫn giống nhau; nó không phải số đo.',
        'The picture in “Randomness” is an illustration: each nucleus decays at random with the law’s probability, with a fixed seed so it is the same each time; it is not a measurement.',
      ),
      L(
        'An toàn: nguồn điểm, không bị hấp thụ trên đường đi; khoảng cách tăng gấp đôi thì liều giảm 4 lần như sách nêu.',
        'Safety: a point source with no absorption on the way; twice as far gives a quarter of the dose, as the book says.',
      ),
    ],
    validity: L(
      'Định luật phóng xạ đúng cho số rất lớn hạt nhân; với ít hạt nhân, số còn lại dao động ngẫu nhiên quanh N₀·2^(−t/T).',
      'The decay law holds for very many nuclei; with few nuclei the number left scatters at random around N₀·2^(−t/T).',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Hệ thức là chính xác cho số trung bình; số liệu lấy từ sách, chờ giáo viên duyệt.',
      'The relation is exact for the average; the data come from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [sgkVl12(23), NUCLEAR_SOURCE],
    reviewStatus: 'pending',
  };
}
