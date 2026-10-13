/**
 * Texts of the 3D mitosis view: clickable cell parts (name + one-sentence function), stage
 * names and notes, and the Science Card. Vietnamese is the source of truth. Every text here
 * is listed in docs/DATA_REVIEW.md (review_status: pending) — sources: BSRC.sgk10, BSRC.campbell.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../../common';
import { STAGE_NAME, STAGE_NOTE } from '../state';
import type { CellType, Mitosis3DState, Stage3D } from './timeline';

export type ComponentId =
  | 'membrane'
  | 'nucleus'
  | 'nuclearEnvelope'
  | 'chromatin'
  | 'doubleChromosome'
  | 'sisterChromatid'
  | 'singleChromosome'
  | 'centromere'
  | 'spindle'
  | 'centrosome'
  | 'cellWall'
  | 'cleavageFurrow'
  | 'cellPlate';

/** The part the learner picked (by clicking the 3D view or the parts list). */
export interface Selection {
  component: ComponentId;
  /** Picked chromosome (index in the G1 cell of the model) and sister, when one was clicked. */
  chromosome?: number;
  sister?: 0 | 1;
}

export type CameraMode = 'overview' | 'closeup';

export interface ComponentInfo {
  name: LocalizedText;
  role: LocalizedText;
  /** Cell types that have this part (never mix animal-only and plant-only parts). */
  cells: readonly CellType[];
}

const BOTH = ['animal', 'plant'] as const;

export const COMPONENTS: Record<ComponentId, ComponentInfo> = {
  membrane: {
    name: L('Màng tế bào', 'Cell membrane'),
    role: L(
      'Lớp màng bao quanh tế bào chất, ngăn cách tế bào với môi trường và kiểm soát các chất ra vào tế bào.',
      'The membrane around the cytoplasm; it separates the cell from its surroundings and controls what enters and leaves.',
    ),
    cells: BOTH,
  },
  nucleus: {
    name: L('Nhân tế bào', 'Nucleus'),
    role: L(
      'Chứa vật chất di truyền (ADN, ở kì trung gian dưới dạng sợi nhiễm sắc) và điều khiển mọi hoạt động của tế bào.',
      'Holds the genetic material (DNA, as chromatin in interphase) and controls the activities of the cell.',
    ),
    cells: BOTH,
  },
  nuclearEnvelope: {
    name: L('Màng nhân', 'Nuclear envelope'),
    role: L(
      'Màng kép bao quanh nhân; tiêu biến ở kì đầu và hình thành lại quanh mỗi bộ NST ở kì cuối.',
      'The double membrane around the nucleus; it breaks down in prophase and re-forms around each chromosome set in telophase.',
    ),
    cells: BOTH,
  },
  chromatin: {
    name: L('Sợi nhiễm sắc (NST dãn xoắn)', 'Chromatin (decondensed chromosome)'),
    role: L(
      'Ở kì trung gian, NST ở dạng sợi mảnh dãn xoắn, nhờ đó ADN có thể nhân đôi và phiên mã.',
      'In interphase chromosomes are long, thin, decondensed threads, so their DNA can be replicated and transcribed.',
    ),
    cells: BOTH,
  },
  doubleChromosome: {
    name: L('Nhiễm sắc thể kép', 'Double (replicated) chromosome'),
    role: L(
      'NST đã nhân đôi ở pha S, gồm 2 cromatit chị em giống hệt nhau dính với nhau ở tâm động.',
      'A chromosome replicated in S phase: two identical sister chromatids joined at the centromere.',
    ),
    cells: BOTH,
  },
  sisterChromatid: {
    name: L('Cromatit chị em', 'Sister chromatid'),
    role: L(
      'Một trong hai nửa giống hệt nhau của NST kép (mỗi cromatit là một phân tử ADN); hai cromatit chị em tách nhau ở kì sau.',
      'One of the two identical halves of a double chromosome (each is one DNA molecule); sisters separate in anaphase.',
    ),
    cells: BOTH,
  },
  singleChromosome: {
    name: L('Nhiễm sắc thể đơn', 'Single chromosome'),
    role: L(
      'NST chỉ gồm 1 phân tử ADN: có ở pha G1 và sau khi hai cromatit chị em tách nhau ở kì sau.',
      'A chromosome made of one DNA molecule: found in G1 and after the sister chromatids separate in anaphase.',
    ),
    cells: BOTH,
  },
  centromere: {
    name: L('Tâm động', 'Centromere'),
    role: L(
      'Vùng thắt nơi hai cromatit chị em dính nhau; sợi thoi phân bào bám vào tâm động (tại thể động) để kéo NST về các cực.',
      'The constriction where sister chromatids are joined; spindle fibres attach there (at the kinetochores) to pull chromosomes to the poles.',
    ),
    cells: BOTH,
  },
  spindle: {
    name: L('Thoi phân bào', 'Mitotic spindle'),
    role: L(
      'Hệ vi ống hình thành ở kì đầu, đính vào tâm động và kéo các NST về hai cực tế bào; tiêu biến ở kì cuối.',
      'Microtubules that form in prophase, attach to the centromeres and pull the chromosomes to the poles; they disassemble in telophase.',
    ),
    cells: BOTH,
  },
  centrosome: {
    name: L('Trung thể', 'Centrosome'),
    role: L(
      'Ở tế bào động vật, trung thể (chứa một cặp trung tử) nhân đôi ở kì trung gian; hai trung thể đi về hai cực và tổ chức thoi phân bào.',
      'In animal cells the centrosome (with a pair of centrioles) duplicates in interphase; the two centrosomes move to opposite poles and organise the spindle.',
    ),
    cells: ['animal'],
  },
  cellWall: {
    name: L('Thành tế bào', 'Cell wall'),
    role: L(
      'Lớp vỏ cứng (chủ yếu là cellulose) bên ngoài màng tế bào thực vật, giữ hình dạng tế bào nên tế bào không thắt eo được.',
      'The rigid layer (mainly cellulose) outside the plant cell membrane; it keeps the cell’s shape, so the cell cannot pinch in two.',
    ),
    cells: ['plant'],
  },
  cleavageFurrow: {
    name: L('Rãnh phân cắt (eo thắt)', 'Cleavage furrow'),
    role: L(
      'Ở tế bào động vật, vòng co gồm các sợi actin và myosin thắt dần màng tế bào ở mặt phẳng xích đạo, chia tế bào chất làm hai.',
      'In animal cells a contractile ring of actin and myosin filaments tightens the membrane at the equator and divides the cytoplasm in two.',
    ),
    cells: ['animal'],
  },
  cellPlate: {
    name: L('Vách ngăn (tấm tế bào)', 'Cell plate'),
    role: L(
      'Ở tế bào thực vật, các túi từ bộ máy Golgi tập trung ở mặt phẳng xích đạo, hợp lại thành tấm tế bào lớn dần từ giữa ra và trở thành vách ngăn giữa hai tế bào con.',
      'In plant cells, vesicles from the Golgi apparatus gather at the equator and fuse into a cell plate that grows outward and becomes the new wall between the daughter cells.',
    ),
    cells: ['plant'],
  },
};

