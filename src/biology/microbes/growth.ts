/**
 * "Trao đổi chất, sinh trưởng và sinh sản ở vi sinh vật" (SH10 KNTT Bài 21, #255): growth of a
 * bacterial population in ideal conditions, exactly as the textbook writes it (tr. 124):
 * Nₜ = N₀ × 2^(t/g) = N₀ × 2ⁿ, n = t/g. Pure functions, no state; times in minutes.
 */
import type { LocalizedText, Source } from '@/core/data/dataset';
import type { ReviewStatus } from '@/science-card/types';
import { L } from '../common';

/** The textbook every text and example here comes from (pages on each item). */
export const SGK_SH10_BAI21: Source = {
  id: 'sgk-sh10-kntt-bai21',
  citation:
    'SGK Sinh học 10, bộ Kết nối tri thức với cuộc sống (NXB Giáo dục Việt Nam), Bài 21 “Trao đổi chất, sinh trưởng và sinh sản ở vi sinh vật”, tr. 124–125 (đọc trên taphuan.nxbgd.vn ngày 15/11/2026)',
  url: 'https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489',
};

export interface GenerationExample {
  id: 'ecoli' | 'tuberculosis';
  name: LocalizedText;
  /** Generation time g in minutes, as printed. */
  g: number;
  /** As the book prints it (its own unit). */
  printed: LocalizedText;
  page: number;
  review_status: ReviewStatus;
}

/** The book's two examples (tr. 124), copied as printed: E. coli 20 phút, vi khuẩn lao 12 giờ. */
export const EXAMPLES: readonly GenerationExample[] = [
  {
    id: 'ecoli',
    name: L('Vi khuẩn E. coli (điều kiện tối ưu)', 'E. coli (optimal conditions)'),
    g: 20,
    printed: L('cứ 20 phút phân chia một lần (g = 20)', 'divides once every 20 minutes (g = 20)'),
    page: 124,
    review_status: 'pending',
  },
  {
    id: 'tuberculosis',
    name: L('Vi khuẩn lao', 'Tuberculosis bacterium'),
    g: 12 * 60,
    printed: L('g = 12 giờ', 'g = 12 hours'),
    page: 124,
    review_status: 'pending',
  },
];

/** Number of generations (divisions) in t minutes: n = t/g (a whole number when g divides t). */
export function generations(t: number, g: number): number {
  return t / g;
}

/** Cells after t minutes from N₀ cells with generation time g: Nₜ = N₀ × 2^(t/g). */
export function cellsAt(n0: number, t: number, g: number): number {
  return n0 * 2 ** (t / g);
}

/** Time (minutes) for N₀ cells to become N cells: t = g·log₂(N/N₀). */
export function timeToReach(n0: number, n: number, g: number): number {
  return g * Math.log2(n / n0);
}

/** The curve 0 … tEnd in `steps` equal intervals, with N and log₂N (exact at every point). */
export function growthCurve(
  n0: number,
  g: number,
  tEnd: number,
  steps = 240,
): { t: number[]; n: number[]; log2n: number[] } {
  const t: number[] = [];
  const n: number[] = [];
  const log2n: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const ti = (tEnd * i) / steps;
    t.push(ti);
    n.push(cellsAt(n0, ti, g));
    // log₂Nₜ = log₂N₀ + t/g: computed this way it stays exact where 2^(t/g) would overflow.
    log2n.push(Math.log2(n0) + ti / g);
  }
  return { t, n, log2n };
}
