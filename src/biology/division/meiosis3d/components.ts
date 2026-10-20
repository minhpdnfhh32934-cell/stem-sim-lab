/**
 * Texts of the 3D meiosis view: clickable cell parts (name + function), stage names and notes,
 * and the 3D Science Card. Vietnamese is the source of truth. Texts shared with the mitosis view
 * are reused where they hold for meiosis too; every new text is listed in docs/DATA_REVIEW.md
 * (MEI3D-*, review_status: pending) — sources: BSRC.sgk10, BSRC.campbell.
 */
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../../common';
import { COMPONENTS as MITOSIS_PARTS } from '../mitosis3d/components';
import { STAGE_NAME, STAGE_NOTE, cardFor } from '../state';
import type { Meiosis3DState, MeiosisStage3D } from './timeline';

export type MeiosisComponentId =
  | 'membrane'
  | 'nucleus'
  | 'nuclearEnvelope'
  | 'nucleolus'
  | 'chromatin'
  | 'bivalent'
  | 'homologousChromosome'
  | 'doubleChromosome'
  | 'sisterChromatid'
  | 'chiasma'
  | 'centromere'
  | 'singleChromosome'
  | 'spindle'
  | 'centrosome'
  | 'cleavageFurrow';

/** The part the learner picked (by clicking the 3D view or the parts list). */
export interface MeiosisSelection {
  component: MeiosisComponentId;
  /** Homologous pair (0-based) of a picked bivalent or chiasma. */
  pair?: number;
  /** Picked chromosome (index in the model's G1 cell) and sister, when one was clicked. */
  chromosome?: number;
  sister?: 0 | 1;
}

export type MeiosisCameraMode = 'overview' | 'closeup';

export interface MeiosisPartInfo {
  name: LocalizedText;
  role: LocalizedText;
}

/** "Minh họa — không phải tỉ lệ/hình dạng thật": parts list, caption and 3D card. */
export const MEIOSIS_ILLUSTRATION = L(
  'Minh họa — không phải tỉ lệ/hình dạng thật.',
  'Illustration — not to scale or true shape.',
);

