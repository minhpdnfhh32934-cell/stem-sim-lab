import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { COMPLEXES_SOURCE } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const STRUCTURE_TITLE = L('Sơ lược về phức chất', 'Complexes');
export const REACTIONS_TITLE = L(
  'Một số tính chất và ứng dụng của phức chất',
  'Properties and uses of complexes',
);

const pendingNote = L(
  'Điện tích và số phối tử tính đúng từ công thức; dạng hình học chỉ vẽ khi sách nêu; số liệu chờ giáo viên duyệt.',
  'Charges and ligand counts follow exactly from the formulas; a geometry is drawn only where the book states it; awaiting teacher review.',
);

export function structureCard(): ScienceCardData {
  return {
    title: STRUCTURE_TITLE,
    model: L(
      'Phức chất có nguyên tử trung tâm M (thường là cation kim loại hoặc nguyên tử kim loại) và các phối tử L (anion hoặc phân tử) liên kết với nó. Liên kết giữa M và L là liên kết cho – nhận: phối tử cho cặp electron chưa liên kết vào orbital trống của nguyên tử trung tâm. Điện tích của phức chất bằng tổng điện tích của nguyên tử trung tâm và các phối tử. Các phối tử sắp xếp xác định quanh nguyên tử trung tâm; dạng phổ biến là tứ diện, vuông phẳng (4 phối tử) và bát diện (6 phối tử). Trong dung dịch, ion kim loại chuyển tiếp thường tạo phức chất aqua, hầu hết có dạng bát diện.',
      'A complex has a central atom M (usually a metal cation or atom) bonded to ligands L (anions or molecules). The M–L bond is a dative bond: the ligand gives a lone pair into an empty orbital of the central atom. The complex’s charge is the sum of the central atom’s and the ligands’. The ligands sit in a definite arrangement; common shapes are tetrahedral, square planar (4 ligands) and octahedral (6 ligands). In solution transition-metal ions usually form aqua complexes, most of them octahedral.',
    ),
    equations: [
      {
        tex: 'q_{\\text{complex}} = q_M + \\sum n_i\\,q_{L_i}',
        label: L('Điện tích của phức chất (tr. 134)', 'Charge of a complex (p. 134)'),
      },
    ],
    assumptions: [
      L(
        'Mô hình 3D vẽ mỗi phối tử bằng nguyên tử cho cặp electron, theo hướng lí tưởng của Bảng 28.1; độ dài liên kết chỉ để minh họa.',
        'The 3D model draws each ligand as its donor atom on Table 28.1’s ideal directions; bond lengths are illustrative.',
      ),
      L(
        'Chỉ vẽ dạng hình học khi sách nêu cho phức chất đó (phức chất aqua, cisplatin, câu hỏi tr. 136, 140).',
        'A geometry is drawn only when the book states it for that complex (aqua complexes, cisplatin, questions on pp. 136, 140).',
      ),
    ],
    validity: L(
      'Các phức chất sách nêu ở Bài 28, 29.',
      'The complexes named in Lessons 28 and 29.',
    ),
    confidence: 'exact',
    confidenceNote: pendingNote,
    userIntervened: false,
    sources: [COMPLEXES_SOURCE],
    reviewStatus: 'pending',
  };
}

export function reactionsCard(): ScienceCardData {
  return {
    title: REACTIONS_TITLE,
    model: L(
      'Phản ứng tạo phức chất trong dung dịch được nhận biết qua các dấu hiệu: xuất hiện kết tủa, hòa tan kết tủa, thay đổi màu sắc. Các phối tử trong phức chất có thể bị thế bởi phối tử khác (phản ứng thế phối tử); quá trình thuận lợi khi phức chất mới bền hơn phức chất ban đầu. Phức chất được dùng trong y học (cisplatin), làm xúc tác và để nhận biết, xác định hàm lượng các ion kim loại chuyển tiếp.',
      'Complex formation in solution shows as a precipitate forming, a precipitate dissolving or a colour change. Ligands can be replaced by others (ligand substitution), favoured when the new complex is more stable. Complexes are used in medicine (cisplatin), as catalysts and to detect and measure transition-metal ions.',
    ),
    equations: [
      {
        tex: '\\mathrm{[Cu(H_2O)_6]^{2+} + 4Cl^- \\rightarrow [CuCl_4]^{2-} + 6H_2O}',
        label: L('Thế phối tử (tr. 140)', 'Ligand substitution (p. 140)'),
      },
    ],
    assumptions: [
      L(
        'Màu sắc ghi bằng chữ như sách nêu; app không tô màu.',
        'Colours are given in words as the book does; the app paints none.',
      ),
    ],
    validity: L(
      'Các phản ứng và màu sắc sách nêu ở Bài 29.',
      'The reactions and colours named in Lesson 29.',
    ),
    confidence: 'exact',
    confidenceNote: pendingNote,
    userIntervened: false,
    sources: [COMPLEXES_SOURCE],
    reviewStatus: 'pending',
  };
}
