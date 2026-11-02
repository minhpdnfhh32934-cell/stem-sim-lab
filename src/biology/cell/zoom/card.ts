/**
 * Texts of "Từ tế bào đến DNA": each level's Science Card, the scale bar's and the transition's
 * wording. Every number comes from `levels.ts` (printed sizes or the B-DNA constant), formatted
 * per language; nothing is measured or computed from the picture.
 */
import { formatNumber } from '@/app/i18n';
import type { LocalizedText, Source } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { B_DNA } from '../../central/dogma3d/bdna';
import { L } from '../../common';
import {
  DRAWN,
  LEVEL_FACTS,
  LEVEL_NAME,
  LEVELS,
  SIZE,
  SIZES,
  levelInfo,
  lengthParts,
  sourceOf,
  type ZoomLevel,
  type ZoomPart,
} from './levels';
import { PARTS } from '../parts';

/** A number in both languages (Vietnamese decimal comma). */
function n(v: number): { vi: string; en: string } {
  return { vi: formatNumber('vi', v), en: formatNumber('en', v) };
}

/** A length in both languages: "5 µm", "3,4 nm". */
export function lengthText(nm: number): LocalizedText {
  const { value, unit } = lengthParts(nm);
  const v = n(value);
  return { vi: `${v.vi} ${unit}`, en: `${v.en} ${unit}` };
}

/** Shown while the camera moves from one level to the next (`#54`: "không theo tỉ lệ"). */
export const TRANSITION = L(
  'Chuyển cảnh giữa hai cấp — không theo tỉ lệ',
  'Moving between two levels — not to scale',
);

/** The caption of a level: what is to scale and what is illustration. */
export function levelCaption(level: ZoomLevel): LocalizedText {
  const bar = lengthText(levelInfo(LEVELS.indexOf(level)).barNm);
  const ruler = {
    vi: `Thước tỉ lệ dài đúng ${bar.vi}.`,
    en: `The scale bar is exactly ${bar.en} long.`,
  };
  const rest = CAPTION[level];
  return { vi: `${ruler.vi} ${rest.vi}`, en: `${ruler.en} ${rest.en}` };
}

const cell = lengthText(DRAWN.cellNm);
const cellMin = lengthText(SIZE.cellMinNm);
const cellMax = lengthText(SIZE.cellMaxNm);
const nucleus = lengthText(SIZE.nucleusNm);
const chromatid = lengthText(SIZE.chromatidNm);
const fibre = lengthText(SIZE.fibreNm);
const dna = lengthText(SIZE.dnaNm);
const pitch = lengthText(SIZE.pitchNm);
const bp = n(SIZE.nucleosomeBp);
const histones = n(SIZE.histones);
const kinds = n(SIZE.histoneKinds);
const perTurn = n(SIZE.bpPerTurn);
const helixBp = n(DRAWN.helixBp);
const bpOu = n(SIZES.nucleosomeBpOu.value);
const coreOu = lengthText(SIZES.coreParticleNmOu.value);

const CAPTION: Record<ZoomLevel, LocalizedText> = {
  cell: {
    vi: `Tế bào vẽ đường kính ${cell.vi} (một giá trị trong khoảng ${cellMin.vi} – ${cellMax.vi} của SGK), nhân ${nucleus.vi} đúng tỉ lệ; các bào quan khác là minh họa.`,
    en: `The cell is drawn ${cell.en} across (a value within the textbook’s ${cellMin.en} – ${cellMax.en}), the ${nucleus.en} nucleus to scale; the other organelles are illustration.`,
  },
  nucleus: L(
    'Màng nhân, lỗ màng nhân, hạch nhân (nhân con) và chất nhiễm sắc: hình dạng và số lượng là minh họa.',
    'Envelope, pores, nucleolus and chromatin: shapes and numbers are illustration.',
  ),
  chromosome: L(
    'Chỉ bề rộng crômatit theo số đo; chiều dài hai cánh là minh họa.',
    'Only the chromatid’s width follows the measured size; the arm lengths are illustration.',
  ),
  fibre: {
    vi: `Sợi ${fibre.vi} và bề rộng crômatit theo số đo; số vòng, độ dài vòng và khung NST là minh họa.`,
    en: `The ${fibre.en} fibre and the chromatid’s width follow the measured sizes; the number and length of the loops and the scaffold are illustration.`,
  },
  nucleosome: {
    vi: `Bề rộng ${fibre.vi} theo số đo; số vòng quấn, DNA nối và vị trí từng histone là minh họa.`,
    en: `The ${fibre.en} width follows the measured size; the turns, the linker DNA and where each histone sits are illustration.`,
  },
  dna: {
    vi: `Đường kính và bước xoắn theo số đo; trình tự ${helixBp.vi} cặp nucleotide là minh họa.`,
    en: `Width and pitch follow the measured sizes; the ${helixBp.en}-base-pair sequence is illustration.`,
  },
};