const ORDER: ComponentId[] = [
  'cellWall',
  'membrane',
  'nucleus',
  'nuclearEnvelope',
  'chromatin',
  'doubleChromosome',
  'sisterChromatid',
  'centromere',
  'singleChromosome',
  'spindle',
  'centrosome',
  'cleavageFurrow',
  'cellPlate',
];

/** Parts a cell type has, in a teaching order (outside → inside → division machinery). */
export function componentsFor(cellType: CellType): ComponentId[] {
  return ORDER.filter((id) => COMPONENTS[id].cells.includes(cellType));
}

/** Whether a part can be seen at this moment (the info panel says so when it cannot). */
export function componentVisible(id: ComponentId, s: Mitosis3DState): boolean {
  const condensed = s.condensation > 0.4;
  const some = (f: (c: Mitosis3DState['chromatids'][number]) => boolean) =>
    s.chromatids.some((c) => c.present && f(c));
  switch (id) {
    case 'membrane':
      return true;
    case 'cellWall':
      return s.shape.type === 'plant';
    case 'nucleus':
    case 'nuclearEnvelope':
      return s.nuclei.some((n) => n.envelope > 0.2);
    case 'chromatin':
      return s.condensation < 0.5;
    case 'doubleChromosome':
    case 'sisterChromatid':
      return condensed && some((c) => c.joined);
    case 'singleChromosome':
      return some((c) => !c.joined);
    case 'centromere':
      return condensed;
    case 'spindle':
      return s.spindle > 0.05;
    case 'centrosome':
      return s.centrosomes.length > 0;
    case 'cleavageFurrow':
      return s.shape.type === 'animal' && s.shape.ring;
    case 'cellPlate':
      return s.shape.type === 'plant' && s.shape.plate > 0;
  }
}

