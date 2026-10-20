import { useCallback, useEffect, useRef, useState } from 'react';
import { pauseLesson } from '@/teacher/board/lesson';
import { speak, speechId, stopSpeaking } from './speak';
import { useVoiceStore } from './voiceStore';

export interface VoicePreview {
  /** The preview started here is still being read. */
  previewing: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * The voice preview of Settings → "Giọng nói". It only ever stops its own speech: closing
 * Settings never cuts a board lesson's sentence (audit BRD-02). A lesson being read is paused
 * first, so the sentence the preview cuts is read again on "Tiếp tục".
 */
export function useVoicePreview(text: string): VoicePreview {
  const own = useRef<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const stop = useCallback(() => {
    if (own.current !== null && own.current === speechId()) stopSpeaking();
    own.current = null;
    setPreviewing(false);
  }, []);

  const start = useCallback(() => {
    if (useVoiceStore.getState().speaking) pauseLesson();
    const done = speak(text);
    // `speak` names its speech at once (before its first await).
    const id = speechId();
    own.current = id;
    setPreviewing(true);
    const finished = () => {
      if (own.current !== id) return;
      own.current = null;
      setPreviewing(false);
    };
    done.then(finished, finished);
  }, [text]);

  useEffect(
    () => () => {
      if (own.current !== null && own.current === speechId()) stopSpeaking();
      own.current = null;
    },
    [],
  );

  return { previewing, start, stop };
}
