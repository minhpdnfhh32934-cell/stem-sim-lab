/**
 * The four phases of a batch culture ("nuôi cấy không liên tục", SGK Sinh học 10 KNTT Bài 21,
 * H 21.4 and tr. 125): names and what happens in each, paraphrased from the book. The curve is an
 * ILLUSTRATION of the book's figure: its shape carries no data (no axis values), only the
 * exponential phase follows the formula N = N₀·2ⁿ (growth.ts). DATA_REVIEW SH10-MICRO-3.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';

export type PhaseId = 'lag' | 'log' | 'stationary' | 'death';
export const PHASES: readonly PhaseId[] = ['lag', 'log', 'stationary', 'death'];

export const isPhase = (v: unknown): v is PhaseId =>
  typeof v === 'string' && (PHASES as readonly string[]).includes(v);

export const PHASE_TEXT: Record<PhaseId, { name: LocalizedText; text: LocalizedText }> = {
  lag: {
    name: L('Pha tiềm phát (pha lag)', 'Lag phase'),
    text: L(
      'Từ lúc cấy vi khuẩn vào môi trường đến khi chúng bắt đầu phân chia. Vi khuẩn làm quen với môi trường mới và tổng hợp các chất chuẩn bị cho phân chia; số tế bào gần như chưa tăng.',
      'From inoculation until the bacteria start to divide. They adapt to the new medium and make the substances they need to divide; the number of cells hardly rises yet.',
    ),
  },
  log: {
    name: L('Pha lũy thừa (pha log)', 'Exponential (log) phase'),
    text: L(
      'Vi khuẩn phân chia mạnh mẽ theo tiềm năng; số tế bào tăng theo lũy thừa và đạt cực đại ở cuối pha. Chỉ ở pha này số tế bào theo đúng công thức Nₜ = N₀ × 2ⁿ.',
      'The bacteria divide as fast as they can; the number of cells rises exponentially and reaches its maximum at the end of the phase. Only in this phase does the number follow Nₜ = N₀ × 2ⁿ.',
    ),
  },
  stationary: {
    name: L('Pha cân bằng', 'Stationary phase'),
    text: L(
      'Chất dinh dưỡng giảm dần, chất độc hại tăng lên; vi khuẩn sinh trưởng và trao đổi chất chậm lại. Số tế bào sinh ra bằng số tế bào chết đi.',
      'Nutrients run low and toxic substances build up; growth and metabolism slow down. As many cells are made as die.',
    ),
  },
  death: {
    name: L('Pha suy vong', 'Death phase'),
    text: L(
      'Chất dinh dưỡng cạn kiệt, chất độc hại tích lũy ngày càng nhiều nên số tế bào trong quần thể ngày càng giảm.',
      'Nutrients are used up and toxic substances keep building up, so the number of cells keeps falling.',
    ),
  },
};

/**
 * Where each phase starts and ends on the illustration's time axis (0 … 1): a drawing choice,
 * like the book's figure, not a measurement.
 */
export const PHASE_SPAN: Record<PhaseId, readonly [number, number]> = {
  lag: [0, 0.18],
  log: [0.18, 0.45],
  stationary: [0.45, 0.78],
  death: [0.78, 1],
};

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * Height of the illustrative curve at x ∈ [0, 1] (0 = the starting level, 1 = the plateau): flat
 * in the lag phase, a steep rise, a plateau, then a fall. Continuous; for drawing only.
 */
export function illustrativeLevel(x: number): number {
  const [, lagEnd] = PHASE_SPAN.lag;
  const [, logEnd] = PHASE_SPAN.log;
  const [, statEnd] = PHASE_SPAN.stationary;
  const base = 0.1;
  if (x <= lagEnd) return base;
  if (x <= logEnd) return base + (1 - base) * smooth((x - lagEnd) / (logEnd - lagEnd));
  if (x <= statEnd) return 1;
  return 1 - 0.45 * smooth(Math.min(1, (x - statEnd) / (1 - statEnd)));
}

/** The phase a point of the illustration's time axis belongs to. */
export function phaseAt(x: number): PhaseId {
  return PHASES.find((p) => x <= PHASE_SPAN[p][1]) ?? 'death';
}
