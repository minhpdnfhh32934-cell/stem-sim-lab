/**
 * Parts of the three cells of "Tế bào nhân sơ và nhân thực": a bacterium (prokaryote), an
 * animal cell and a plant cell. Which parts each cell shows and how they are named follow the
 * textbook's labelled pictures (SGK Sinh học 10 KNTT, H 7.2 and H 8.1); each function is a
 * short paraphrase of the textbook text on `pages` (printed page numbers). Never copy the
 * textbook's sentences, and keep numbers (sizes, counts) out of these texts.
 * Every item is listed in docs/DATA_REVIEW.md (CELL3D-*), review_status "pending".
 */
import type { LocalizedText, Source } from '@/core/data/dataset';
import type { ReviewStatus } from '@/science-card/types';
import { L } from '../common';

export type CellKind = 'bacterium' | 'animal' | 'plant';

export const CELL_KINDS: readonly CellKind[] = ['bacterium', 'animal', 'plant'];

export const isCellKind = (v: unknown): v is CellKind =>
  typeof v === 'string' && (CELL_KINDS as readonly string[]).includes(v);

export const CELL_KIND_NAME: Record<CellKind, LocalizedText> = {
  bacterium: L('Vi khuẩn (tế bào nhân sơ)', 'Bacterium (prokaryotic cell)'),
  animal: L('Tế bào động vật (nhân thực)', 'Animal cell (eukaryotic)'),
  plant: L('Tế bào thực vật (nhân thực)', 'Plant cell (eukaryotic)'),
};

/** The textbook every text here is paraphrased from (book only; pages are on each part). */
export const SGK_SH10_KNTT: Source = {
  id: 'sgk-sh10-kntt',
  citation:
    'Sinh học 10, bộ sách Kết nối tri thức với cuộc sống (Chương trình GDPT 2018), NXB Giáo dục Việt Nam',
};

export type PartId =
  | 'pili'
  | 'flagellum'
  | 'outerMembrane'
  | 'bacterialWall'
  | 'plantWall'
  | 'membrane'
  | 'prokCytoplasm'
  | 'cytoplasm'
  | 'nucleoid'
  | 'plasmid'
  | 'ribosome'
  | 'nucleus'
  | 'er'
  | 'golgi'
  | 'lysosome'
  | 'peroxysome'
  | 'vacuole'
  | 'mitochondrion'
  | 'chloroplast'
  | 'cytoskeleton'
  | 'centrosome';

export interface CellPart {
  name: LocalizedText;
  /** What it does, in one or two sentences. */
  role: LocalizedText;
  /** Cells whose textbook picture shows this part. */
  cells: readonly CellKind[];
  /** An organelle wrapped in its own membrane (textbook: "bào quan có màng bao bọc"). */
  membraneBound: boolean;
  source: Source;
  /** Printed pages of the source the name and function come from. */
  pages: readonly number[];
  review_status: ReviewStatus;
}

const ALL = ['bacterium', 'animal', 'plant'] as const;
const EUK = ['animal', 'plant'] as const;

const part = (
  name: LocalizedText,
  role: LocalizedText,
  cells: readonly CellKind[],
  membraneBound: boolean,
  pages: readonly number[],
): CellPart => ({
  name,
  role,
  cells,
  membraneBound,
  source: SGK_SH10_KNTT,
  pages,
  review_status: 'pending',
});

