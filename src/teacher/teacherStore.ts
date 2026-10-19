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
  /**
   * A question another screen wrote for the learner (openTeacherWithQuestion): the teacher page's
   * chat puts it into the box once and clears it. It is never sent by itself.
   */
  draft: string | null;
  /**
   * The same for the chat bubble (askInBubble): it opens the bubble, where the learner decides
   * whether screen context goes with the question. Also never sent by itself.
   */
  bubbleDraft: string | null;
  setLayout: (layout: TeacherLayout) => void;
}

export const useTeacherStore = create<TeacherState>()((set) => ({
  open: false,
  layout: 'talk',
  draft: null,
  bubbleDraft: null,
  setLayout: (layout) => {
    set({ layout });
  },
}));

export function openTeacher(): void {
  useChatStore.getState().setIncludeScreen(false);
  useNavigationStore.getState().setScreen('teacher');
  useTeacherStore.setState({ open: true, layout: 'talk', draft: null });
}

/**
 * Opens AI Teacher (talk layout) with `question` written into the box, e.g. "Hỏi thầy về bộ phận
 * này" in the 3D mitosis view. The learner reads it, may change it and sends it themselves.
 */
export function openTeacherWithQuestion(question: string): void {
  openTeacher();
  useTeacherStore.setState({ draft: question });
}

/**
 * Opens the chat bubble with `question` written into its box (e.g. "Hỏi thầy" in Science Studio).
 * Screen context stays as the learner set it: off whenever the bubble was closed.
 */
export function askInBubble(question: string): void {
  useTeacherStore.setState({ bubbleDraft: question });
}

export function closeTeacher(): void {
  stopSpeaking();
  useTeacherStore.setState({ open: false, draft: null });
  if (useNavigationStore.getState().screen === 'teacher') {
    useNavigationStore.getState().returnFromTeacher();
  }
}
