/**
 * The orb's state from what the page already knows (#234): the voice store (speaking), the chat
 * store (an answer on its way, just finished) and `typing`, which the chat panel reports
 * (`onComposingChange`: its question box has the focus and some text). Nothing new is stored.
 */
import { useEffect, useState } from 'react';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { orbStateOf, type OrbState } from './states';

/** The first open "boots" this long. */
export const BOOT_MS = 1200;
/** A finished answer shows as "done" this long, then the orb waits. */
export const DONE_MS = 3000;

export function useOrbState(typing: boolean): OrbState {
  const speaking = useVoiceStore((s) => s.speaking);
  const answering = useChatStore((s) => s.answering);
  const [booting, setBooting] = useState(true);
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
      if (s.answering && !prev.answering) setJustAnswered(false);
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

  return orbStateOf({ booting, speaking, answering, typing, justAnswered });
}