export const PARTS: Record<PartId, CellPart> = {
  pili: part(
    L('Lông', 'Pili'),
    L(
      'Những sợi ngắn, nhiều, nhô ra khỏi thành tế bào; giúp vi khuẩn bám dính, tiếp hợp với nhau hoặc bám vào bề mặt tế bào của sinh vật khác.',
      'Short, numerous threads sticking out through the cell wall; they let a bacterium cling to surfaces, join another bacterium (conjugation) or attach to the cells of another organism.',
    ),
    ['bacterium'],
    false,
    [45],
  ),
  flagellum: part(
    L('Roi', 'Flagellum'),
    L(
      'Sợi dài làm từ các bó sợi protein; là bộ phận giúp tế bào vi khuẩn di chuyển.',
      'A long thread built from bundles of protein fibres; it is the part that moves the bacterium.',
    ),
    ['bacterium'],
    false,
    [45],
  ),
  outerMembrane: part(
    L('Màng ngoài', 'Outer membrane'),
    L(
      'Ở một số vi khuẩn (Gram âm), lớp màng giàu lipopolysaccharide phủ ngoài thành tế bào; giúp một số vi khuẩn gây bệnh tránh bị bạch cầu tấn công.',
      'In some (Gram-negative) bacteria, a lipopolysaccharide-rich layer covering the cell wall; it helps some disease-causing bacteria escape attack by white blood cells.',
    ),
    ['bacterium'],
    false,
    [45, 46],
  ),
  bacterialWall: part(
    L('Thành tế bào', 'Cell wall'),
    L(
      'Lớp khung bên ngoài màng tế bào, cấu tạo từ peptidoglycan; giữ ổn định hình dạng và bảo vệ tế bào.',
      'The outer framework around the cell membrane, made of peptidoglycan; it keeps the cell’s shape steady and protects it.',
    ),
    ['bacterium'],
    false,
    [45],
  ),
  plantWall: part(
    L('Thành tế bào', 'Cell wall'),
    L(
      'Lớp vững chắc bao ngoài màng tế bào thực vật, cấu tạo chủ yếu từ các sợi cellulose; bảo vệ và định hình tế bào.',
      'A sturdy layer outside the plant cell membrane, built mainly from cellulose fibres; it protects the cell and gives it its shape.',
    ),
    ['plant'],
    false,
    [57],
  ),
  membrane: part(
    L('Màng tế bào', 'Cell membrane'),
    L(
      'Lớp kép phospholipid xen protein (còn gọi là màng sinh chất) ngăn cách tế bào với môi trường; cho các chất ra vào có chọn lọc và tiếp nhận thông tin từ bên ngoài.',
      'A phospholipid bilayer with proteins (the plasma membrane) that separates the cell from its surroundings; it lets substances in and out selectively and receives signals from outside.',
    ),
    ALL,
    false,
    [46, 55, 56],
  ),
  prokCytoplasm: part(
    L('Tế bào chất', 'Cytoplasm'),
    L(
      'Khối dạng keo, chủ yếu là nước, nằm giữa màng tế bào và vùng nhân; chứa ribosome và các hạt dự trữ, là nơi diễn ra các phản ứng hoá sinh của tế bào.',
      'A gel, mostly water, between the cell membrane and the nucleoid; it holds ribosomes and storage granules and is where the cell’s biochemical reactions happen.',
    ),
    ['bacterium'],
    false,
    [46],
  ),
  cytoplasm: part(
    L('Tế bào chất', 'Cytoplasm'),
    L(
      'Gồm bào tương (dạng keo, chủ yếu là nước và các phân tử sinh học) cùng các bào quan; là nơi diễn ra các hoạt động sống của tế bào.',
      'The cytosol (a gel of mostly water and biological molecules) together with the organelles; it is where the cell’s life activities take place.',
    ),
    EUK,
    false,
    [54],
  ),
  nucleoid: part(
    L('Vùng nhân', 'Nucleoid'),
    L(
      'Vùng chứa phân tử DNA dạng vòng, mạch kép, không có màng bao bọc; DNA này mang thông tin di truyền điều khiển hoạt động sống của vi khuẩn.',
      'The region that holds the circular, double-stranded DNA, with no membrane around it; this DNA carries the genetic information that runs the bacterium.',
    ),
    ['bacterium'],
    false,
    [46],
  ),
  plasmid: part(
    L('Plasmid', 'Plasmid'),
    L(
      'Phân tử DNA nhỏ, dạng vòng nằm ngoài vùng nhân, thường mang gene kháng thuốc kháng sinh; vi khuẩn không có plasmid vẫn sống bình thường.',
      'A small circular DNA molecule outside the nucleoid that often carries antibiotic-resistance genes; a bacterium without plasmids still grows normally.',
    ),
    ['bacterium'],
    false,
    [46],
  ),
  ribosome: part(
    L('Ribosome', 'Ribosome'),
    L(
      'Bào quan không có màng bao bọc, gồm tiểu đơn vị lớn và tiểu đơn vị nhỏ; là nơi tổng hợp protein.',
      'An organelle with no membrane, made of a large and a small subunit; it is where proteins are made.',
    ),
    ALL,
    false,
    [46, 49],
  ),
  nucleus: part(
    L('Nhân tế bào', 'Nucleus'),
    L(
      'Được bao bọc bởi màng nhân có nhiều lỗ nhỏ; chứa chất nhiễm sắc mang DNA và điều khiển các hoạt động sống của tế bào.',
      'Wrapped in a nuclear envelope with many small pores; it holds the DNA-carrying chromatin and controls the cell’s life activities.',
    ),
    EUK,
    true,
    [49],
  ),
  er: part(
    L('Lưới nội chất', 'Endoplasmic reticulum'),
    L(
      'Mạng lưới ống và túi dẹp nối với màng nhân. Lưới nội chất hạt có ribosome bám, đưa protein mới tổng hợp tới bộ máy Golgi; lưới nội chất trơn tổng hợp lipid và khử độc.',
      'A network of tubes and flat sacs joined to the nuclear envelope. Rough ER carries ribosomes and sends new proteins on to the Golgi apparatus; smooth ER makes lipids and breaks down toxins.',
    ),
    EUK,
    true,
    [50],
  ),
  golgi: part(
    L('Bộ máy Golgi', 'Golgi apparatus'),
    L(
      'Các túi dẹp xếp song song; chế biến, đóng gói protein và lipid rồi gửi chúng trong các túi vận chuyển tới nơi cần trong tế bào hoặc ra ngoài tế bào.',
      'A stack of flat sacs; it modifies and packages proteins and lipids, then ships them in transport vesicles to where they are needed in the cell or out of it.',
    ),
    EUK,
    true,
    [50],
  ),
  lysosome: part(
    L('Lysosome', 'Lysosome'),
    L(
      'Túi có màng đơn chứa enzyme thuỷ phân; phân giải bào quan già, hỏng để tái sử dụng và giúp tế bào tiêu hoá thức ăn.',
      'A sac with a single membrane full of digestive (hydrolytic) enzymes; it breaks down worn-out organelles for reuse and helps the cell digest food.',
    ),
    ['animal'],
    true,
    [51],
  ),
  peroxysome: part(
    L('Peroxysome', 'Peroxisome'),
    L(
      'Bào quan hình cầu có màng đơn, chứa enzyme phân giải peroxide (chất có thể gây hại cho tế bào); tham gia khử độc và chuyển hoá lipid.',
      'A round organelle with a single membrane and enzymes that break down peroxide (which can harm the cell); it helps detoxify and process lipids.',
    ),
    EUK,
    true,
    [52],
  ),
  vacuole: part(
    L('Không bào trung tâm', 'Central vacuole'),
    L(
      'Không bào lớn có màng đơn, nằm giữa tế bào thực vật; giúp điều hoà áp suất thẩm thấu. Không bào còn có thể chứa sắc tố, chất dự trữ hay chất thải.',
      'The large vacuole with a single membrane in the middle of a plant cell; it helps regulate osmotic pressure. Vacuoles can also hold pigments, stored substances or wastes.',
    ),
    ['plant'],
    true,
    [51, 52],
  ),
  mitochondrion: part(
    L('Ti thể', 'Mitochondrion'),
    L(
      'Bào quan có màng kép, màng trong gấp nếp thành các mào; là nơi hô hấp tế bào, phân giải carbohydrate để cung cấp năng lượng (ATP) cho tế bào.',
      'An organelle with a double membrane whose inner membrane folds into cristae; cellular respiration happens here, breaking down carbohydrates to supply the cell with energy (ATP).',
    ),
    EUK,
    true,
    [52, 53],
  ),
  chloroplast: part(
    L('Lục lạp', 'Chloroplast'),
    L(
      'Bào quan có màng kép, bên trong có các túi dẹp thylakoid chứa diệp lục; thu nhận năng lượng ánh sáng để quang hợp tạo ra carbohydrate.',
      'An organelle with a double membrane, holding flat thylakoid sacs that contain chlorophyll; it captures light energy for photosynthesis, which makes carbohydrates.',
    ),
    ['plant'],
    true,
    [53],
  ),
  cytoskeleton: part(
    L('Khung xương tế bào', 'Cytoskeleton'),
    L(
      'Mạng lưới vi sợi, sợi trung gian và vi ống trong bào tương; nâng đỡ, giữ hình dạng tế bào, neo giữ bào quan và giúp tế bào di chuyển.',
      'A network of microfilaments, intermediate filaments and microtubules in the cytosol; it supports the cell, keeps its shape, anchors organelles and helps the cell move.',
    ),
    EUK,
    false,
    [54],
  ),
  centrosome: part(
    L('Trung thể', 'Centrosome'),
    L(
      'Gồm cặp trung tử xếp vuông góc với nhau; nơi lắp ráp và tổ chức vi ống, hình thành thoi phân bào khi tế bào động vật phân chia.',
      'Centrioles set at right angles to each other; it assembles and organises microtubules and forms the spindle when an animal cell divides.',
    ),
    ['animal'],
    false,
    [54],
  ),
};

/** Teaching order: outside → inside (appendages, wall, membrane, cytoplasm, then organelles). */
const ORDER: readonly PartId[] = [
  'flagellum',
  'pili',
  'outerMembrane',
  'bacterialWall',
  'plantWall',
  'membrane',
  'prokCytoplasm',
  'cytoplasm',
  'nucleoid',
  'plasmid',
  'nucleus',
  'ribosome',
  'er',
  'golgi',
  'mitochondrion',
  'chloroplast',
  'vacuole',
  'lysosome',
  'peroxysome',
  'cytoskeleton',
  'centrosome',
];

/** Parts of one cell, in teaching order. */
export function partsFor(kind: CellKind): PartId[] {
  return ORDER.filter((id) => PARTS[id].cells.includes(kind));
}
