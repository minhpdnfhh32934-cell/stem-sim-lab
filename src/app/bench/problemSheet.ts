import { create } from 'zustand';

/** "Đề bài" sheet of the bench (header button, the Library's "Có đề bài?" card). */
export const useProblemSheet = create<{ open: boolean }>(() => ({ open: false }));

export function openProblemSheet(): void {
  useProblemSheet.setState({ open: true });
}
