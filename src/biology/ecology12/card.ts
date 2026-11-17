import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { sgkSh12 } from '../sh12Sources';
import { ECOLOGY12_SOURCE } from './model';

export const TOLERANCE_TITLE = L(
  'Môi trường và các nhân tố sinh thái',
  'Environment and ecological factors',
);
export const PYRAMID_TITLE = L(
  'Trao đổi vật chất và chuyển hóa năng lượng trong hệ sinh thái',
  'Matter and energy in ecosystems',
);

const pending = L(
  'Vùng và tỉ lệ tính đúng từ số liệu sách; chờ giáo viên duyệt.',
  'Zones and ratios follow exactly from the book’s data; awaiting teacher review.',
);

export const TOLERANCE_CARD: ScienceCardData = {
  title: TOLERANCE_TITLE,
  model: L(
    'Khoảng giá trị xác định của một nhân tố sinh thái mà tại đó sinh vật tồn tại và phát triển ổn định theo thời gian gọi là giới hạn sinh thái. Giới hạn sinh thái gồm khoảng thuận lợi, nơi sinh vật sinh trưởng và phát triển tốt nhất, và các khoảng ức chế, nơi hoạt động sinh lí bị ức chế. Vượt qua giới hạn, sinh vật bị chết. Ngoài ra các nhân tố sinh thái còn tác động tổng hợp và tác động không đồng đều lên sinh vật.',
    'The range of an ecological factor within which an organism survives and develops steadily is its tolerance range. It holds an optimum range, where the organism grows best, and stress ranges, where its physiology is inhibited. Beyond the limits it dies. Ecological factors also act together and act unevenly on organisms.',
  ),
  equations: [],
  assumptions: [
    L(
      'Đường cong chỉ minh họa hình dạng như Hình 23.5; các mốc nhiệt độ là ví dụ của sách về quang hợp của thực vật.',
      'The curve only shows the shape of Figure 23.5; the temperatures are the book’s example for plant photosynthesis.',
    ),
  ],
  validity: L(
    'Ví dụ về nhiệt độ đối với quang hợp của thực vật như sách nêu.',
    'The book’s temperature example for plant photosynthesis.',
  ),
  confidence: 'qualitative',
  confidenceNote: pending,
  userIntervened: false,
  sources: [sgkSh12(23, 'Môi trường và các nhân tố sinh thái', '122–127'), ECOLOGY12_SOURCE],
  reviewStatus: 'pending',
};

export const PYRAMID_CARD: ScienceCardData = {
  title: PYRAMID_TITLE,
  model: L(
    'Năng lượng ánh sáng mặt trời đi vào hệ sinh thái qua quang hợp ở sinh vật sản xuất, truyền qua các bậc dinh dưỡng và được giải phóng ra môi trường dưới dạng nhiệt; ở mỗi bậc, phần lớn năng lượng bị thất thoát. Hiệu suất sinh thái là tỉ lệ phần trăm chuyển hóa năng lượng giữa các bậc dinh dưỡng, trung bình khoảng 10 %, thực tế dao động khoảng 5 – 20 %. Tháp sinh thái biểu diễn số lượng, sinh khối hoặc năng lượng ở các bậc dinh dưỡng; tháp số lượng và tháp sinh khối có thể có dạng ngược, tháp năng lượng luôn có dạng điển hình.',
    'Sunlight enters an ecosystem through photosynthesis by producers, passes along the trophic levels and leaves as heat; at each level most of the energy is lost. Ecological efficiency is the percentage of energy passed between levels, about 10 % on average and 5 – 20 % in practice. Ecological pyramids show numbers, biomass or energy at each level; number and biomass pyramids can be inverted, an energy pyramid is always upright.',
  ),
  equations: [
    {
      tex: 'H = \\dfrac{E_{n+1}}{E_{n}} \\times 100\\,\\%',
      label: L(
        'Hiệu suất sinh thái giữa hai bậc kế tiếp',
        'Efficiency between two successive levels',
      ),
    },
  ],
  assumptions: [
    L(
      'Độ rộng mỗi bậc tỉ lệ với số liệu của Hình 29.6; bậc quá nhỏ vẫn được vẽ đủ để thấy.',
      'Each level’s width follows Figure 29.6’s data; a very small level is still drawn wide enough to see.',
    ),
  ],
  validity: L(
    'Số liệu của các hệ sinh thái sách dẫn (Odum 1959).',
    'The data of the ecosystems the book quotes (Odum 1959).',
  ),
  confidence: 'exact',
  confidenceNote: pending,
  userIntervened: false,
  sources: [
    sgkSh12(29, 'Trao đổi vật chất và chuyển hoá năng lượng trong hệ sinh thái', '155–160'),
    ECOLOGY12_SOURCE,
  ],
  reviewStatus: 'pending',
};
