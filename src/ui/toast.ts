import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

/** A button in the toast ("Hoàn tác"): runs once, then the toast goes. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  action?: ToastAction;
}

export const useToastStore = create<{ toasts: Toast[] }>()(() => ({ toasts: [] }));

let nextId = 1;

/** Shows a short message at the bottom of the window (warnings stay longer). */
export function toast(
  text: string,
  kind: ToastKind = 'info',
  durationMs?: number,
  action?: ToastAction,
): number {
  const id = nextId++;
  const item: Toast = action ? { id, kind, text, action } : { id, kind, text };
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), item] }));
  const ms = durationMs ?? (kind === 'warn' || kind === 'error' ? 9000 : 4000);
  setTimeout(() => {
    dismissToast(id);
  }, ms);
  return id;
}

export function dismissToast(id: number): void {
  useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
