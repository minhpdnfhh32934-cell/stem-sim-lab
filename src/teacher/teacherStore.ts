import { create } from 'zustand';
import { useNavigationStore } from '@/app/navigationStore';
import { stopSpeaking } from './voice/speak';
import { useChatStore } from './chat/chatStore';

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
  useChatStore.getState().setIncludeScreen(false);
  useNavigationStore.getState().setScreen('teacher');
  useTeacherStore.setState({ open: true, layout: 'talk' });
}

export function closeTeacher(): void {
  stopSpeaking();
  useTeacherStore.setState({ open: false });
  if (useNavigationStore.getState().screen === 'teacher') {
    useNavigationStore.getState().returnFromTeacher();
  }
}