export const STAGE3D_NAME: Record<Stage3D, LocalizedText> = {
  g1: STAGE_NAME.g1,
  g2: STAGE_NAME.g2,
  prophase: STAGE_NAME.prophase,
  metaphase: STAGE_NAME.metaphase,
  anaphase: STAGE_NAME.anaphase,
  telophase: STAGE_NAME.telophase,
  cytokinesis: L('Phân chia tế bào chất', 'Cytokinesis'),
};

const NOTES: Record<CellType, Record<Stage3D, LocalizedText>> = {
  animal: {
    g1: L(
      `${STAGE_NOTE.g1.vi} Tế bào động vật có 1 trung thể (gồm 2 trung tử) cạnh nhân.`,
      `${STAGE_NOTE.g1.en} An animal cell has one centrosome (two centrioles) next to the nucleus.`,
    ),
    g2: L(
      `${STAGE_NOTE.g2.vi} Trung thể cũng đã nhân đôi.`,
      `${STAGE_NOTE.g2.en} The centrosome has duplicated too.`,
    ),
    prophase: L(
      'NST kép co xoắn dần; màng nhân tiêu biến; hai trung thể đi về hai cực và thoi phân bào hình thành giữa chúng.',
      'Double chromosomes condense; the nuclear envelope breaks down; the two centrosomes move to opposite poles and the spindle forms between them.',
    ),
    metaphase: L(
      'NST kép co xoắn cực đại, tập trung thành 1 hàng ở mặt phẳng xích đạo; tâm động của mỗi NST đính với sợi thoi từ cả hai cực.',
      'Fully condensed double chromosomes line up in one row on the equatorial plate; each centromere is attached to fibres from both poles.',
    ),
    anaphase: L(
      'Hai cromatit chị em tách nhau ở tâm động, thành 2 NST đơn đi về hai cực; tế bào dài ra.',
      'Sister chromatids separate at the centromere and, as single chromosomes, move to opposite poles; the cell elongates.',
    ),
    telophase: L(
      'NST dãn xoắn; màng nhân hình thành lại quanh mỗi bộ NST: 1 tế bào có 2 nhân; thoi phân bào tiêu biến.',
      'Chromosomes decondense; a nuclear envelope re-forms around each set: one cell with two nuclei; the spindle disassembles.',
    ),
    cytokinesis: L(
      'Vòng co thắt màng tế bào ở mặt phẳng xích đạo (rãnh phân cắt), chia tế bào chất làm hai: 2 tế bào con, mỗi tế bào có 2n NST đơn giống tế bào mẹ.',
      'A contractile ring pinches the membrane at the equator (cleavage furrow) and divides the cytoplasm: two daughter cells, each with the same 2n single chromosomes as the mother cell.',
    ),
  },
  plant: {
    g1: L(
      `${STAGE_NOTE.g1.vi} Tế bào thực vật có thành tế bào cứng và không có trung thể.`,
      `${STAGE_NOTE.g1.en} A plant cell has a rigid cell wall and no centrosome.`,
    ),
    g2: STAGE_NOTE.g2,
    prophase: L(
      'NST kép co xoắn dần; màng nhân tiêu biến; thoi phân bào hình thành từ hai vùng cực (tế bào thực vật không có trung thể).',
      'Double chromosomes condense; the nuclear envelope breaks down; the spindle forms from two polar regions (plant cells have no centrosomes).',
    ),
    metaphase: L(
      'NST kép co xoắn cực đại, tập trung thành 1 hàng ở mặt phẳng xích đạo; tâm động của mỗi NST đính với sợi thoi từ cả hai cực.',
      'Fully condensed double chromosomes line up in one row on the equatorial plate; each centromere is attached to fibres from both poles.',
    ),
    anaphase: L(
      'Hai cromatit chị em tách nhau ở tâm động, thành 2 NST đơn đi về hai cực; thành tế bào giữ nguyên hình dạng tế bào.',
      'Sister chromatids separate at the centromere and, as single chromosomes, move to opposite poles; the wall keeps the cell’s shape.',
    ),
    telophase: L(
      'NST dãn xoắn; màng nhân hình thành lại quanh mỗi bộ NST: 1 tế bào có 2 nhân; thoi phân bào tiêu biến.',
      'Chromosomes decondense; a nuclear envelope re-forms around each set: one cell with two nuclei; the spindle disassembles.',
    ),
    cytokinesis: L(
      'Tấm tế bào hình thành ở mặt phẳng xích đạo, lớn dần từ giữa ra tới thành tế bào và trở thành vách ngăn: 2 tế bào con, mỗi tế bào có 2n NST đơn giống tế bào mẹ.',
      'A cell plate forms at the equator, grows outward to the wall and becomes the new wall: two daughter cells, each with the same 2n single chromosomes as the mother cell.',
    ),
  },
};

