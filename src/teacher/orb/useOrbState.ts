/**
 * The orb's state from what the page already knows (#234): the voice store (speaking), the chat
 * store (an answer on its way, just finished) and the question box inside `scope` (being typed).
 * Nothing new is stored; the question box is read from its own events (its text lives in the
 * chat panel).
 */
import { useEffect, useState, type RefObject } from 'react';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { orbStateOf, type OrbState } from './states';

/** The first open "boots" this long. */
export const BOOT_MS = 1200;
/** A finished answer shows as "done" this long, then the orb waits. */
export const DONE_MS = 3000;

const isQuestionBox = (t: EventTarget | null): t is HTMLTextAreaElement =>
  t instanceof HTMLTextAreaElement && t.closest('.chat-panel__composer') !== null;

export function useOrbState(scope: RefObject<HTMLElement | null>): OrbState {
  const speaking = useVoiceStore((s) => s.speaking);
  const answering = useChatStore((s) => s.answering);
  const [booting, setBooting] = useState(true);
  const [typing, setTyping] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setBooting(false);
    }, BOOT_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    let done = 0;
    const unsubscribe = useChatStore.subscribe((s, prev) => {
      if (s.answering && !prev.answering) {
        // The question was sent: the box is empty again (set from code, no input event).
        setTyping(false);
        setJustAnswered(false);
      }
      if (prev.answering && !s.answering) {
        setJustAnswered(true);
        window.clearTimeout(done);
        done = window.setTimeout(() => {
          setJustAnswered(false);
        }, DONE_MS);
      }
    });
    return () => {
      unsubscribe();
      window.clearTimeout(done);
    };
  }, []);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const check = (e: Event) => {
      if (!isQuestionBox(e.target)) return;
      setTyping(e.type !== 'focusout' && e.target.value.trim() !== '');
    };
    const events = ['input', 'focusin', 'focusout'] as const;
    for (const type of events) el.addEventListener(type, check);
    return () => {
      for (const type of events) el.removeEventListener(type, check);
    };
  }, [scope]);

  return orbStateOf({ booting, speaking, answering, typing, justAnswered });
}
