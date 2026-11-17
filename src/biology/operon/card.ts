import type { Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';

export const SGK_SH12_BAI3: Source = {
  id: 'sgk-sh12-kntt-bai3',
  citation:
    'SGK Sinh học 12, bộ Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 3 “Điều hoà biểu hiện gene”, tr. 18–22 (đọc trên taphuan.nxbgd.vn ngày 17/11/2026)',
};

export const OPERON_TITLE = L(
  'Điều hòa biểu hiện gene: operon lac',
  'Gene regulation: the lac operon',
);

export const OPERON_CARD: ScienceCardData = {
  title: OPERON_TITLE,
  model: L(
    'Operon lac của vi khuẩn E. coli gồm vùng điều hòa (trình tự P – promoter, nơi RNA polymerase khởi động phiên mã, và trình tự O – operator, nơi protein ức chế liên kết) và ba gene cấu trúc lacZ, lacY, lacA quy định các enzyme β-galactosidase, permease, transacetylase. Gene điều hòa lacI nằm ngoài operon, quy định protein ức chế. Khi môi trường không có lactose, protein ức chế liên kết với O, ngăn RNA polymerase phiên mã. Khi có lactose, allolactose liên kết với protein ức chế làm nó thay đổi hình dạng, không liên kết được với O, nên các gene cấu trúc được phiên mã.',
    'The lac operon of E. coli has a regulatory region (P, the promoter where RNA polymerase starts, and O, the operator where the repressor binds) and three structural genes lacZ, lacY, lacA coding for β-galactosidase, permease and transacetylase. The regulator gene lacI, outside the operon, codes for the repressor. Without lactose the repressor binds O and blocks RNA polymerase. With lactose, allolactose binds the repressor, which changes shape and cannot bind O, so the structural genes are transcribed.',
  ),
  equations: [],
  assumptions: [
    L(
      'Mô hình bật/tắt theo sơ đồ Hình 3.1, 3.2 của sách; không mô phỏng lượng enzyme theo thời gian.',
      'An on/off model following the book’s Figures 3.1 and 3.2; enzyme amounts over time are not simulated.',
    ),
    L(
      '“Gene lacI bị hỏng” nghĩa là không có protein ức chế hoạt động; “vùng O bị hỏng” nghĩa là protein ức chế không liên kết được với O (câu 2 tr. 21).',
      '“lacI damaged” means no working repressor; “O damaged” means the repressor cannot bind O (question 2, p. 21).',
    ),
  ],
  validity: L(
    'Operon lac ở vi khuẩn E. coli như sách trình bày.',
    'The lac operon of E. coli as the book presents it.',
  ),
  confidence: 'qualitative',
  confidenceNote: L(
    'Mô hình định tính (bật/tắt), đúng theo cơ chế sách nêu; chờ giáo viên duyệt.',
    'A qualitative (on/off) model following the book’s mechanism; awaiting teacher review.',
  ),
  userIntervened: false,
  sources: [SGK_SH12_BAI3],
  reviewStatus: 'pending',
};
