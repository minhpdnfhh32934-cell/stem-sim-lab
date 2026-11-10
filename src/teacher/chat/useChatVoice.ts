import { useEffect, useState } from 'react';
import { useBoardStore } from '@/teacher/board/boardStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { canSpeakOnDevice, speak, stopSpeaking } from '@/teacher/voice/speak';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { useChatStore } from './chatStore';

/**
 * Who reads the chat's answers aloud: the chat or the board's lesson, and which answers about a
 * circled picture were not read (only a voice that reads on this computer may say them).
 */
export function useChatVoice(teacherPage: boolean) {
  const boardOwnsVoice = () => teacherPage && useTeacherStore.getState().layout === 'board';
  /**
   * Who reads an answer aloud, decided when it arrives: the chat, unless the board reads it as a
   * lesson. An answer about part of the board (an aside) is never taught on the board, so the
   * chat reads it, while the board's lesson waits (paused); not over a lesson that goes on.
   */
  const speaksInChat = (aside: boolean) =>
    aside ? useBoardStore.getState().status !== 'playing' : !boardOwnsVoice();
  /**
   * Quiet before a new question. A board lesson that is speaking is left alone: the board pauses
   * it when the chat starts answering (Whiteboard), so the sentence it cuts is read again on
   * "Tiếp tục"; stopping the voice here would lose that sentence.
   */
  const quietBeforeAsking = () => {
    if (boardOwnsVoice() && useBoardStore.getState().status === 'playing') return;
    stopSpeaking();
  };
  /** Answers about a circled picture that were not read aloud (the chosen voice reads online). */
  const [unread, setUnread] = useState<readonly string[]>([]);
  /**
   * Reads an answer aloud. An answer about a circled picture is the on-device model's reading of
   * the learner's strokes and stays on this computer: only a voice that reads here says it (the
   * on-device voice, a Windows voice that is not an online one), never the Gemini voice or an
   * online Windows voice. Otherwise it is not read, and the chat says so under the answer.
   */
  const readAloud = (text: string, id: string, aside: boolean, staysHere: boolean) => {
    if (!useVoiceStore.getState().enabled || !speaksInChat(aside)) return;
    if (!staysHere) {
      void speak(text);
      return;
    }
    void canSpeakOnDevice().then((ok) => {
      if (!ok) {
        setUnread((ids) => (ids.includes(id) ? ids : [...ids, id]));
        return;
      }
      // Asked again once the voice list is known (it may take a moment to load): a newer question,
      // or the lesson that went on meanwhile, is heard instead of this answer.
      if (
        useVoiceStore.getState().enabled &&
        !useChatStore.getState().answering &&
        speaksInChat(aside)
      ) {
        void speak(text, { onDevice: true });
      }
    });
  };

  // Never keep reading after the panel goes away.
  useEffect(() => stopSpeaking, []);
  return { quietBeforeAsking, readAloud, unread };
}
