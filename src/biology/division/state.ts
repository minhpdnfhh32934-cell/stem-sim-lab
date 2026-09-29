import { useMemo } from 'react';
import { create } from 'zustand';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';
import { rng } from '../genetics/stats';
import { runDivision, type Division, type StageId, type StageState } from './division';

export const STAGE_NAME: Record<StageId, LocalizedText> = {
  g1: L('Kì trung gian (pha G1)', 'Interphase (G1)'),
  g2: L('Kì trung gian (sau pha S, G2)', 'Interphase (after S, G2)'),
  prophase: L('Kì đầu', 'Prophase'),
  metaphase: L('Kì giữa', 'Metaphase'),
  anaphase: L('Kì sau', 'Anaphase'),
  telophase: L('Kì cuối', 'Telophase'),
  prophase1: L('Kì đầu I', 'Prophase I'),
  metaphase1: L('Kì giữa I', 'Metaphase I'),
  anaphase1: L('Kì sau I', 'Anaphase I'),
  telophase1: L('Kì cuối I', 'Telophase I'),
  prophase2: L('Kì đầu II', 'Prophase II'),
  metaphase2: L('Kì giữa II', 'Metaphase II'),
  anaphase2: L('Kì sau II', 'Anaphase II'),
  telophase2: L('Kì cuối II', 'Telophase II'),
};

export const STAGE_NOTE: Record<StageId, LocalizedText> = {
  g1: L(
    'NST ở dạng sợi mảnh (dãn xoắn), mỗi NST là một phân tử ADN.',
    'Chromosomes are decondensed; each is one DNA molecule.',
  ),
  g2: L(
    'Pha S đã nhân đôi ADN: mỗi NST gồm 2 cromatit chị em dính ở tâm động.',
    'DNA replicated in S: each chromosome has two sister chromatids.',
  ),
  prophase: L(
    'NST co xoắn, màng nhân biến mất, thoi phân bào hình thành.',
    'Chromosomes condense, the nuclear envelope breaks down, the spindle forms.',
  ),
  metaphase: L(
    'NST kép co xoắn cực đại, xếp 1 hàng ở mặt phẳng xích đạo.',
    'Fully condensed double chromosomes line up in one row at the equator.',
  ),
  anaphase: L(
    'Hai cromatit chị em tách nhau ở tâm động, đi về hai cực.',
    'Sister chromatids separate at the centromere and move to the poles.',
  ),
  telophase: L(
    'Tạo 2 tế bào con, mỗi tế bào có bộ NST 2n giống tế bào mẹ.',
    'Two daughter cells, each with the same 2n set as the parent.',
  ),
  prophase1: L(
    'NST kép tương đồng tiếp hợp; có thể trao đổi chéo giữa 2 cromatit không chị em.',
    'Homologous double chromosomes pair; crossing over between non-sister chromatids.',
  ),
  metaphase1: L(
    'Các cặp NST tương đồng xếp 2 hàng ở mặt phẳng xích đạo; chiều sắp xếp mỗi cặp là ngẫu nhiên.',
    'Homologous pairs line up in two rows; each pair’s orientation is random.',
  ),
  anaphase1: L(
    'Mỗi NST kép trong cặp tương đồng đi về một cực (tâm động không tách).',
    'Each double chromosome of a pair goes to one pole (centromeres do not split).',
  ),
  telophase1: L(
    'Tạo 2 tế bào con, mỗi tế bào có n NST kép.',
    'Two cells, each with n double chromosomes.',
  ),
  prophase2: L(
    'NST kép co xoắn lại (không nhân đôi ADN trước giảm phân II).',
    'Double chromosomes condense again (no DNA replication before meiosis II).',
  ),
  metaphase2: L(
    'NST kép xếp 1 hàng ở mặt phẳng xích đạo trong mỗi tế bào.',
    'Double chromosomes line up in one row in each cell.',
  ),
  anaphase2: L(
    'Cromatit chị em tách nhau, đi về hai cực.',
    'Sister chromatids separate to the poles.',
  ),
  telophase2: L(
    'Tạo 4 tế bào con, mỗi tế bào có n NST đơn.',
    'Four cells, each with n single chromosomes.',
  ),
};

export interface DivisionState {
  pairs: number;
  index: number;
  playing: boolean;
  crossover: boolean;
  seed: number;
}

export const useDivisionStore = create<DivisionState>()(() => ({
  pairs: 2,
  index: 0,
  playing: false,
  crossover: true,
  seed: 1,
}));

/** Stages of the current division (deterministic for a given seed). */
export function useStages(kind: Division): StageState[] {
  const { pairs, crossover, seed } = useDivisionStore();
  return useMemo(() => {
    const rand = rng(seed);
    const orientation = Array.from({ length: pairs }, () => rand() < 0.5);
    const crossovers = crossover ? [{ pair: 0, point: 0.35 + 0.3 * rand() }] : [];
    return runDivision(kind, pairs, { orientation, crossovers });
  }, [kind, pairs, crossover, seed]);
}

export function cardFor(kind: Division): ScienceCardData {
  return {
    title: kind === 'mitosis' ? L('Nguyên phân', 'Mitosis') : L('Giảm phân', 'Meiosis'),
    model: L(
      'Mô hình đếm NST: mỗi kì được suy ra từ kì trước theo quy tắc (nhân đôi ở pha S, tiếp hợp và trao đổi chéo ở kì đầu I, phân li cặp tương đồng ở kì sau I, tách cromatit chị em ở kì sau nguyên phân và kì sau II). Số liệu trong bảng được đếm từ mô hình.',
      'Chromosome bookkeeping: every stage is derived from the previous one (replication in S, synapsis and crossing over in prophase I, homologues separate in anaphase I, sister chromatids separate in mitotic anaphase and anaphase II). The table counts the model.',
    ),
    equations:
      kind === 'meiosis'
        ? [
            {
              tex: 'N_{\\text{gt}} = 2^n',
              label: L(
                'Số loại giao tử khi không trao đổi chéo',
                'Number of gamete types without crossing over',
              ),
            },
          ]
        : [
            {
              tex: 'N_k = 2^k',
              label: L('Số tế bào sau k lần nguyên phân', 'Cells after k mitotic divisions'),
            },
          ],
    assumptions: [
      L(
        'Hình vẽ minh họa (hình dạng, vị trí NST); số lượng là chính xác.',
        'Pictures are illustrative (shapes, positions); counts are exact.',
      ),
      L(
        'Kì cuối: số liệu tính cho mỗi tế bào con sau khi tế bào chất phân chia.',
        'Telophase: counts are per daughter cell after cytokinesis.',
      ),
      ...(kind === 'meiosis'
        ? [
            L(
              'Trao đổi chéo minh họa ở cặp NST số 1, tại một điểm.',
              'Crossing over shown on pair 1 at one point.',
            ),
          ]
        : []),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Test tự động: số NST, cromatit, tâm động ở mọi kì khớp bảng SGK với 2n = 4, 8, 46.',
      'Automated test: chromosome, chromatid and centromere counts match the textbook table for 2n = 4, 8, 46.',
    ),
    userIntervened: false,
    sources: [BSRC.sgk10, BSRC.campbell],
  };
}