export const MEIOSIS_PARTS: Record<MeiosisComponentId, MeiosisPartInfo> = {
  membrane: MITOSIS_PARTS.membrane,
  nucleus: MITOSIS_PARTS.nucleus,
  nuclearEnvelope: {
    name: MITOSIS_PARTS.nuclearEnvelope.name,
    role: L(
      'Màng kép bao quanh nhân; tiêu biến ở kì đầu I và kì đầu II, hình thành lại quanh mỗi bộ NST ở kì cuối (ở kì cuối I, tùy loài).',
      'The double membrane around the nucleus; it breaks down in prophase I and prophase II and re-forms around each chromosome set in telophase (in telophase I, depending on the species).',
    ),
  },
  nucleolus: MITOSIS_PARTS.nucleolus,
  chromatin: MITOSIS_PARTS.chromatin,
  bivalent: {
    name: L('Cặp NST kép tương đồng (thể lưỡng trị)', 'Bivalent (tetrad)'),
    role: L(
      'Hai NST kép tương đồng (một từ mẹ, một từ bố) bắt đôi với nhau suốt chiều dài ở kì đầu I (tiếp hợp), gồm 4 crômatit nên còn gọi là bộ bốn. Ở kì giữa I các cặp xếp thành 2 hàng ở mặt phẳng xích đạo; ở kì sau I hai NST kép của mỗi cặp tách nhau, đi về hai cực.',
      'Two homologous double chromosomes (one from the mother, one from the father) paired along their length in prophase I (synapsis); with four chromatids it is also called a tetrad. In metaphase I the pairs line up in two rows on the equatorial plate; in anaphase I the two double chromosomes of each pair separate to opposite poles.',
    ),
  },
  homologousChromosome: {
    name: L('NST tương đồng', 'Homologous chromosome'),
    role: L(
      'Mỗi cặp NST tương đồng gồm 2 NST giống nhau về hình dạng, kích thước và trình tự gen, một có nguồn gốc từ mẹ, một từ bố. Ở giảm phân I, hai NST tương đồng (đều là NST kép) tách nhau và đi về hai tế bào con.',
      'A homologous pair has two chromosomes alike in shape, size and gene order, one from the mother and one from the father. In meiosis I the two homologues (both double) separate into the two daughter cells.',
    ),
  },
  doubleChromosome: {
    name: MITOSIS_PARTS.doubleChromosome.name,
    role: L(
      'NST đã nhân đôi ở pha S, gồm 2 crômatit chị em dính nhau ở tâm động. Từ kì sau I, hai NST tương đồng của mỗi cặp đã tách về hai cực: mỗi cực (rồi mỗi tế bào con) chỉ có một chiếc của mỗi cặp, tức n NST kép, không còn cặp NST tương đồng. Hai crômatit chị em tách nhau ở kì sau II.',
      'A chromosome replicated in S phase: two sister chromatids joined at the centromere. From anaphase I the two homologues of each pair have moved to opposite poles: each pole (then each daughter cell) has one chromosome of each pair, n double chromosomes and no homologous pairs. The sister chromatids separate in anaphase II.',
    ),
  },
  sisterChromatid: {
    name: MITOSIS_PARTS.sisterChromatid.name,
    role: L(
      'Một trong hai nửa của NST kép (mỗi crômatit là một phân tử ADN), dính với crômatit chị em ở tâm động. Hai crômatit chị em chỉ tách nhau ở kì sau II. Sau trao đổi chéo, một crômatit có thể mang một đoạn của NST tương đồng (màu khác).',
      'One of the two halves of a double chromosome (each chromatid is one DNA molecule), joined to its sister at the centromere. Sister chromatids separate only in anaphase II. After crossing over, a chromatid may carry a piece of its homologue (another colour).',
    ),
  },
  chiasma: {
    name: L('Điểm bắt chéo (trao đổi chéo)', 'Chiasma (crossover point)'),
    role: L(
      'Chỗ hai crômatit không chị em của một cặp NST tương đồng bắt chéo nhau. Tại đây chúng đã trao đổi đoạn tương ứng (trao đổi chéo, kì đầu I), tạo ra crômatit mang gen của cả bố và mẹ — một nguồn biến dị tổ hợp. Điểm bắt chéo giữ hai NST tương đồng với nhau tới kì sau I.',
      'Where two non-sister chromatids of a homologous pair cross. There they have exchanged matching pieces (crossing over, prophase I), giving chromatids that carry genes of both parents — a source of genetic variation. The chiasma holds the homologues together until anaphase I.',
    ),
  },
  centromere: {
    name: MITOSIS_PARTS.centromere.name,
    role: L(
      'Vùng thắt trên NST; hai crômatit chị em dính nhau ở tâm động. Ở kì sau I tâm động không tách (cả NST kép đi về một cực); tâm động chỉ tách ở kì sau II. Sợi thoi đính vào tâm động (tại thể động): ở giảm phân I, cả hai crômatit chị em của một NST đính sợi thoi từ cùng một cực.',
      'The constriction of a chromosome, where the sister chromatids are joined. In anaphase I it does not split (the whole double chromosome goes to one pole); it splits only in anaphase II. Spindle fibres attach there (at the kinetochores): in meiosis I both sisters of a chromosome are attached to the same pole.',
    ),
  },
  singleChromosome: {
    name: MITOSIS_PARTS.singleChromosome.name,
    role: L(
      'NST chỉ gồm 1 phân tử ADN: có ở pha G1 và sau khi hai crômatit chị em tách nhau ở kì sau II. Mỗi tế bào con cuối cùng có n NST đơn, mỗi cặp tương đồng một chiếc.',
      'A chromosome made of one DNA molecule: found in G1 and after the sister chromatids separate in anaphase II. Each final cell has n single chromosomes, one of each homologous pair.',
    ),
  },
  spindle: {
    name: L('Thoi phân bào', 'Spindle'),
    role: L(
      'Hệ vi ống hình thành ở kì đầu I, và lại ở kì đầu II (mỗi tế bào một thoi, vuông góc với thoi thứ nhất). Một số sợi thoi đính vào tâm động (tại thể động) và kéo NST về hai cực; các sợi còn lại không gắn với NST. Thoi phân bào tiêu biến ở kì cuối.',
      'Microtubules that form in prophase I, and again in prophase II (one spindle per cell, at a right angle to the first one). Some fibres attach to the centromeres (at the kinetochores) and pull the chromosomes to the poles; the others do not attach to chromosomes. The spindle disassembles in telophase.',
    ),
  },
  centrosome: {
    name: MITOSIS_PARTS.centrosome.name,
    role: L(
      'Ở tế bào động vật, trung thể (chứa một cặp trung tử) tổ chức thoi phân bào. Trung thể nhân đôi ở kì trung gian trước giảm phân I, hai trung thể đi về hai cực; ở giảm phân II, mỗi tế bào có hai cực thoi mới (hình vẽ đơn giản hóa).',
      'In animal cells the centrosome (with a pair of centrioles) organises the spindle. It duplicates in the interphase before meiosis I and the two centrosomes move to opposite poles; in meiosis II each cell has two new spindle poles (simplified drawing).',
    ),
  },
  cleavageFurrow: MITOSIS_PARTS.cleavageFurrow,
};

