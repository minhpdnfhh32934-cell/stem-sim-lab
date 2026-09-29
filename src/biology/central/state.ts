import { create } from 'zustand';
import type { LocalizedText } from '@/core/data/dataset';
import type { ScienceCardData } from '@/science-card/types';
import { BSRC, L } from '../common';
import {
  GENETIC_CODE_SOURCE,
  SequenceError,
  cleanDna,
  complement,
  type Mutation,
  type MutationEffect,
} from './dogma';

export interface DogmaState {
  input: string;
  strand: 'coding' | 'template';
  step: number;
  playing: boolean;
  kind: 'substitution' | 'insertion' | 'deletion';
  /** 1-based position on the coding strand. */
  pos: number;
  bases: string;
  count: number;
}

export const useDogmaStore = create<DogmaState>()(() => ({
  input: 'TAC ATGGCTTTCAAAGGCTGGTAA GC',
  strand: 'coding',
  step: 0,
  playing: false,
  kind: 'substitution',
  pos: 13,
  bases: 'T',
  count: 1,
}));

/** User input → coding strand (5′→3′). A template strand is complemented (and reversed-order aware). */
export function parseInput(
  input: string,
  strand: 'coding' | 'template',
): { ok: true; coding: string } | { ok: false; error: string } {
  try {
    const dna = cleanDna(input);
    if (!dna) return { ok: false, error: 'empty' };
    // The template is typed 3′→5′ aligned under the coding strand, so its complement is the
    // coding strand read 5′→3′.
    return { ok: true, coding: strand === 'coding' ? dna : complement(dna) };
  } catch (e) {
    return { ok: false, error: e instanceof SequenceError ? e.message : String(e) };
  }
}

export function mutationOf(st: DogmaState, length: number): Mutation | null {
  const pos = Math.min(Math.max(1, st.pos), length) - 1;
  if (length === 0) return null;
  if (st.kind === 'substitution')
    return st.bases.length === 1 ? { kind: 'substitution', pos, base: st.bases } : null;
  if (st.kind === 'insertion')
    return st.bases.length ? { kind: 'insertion', pos, bases: st.bases } : null;
  return { kind: 'deletion', pos, count: Math.min(st.count, length - pos) };
}

export const EFFECT: Record<MutationEffect, { name: LocalizedText; desc: LocalizedText }> = {
  silent: {
    name: L('Đột biến im lặng (đồng nghĩa)', 'Silent (synonymous) mutation'),
    desc: L(
      'Bộ ba mới mã hóa cùng axit amin (do tính thoái hóa của mã di truyền): protein không đổi.',
      'The new codon codes for the same amino acid (degenerate code): the protein is unchanged.',
    ),
  },
  missense: {
    name: L('Đột biến sai nghĩa', 'Missense mutation'),
    desc: L(
      'Một axit amin bị thay bằng axit amin khác; protein có thể thay đổi chức năng.',
      'One amino acid is replaced by another; the protein may change function.',
    ),
  },
  nonsense: {
    name: L('Đột biến vô nghĩa', 'Nonsense mutation'),
    desc: L(
      'Xuất hiện bộ ba kết thúc sớm: chuỗi pôlipeptit bị ngắn lại.',
      'A premature stop codon appears: the polypeptide is shortened.',
    ),
  },
  stopLoss: {
    name: L('Mất bộ ba kết thúc', 'Stop-loss mutation'),
    desc: L(
      'Bộ ba kết thúc bị thay đổi: chuỗi pôlipeptit kéo dài thêm.',
      'The stop codon is lost: the polypeptide is extended.',
    ),
  },
  startLoss: {
    name: L('Mất bộ ba mở đầu', 'Start-loss mutation'),
    desc: L(
      'Bộ ba mở đầu AUG bị thay đổi: dịch mã không bắt đầu đúng vị trí.',
      'The AUG start codon is changed: translation does not start correctly.',
    ),
  },
  frameshift: {
    name: L('Đột biến dịch khung', 'Frameshift mutation'),
    desc: L(
      'Thêm/mất số nuclêôtit không phải bội số của 3: mọi bộ ba từ vị trí đột biến trở đi bị đọc sai.',
      'Insertion/deletion not a multiple of 3: every codon after the mutation is read differently.',
    ),
  },
  inFrameIndel: {
    name: L('Thêm/mất bộ ba (không dịch khung)', 'In-frame insertion/deletion'),
    desc: L(
      'Thêm hoặc mất trọn bộ ba: protein thêm/mất axit amin, phần còn lại giữ nguyên khung đọc.',
      'Whole codons inserted or deleted: amino acids are added/lost, the frame is kept.',
    ),
  },
  outsideCds: {
    name: L('Ngoài vùng mã hóa', 'Outside the coding region'),
    desc: L(
      'Đột biến nằm ngoài đoạn từ AUG đến bộ ba kết thúc: không đổi trình tự protein.',
      'The mutation lies outside AUG…stop: the protein sequence is unchanged.',
    ),
  },
  none: {
    name: L('Không có gen mã hóa', 'No coding sequence'),
    desc: L('Trình tự không có bộ ba mở đầu AUG.', 'The sequence has no AUG start codon.'),
  },
};

export function dogmaCard(mode: 'dogma' | 'mutation'): ScienceCardData {
  return {
    title:
      mode === 'dogma'
        ? L('ADN → mARN → Protein', 'DNA → mRNA → protein')
        : L('Đột biến điểm', 'Point mutations'),
    model: L(
      'Phiên mã và dịch mã theo nguyên tắc bổ sung và bảng mã di truyền chuẩn; kết quả là quy tắc chính xác, không phải mô phỏng số.',
      'Transcription and translation by base pairing and the standard genetic code; exact rules, not a numerical simulation.',
    ),
    equations: [],
    assumptions: [
      L(
        'Gen của sinh vật nhân sơ (không có intron); dịch mã từ AUG đầu tiên.',
        'Prokaryote-like gene (no introns); translation from the first AUG.',
      ),
      L(
        'Bảng mã chuẩn NCBI số 1 (không xét mã di truyền của ti thể).',
        'NCBI standard table 1 (mitochondrial codes not considered).',
      ),
      L(
        'Hình ribosome/ARN pôlimeraza chỉ minh họa thứ tự các bước.',
        'The ribosome/RNA polymerase animation only shows the order of steps.',
      ),
    ],
    confidence: 'exact',
    confidenceNote: L(
      'Test tự động: 64 bộ ba, 3 bộ ba kết thúc, các dạng đột biến im lặng/sai nghĩa/vô nghĩa/dịch khung.',
      'Automated tests: 64 codons, 3 stops, silent/missense/nonsense/frameshift cases.',
    ),
    userIntervened: false,
    sources: [GENETIC_CODE_SOURCE, BSRC.sgk12, BSRC.campbell],
    reviewStatus: 'pending',
  };
}
