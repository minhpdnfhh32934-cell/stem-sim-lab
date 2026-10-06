import { create } from 'zustand';

/** The two layouts of the AI teacher screen (PROMPT_PHAN_2 B4.1). */
export type TeacherLayout = 'talk' | 'board';

interface TeacherState {
  /** The "Dạy học bằng AI" screen replaces the workspace while open. */
  open: boolean;
  layout: TeacherLayout;
  setLayout: (layout: TeacherLayout) => void;
}

export const useTeacherStore = create<TeacherState>()((set) => ({
  open: false,
  layout: 'talk',
  setLayout: (layout) => {
    set({ layout });
  },
}));

export function openTeacher(): void {
  useTeacherStore.setState({ open: true, layout: 'talk' });
}

export function closeTeacher(): void {
  useTeacherStore.setState({ open: false });
}
