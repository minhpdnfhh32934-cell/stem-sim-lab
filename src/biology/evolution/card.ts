import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { sgkSh12 } from '../sh12Sources';
import { EVOLUTION_SOURCE } from './model';

export const EVOLUTION_TITLE = L(
  'Bằng chứng tiến hóa và lịch sử sự sống',
  'Evidence of evolution and the history of life',
);

export const EVOLUTION_CARD: ScienceCardData = {
  title: EVOLUTION_TITLE,
  model: L(
    'Hóa thạch là bằng chứng trực tiếp cho thấy sinh vật đã từng tồn tại và tiến hóa; cấu trúc tương đồng và bằng chứng tế bào, phân tử cho thấy các loài có chung tổ tiên. Các loài có họ hàng càng gần thì trình tự amino acid trong protein (ví dụ cytochrome C) càng giống nhau. Sự sống phát triển qua các đại địa chất; những biến cố lớn về địa chất làm nhiều loài bị diệt vong rồi nhiều loài mới xuất hiện.',
    'Fossils show directly that organisms lived and evolved; homologous structures and cell and molecular evidence show common ancestry. The closer two species, the more alike their protein sequences (for example cytochrome C). Life developed through the geological eras; major geological events wiped out many species, after which many new ones appeared.',
  ),
  equations: [],
  assumptions: [
    L(
      'Số liệu là Bảng 19.1 và Bảng 22.1 của sách; thời gian tính bằng triệu năm trước.',
      'The data are the book’s Tables 19.1 and 22.1; times are millions of years ago.',
    ),
  ],
  validity: L(
    'Các mốc thời gian là ước lượng sách dẫn; các nghiên cứu mới có thể điều chỉnh.',
    'The dates are the estimates the book quotes; new research may revise them.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Bảng và thứ tự lấy đúng từ sách; chờ giáo viên duyệt.',
    'Tables and order follow the book exactly; awaiting teacher review.',
  ),
  userIntervened: false,
  sources: [
    sgkSh12(19, 'Các bằng chứng tiến hoá', '97–100'),
    sgkSh12(22, 'Tiến hoá lớn và quá trình phát sinh chủng loại', '113–120'),
    EVOLUTION_SOURCE,
  ],
  reviewStatus: 'pending',
};