export function stageNote(stage: Stage3D, cellType: CellType): LocalizedText {
  return NOTES[cellType][stage];
}

export const CELL_TYPE_NAME: Record<CellType, LocalizedText> = {
  animal: L('Tế bào động vật', 'Animal cell'),
  plant: L('Tế bào thực vật', 'Plant cell'),
};

export function card3d(cellType: CellType): ScienceCardData {
  return {
    title: L(
      `Nguyên phân 3D — ${CELL_TYPE_NAME[cellType].vi.toLowerCase()}`,
      `Mitosis in 3D — ${CELL_TYPE_NAME[cellType].en.toLowerCase()}`,
    ),
    model: L(
      'Mô hình đếm NST (như bản 2D: nhân đôi ở pha S, tách cromatit chị em ở kì sau) cho số lượng chính xác; mô hình 3D chỉ đặt các NST, thoi phân bào, màng và nhân vào khung hình chính của từng kì rồi chuyển tiếp mượt giữa chúng.',
      'Chromosome bookkeeping (as in the 2D view: replication in S, sister chromatids separate in anaphase) gives exact counts; the 3D model only places chromosomes, spindle, membranes and nuclei in key poses for each stage and moves smoothly between them.',
    ),
    equations: [
      {
        tex: 'N_k = 2^k',
        label: L('Số tế bào sau k lần nguyên phân', 'Cells after k mitotic divisions'),
      },
    ],
    assumptions: [
      L(
        'Kích thước và vị trí là minh họa, không theo tỉ lệ (tế bào, nhân, NST, thoi phân bào); thời gian mỗi kì cũng là minh họa.',
        'Sizes and positions are illustrative, not to scale (cell, nucleus, chromosomes, spindle); stage durations are illustrative too.',
      ),
      L(
        'Số NST, cromatit, tâm động, phân tử ADN là chính xác (đếm từ mô hình). Kì cuối: 1 tế bào có 2 nhân; bước "Phân chia tế bào chất": số liệu tính cho mỗi tế bào con.',
        'Chromosome, chromatid, centromere and DNA counts are exact (counted from the model). Telophase: one cell with two nuclei; "Cytokinesis": counts per daughter cell.',
      ),
      L(
        'Trong tế bào thật, phân chia tế bào chất thường bắt đầu từ cuối kì sau hoặc kì cuối; ở đây tách thành một bước riêng cho dễ quan sát.',
        'In real cells cytokinesis usually begins in late anaphase or telophase; here it is shown as a separate step for clarity.',
      ),
      L(
        'Các NST tập trung về mặt phẳng xích đạo ở đầu kì giữa (một số tài liệu tách thành kì riêng: tiền kì giữa).',
        'Chromosomes move to the equatorial plate at the start of metaphase (some books call this a separate stage, prometaphase).',
      ),
      cellType === 'animal'
        ? L(
            'Tế bào động vật: có trung thể, sao (vi ống tỏa ra từ trung thể), rãnh phân cắt; không có thành tế bào.',
            'Animal cell: centrosomes, asters and a cleavage furrow; no cell wall.',
          )
        : L(
            'Tế bào thực vật: có thành tế bào, tấm tế bào (vách ngăn); không có trung thể, không thắt eo.',
            'Plant cell: cell wall and cell plate; no centrosomes and no cleavage furrow.',
          ),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Test tự động: số lượng ở mọi kì lấy từ mô hình đếm NST (khớp bảng SGK với 2n = 4, 8, 46); ở kì giữa mọi tâm động nằm trên mặt phẳng xích đạo; kì sau hai cromatit chị em về hai cực; sau phân chia: 2 tế bào, mỗi tế bào 2n NST đơn.',
      'Automated tests: counts at every stage come from the bookkeeping model (textbook table for 2n = 4, 8, 46); in metaphase every centromere is on the equatorial plane; in anaphase sisters go to opposite poles; after division: two cells with 2n single chromosomes each.',
    ),
    userIntervened: false,
    sources: [BSRC.sgk10, BSRC.campbell],
    reviewStatus: 'pending',
  };
}