/** Parts in a teaching order (outside → inside → division machinery). */
export const MEIOSIS_PART_ORDER: readonly MeiosisComponentId[] = [
  'membrane',
  'nucleus',
  'nuclearEnvelope',
  'nucleolus',
  'chromatin',
  'bivalent',
  'homologousChromosome',
  'doubleChromosome',
  'sisterChromatid',
  'chiasma',
  'centromere',
  'singleChromosome',
  'spindle',
  'centrosome',
  'cleavageFurrow',
];

/**
 * Whether both homologues of every pair are still in one group: G1 to metaphase I. From
 * anaphase I the homologues have separated (the model's reduction division), so a chromosome is
 * one of its pair — never labelled "NST tương đồng" any more.
 */
export function homologuesTogether(stage: MeiosisStage3D): boolean {
  return stage === 'g1' || stage === 'g2' || stage === 'prophase1' || stage === 'metaphase1';
}

/** The part a condensed chromosome (one of its chromatids) belongs to at this stage. */
export function chromosomePart(
  c: { paired: boolean; joined: boolean },
  stage: MeiosisStage3D,
): 'bivalent' | 'homologousChromosome' | 'doubleChromosome' | 'singleChromosome' {
  if (c.paired) return 'bivalent';
  if (!c.joined) return 'singleChromosome';
  return homologuesTogether(stage) ? 'homologousChromosome' : 'doubleChromosome';
}

/**
 * The selection after a tap on the picture: a second tap on the bivalent or the chromosome
 * already picked drills down to the chromatid under the pointer (its DNA pieces are listed).
 */
export function drillSelection(
  prev: MeiosisSelection | null,
  hit: MeiosisSelection | null,
): MeiosisSelection | null {
  if (!hit || !prev || hit.chromosome === undefined) return hit;
  const sameBivalent =
    hit.component === 'bivalent' && prev.component === 'bivalent' && prev.pair === hit.pair;
  const sameChromosome =
    (hit.component === 'homologousChromosome' || hit.component === 'doubleChromosome') &&
    prev.component === hit.component &&
    prev.chromosome === hit.chromosome;
  return sameBivalent || sameChromosome
    ? { component: 'sisterChromatid', chromosome: hit.chromosome, sister: hit.sister ?? 0 }
    : hit;
}

/** Whether a part can be seen at this moment (the info panel says so when it cannot). */
export function meiosisPartVisible(id: MeiosisComponentId, s: Meiosis3DState): boolean {
  const condensed = s.condensation > 0.4;
  const some = (f: (c: Meiosis3DState['chromatids'][number]) => boolean) =>
    s.chromatids.some((c) => c.present && f(c));
  switch (id) {
    case 'membrane':
      return true;
    case 'nucleus':
    case 'nuclearEnvelope':
      return s.nuclei.some((n) => n.envelope > 0.2);
    case 'nucleolus':
      return s.nuclei.some((n) => n.nucleolus > 0.2);
    case 'chromatin':
      return s.condensation < 0.5;
    case 'bivalent':
      return condensed && some((c) => c.paired);
    case 'homologousChromosome':
      return condensed && homologuesTogether(s.stage) && some((c) => c.joined);
    case 'doubleChromosome':
    case 'sisterChromatid':
      return condensed && some((c) => c.joined);
    case 'chiasma':
      return s.chiasmata.some((x) => x.weight > 0.05);
    case 'centromere':
      return condensed;
    case 'singleChromosome':
      return some((c) => !c.joined);
    case 'spindle':
      return s.spindle > 0.05;
    case 'centrosome':
      return s.centrosomes.length > 0;
    case 'cleavageFurrow':
      return s.membranes.some((m) => m.ring);
  }
}

