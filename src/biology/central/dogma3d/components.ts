/**
 * Texts of the 3D view of "ADN → mARN → Protein": clickable parts (name + function), base names,
 * what is illustration, the 3D Science Card, and the selection type. Vietnamese is the source of
 * truth; every new text is listed in docs/DATA_REVIEW.md (DOG3D-*, review_status: pending) —
 * sources: SGK Sinh học 10 / 12, Campbell Biology, NCBI genetic code table 1.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../../common';
import { dogmaCard } from '../state';

export type DogmaPart =
  'coding' | 'template' | 'polymerase' | 'mrna' | 'ribosome' | 'trna' | 'polypeptide';

export const DOGMA_PART_ORDER: readonly DogmaPart[] = [
  'coding',
  'template',
  'polymerase',
  'mrna',
  'ribosome',
  'trna',
  'polypeptide',
];

/** What the learner picked (in the picture or the parts list). Indices are the model's (0-based). */
export type DogmaSelection =
  | { kind: 'part'; part: DogmaPart }
  | { kind: 'base'; strand: 'coding' | 'template'; index: number }
  | { kind: 'mrnaBase'; index: number }
  | { kind: 'codon'; codon: number }
  | { kind: 'residue'; codon: number };

/** "Minh họa — không phải tỉ lệ/hình dạng thật": caption, parts list and 3D card. */
export const DOGMA_ILLUSTRATION = L(
  'Minh họa — không phải tỉ lệ/hình dạng thật.',
  'Illustration — not to scale or true shape.',
);

export const DOGMA_PARTS: Record<DogmaPart, { name: LocalizedText; role: LocalizedText }> = {
  coding: {
    name: L('Mạch bổ sung', 'Coding strand'),
    role: L(
      'Mạch ADN không làm khuôn, đọc theo chiều 5′→3′. Trình tự của nó giống mARN, chỉ khác T được thay bằng U.',
      'The DNA strand that is not copied, read 5′→3′. Its sequence is the mRNA’s, with T in place of U.',
    ),
  },
  template: {
    name: L('Mạch khuôn (mạch mã gốc)', 'Template strand'),
    role: L(
      'Mạch ADN được ARN pôlimeraza dùng làm khuôn, đọc theo chiều 3′→5′. mARN được tổng hợp theo nguyên tắc bổ sung với mạch này: A–U, T–A, G–C, C–G (C còn được viết là X).',
      'The DNA strand RNA polymerase copies, read 3′→5′. The mRNA is built by base pairing with it: A–U, T–A, G–C, C–G.',
    ),
  },
  polymerase: {
    name: L('ARN pôlimeraza', 'RNA polymerase'),
    role: L(
      'Enzim tháo xoắn một đoạn ADN, đọc mạch khuôn theo chiều 3′→5′ và nối các nuclêôtit tự do thành mARN theo chiều 5′→3′.',
      'The enzyme that unwinds a stretch of DNA, reads the template strand 3′→5′ and joins free nucleotides into mRNA 5′→3′.',
    ),
  },
  mrna: {
    name: L('mARN', 'mRNA'),
    role: L(
      'Bản sao của gen, mang thông tin di truyền dưới dạng các bộ ba (côđon), được ribosome đọc theo chiều 5′→3′ từ bộ ba mở đầu AUG.',
      'The gene’s copy; it carries the information as codons, read by the ribosome 5′→3′ from the AUG start codon.',
    ),
  },
  ribosome: {
    name: L('Ribosome', 'Ribosome'),
    role: L(
      'Gồm tiểu phần bé và tiểu phần lớn. Ribosome trượt trên mARN theo chiều 5′→3′, mỗi lần một bộ ba, và nối các axit amin thành chuỗi pôlipeptit.',
      'A small and a large subunit. The ribosome moves along the mRNA 5′→3′, one codon at a time, and joins amino acids into a polypeptide.',
    ),
  },
  trna: {
    name: L('tARN', 'tRNA'),
    role: L(
      'Mang axit amin tới ribosome. Bộ ba đối mã (anticôđon) của tARN bắt cặp bổ sung với bộ ba (côđon) trên mARN.',
      'Brings an amino acid to the ribosome. Its anticodon pairs with the codon on the mRNA.',
    ),
  },
  polypeptide: {
    name: L('Chuỗi pôlipeptit', 'Polypeptide'),
    role: L(
      'Các axit amin nối với nhau bằng liên kết peptit theo đúng thứ tự các bộ ba trên mARN. Khi ribosome gặp bộ ba kết thúc, chuỗi được giải phóng.',
      'Amino acids joined by peptide bonds in the order of the codons on the mRNA. At the stop codon the chain is released.',
    ),
  },
};

