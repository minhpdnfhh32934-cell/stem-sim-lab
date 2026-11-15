/**
 * Science Cards of "Sinh trưởng của quần thể vi khuẩn": the formula view is exact (the textbook's
 * formula, evaluated as written), the four-phase picture is qualitative (an illustration).
 */
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { SGK_SH10_BAI21 } from './growth';

export const GROWTH_CARD: ScienceCardData = {
  title: L('Sinh trưởng của quần thể vi khuẩn', 'Growth of a bacterial population'),
  model: L(
    'Trong điều kiện lí tưởng (mọi yếu tố môi trường đều tối ưu), thời gian thế hệ g là hằng số: cứ sau g phút số tế bào tăng gấp đôi. Số tế bào sau thời gian t tính đúng theo công thức của sách giáo khoa.',
    'In ideal conditions (every factor of the medium optimal) the generation time g is constant: every g minutes the number of cells doubles. The number after time t is computed exactly with the textbook formula.',
  ),
  equations: [
    { tex: 'N_t = N_0 \\times 2^{t/g} = N_0 \\times 2^{n}' },
    { tex: 'n = \\dfrac{t}{g}' },
    { tex: '\\log_2 N_t = \\log_2 N_0 + \\dfrac{t}{g}' },
  ],
  assumptions: [
    L(
      'Điều kiện lí tưởng suốt thời gian t: đủ dinh dưỡng, không có chất độc, không tế bào nào chết. Đó là pha lũy thừa của nuôi cấy không liên tục; các pha khác không theo công thức này.',
      'Ideal conditions for the whole time t: enough nutrients, no toxic substances, no cell dies. That is the exponential phase of a batch culture; the other phases do not follow this formula.',
    ),
    L(
      'Khi t không là bội của g, n = t/g không nguyên: công thức cho số tế bào trung bình của một quần thể mà các tế bào không phân chia cùng lúc.',
      'When t is not a multiple of g, n = t/g is not a whole number: the formula then gives the average count of a population whose cells do not divide at the same moment.',
    ),
  ],
  validity: L(
    'Chỉ đúng trong pha lũy thừa. Một quần thể thật không tăng mãi: khi dinh dưỡng giảm và chất độc hại tăng, quần thể sang pha cân bằng.',
    'Valid only in the exponential phase. A real population cannot grow for ever: as nutrients fall and toxic substances build up, it enters the stationary phase.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Tính đúng công thức (không có bước gần đúng); test so sánh với các ví dụ nhân đôi của sách.',
    'The formula is evaluated as written (no approximation step); tests check it against doubling examples.',
  ),
  userIntervened: false,
  sources: [SGK_SH10_BAI21],
  reviewStatus: 'pending',
};

export const PHASES_CARD: ScienceCardData = {
  title: L('Bốn pha của nuôi cấy không liên tục', 'The four phases of a batch culture'),
  model: L(
    'Hình định tính theo H 21.4 của sách giáo khoa: trong môi trường không được bổ sung dinh dưỡng và không lấy bớt sản phẩm, quần thể vi khuẩn qua pha tiềm phát, pha lũy thừa, pha cân bằng và pha suy vong.',
    'A qualitative picture after the textbook’s figure 21.4: in a medium that gets no new nutrients and loses no products, a bacterial population goes through the lag, exponential, stationary and death phases.',
  ),
  equations: [],
  assumptions: [
    L(
      'Hình minh họa: độ dài các pha và độ cao đường cong không phải số liệu đo.',
      'Illustration: the lengths of the phases and the height of the curve are not measured data.',
    ),
    L(
      'Chỉ pha lũy thừa có công thức (xem chế độ "Công thức").',
      'Only the exponential phase has a formula (see the "Formula" view).',
    ),
  ],
  validity: L(
    'Nuôi cấy không liên tục. Trong nuôi cấy liên tục (thường xuyên bổ sung dinh dưỡng, loại bỏ sản phẩm) quần thể được giữ ở mức cân bằng.',
    'Batch culture. In a continuous culture (nutrients added and products removed all the time) the population is held at a steady level.',
  ),
  confidence: 'qualitative',
  confidenceNote: L(
    'Hình định tính: không đọc số từ đường cong.',
    'Qualitative picture: do not read numbers from the curve.',
  ),
  userIntervened: false,
  sources: [SGK_SH10_BAI21],
  reviewStatus: 'pending',
};