export const MEIOSIS_STAGE_NAME: Record<MeiosisStage3D, LocalizedText> = {
  g1: STAGE_NAME.g1,
  g2: STAGE_NAME.g2,
  prophase1: STAGE_NAME.prophase1,
  metaphase1: STAGE_NAME.metaphase1,
  anaphase1: STAGE_NAME.anaphase1,
  telophase1: STAGE_NAME.telophase1,
  cytokinesis1: L('Phân chia tế bào chất I', 'Cytokinesis I'),
  prophase2: STAGE_NAME.prophase2,
  metaphase2: STAGE_NAME.metaphase2,
  anaphase2: STAGE_NAME.anaphase2,
  telophase2: STAGE_NAME.telophase2,
  cytokinesis2: L('Phân chia tế bào chất II', 'Cytokinesis II'),
};

/** Short names for the stage strip (the full name is the tooltip). */
export const MEIOSIS_STAGE_SHORT: Record<MeiosisStage3D, LocalizedText> = {
  g1: L('Trung gian G1', 'Interphase G1'),
  g2: L('Trung gian G2', 'Interphase G2'),
  prophase1: L('Kì đầu I', 'Prophase I'),
  metaphase1: L('Kì giữa I', 'Metaphase I'),
  anaphase1: L('Kì sau I', 'Anaphase I'),
  telophase1: L('Kì cuối I', 'Telophase I'),
  cytokinesis1: L('Chia tế bào chất I', 'Cytokinesis I'),
  prophase2: L('Kì đầu II', 'Prophase II'),
  metaphase2: L('Kì giữa II', 'Metaphase II'),
  anaphase2: L('Kì sau II', 'Anaphase II'),
  telophase2: L('Kì cuối II', 'Telophase II'),
  cytokinesis2: L('Chia tế bào chất II', 'Cytokinesis II'),
};

export const MEIOSIS_STAGE_NOTE: Record<MeiosisStage3D, LocalizedText> = {
  g1: L(
    `${STAGE_NOTE.g1.vi} Tế bào sinh dục chín (động vật) có 1 trung thể (gồm 2 trung tử) cạnh nhân.`,
    `${STAGE_NOTE.g1.en} The animal germ cell has one centrosome (two centrioles) next to the nucleus.`,
  ),
  g2: L(
    `${STAGE_NOTE.g2.vi} Trung thể cũng đã nhân đôi.`,
    `${STAGE_NOTE.g2.en} The centrosome has duplicated too.`,
  ),
  prophase1: L(
    'NST kép co xoắn dần; các NST tương đồng bắt đôi theo từng cặp (tiếp hợp) thành cặp NST kép tương đồng gồm 4 crômatit, và có thể trao đổi chéo giữa 2 crômatit không chị em (điểm bắt chéo). Nhân con, màng nhân tiêu biến; thoi phân bào hình thành.',
    'Double chromosomes condense; homologues pair up (synapsis) into bivalents of four chromatids, and two non-sister chromatids may cross over (chiasma). The nucleolus and the nuclear envelope disappear; the spindle forms.',
  ),
  metaphase1: L(
    'Các cặp NST kép tương đồng xếp thành 2 hàng ở mặt phẳng xích đạo; mỗi NST kép đính sợi thoi từ một cực. Chiều sắp xếp của mỗi cặp là ngẫu nhiên (lấy từ mô hình, giống bản 2D).',
    'The homologous pairs line up in two rows on the equatorial plate; each double chromosome is attached to one pole. Each pair’s orientation is random (from the model, as in the 2D view).',
  ),
  anaphase1: L(
    'Hai NST kép của mỗi cặp tương đồng tách nhau, đi về hai cực; tâm động không tách nên các crômatit chị em vẫn dính nhau. Tế bào dài ra.',
    'The two double chromosomes of each pair separate to opposite poles; centromeres do not split, so sister chromatids stay joined. The cell elongates.',
  ),
  telophase1: L(
    'Ở mỗi cực có n NST kép; NST dãn xoắn, thoi phân bào tiêu biến, màng nhân hình thành lại (tùy loài): 1 tế bào có 2 nhân.',
    'Each pole has n double chromosomes; they decondense, the spindle disassembles and nuclear envelopes re-form (depending on the species): one cell with two nuclei.',
  ),
  cytokinesis1: L(
    'Vòng co chia tế bào chất làm hai: 2 tế bào con, mỗi tế bào n NST kép. Các tế bào bước vào giảm phân II mà không nhân đôi ADN.',
    'A contractile ring divides the cytoplasm: two cells, each with n double chromosomes. They enter meiosis II without replicating their DNA.',
  ),
  prophase2: L(
    'Không có pha S trước kì đầu II: mỗi tế bào vẫn có n NST kép. NST co xoắn lại, màng nhân tiêu biến; trong mỗi tế bào thoi phân bào mới hình thành, vuông góc với thoi của giảm phân I.',
    'No S phase before prophase II: each cell still has n double chromosomes. They condense again, the nuclear envelope breaks down; in each cell a new spindle forms, at a right angle to the spindle of meiosis I.',
  ),
  metaphase2: L(
    'Trong mỗi tế bào, n NST kép xếp 1 hàng ở mặt phẳng xích đạo; hai crômatit chị em đính sợi thoi từ hai cực.',
    'In each cell the n double chromosomes line up in one row on the equatorial plate; the two sister chromatids are attached to opposite poles.',
  ),
  anaphase2: L(
    'Tâm động tách: hai crômatit chị em thành 2 NST đơn, đi về hai cực của mỗi tế bào.',
    'Centromeres split: the sister chromatids become two single chromosomes and move to the two poles of each cell.',
  ),
  telophase2: L(
    'NST đơn dãn xoắn, thoi phân bào tiêu biến, màng nhân hình thành lại: mỗi tế bào có 2 nhân, mỗi nhân n NST đơn.',
    'Single chromosomes decondense, the spindle disassembles, nuclear envelopes re-form: each cell has two nuclei with n single chromosomes each.',
  ),
  cytokinesis2: L(
    'Tế bào chất phân chia: từ 1 tế bào ban đầu tạo 4 tế bào con, mỗi tế bào n NST đơn. Hình vẽ 4 tế bào bằng nhau; ở con cái, tế bào chất chia không đều (1 trứng và các thể cực).',
    'The cytoplasm divides: one cell has become four, each with n single chromosomes. The picture draws four equal cells; in females the cytoplasm divides unequally (one egg and polar bodies).',
  ),
};