/** Names of the bases (SGK spelling; X is the Vietnamese letter for cytosine). */
export const BASE_NAME: Record<string, LocalizedText> = {
  A: L('Ađênin', 'Adenine'),
  T: L('Timin', 'Thymine'),
  G: L('Guanin', 'Guanine'),
  C: L('Xitôzin (X)', 'Cytosine'),
  U: L('Uraxin', 'Uracil'),
};

export const PHASE_NAME = {
  transcription: L('Phiên mã', 'Transcription'),
  translation: L('Dịch mã', 'Translation'),
} as const;

/**
 * The 3D Science Card: the lesson's card (same model, confidence and sources) with what the 3D
 * picture adds.
 */
export function dogmaCard3d(): ScienceCardData {
  const base = dogmaCard('dogma');
  return {
    ...base,
    title: L('ADN → mARN → Protein 3D', 'DNA → mRNA → protein in 3D'),
    assumptions: [
      ...base.assumptions,
      L(
        `${DOGMA_ILLUSTRATION.vi} Hình dạng và kích thước ARN pôlimeraza, ribosome, tARN; độ dài đoạn ADN tháo xoắn; tốc độ chuyển động là minh họa — hình chỉ cho thấy thứ tự các bước. Hình giữ ARN pôlimeraza đứng yên nên khi đoạn tháo xoắn dịch dần, phần ADN hai bên được vẽ quay quanh trục của nó. ARN pôlimeraza và tiểu phần lớn của ribosome được vẽ cắt mở phía trước để thấy bên trong; tARN vẽ hình chữ L (dạng không gian của phân tử). Các nuclêôtit tự do đi tới theo đúng thứ tự mạch khuôn đòi hỏi — đường đi của chúng là minh họa. Khi dịch mã, ADN được vẽ nhỏ lại và lùi về phía sau để ribosome ở giữa hình.`,
        `${DOGMA_ILLUSTRATION.en} The shapes and sizes of RNA polymerase, the ribosome and the tRNAs, the length of the unwound stretch and the speed of motion are illustrative — the picture only shows the order of the steps. The picture keeps RNA polymerase still, so as the unwound stretch moves along, the DNA on either side is drawn turning about its axis. RNA polymerase and the ribosome's large subunit are drawn cut open at the front to show the inside; tRNAs are drawn L-shaped (the molecule's 3D shape). Free nucleotides arrive in the order the template strand asks for — their path is illustrative. During translation the DNA is drawn smaller and further back so that the ribosome holds the middle of the picture.`,
      ),
      L(
        'Chính xác (lấy từ mô hình): mọi bazơ của hai mạch ADN và của mARN, mọi bộ ba, bộ ba đối mã và axit amin (bảng mã chuẩn).',
        'Exact (from the model): every base of both DNA strands and of the mRNA, every codon, anticodon and amino acid (standard code).',
      ),
      L(
        'Chuỗi xoắn kép vẽ theo mô hình ADN dạng B: mỗi vòng xoắn 10 cặp nuclêôtit, dài 3,4 nm, đường kính 2 nm. Rãnh lớn và rãnh nhỏ không được vẽ (hai mạch vẽ đối xứng).',
        'The double helix follows B-DNA: 10 base pairs and 3.4 nm per turn, 2 nm across. The major and minor grooves are not drawn (the strands are drawn symmetrically).',
      ),
      L(
        'Không vẽ nhân tế bào: mô hình kiểu sinh vật nhân sơ (không có intron, dịch mã từ AUG đầu tiên). Phiên mã toàn bộ đoạn ADN đã nhập (không vẽ vùng khởi động, vùng kết thúc). Phiên mã và dịch mã chiếu lần lượt cho dễ theo dõi; ở sinh vật nhân sơ, ribosome có thể bắt đầu dịch mã khi phiên mã chưa xong.',
        'No nucleus is drawn: a prokaryote-like model (no introns, translation from the first AUG). The whole DNA typed in is transcribed (no promoter or terminator is drawn). Transcription and translation are shown one after the other; in prokaryotes ribosomes can start before transcription ends.',
      ),
      L(
        'Bộ ba đối mã là bộ ba bổ sung hoàn toàn với bộ ba trên mARN (không xét bắt cặp linh hoạt). Không có tARN nào đến bộ ba kết thúc.',
        'The anticodon is the fully complementary triplet (wobble pairing is not modelled). No tRNA comes to a stop codon.',
      ),
      L(
        'Trình tự dài: hình chỉ vẽ một đoạn quanh vị trí đang xét; số thứ tự trên hình là vị trí thật trên trình tự.',
        'Long sequences: the picture draws a stretch around the current position; the numbers shown are the real positions in the sequence.',
      ),
    ],
    sources: [...base.sources, BSRC.sgk10],
  };
}
