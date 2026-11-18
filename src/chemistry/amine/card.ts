import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { ELEMENTS_SOURCE } from '../data/elements';
import { NITROGEN_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const AMINE_TITLE = L('Amine', 'Amines');
export const AA_TITLE = L('Amino acid và peptide', 'Amino acids and peptides');

const molarNote = L(
  'Khối lượng mol tính theo nguyên tử khối chuẩn trong dữ liệu nguyên tố của SimLab, vì sách Hóa học 12 không in bảng nguyên tử khối.',
  'Molar masses use the standard atomic weights of SimLab’s element data, since the chemistry book prints no table of them.',
);

export function amineCard(): ScienceCardData {
  return {
    title: AMINE_TITLE,
    model: L(
      'Amine là dẫn xuất của ammonia khi thay nguyên tử hydrogen bằng gốc hydrocarbon. Bậc amine là số gốc hydrocarbon liên kết với nguyên tử nitrogen. Tên gốc – chức gồm tên các gốc (theo thứ tự chữ cái) và "amine"; tên thay thế lấy gốc lớn nhất làm mạch chính, các gốc khác gắn trên N. Do nguyên tử N còn cặp electron chưa liên kết, amine có tính base yếu như ammonia.',
      'An amine is ammonia with hydrogen atoms replaced by hydrocarbon groups; its degree is the number of such groups on the N. A radicofunctional name lists the groups alphabetically and adds "amine"; a substitutive name takes the largest group as the parent and puts the others on the N. With its lone pair, the N makes amines weak bases like ammonia.',
    ),
    equations: [
      {
        tex: '\\mathrm{CH_3NH_2 + H_2O \\rightleftharpoons CH_3NH_3^+ + OH^-}',
        label: L('Tính base (tr. 38)', 'Basicity (p. 38)'),
      },
      {
        tex: '\\mathrm{CH_3NH_2 + HCl \\rightarrow CH_3NH_3Cl}',
        label: L('Phản ứng với acid (tr. 38)', 'With an acid (p. 38)'),
      },
      {
        tex: '\\mathrm{CH_3NH_2 + HONO \\rightarrow CH_3OH + N_2 + H_2O}',
        label: L(
          'Amine bậc một với nitrous acid (tr. 39)',
          'A primary amine with nitrous acid (p. 39)',
        ),
      },
    ],
    assumptions: [
      L(
        'Danh sách đồng phân gồm các amine no, mạch hở có không quá 4 nguyên tử C; nhiệt độ nóng chảy, nhiệt độ sôi là Bảng 8.1 của sách.',
        'The isomer list holds the saturated open-chain amines with at most 4 carbon atoms; melting and boiling points are the book’s Table 8.1.',
      ),
      molarNote,
    ],
    validity: L(
      'Alkylamine no, mạch hở, đơn chức và aniline như các ví dụ của Bài 8.',
      'Saturated open-chain monoamines and aniline, as in lesson 8’s examples.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Tên gọi và công thức suy từ cấu tạo là chính xác; số liệu lấy từ sách, chờ giáo viên duyệt.',
      'Names and formulas from the structures are exact; the data come from the book, awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [NITROGEN_SOURCE, ELEMENTS_SOURCE],
    reviewStatus: 'pending',
  };
}

export function aminoAcidCard(): ScienceCardData {
  return {
    title: AA_TITLE,
    model: L(
      'Amino acid là hợp chất hữu cơ tạp chức có cả nhóm amino (–NH₂) và nhóm carboxyl (–COOH), tồn tại chủ yếu ở dạng ion lưỡng cực nên có tính lưỡng tính và di chuyển khác nhau trong điện trường tùy pH. Peptide gồm các đơn vị α-amino acid nối với nhau bằng liên kết peptide –CO–NH–; n đơn vị tạo n − 1 liên kết peptide và giải phóng n − 1 phân tử nước. Peptide có từ hai liên kết peptide trở lên cho phản ứng màu biuret.',
      'Amino acids carry both an amino group (–NH₂) and a carboxyl group (–COOH), exist mostly as zwitterions, are amphoteric and move differently in an electric field depending on pH. A peptide is α-amino acid units joined by peptide bonds –CO–NH–; n units make n − 1 bonds and release n − 1 water molecules. Peptides with two or more peptide bonds give the biuret colour.',
    ),
    equations: [
      {
        tex: '\\mathrm{H_2N{-}CH(R){-}COOH \\rightleftharpoons H_3N^+{-}CH(R){-}COO^-}',
        label: L('Dạng ion lưỡng cực (tr. 42)', 'Zwitterion (p. 42)'),
      },
      {
        tex: 'M_{peptide} = \\sum M_{aa} - (n-1)\\,M_{H_2O}',
        label: L('Khối lượng mol peptide', 'Molar mass of a peptide'),
      },
    ],
    assumptions: [
      L(
        'Điện di theo ví dụ glycine của sách: gần pH 6 hầu như không di chuyển, pH nhỏ hơn về cực âm, lớn hơn về cực dương.',
        'Electrophoresis follows the book’s glycine example: near pH 6 it hardly moves, below it moves to the cathode, above to the anode.',
      ),
      L(
        'Tyr chỉ dùng làm tên trong ví dụ thủy phân của sách; sách không in cấu tạo của nó nên app không tính công thức khi peptide có Tyr.',
        'Tyr is only a name in the book’s hydrolysis example; the book prints no structure for it, so the app computes no formula when a peptide holds Tyr.',
      ),
      molarNote,
    ],
    validity: L(
      'Năm amino acid của Bảng 9.1 và peptide mạch hở tạo từ chúng.',
      'The five amino acids of Table 9.1 and open-chain peptides made of them.',
    ),
    confidence: 'exact',
    confidenceNote: L(
      'Công thức, số liên kết và các đoạn thủy phân suy trực tiếp từ cấu tạo; chờ giáo viên duyệt.',
      'Formulas, bond counts and hydrolysis fragments follow directly from the structures; awaiting teacher review.',
    ),
    userIntervened: false,
    sources: [NITROGEN_SOURCE, ELEMENTS_SOURCE],
    reviewStatus: 'pending',
  };
}
