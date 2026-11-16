/**
 * Science Card of "Các phân tử sinh học": the molecule's 3D structure is one force-field conformer
 * (approximate), the texts follow the textbook.
 */
import type { ScienceCardData, Source } from '@/science-card/types';
import { L } from '../common';
import { BIOMOLECULES_SOURCE, GROUP_INFO, pubchemUrl, type Biomolecule } from './data';

export const SGK_SH10_BAI5: Source = {
  id: 'sgk-sh10-kntt-bai5',
  citation:
    'SGK Sinh học 10, bộ Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 5 “Các phân tử sinh học”, tr. 28–37 (đọc trên taphuan.nxbgd.vn ngày 15/11/2026)',
  url: 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489',
};

/** Illustration note shared by the 3D and 2D pictures. */
export const MOLECULE_CAPTION = L(
  'Mô hình que – bi: một cấu dạng tính bằng trường lực, không phải ảnh chụp; màu nguyên tố theo quy ước Jmol.',
  'Ball-and-stick model: one force-field conformer, not a photograph; element colours follow the Jmol convention.',
);

export function biomoleculeCard(m: Biomolecule): ScienceCardData {
  const g = GROUP_INFO[m.group];
  return {
    title: L(`${m.name.vi} — ${g.name.vi}`, `${m.name.en} — ${g.name.en}`),
    model: L(
      `Cấu trúc 3D của ${m.name.vi} (PubChem CID ${String(m.cid)}), dựng bằng RDKit: nhúng ETKDG rồi tối ưu bằng trường lực MMFF94. Các nhóm của đơn phân (nhóm amino, nhóm carboxyl, phosphate…) được tìm tự động bằng mẫu cấu trúc SMARTS.`,
      `3D structure of ${m.name.en} (PubChem CID ${String(m.cid)}), built with RDKit: ETKDG embedding, then the MMFF94 force field. The monomer’s groups (amino, carboxyl, phosphate…) are found automatically with SMARTS patterns.`,
    ),
    equations: [],
    assumptions: [
      L(
        'Một cấu dạng của phân tử tự do (pha khí), dạng trung hòa như PubChem ghi; trong tế bào phân tử dao động, quay quanh liên kết và có thể mang điện (ví dụ amino acid ở dạng ion lưỡng cực).',
        'One conformer of the free molecule (gas phase), in the neutral form PubChem lists; in the cell the molecule vibrates, rotates about its bonds and may carry charges (an amino acid as a zwitterion, for example).',
      ),
      MOLECULE_CAPTION,
    ],
    validity: L(
      `Một phân tử đại diện cho nhóm ${g.name.vi}; mỗi nhóm có rất nhiều phân tử khác.`,
      `One molecule standing for the group ${g.name.en}; each group has a great many others.`,
    ),
    confidence: 'approx',
    confidenceNote: L(
      'Độ dài liên kết, góc liên kết từ trường lực MMFF94: gần đúng, không phải số đo.',
      'Bond lengths and angles from the MMFF94 force field: approximate, not measured.',
    ),
    userIntervened: false,
    sources: [
      { ...BIOMOLECULES_SOURCE, id: `pubchem-${String(m.cid)}`, url: pubchemUrl(m.cid) },
      SGK_SH10_BAI5,
    ],
    reviewStatus: 'pending',
  };
}
