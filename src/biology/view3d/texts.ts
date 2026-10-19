/**
 * Honest labels of the biology 3D views (DATA_REVIEW #26): what in a 3D picture is
 * illustration and what comes from the lesson's model.
 */
import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';

/** Shapes, positions and sizes are drawn freely; counts and ratios are the model's. */
export const ILLUSTRATION = L(
  'Minh họa — hình dạng, vị trí và kích thước không theo tỉ lệ thật; số lượng và tỉ lệ lấy từ mô hình của bài.',
  'Illustration — shapes, positions and sizes are not to scale; counts and ratios come from the lesson’s model.',
);

/** One figure per individual, or one per `per` individuals (rounded; `fmt` uses the locale). */
export function perFigure(per: number, fmt: (v: number) => string): LocalizedText {
  return per <= 1
    ? L('Mỗi hình là 1 cá thể.', 'Each figure is 1 individual.')
    : L(
        `Mỗi hình ≈ ${fmt(per)} cá thể (làm tròn).`,
        `Each figure ≈ ${fmt(per)} individuals (rounded).`,
      );
}
