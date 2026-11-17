import { create } from 'zustand';
import type { OperonInput, PartState } from './model';

/** Opens on the control batch of Monod and Jacob: no lactose, nothing damaged (tr. 18). */
export const useOperon = create<OperonInput>()(() => ({
  lactose: false,
  lacI: 'normal',
  operator: 'normal',
}));

const part = (v: unknown, keep: PartState): PartState =>
  v === 'normal' || v === 'broken' ? v : keep;

export function restoreOperon(patch: Partial<Record<keyof OperonInput, unknown>>): void {
  const s = useOperon.getState();
  useOperon.setState({
    lactose: typeof patch.lactose === 'boolean' ? patch.lactose : s.lactose,
    lacI: part(patch.lacI, s.lacI),
    operator: part(patch.operator, s.operator),
  });
}
