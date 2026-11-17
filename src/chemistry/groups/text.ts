import type { LocalizedText } from '@/core/data/dataset';
import type { Trend } from './model';

export const L = (vi: string, en: string): LocalizedText => ({ vi, en });

const SUP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** "[Ar]3d104s1" → "[Ar]3d¹⁰4s¹": each subshell's count raised (the count ends where the next
 * subshell's number begins). */
export const configText = (c: string): string =>
  c.replace(
    /([spdf])(\d+?)(?=\d[spdf]|$)/g,
    (_m, l: string, n: string) => `${l}${n.replace(/\d/g, (d) => SUP[d] ?? d)}`,
  );

/** The trend down a list, in words: "tăng dần từ Li đến Cs". */
export function trendText(t: Trend, first: string, last: string): LocalizedText {
  if (t === 'up') return L(`tăng dần từ ${first} đến ${last}`, `grows from ${first} to ${last}`);
  if (t === 'down') return L(`giảm dần từ ${first} đến ${last}`, `falls from ${first} to ${last}`);
  return L('không biến đổi đều', 'does not change steadily');
}