const MODEL: Record<ZoomLevel, LocalizedText> = {
  cell: {
    vi: `Tế bào động vật và thực vật có kích thước khoảng ${cellMin.vi} – ${cellMax.vi} (SGK Sinh học 10, H 7.1, tr. 44). Nhân là cấu trúc lớn nhất có màng bao bọc, phần lớn hình cầu, đường kính khoảng ${nucleus.vi} (tr. 49).`,
    en: `Animal and plant cells are about ${cellMin.en} – ${cellMax.en} across (Sinh học 10 textbook, Fig. 7.1, p. 44). The nucleus is the largest membrane-bound structure, mostly spherical, about ${nucleus.en} across (p. 49).`,
  },
  nucleus: {
    vi: `Nhân đường kính khoảng ${nucleus.vi}, bọc bởi màng kép có nhiều lỗ nhỏ; trong nhân có chất nhiễm sắc chứa DNA và hạch nhân (nhân con) (SGK Sinh học 10, tr. 49).`,
    en: `The nucleus, about ${nucleus.en} across, is wrapped in a double membrane with many small pores; inside are the DNA-carrying chromatin and the nucleolus (Sinh học 10 textbook, p. 49).`,
  },
  chromosome: {
    vi: `NST quan sát rõ nhất ở kì giữa (SGK Sinh học 12, tr. 36). NST kép gồm hai crômatit chị em dính ở tâm động (H 7.2, tr. 38); mỗi crômatit đường kính khoảng ${chromatid.vi} (tr. 37).`,
    en: `Chromosomes are seen most clearly at metaphase (Sinh học 12 textbook, p. 36). A replicated chromosome is two sister chromatids joined at the centromere (Fig. 7.2, p. 38); each chromatid is about ${chromatid.en} across (p. 37).`,
  },
  fibre: {
    vi: `Ở kì đầu, sợi nhiễm sắc ${fibre.vi} luồn vào các vòng protein condensin, tạo các vòng nhô ra ngoài khung NST; khung co xoắn tiếp đến kì giữa, khi mỗi crômatit rộng khoảng ${chromatid.vi} (SGK Sinh học 12, tr. 37, H 7.1).`,
    en: `In prophase the ${fibre.en} fibre threads through condensin protein rings into loops standing out from the chromosome scaffold; the scaffold keeps coiling until metaphase, when each chromatid is about ${chromatid.en} wide (Sinh học 12 textbook, p. 37, Fig. 7.1).`,
  },
  nucleosome: {
    vi: `Mỗi nucleosome gồm ${histones.vi} phân tử histone thuộc ${kinds.vi} loại, quấn bên ngoài là một đoạn DNA ${bp.vi} cặp nucleotide; các nucleosome nối nhau bằng DNA nối thành chuỗi có đường kính khoảng ${fibre.vi} (SGK Sinh học 12, tr. 36, H 7.1).`,
    en: `Each nucleosome is ${histones.en} histone molecules of ${kinds.en} kinds with a ${bp.en}-base-pair stretch of DNA wrapped around them; nucleosomes are joined by linker DNA into a chain about ${fibre.en} across (Sinh học 12 textbook, p. 36, Fig. 7.1).`,
  },
  dna: {
    vi: `Chuỗi xoắn kép B-DNA (mô hình Watson–Crick): đường kính ${dna.vi}, mỗi vòng xoắn ${perTurn.vi} cặp nucleotide dài ${pitch.vi} — cùng hằng số với bài “ADN → mARN → Protein”.`,
    en: `The B-DNA double helix (Watson–Crick model): ${dna.en} across, ${perTurn.en} base pairs and ${pitch.en} per turn — the same constant as the “DNA → mRNA → Protein” lesson.`,
  },
};

