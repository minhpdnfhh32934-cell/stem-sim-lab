import type { ScienceCardData } from '@/science-card/types';
import { L } from '../common';
import { DER_SOURCE } from './model';

export const HAP_TITLE = L(
  'Dẫn xuất halogen, alcohol, phenol',
  'Halogen derivatives, alcohols, phenols',
);
export const CA_TITLE = L(
  'Hợp chất carbonyl, carboxylic acid',
  'Carbonyl compounds, carboxylic acids',
);

const TABLES = L(
  'Nhiệt độ sôi, nhiệt độ nóng chảy, độ tan lấy nguyên từ các bảng và các so sánh của sách; app không tự tính tính chất vật lí nào.',
  'Boiling points, melting points and solubilities are taken as printed from the book’s tables and comparisons; the app computes no physical property.',
);
const EQUATIONS = L(
  'Phương trình là của sách, kèm điều kiện; mỗi phương trình viết bằng công thức cụ thể đã được kiểm tra bảo toàn nguyên tố. SimLab không mô phỏng cơ chế phản ứng.',
  'The equations are the book’s, with their conditions; each one written with actual formulas is checked for conservation of elements. SimLab does not simulate reaction mechanisms.',
);

export function hapCard(): ScienceCardData {
  return {
    title: HAP_TITLE,
    model: L(
      'Chương 5: dẫn xuất halogen RXₙ, alcohol no, đơn chức, mạch hở CₙH₂ₙ₊₁OH (n ≥ 1) và phenol. Liên kết hydrogen giải thích vì sao alcohol sôi cao hơn và tan tốt hơn hydrocarbon, ether có phân tử khối tương đương. Phản ứng tách theo quy tắc Zaitsev.',
      'Chapter 5: halogen derivatives RXₙ, saturated monohydric open-chain alcohols CₙH₂ₙ₊₁OH (n ≥ 1) and phenol. Hydrogen bonding explains why alcohols boil higher and dissolve better than hydrocarbons and ethers of similar molar mass. Eliminations follow Zaitsev’s rule.',
    ),
    equations: [
      {
        tex: '\\mathrm{R{-}X + OH^- \\to R{-}OH + X^-}',
        label: L('Thế halogen (tr. 115)', 'Halogen substitution (p. 115)'),
      },
      {
        tex: '\\mathrm{C_nH_{2n+1}OH} + \\tfrac{3n}{2}\\,\\mathrm{O_2} \\to n\\,\\mathrm{CO_2} + (n+1)\\,\\mathrm{H_2O}',
        label: L('Đốt cháy alcohol (tr. 125)', 'Burning an alcohol (p. 125)'),
      },
    ],
    assumptions: [
      TABLES,
      L(
        'Quy tắc Zaitsev (tr. 116, 124): nguyên tử halogen (hay nhóm –OH) bị tách ưu tiên cùng nguyên tử hydrogen ở carbon bên cạnh có bậc cao hơn. Bậc của một carbon là số nguyên tử carbon liên kết với nó; app đếm bậc từ mạch carbon và áp dụng đúng quy tắc của sách.',
        'Zaitsev’s rule (pp. 116, 124): the halogen (or the –OH group) leaves preferably with a hydrogen of the neighbouring carbon of higher degree. A carbon’s degree is the number of carbon atoms bonded to it; the app counts it from the carbon chain and applies the book’s rule as stated.',
      ),
      EQUATIONS,
    ],
    validity: L(
      'Các chất trong bảng của sách và các ví dụ, câu hỏi về phản ứng tách của Bài 19, 20.',
      'The compounds of the book’s tables and the elimination examples and questions of lessons 19 and 20.',
    ),
    confidence: 'qualitative',
    confidenceNote: L(
      'Số liệu đọc từ sách, chờ giáo viên duyệt; quy tắc Zaitsev cho sản phẩm chính, không cho tỉ lệ sản phẩm.',
      'Values are read from the book, awaiting teacher review; Zaitsev’s rule names the main product, not the product ratio.',
    ),
    userIntervened: false,
    sources: [DER_SOURCE],
    reviewStatus: 'pending',
  };
}

export function caCard(): ScienceCardData {
  return {
    title: CA_TITLE,
    model: L(
      'Chương 6: aldehyde, ketone và carboxylic acid. Nhóm carbonyl phân cực; nhóm carboxyl vừa phân cực vừa tạo liên kết hydrogen, nên acid sôi cao nhất trong các chất có phân tử khối tương đương. Carboxylic acid là acid yếu: chỉ một phần nhỏ phân li.',
      'Chapter 6: aldehydes, ketones and carboxylic acids. The carbonyl group is polar; the carboxyl group is polar and forms hydrogen bonds, so acids boil highest among compounds of similar molar mass. Carboxylic acids are weak: only a small part dissociates.',
    ),
    equations: [
      {
        tex: '\\mathrm{RCOOH \\rightleftharpoons RCOO^- + H^+}',
        label: L('Phân li (tr. 148)', 'Dissociation (p. 148)'),
      },
      {
        tex: 'K_a = \\dfrac{[\\mathrm{H^+}][\\mathrm{RCOO^-}]}{[\\mathrm{RCOOH}]} = \\dfrac{C\\alpha^2}{1-\\alpha}',
        label: L('Hằng số phân li, độ phân li α', 'Dissociation constant, fraction α'),
      },
      {
        tex: '\\mathrm{pH} = -\\lg[\\mathrm{H^+}],\\ [\\mathrm{H^+}] = C\\alpha',
        label: L('Bài 2', 'Lesson 2'),
      },
    ],
    assumptions: [
      TABLES,
      L(
        'Phần trăm phân li tính từ hằng số Kₐ của Bảng 24.3 bằng nghiệm đúng của phương trình trên, bỏ qua H⁺ do nước phân li (ở mọi nồng độ app cho chọn, [H⁺] lớn hơn 10⁻⁶ M). Ở 0,1 M, app đặt cạnh số in trong sách.',
        'The percentage dissociated is computed from Table 24.3’s Kₐ with the exact root of the equation above, neglecting the H⁺ from water (at every concentration offered, [H⁺] exceeds 10⁻⁶ M). At 0.1 M the app shows the book’s printed value beside it.',
      ),
      EQUATIONS,
    ],
    validity: L(
      'Dung dịch loãng, lí tưởng (nồng độ thay cho hoạt độ), 10⁻³ đến 1 M; bốn acid của Bảng 24.3.',
      'Dilute ideal solutions (concentration in place of activity), 10⁻³ to 1 M; the four acids of Table 24.3.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Độ phân li và pH là nghiệm chính xác trong mô hình lí tưởng; số liệu đọc từ sách, chờ giáo viên duyệt.',
      'Dissociation and pH are exact within the ideal model; the values are read from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [DER_SOURCE],
    reviewStatus: 'pending',
  };
}
