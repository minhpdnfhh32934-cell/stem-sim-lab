import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

export const useToastStore = create<{ toasts: Toast[] }>()(() => ({ toasts: [] }));

let nextId = 1;

/** Shows a short message at the bottom of the window (warnings stay longer). */
export function toast(text: string, kind: ToastKind = 'info'): number {
  const id = nextId++;
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
  const ms = kind === 'warn' || kind === 'error' ? 9000 : 4000;
  setTimeout(() => {
    dismissToast(id);
  }, ms);
  return id;
}

export function dismissToast(id: number): void {
  useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
