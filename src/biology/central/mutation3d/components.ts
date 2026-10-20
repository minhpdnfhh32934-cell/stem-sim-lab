/**
 * Texts of the 3D view of "Đột biến điểm": names of the parts on the picture, what is
 * illustration, the 3D Science Card, and the selection type. Vietnamese is the source of truth;
 * every new text is listed in docs/DATA_REVIEW.md (MUT3D-*, review_status: pending) — sources: SGK
 * Sinh học 10 / 12, Campbell Biology, NCBI genetic code table 1.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../../common';
import { DOGMA_ILLUSTRATION } from '../dogma3d/components';
import { dogmaCard } from '../state';
import type { HelixId } from './binding';

export type MutationPart =
  'normalDna' | 'mutatedDna' | 'normalMrna' | 'mutatedMrna' | 'normalProtein' | 'mutatedProtein';

/** What the learner picked. Indices are the model's (0-based, on that helix's own strand). */
export type MutationSelection =
  | { kind: 'pair'; helix: HelixId; index: number }
  | { kind: 'codon'; helix: HelixId; codon: number }
  | { kind: 'bead'; helix: HelixId; index: number };

/** "Minh họa — không phải tỉ lệ/hình dạng thật" (the same words as the DNA → protein view). */
export const MUTATION_ILLUSTRATION = DOGMA_ILLUSTRATION;

/** Names on the picture ("Hiện tên"): the 2D page's row names. */
export const MUTATION_PARTS: Record<MutationPart, LocalizedText> = {
  normalDna: L('ADN bình thường', 'Normal DNA'),
  mutatedDna: L('ADN đột biến', 'Mutated DNA'),
  normalMrna: L('mARN bình thường', 'Normal mRNA'),
  mutatedMrna: L('mARN đột biến', 'Mutated mRNA'),
  normalProtein: L('Protein bình thường', 'Normal protein'),
  mutatedProtein: L('Protein đột biến', 'Mutated protein'),
};

export const HELIX_NAME: Record<HelixId, LocalizedText> = {
  normal: L('bình thường', 'normal'),
  mutated: L('đột biến', 'mutated'),
};

/** The camera choices: everything drawn, or close to the changed base pairs. */
export const CAMERA_NAME = {
  overview: L('Toàn cảnh', 'Whole picture'),
  site: L('Vị trí đột biến', 'Mutation site'),
} as const;

/**
 * The 3D Science Card: the lesson's card (same model, confidence and sources) with what the 3D
 * picture adds.
 */
export function mutationCard3d(): ScienceCardData {
  const base = dogmaCard('mutation');
  return {
    ...base,
    title: L('Đột biến điểm 3D', 'Point mutations in 3D'),
    assumptions: [
      ...base.assumptions,
      L(
        `${MUTATION_ILLUSTRATION.vi} Hình dạng chuỗi xoắn, chỗ phình (thêm nuclêôtit), khoảng trống (mất nuclêôtit), dấu ngoặc bộ ba và chuỗi hạt axit amin là hình vẽ để so sánh.`,
        `${MUTATION_ILLUSTRATION.en} The helix shape, the bulge (inserted bases), the gap (deleted bases), the codon brackets and the bead chains are drawings made for comparison.`,
      ),
      L(
        'ADN đột biến được vẽ thẳng hàng với ADN bình thường: mỗi cặp nuclêôtit không đổi nằm đúng dưới cặp tương ứng. Vì vậy các cặp được thêm vào vẽ phình ra khỏi chuỗi xoắn và chỗ các cặp bị mất để trống; ADN thật vẫn là một chuỗi xoắn kép liền mạch.',
        'The mutated DNA is drawn aligned with the normal DNA: every unchanged base pair sits right under its match. So inserted pairs are drawn bulging out of the helix and deleted pairs leave an empty stretch; real DNA stays one continuous double helix.',
      ),
      L(
        'Chính xác (lấy từ mô hình): mọi bazơ của hai ADN và hai mARN, vị trí đột biến, các bộ ba, hai chuỗi axit amin và dạng đột biến — giống hệt trang 2D.',
        'Exact (from the model): every base of both DNAs and both mRNAs, the mutation site, the codons, both amino acid chains and the kind of mutation — the same as the 2D page.',
      ),
      L(
        'Chuỗi xoắn kép vẽ theo mô hình ADN dạng B: mỗi vòng xoắn 10 cặp nuclêôtit, dài 3,4 nm, đường kính 2 nm. Rãnh lớn và rãnh nhỏ không được vẽ.',
        'The double helix follows B-DNA: 10 base pairs and 3.4 nm per turn, 2 nm across. The major and minor grooves are not drawn.',
      ),
      L(
        'Hai chuỗi axit amin xếp cạnh nhau theo số thứ tự axit amin; các hạt khác nhau từ axit amin đầu tiên bị đổi trở đi được tô nổi.',
        'The two amino acid chains are lined up by amino acid number; from the first changed amino acid on, the beads that differ are highlighted.',
      ),
      L(
        'Trình tự dài: hình chỉ vẽ một đoạn quanh vị trí đột biến; số thứ tự trên hình là vị trí thật trên trình tự.',
        'Long sequences: the picture draws a stretch around the mutation site; the numbers shown are the real positions in the sequence.',
      ),
    ],
    sources: [...base.sources, BSRC.sgk10],
  };
}