const TRANSITION_NOTE = L(
  'Mỗi cấp có thước tỉ lệ riêng; lúc chuyển giữa hai cấp, hình không theo tỉ lệ.',
  'Each level has its own scale bar; while moving between two levels the picture is not to scale.',
);

/** The 30 nm fibre: drawn by many books, not by this textbook, and debated (#54 §7). */
const NO_30NM = L(
  'Nhiều tài liệu vẽ thêm cấp “sợi 30 nm” giữa chuỗi nucleosome và các vòng. SGK Sinh học 12 (H 7.1) không có cấp này, và nghiên cứu hiển vi điện tử của Ou và cộng sự (2017) không thấy sợi 30 nm trong các tế bào người mà nhóm quan sát — cấp này còn được tranh luận nên hình không vẽ.',
  'Many books draw an extra “30 nm fibre” level between the nucleosome chain and the loops. The Sinh học 12 textbook (Fig. 7.1) has no such level, and the electron-microscopy study of Ou et al. (2017) found no 30 nm fibres in the human cells they imaged — the level is debated, so it is not drawn.',
);

const EXTRA: Record<ZoomLevel, readonly LocalizedText[]> = {
  cell: [],
  nucleus: [
    L(
      'Cấp sau là NST kép ở kì giữa của phân bào: hai cấp là hai thời điểm khác nhau của chu kì tế bào.',
      'The next level is a metaphase chromosome of a dividing cell: the two levels are two different moments of the cell cycle.',
    ),
  ],
  chromosome: [],
  fibre: [NO_30NM],
  nucleosome: [
    {
      vi: `Bán kính trục DNA quấn quanh lõi histone trong hình = (${fibre.vi} − ${dna.vi}) / 2, tính từ hai số đo của SGK. Các histone vẽ cùng một màu, không tô riêng từng loại. DNA vẽ thành ống trơn, không vẽ từng cặp base.`,
      en: `In the picture, the wrapped DNA’s axis radius = (${fibre.en} − ${dna.en}) / 2, computed from the two textbook sizes. The histones share one colour (the kinds are not told apart). The DNA is drawn as a smooth tube, without base pairs.`,
    },
    NO_30NM,
  ],
  dna: [
    L(
      'Các cặp nucleotide ghép theo nguyên tắc bổ sung A – T, G – C.',
      'Base pairs follow complementary pairing A – T, G – C.',
    ),
  ],
};

