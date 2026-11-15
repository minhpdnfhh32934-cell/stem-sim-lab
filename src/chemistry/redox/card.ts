import type { Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { REACTIONS_SOURCE } from '../data/reactions';

const READER = 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983';

export const SGK_B15: Source = {
  id: 'sgk-hh10-kntt-b15',
  citation:
    'SGK Hoá học 10, Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 15: khái niệm số oxi hoá (tr. 71), quy tắc và Bảng 15.1 (tr. 72), chất oxi hoá, chất khử (tr. 73), phương pháp thăng bằng electron (tr. 74); Bài 21 (tr. 106): fluorine luôn có số oxi hoá −1',
  url: READER,
};

export const OPENSTAX_OX: Source = {
  id: 'openstax-chem2e-4-2',
  citation:
    'P. Flowers et al., Chemistry 2e, OpenStax (CC BY 4.0), §4.2 Classifying Chemical Reactions: oxidation numbers of H with metals, peroxides, O with F, the other halogens',
  url: 'https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions',
};

/** Science Card of "Phản ứng oxi hoá – khử" (HH10 Bài 15; DATA_REVIEW HH10-RX-2, -3). */
export const REDOX_CARD: ScienceCardData = {
  title: L('Phản ứng oxi hoá – khử', 'Redox reactions'),
  model: L(
    'Số oxi hoá là điện tích quy ước của nguyên tử trong phân tử khi coi tất cả các electron liên kết đều chuyển hoàn toàn về nguyên tử có độ âm điện lớn hơn (SGK tr. 71). Chương trình áp dụng các quy tắc của sách cho từng chất, lấy hệ số từ bộ cân bằng chính xác, rồi tìm nguyên tử thay đổi số oxi hoá, chất khử, chất oxi hoá và số electron trao đổi. Chỉ phân tích phản ứng có trong thư viện đã kiểm chứng.',
    'The oxidation number is the conventional charge of an atom in a molecule when all bonding electrons are taken to belong to the more electronegative atom (SGK p. 71). The program applies the book’s rules to each species, takes the coefficients from the exact balancer, then finds the atoms whose oxidation number changes, the reducing and oxidising agents and the electrons transferred. Only reactions in the verified library are analysed.',
  ),
  equations: [
    {
      tex: '\\sum_i n_i\\,x_i = q',
      label: L(
        'Tổng số oxi hoá bằng điện tích của phân tử hoặc ion (nᵢ: số nguyên tử, xᵢ: số oxi hoá)',
        'The oxidation numbers add up to the charge of the molecule or ion (nᵢ: atoms, xᵢ: oxidation number)',
      ),
    },
    {
      tex: '\\sum_{\\Delta x > 0} n\\,\\Delta x = \\sum_{\\Delta x < 0} n\\,|\\Delta x|',
      label: L(
        'Tổng số electron chất khử nhường bằng tổng số electron chất oxi hoá nhận (Δx: thay đổi số oxi hoá của n nguyên tử)',
        'Electrons given by the reducing agent equal those taken by the oxidising agent (Δx: change of oxidation number of n atoms)',
      ),
    },
  ],
  assumptions: [
    L(
      'Quy tắc của sách (Bảng 15.1): đơn chất 0; trong hợp chất H là +1, O là −2, kim loại nhóm IA +1, nhóm IIA +2, Al +3; tổng bằng điện tích; ion đơn nguyên tử có số oxi hoá bằng điện tích ion.',
      'The book’s rules (Bảng 15.1): free elements 0; in compounds H is +1, O is −2, group IA metals +1, group IIA +2, Al +3; the sum equals the charge; a monatomic ion has its charge.',
    ),
    L(
      'Ngoại lệ thường gặp (OpenStax §4.2; SGK tr. 106 cho fluorine): F luôn −1; O là −1 trong peroxide và dương khi liên kết với F; H là −1 khi liên kết với kim loại; Cl, Br, I là −1 trong hợp chất hai nguyên tố với kim loại.',
      'Usual exceptions (OpenStax §4.2; SGK p. 106 for fluorine): F is always −1; O is −1 in peroxides and positive with F; H is −1 with metals; Cl, Br, I are −1 in binary compounds with a metal.',
    ),
    L(
      'Khi quy tắc không đủ (hai nguyên tố chưa biết như Cu và S trong CuSO₄, hợp chất hữu cơ nhiều nguyên tử C, một nguyên tố viết ở hai nhóm như N trong NH₄NO₃), chương trình nói rõ là không xác định được, không đoán.',
      'When the rules are not enough (two unknown elements such as Cu and S in CuSO₄, organic compounds with several C atoms, an element written in two groups such as N in NH₄NO₃), the program says it cannot decide; it never guesses.',
    ),
    L(
      'Số oxi hoá là điện tích quy ước, không phải điện tích thật của nguyên tử.',
      'An oxidation number is a conventional charge, not the atom’s real charge.',
    ),
  ],
  validity: L(
    'Các phản ứng trong thư viện đã kiểm chứng; phương trình khác chỉ nhận cảnh báo “chưa có trong cơ sở dữ liệu đã kiểm chứng”.',
    'Reactions in the verified library; any other equation only gets the warning “not in the verified database”.',
  ),
  confidence: 'exact',
  confidenceNote: L(
    'Quy tắc áp dụng đúng từng bước và hệ số tính bằng số hữu tỉ chính xác; nội dung đang chờ giáo viên duyệt.',
    'The rules are applied step by step and the coefficients use exact rational arithmetic; the content awaits a teacher’s review.',
  ),
  userIntervened: false,
  sources: [SGK_B15, OPENSTAX_OX, REACTIONS_SOURCE],
  reviewStatus: 'pending',
};
