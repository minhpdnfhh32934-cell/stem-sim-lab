import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type VoiceStyle = 'vui' | 'am' | 'lanh' | 'hai';

/**
 * Where AI Teacher's voice comes from:
 * - `system`: a voice installed in Windows (or the browser), offline and free;
 * - `gemini`: Google's Gemini text-to-speech (natural, online, uses the Gemini key);
 * - `local`: a Vietnamese voice model downloaded once and run on this computer (MMS-TTS).
 */
export type VoiceEngine = 'system' | 'gemini' | 'local';
export const VOICE_ENGINES: readonly VoiceEngine[] = ['system', 'gemini', 'local'];

/** Speech rate/pitch presets behind the four teacher voice styles (operating-system voices). */
export const VOICE_PRESETS: Record<VoiceStyle, { rate: number; pitch: number }> = {
  vui: { rate: 1.05, pitch: 1.1 },
  am: { rate: 0.93, pitch: 0.9 },
  lanh: { rate: 1.15, pitch: 1.05 },
  hai: { rate: 1.0, pitch: 1.2 },
};

/** The same styles told to Gemini in words (its `speech_metadata.style`). */
export const GEMINI_STYLES: Record<VoiceStyle, string> = {
  vui: 'Giọng một thầy giáo người Việt vui vẻ, thân thiện, phát âm rõ ràng, ngắt nghỉ tự nhiên.',
  am: 'Giọng một thầy giáo người Việt trầm ấm, chậm rãi, nhẹ nhàng, kiên nhẫn.',
  lanh: 'Giọng một thầy giáo người Việt nhanh nhẹn, hào hứng, nhấn vào ý chính.',
  hai: 'Giọng một thầy giáo người Việt dí dỏm, hài hước nhẹ nhàng nhưng vẫn rõ ràng.',
};

export const VOICE_STYLES: readonly VoiceStyle[] = ['vui', 'am', 'lanh', 'hai'];

/** Gemini TTS models (checked 2026-10, ai.google.dev speech-generation page). */
export const GEMINI_TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const;
export type GeminiTtsModel = (typeof GEMINI_TTS_MODELS)[number];

/** A few of Gemini's 30 prebuilt voices that suit a teacher (all speak Vietnamese). */
export const GEMINI_VOICES = [
  { id: 'Achird', trait: 'friendly' },
  { id: 'Sulafat', trait: 'warm' },
  { id: 'Sadaltager', trait: 'knowledgeable' },
  { id: 'Charon', trait: 'informative' },
  { id: 'Kore', trait: 'firm' },
  { id: 'Puck', trait: 'upbeat' },
  { id: 'Aoede', trait: 'breezy' },
  { id: 'Vindemiatrix', trait: 'gentle' },
] as const;

export const SPEED_MIN = 0.8;
export const SPEED_MAX = 1.3;

interface VoiceState {
  /** Master switch: the teacher reads answers aloud. Default off. */
  enabled: boolean;
  engine: VoiceEngine;
  style: VoiceStyle;
  /** Reading speed, 1 = normal. */
  speed: number;
  /** OS voice picked in Settings (empty = automatic Vietnamese-first choice). */
  voiceURI: string;
  geminiVoice: string;
  geminiModel: GeminiTtsModel;
  /** True while the teacher is speaking (not persisted). */
  speaking: boolean;
  /** Why the chosen voice could not speak last time (not persisted; shown in Settings). */
  lastError: string | null;
  setEnabled: (enabled: boolean) => void;
  setEngine: (engine: VoiceEngine) => void;
  setStyle: (style: VoiceStyle) => void;
  setSpeed: (speed: number) => void;
  setVoiceURI: (uri: string) => void;
  setGeminiVoice: (voice: string) => void;
  setGeminiModel: (model: GeminiTtsModel) => void;
  setSpeaking: (speaking: boolean) => void;
  setLastError: (error: string | null) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: false,
      engine: 'system',
      style: 'vui',
      speed: 1,
      voiceURI: '',
      geminiVoice: 'Achird',
      geminiModel: 'gemini-3.8-flash-tts',
      speaking: false,
      lastError: null,
      setEnabled: (enabled) => set({ enabled }),
      setEngine: (engine) => set({ engine, lastError: null }),
      setStyle: (style) => set({ style }),
      setSpeed: (speed) => set({ speed: Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed)) }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
      setGeminiVoice: (geminiVoice) => set({ geminiVoice }),
      setGeminiModel: (geminiModel) => set({ geminiModel }),
      setSpeaking: (speaking) => set({ speaking }),
      setLastError: (lastError) => set({ lastError }),
    }),
    {
      name: 'stemsim.teacher-voice',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v2 adds the voice source, speed and Gemini voice; v1 choices are kept.
      migrate: (state) => ({
        engine: 'system',
        speed: 1,
        geminiVoice: 'Achird',
        geminiModel: 'gemini-3.8-flash-tts',
        ...(state as object),
      }),
      partialize: ({ enabled, engine, style, speed, voiceURI, geminiVoice, geminiModel }) => ({
        enabled,
        engine,
        style,
        speed,
        voiceURI,
        geminiVoice,
        geminiModel,
      }),
    },
  ),
);

/** The sentence the preview button reads: numbers, a unit and a formula, as in a real answer. */
export const VOICE_SAMPLE =
  'Chào em, mình là AI Teacher của SimLab. Gia tốc rơi tự do g = 9,81 m/s², và theo định luật II Newton, F = m·a.';
