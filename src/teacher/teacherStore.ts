import { create } from 'zustand';
import { useNavigationStore } from '@/app/navigationStore';
import { teacherLocked, useSafetyStore } from '@/safety/safetyStore';
import { stopSpeaking } from './voice/speak';
import { useChatStore } from './chat/chatStore';

/**
 * The pages of the AI teacher screen: the two layouts (PROMPT_PHAN_2 B4.1) and, in Advanced mode
 * only, "Ghi nhớ" and "Lượt dùng" (#234 step 5).
 */
export type TeacherLayout = 'talk' | 'board' | 'memory' | 'usage';

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
   * The same for the lab notebook's "Hỏi AI" tab (askInBubble, named after the chat bubble it
   * replaced in B8): the learner decides there whether screen context goes with the question. Also
   * never sent by itself.
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
  // Under 18 the door stays locked whichever way it is asked (#245 follow-up: Ctrl+K opened it).
  if (teacherLocked(useSafetyStore.getState())) return;
  useChatStore.getState().setIncludeScreen(false);
  useNavigationStore.getState().setScreen('teacher');
  useTeacherStore.setState({ open: true, layout: 'talk', draft: null });
}

/**
 * Opens AI Teacher (talk layout) with `question` written into the box, e.g. "Hỏi thầy về bộ phận
 * này" in the 3D mitosis view. The learner reads it, may change it and sends it themselves.
 */
export function openTeacherWithQuestion(question: string): void {
  if (teacherLocked(useSafetyStore.getState())) return;
  openTeacher();
  useTeacherStore.setState({ draft: question });
}

/**
 * Opens the notebook's "Hỏi AI" tab with `question` written into its box (e.g. "Hỏi thầy" in
 * Science Studio). Screen context stays off: it is turned off whenever that chat was left.
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
