import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { HC_SOURCE } from './model';

export const TITLE = L('Hydrocarbon', 'Hydrocarbons');

export function hcCard(): ScienceCardData {
  return {
    title: TITLE,
    model: L(
      'Bốn dãy đồng đẳng của Chương 4: alkane, alkene, alkyne và dãy đồng đẳng của benzene. Mỗi dãy có một công thức chung; các chất trong dãy hơn kém nhau một hay nhiều nhóm CH₂. Tính chất vật lí lấy từ các bảng của sách; phương trình đốt cháy viết từ công thức chung.',
      'The four homologous series of chapter 4: alkanes, alkenes, alkynes and the benzene series. Each series has one general formula; its members differ by one or more CH₂ groups. Physical properties come from the book’s tables; the combustion equation is written from the general formula.',
    ),
    equations: [
      { tex: '\\mathrm{C_nH_{2n+2}}\\ (n \\ge 1)', label: L('Alkane (tr. 82)', 'Alkanes (p. 82)') },
      {
        tex: '\\mathrm{C_nH_{2n}},\\ \\mathrm{C_nH_{2n-2}}\\ (n \\ge 2)',
        label: L('Alkene, alkyne (tr. 92)', 'Alkenes, alkynes (p. 92)'),
      },
      {
        tex: '\\mathrm{C_nH_{2n-6}}\\ (n \\ge 6)',
        label: L('Dãy đồng đẳng của benzene (tr. 102)', 'Benzene series (p. 102)'),
      },
      {
        tex: '\\mathrm{C_nH_m} + \\left(n + \\tfrac{m}{4}\\right)\\mathrm{O_2} \\to n\\,\\mathrm{CO_2} + \\tfrac{m}{2}\\,\\mathrm{H_2O}',
        label: L('Đốt cháy hoàn toàn', 'Complete combustion'),
      },
    ],
    assumptions: [
      L(
        'Nhiệt độ nóng chảy, nhiệt độ sôi và khối lượng riêng ở 20 °C lấy nguyên từ Bảng 15.2, 16.2, 17.1 (sách ghi nguồn PubChem). Đồ thị nối các chất mạch không nhánh; đồng phân, chất có nhánh vẽ chấm rỗng.',
        'Melting points, boiling points and densities at 20 °C are taken from Tables 15.2, 16.2 and 17.1 (the book cites PubChem). The chart joins the straight-chain members; isomers and branched ones are hollow dots.',
      ),
      L(
        'Phân tử khối tính với nguyên tử khối của sách (C 12, H 1). Phương trình đốt cháy viết theo công thức chung và được bộ cân bằng của SimLab kiểm lại.',
        'Molar masses use the book’s atomic masses (C 12, H 1). Combustion equations follow the general formula and are checked by SimLab’s balancer.',
      ),
      L(
        'Các phản ứng khác (thế, cộng, nitro hóa, trùng hợp…) chỉ là phương trình in trong sách, kèm điều kiện; SimLab không mô phỏng cơ chế của chúng.',
        'The other reactions (substitution, addition, nitration, polymerisation…) are only the book’s printed equations with their conditions; SimLab does not simulate their mechanisms.',
      ),
    ],
    validity: L(
      'Hydrocarbon mạch hở và benzene, toluene, xylene, styrene, naphthalene trong sách.',
      'Open-chain hydrocarbons and the book’s benzene, toluene, xylenes, styrene and naphthalene.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức chung và phương trình cháy là hệ thức chính xác; số liệu đọc từ bảng của sách, chờ giáo viên duyệt.',
      'The general formulas and combustion equations are exact; the properties are read from the book’s tables, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [HC_SOURCE],
    reviewStatus: 'pending',
  };
}
