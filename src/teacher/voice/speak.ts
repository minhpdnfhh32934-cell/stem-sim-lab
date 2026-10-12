import { VOICE_PRESETS, useVoiceStore, type VoiceStyle } from './voiceStore';

/** Long answers are cut here so the teacher never reads forever. */
const MAX_SPEAK_CHARS = 1500;

function synth(): SpeechSynthesis | null {
  try {
    return typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  } catch {
    return null;
  }
}

export function speechSupported(): boolean {
  return synth() !== null;
}

function pickVoiceURI(voices: SpeechSynthesisVoice[], wanted: string): string | null {
  if (wanted) {
    const exact = voices.find((v) => v.voiceURI === wanted);
    if (exact) return exact.voiceURI;
  }
  const vi = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
  if (vi) return vi.voiceURI;
  return null;
}

export function listVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  try {
    return s.getVoices();
  } catch {
    return [];
  }
}

/**
 * Turns a chat answer into speakable text: code blocks become a short note, math
 * delimiters are dropped (inner words are read as-is), markdown marks are removed.
 * Exported for tests.
 */
export function toSpokenText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' (đoạn mã trong tin nhắn) ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
    .replace(/\$([^$\n]+)\$/g, ' $1 ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([#$&%_{}])/g, '$1')
    .replace(/_{2,}/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SPEAK_CHARS);
}

/** Reads text aloud with the teacher's style. Resolves when done or unavailable. */
export function speak(text: string, style?: VoiceStyle): Promise<void> {
  const s = synth();
  const spoken = toSpokenText(text);
  if (!s || !spoken) return Promise.resolve();
  const store = useVoiceStore.getState();
  const preset = VOICE_PRESETS[style ?? store.style];
  return new Promise((resolve) => {
    try {
      s.cancel();
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.lang = 'vi-VN';
      utterance.rate = preset.rate;
      utterance.pitch = preset.pitch;
      const uri = pickVoiceURI(listVoices(), store.voiceURI);
      if (uri) {
        const voice = listVoices().find((v) => v.voiceURI === uri);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
      }
      let done = false;
      const finish = (speaking: boolean) => {
        if (done) return;
        done = true;
        useVoiceStore.getState().setSpeaking(speaking);
        resolve();
      };
      useVoiceStore.getState().setSpeaking(true);
      utterance.onend = () => {
        finish(false);
      };
      utterance.onerror = () => {
        finish(false);
      };
      s.speak(utterance);
      // Some engines stall silently: never leave the speaking flag stuck.
      window.setTimeout(() => {
        finish(false);
      }, 120_000);
    } catch {
      useVoiceStore.getState().setSpeaking(false);
      resolve();
    }
  });
}

/** Stops any ongoing teacher speech. Safe to call anytime. */
export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* no speech engine */
  }
  if (useVoiceStore.getState().speaking) useVoiceStore.getState().setSpeaking(false);
}
