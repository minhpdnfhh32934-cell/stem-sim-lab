import { create } from 'zustand';
import { PERIOD3_ROWS } from '../data/period3';

/** "Xu hướng biến đổi … trong một chu kì": the period 3 element looked at in detail. */
export const usePeriodTrendStore = create<{ z: number }>(() => ({ z: 11 }));

export function selectPeriod3Element(z: unknown): void {
  if (typeof z === 'number' && PERIOD3_ROWS.some((r) => r.z === z))
    usePeriodTrendStore.setState({ z });
}
