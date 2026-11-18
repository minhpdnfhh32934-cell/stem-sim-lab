import type { LocalizedText } from '@/core/data/dataset';
import { L } from '../common';
import type { OxRefusal, OxResult } from './oxidation';

/** Why the textbook's rules give no oxidation number, in words (shared by the redox lessons). */
export const REFUSAL: Record<OxRefusal, (els: string) => LocalizedText> = {
  twoUnknown: (els) =>
    L(
      `còn hai nguyên tố chưa biết (${els}): quy tắc không đủ để xác định`,
      `two unknown elements (${els}): the rules cannot decide`,
    ),
  organic: () =>
    L(
      'hợp chất hữu cơ nhiều nguyên tử C: mỗi nguyên tử C có số oxi hóa riêng, quy tắc chỉ cho giá trị trung bình',
      'organic compound with several C atoms: each C has its own oxidation number, the rules give only the mean',
    ),
  mixed: (els) =>
    L(
      `${els} được viết ở hai nhóm nguyên tử: các nguyên tử có thể khác nhau, quy tắc chỉ cho giá trị trung bình`,
      `${els} is written in two groups of atoms: its atoms may differ, the rules give only the mean`,
    ),
  fractional: (els) =>
    L(
      `số oxi hóa của ${els} tính ra không nguyên: chỉ là giá trị trung bình`,
      `the oxidation number of ${els} is not a whole number: only a mean`,
    ),
  outOfRange: (els) =>
    L(
      `${els} sẽ vượt số oxi hóa cao nhất của nhóm: công thức có liên kết đặc biệt`,
      `${els} would exceed its group’s highest oxidation number: the formula hides an unusual bond`,
    ),
  inconsistent: () =>
    L('các quy tắc mâu thuẫn với công thức này', 'the rules contradict this formula'),
};

/** Why a species is refused, in words. */
export const refusalText = (ox: OxResult): LocalizedText | null =>
  ox.ok ? null : REFUSAL[ox.reason](ox.elements.join(', '));