/** The 3D Science Card: the 2D card's model and equation, plus what the 3D picture adds. */
export function meiosisCard3d(): ScienceCardData {
  const base = cardFor('meiosis');
  return {
    ...base,
    title: L('Giảm phân 3D — tế bào động vật', 'Meiosis in 3D — animal cell'),
    model: L(
      'Mô hình đếm NST (như bản 2D: nhân đôi ở pha S, tiếp hợp và trao đổi chéo ở kì đầu I, phân li cặp tương đồng ở kì sau I, tách crômatit chị em ở kì sau II) cho số lượng chính xác; bản 3D dùng cùng lần chạy với bản 2D (cùng chiều sắp xếp ở kì giữa I và cùng điểm trao đổi chéo), rồi đặt NST, thoi phân bào, màng và nhân vào khung hình chính của từng kì và chuyển tiếp mượt giữa chúng.',
      'Chromosome bookkeeping (as in the 2D view: replication in S, synapsis and crossing over in prophase I, homologues separate in anaphase I, sister chromatids separate in anaphase II) gives exact counts; the 3D view uses the same run as the 2D view (the same metaphase I orientations and crossover point), then places chromosomes, spindles, membranes and nuclei in key poses for each stage and moves smoothly between them.',
    ),
    assumptions: [
      L(
        `${MEIOSIS_ILLUSTRATION.vi} Kích thước, vị trí, hình dạng điểm bắt chéo, hình thoi phân bào, thời gian mỗi kì và khoảng nghỉ giữa hai lần phân bào là minh họa.`,
        `${MEIOSIS_ILLUSTRATION.en} Sizes, positions, the shape of the chiasma, the spindle geometry, stage durations and the pause between the two divisions are illustrative.`,
      ),
      L(
        'Chính xác (lấy từ mô hình): số NST, crômatit, tâm động, phân tử ADN; màu từng đoạn của mỗi crômatit (từ mẹ / từ bố); chiều sắp xếp của mỗi cặp ở kì giữa I; vị trí điểm trao đổi chéo.',
        'Exact (from the model): chromosome, chromatid, centromere and DNA counts; the colour of every piece of each chromatid (from the mother / the father); each pair’s metaphase I orientation; the crossover position.',
      ),
      L(
        'Kì cuối I và kì cuối II: 1 tế bào có 2 nhân (quy ước của bản 3D, như nguyên phân 3D); bước phân chia tế bào chất: số liệu cho mỗi tế bào con.',
        'Telophase I and telophase II: one cell with two nuclei (the 3D views’ convention, as in mitosis 3D); cytokinesis steps: counts per daughter cell.',
      ),
      L(
        'Giữa giảm phân I và giảm phân II không có pha S: số phân tử ADN mỗi tế bào không tăng (kiểm tra tự động).',
        'There is no S phase between meiosis I and meiosis II: the number of DNA molecules per cell does not grow (checked automatically).',
      ),
      L(
        'Ở kì giữa II, thoi phân bào của mỗi tế bào vẽ vuông góc với thoi của giảm phân I, như trong hình SGK.',
        'In metaphase II each cell’s spindle is drawn at a right angle to the spindle of meiosis I, as in textbook figures.',
      ),
      L(
        'Kì cuối I: hình vẽ NST dãn xoắn và màng nhân hình thành lại; ở một số loài NST gần như không dãn xoắn và tế bào vào ngay giảm phân II.',
        'Telophase I: the picture shows the chromosomes decondensing and nuclear envelopes re-forming; in some species the chromosomes hardly decondense and the cells go straight into meiosis II.',
      ),
      L(
        'Trung thể ở giảm phân II vẽ đơn giản: ở kì đầu II mỗi tế bào có 2 trung thể đi về hai cực mới; cách trung tử được chia giữa hai lần phân bào khác nhau giữa các loài và không được vẽ chi tiết.',
        'Centrosomes in meiosis II are simplified: in prophase II each cell has two centrosomes moving to the new poles; how centrioles are shared out between the two divisions varies between species and is not drawn in detail.',
      ),
      L(
        'Trao đổi chéo minh họa ở cặp NST số 1, tại một điểm (như bản 2D).',
        'Crossing over is shown on pair 1, at one point (as in the 2D view).',
      ),
      L(
        'Hình 3D chỉ vẽ cho 2n = 2, 4, 6, 8; số lượng của bộ NST lớn (2n = 46) vẫn được kiểm tra bằng test tự động.',
        'The 3D picture is drawn for 2n = 2, 4, 6, 8 only; the counts of a large set (2n = 46) are still checked by automated tests.',
      ),
      L(
        'Chỉ vẽ tế bào động vật. Ở thực vật, giảm phân tạo ra bào tử (không vẽ). Hình vẽ 4 tế bào con bằng nhau; ở con cái, tế bào chất chia không đều tạo 1 trứng và các thể cực.',
        'Animal cells only. In plants meiosis produces spores (not drawn). The picture shows four equal daughter cells; in females the cytoplasm divides unequally into one egg and polar bodies.',
      ),
      L(
        'Pha S không vẽ thành bước riêng: từ đầu bước G2 mỗi NST đã là NST kép và tế bào đã có 2 trung thể. Kì đầu I vẽ dài hơn các kì khác vì tiếp hợp và trao đổi chéo xảy ra trong kì này.',
        'S phase is not its own step: from the start of G2 every chromosome is double and the cell has two centrosomes. Prophase I is drawn longer than the other stages because synapsis and crossing over happen in it.',
      ),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Test tự động (2n = 2, 4, 6, 8; số lượng cả 2n = 46): số liệu mỗi kì khớp mô hình đếm và bảng SGK; kì giữa I mỗi NST tương đồng quay về cực mà mô hình gửi nó tới; kì sau I crômatit chị em vẫn dính nhau, kì sau II tách ra; màu crômatit đúng từng đoạn của mô hình, chỉ 2 crômatit không chị em phía trong đổi đoạn; cùng một lần chạy cho cùng các loại giao tử ở bản 2D và 3D; không nhân đôi ADN giữa hai lần phân bào; mỗi tế bào cuối có n NST đơn. Cách ghi kì cuối (1 tế bào có 2 nhân) đang chờ giáo viên duyệt.',
      'Automated tests (2n = 2, 4, 6, 8; counts also for 2n = 46): every stage’s counts match the bookkeeping model and the textbook table; in metaphase I each homologue faces the pole the model sends it to; sisters stay joined in anaphase I and split in anaphase II; chromatid colours follow the model piece by piece, only the two inner non-sister chromatids exchange pieces; the same run gives the same gametes in 2D and 3D; no DNA replication between the divisions; each final cell has n single chromosomes. The telophase convention (one cell with two nuclei) awaits teacher review.',
    ),
    userIntervened: false,
    sources: [BSRC.sgk10, BSRC.campbell],
    reviewStatus: 'pending',
  };
}