const VALIDITY: Record<ZoomLevel, LocalizedText> = {
  cell: L(
    'Kích thước điển hình; tế bào và nhân thật khác nhau theo loại tế bào và loài.',
    'Typical sizes; real cells and nuclei differ by cell type and species.',
  ),
  nucleus: L(
    'Kích thước điển hình; một số tế bào có nhiều nhân (SGK Sinh học 10, tr. 49).',
    'Typical size; some cells have several nuclei (Sinh học 10 textbook, p. 49).',
  ),
  chromosome: L(
    'Bề rộng ở kì giữa, khi NST co xoắn cực đại; ở các kì khác NST mảnh và dài hơn.',
    'The width at metaphase, when chromosomes are most condensed; at other stages they are thinner and longer.',
  ),
  fibre: L(
    'Theo SGK; cách sợi nhiễm sắc gấp thành NST vẫn đang được nghiên cứu.',
    'As in the textbook; how the fibre folds into a chromosome is still being researched.',
  ),
  nucleosome: {
    vi: `Theo SGK. Bài báo của Ou và cộng sự (2017) ghi ${bpOu.vi} cặp nucleotide quấn quanh khối 8 histone thành hạt ${coreOu.vi}; app giữ số của SGK.`,
    en: `As in the textbook. Ou et al. (2017) give ${bpOu.en} base pairs wrapped around the histone octamer into an ${coreOu.en} particle; the app keeps the textbook’s numbers.`,
  },
  dna: L(
    'Số tròn của mô hình B-DNA (Watson–Crick); DNA còn có các dạng khác (A, Z) với kích thước khác.',
    'The round numbers of the B-DNA (Watson–Crick) model; DNA has other forms (A, Z) with other sizes.',
  ),
};

function sourcesOf(level: ZoomLevel): Source[] {
  const list: Source[] = LEVEL_FACTS[level].map((f) => sourceOf(f.key));
  if (level === 'dna') list.push(...B_DNA.sources);
  if (level === 'fibre' || level === 'nucleosome') list.push(sourceOf('nucleosomeBpOu'));
  return list.filter((s, i) => list.findIndex((o) => o.id === s.id) === i);
}

/** Science Card of a level: printed sizes with the scale bar drawn to them. */
export function levelCard(level: ZoomLevel): ScienceCardData {
  const i = LEVELS.indexOf(level);
  return {
    title: {
      vi: `${LEVEL_NAME[level].vi} — cấp ${String(i + 1)}/${String(LEVELS.length)}`,
      en: `${LEVEL_NAME[level].en} — level ${String(i + 1)}/${String(LEVELS.length)}`,
    },
    model: MODEL[level],
    equations: [],
    assumptions: [levelCaption(level), ...EXTRA[level], TRANSITION_NOTE],
    validity: VALIDITY[level],
    confidence: 'approx',
    confidenceNote: L(
      'Các kích thước là số ước lượng (“khoảng”) in trong sách; thước tỉ lệ vẽ đúng các số đó. Hình dạng, màu và số lượng chi tiết là minh họa: không đọc số khác từ hình.',
      'The sizes are approximate (“about”) values printed in the books; the scale bar is drawn to them. Shapes, colours and how many details are drawn are illustration: read no other number from the picture.',
    ),
    userIntervened: false,
    sources: sourcesOf(level),
    reviewStatus: 'pending',
  };
}

/**
 * Names of the parts ("Hiện tên"): the cell's parts reuse the names of "Tế bào nhân sơ và nhân
 * thực" (parts.ts); the others are the labels of SGK Sinh học 10 H 8.2 and Sinh học 12 H 7.1, 7.2.
 */
export const PART_NAME: Record<ZoomPart, LocalizedText> = {
  membrane: PARTS.membrane.name,
  nucleus: PARTS.nucleus.name,
  mitochondrion: PARTS.mitochondrion.name,
  envelope: L('Màng nhân', 'Nuclear envelope'),
  pore: L('Lỗ màng nhân', 'Nuclear pore'),
  nucleolus: L('Hạch nhân (nhân con)', 'Nucleolus'),
  chromatin: L('Chất nhiễm sắc', 'Chromatin'),
  chromatid: L('Hai crômatit chị em', 'Two sister chromatids'),
  centromere: L('Tâm động', 'Centromere'),
  fibre: { vi: `Sợi nhiễm sắc ${fibre.vi}`, en: `${fibre.en} chromatin fibre` },
  scaffold: L('Khung NST', 'Chromosome scaffold'),
  histones: L('Khối histone', 'Histone core'),
  wrappedDna: L('DNA quấn quanh', 'Wrapped DNA'),
  linker: L('DNA nối', 'Linker DNA'),
  backbone: L('Mạch DNA', 'DNA strand'),
  basePair: L('Cặp nucleotide', 'Base pair'),
};
