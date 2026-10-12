import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type VoiceStyle = 'vui' | 'am' | 'lanh' | 'hai';

/** Speech rate/pitch presets behind the four teacher voice styles. */
export const VOICE_PRESETS: Record<VoiceStyle, { rate: number; pitch: number }> = {
  vui: { rate: 1.08, pitch: 1.15 },
  am: { rate: 0.92, pitch: 0.85 },
  lanh: { rate: 1.22, pitch: 1.05 },
  hai: { rate: 1.0, pitch: 1.3 },
};

export const VOICE_STYLES: readonly VoiceStyle[] = ['vui', 'am', 'lanh', 'hai'];

interface VoiceState {
  /** Master switch: the teacher reads answers aloud. Default off. */
  enabled: boolean;
  style: VoiceStyle;
  /** OS voice picked in Settings (empty = automatic Vietnamese-first choice). */
  voiceURI: string;
  /** True while an utterance is playing (not persisted). */
  speaking: boolean;
  setEnabled: (enabled: boolean) => void;
  setStyle: (style: VoiceStyle) => void;
  setVoiceURI: (uri: string) => void;
  setSpeaking: (speaking: boolean) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: false,
      style: 'vui',
      voiceURI: '',
      speaking: false,
      setEnabled: (enabled) => set({ enabled }),
      setStyle: (style) => set({ style }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setSpeaking: (speaking) => set({ speaking }),
    }),
    {
      name: 'stemsim.teacher-voice',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ enabled, style, voiceURI }) => ({ enabled, style, voiceURI }),
    },
  ),
);

/** The exact sample sentence the preview button reads. */
export const VOICE_SAMPLE =
  'Chào mừng đến với Steam Sim Lab, tôi sẽ là người thầy luôn online mọi lúc để bạn có thể hỏi đáp bất cứ lúc nào';
