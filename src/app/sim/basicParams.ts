import type { ParamSource } from '@/physics/types';

/** Parameters shown in Basic mode before "Thêm thông số" (PROMPT_PHAN_2 A4.2: 3–5). */
export const BASIC_PARAM_COUNT = 5;

/**
 * Splits the visible parameters for Basic mode: the first `BASIC_PARAM_COUNT` (scenes list
 * their main parameters first) plus every value taken from the problem or changed by the
 * learner — those are never hidden.
 */
export function basicSplit<T extends { key: string }>(
  defs: readonly T[],
  sources: Record<string, ParamSource>,
): { main: T[]; more: T[] } {
  const main: T[] = [];
  const more: T[] = [];
  defs.forEach((d, i) => {
    if (i < BASIC_PARAM_COUNT || (sources[d.key] ?? 'default') !== 'default') main.push(d);
    else more.push(d);
  });
  return { main, more };
}
