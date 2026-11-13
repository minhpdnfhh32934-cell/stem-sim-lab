import { speakFormula } from '../../core/formulaSpeech';
import type { Language } from '../../core/i18n';

/** Voices tried first for a man's voice, by language (Edge's and Windows' names). */
const PREFERRED: Readonly<Record<Language, readonly RegExp[]>> = {
  vi: [/NamMinh/i, /Nam ?Minh/i, /\bAn\b/i, /male/i],
  en: [/Andrew/i, /Guy/i, /Christopher/i, /Brian/i, /David/i, /Mark/i, /male/i],
};
/** A voice's language prefix for each game language. */
const TAG: Readonly<Record<Language, string>> = { vi: 'vi', en: 'en' };

/**
 * The browser's speech (Web Speech API) reading a person's lines aloud (Phase Y): a voice in the
 * game's language — a man's where the browser has one — at the teacher's volume (the overall one
 * times the voice's, none when muted). Silent when the browser has no voice for the language: an
 * English voice never reads Vietnamese. One line at a time; a new one or `stop` cuts it.
 */
export class Speech {
  private readonly synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private current: SpeechSynthesisUtterance | null = null;

  constructor() {
    // Some browsers fill the voice list later: ask once so it starts loading.
    this.synth?.getVoices();
  }

  /** Whether a line is being read now. */
  get speaking(): boolean {
    return this.current !== null;
  }

  /**
   * Reads `text` in `language` at `volume` (0–1); `done` when it ends or is cut. False (and
   * `done` not called) when it cannot be read: no speech, no voice for the language, silence.
   */
  speak(text: string, language: Language, volume: number, done: () => void): boolean {
    this.stop();
    const synth = this.synth;
    const voice = this.voiceFor(language);
    if (!synth || !voice || volume <= 0) return false;
    // Formulas as a teacher reads them (m_A "m A", fractions, units by name: core/formulaSpeech).
    const line = new SpeechSynthesisUtterance(speakFormula(text, language));
    line.voice = voice;
    line.lang = voice.lang;
    line.volume = Math.min(1, volume);
    line.rate = 1;
    const end = () => {
      if (this.current !== line) return;
      this.current = null;
      done();
    };
    line.onend = end;
    line.onerror = end;
    this.current = line;
    synth.speak(line);
    return true;
  }

  /** Cuts the line being read, if any. */
  stop(): void {
    if (!this.current) return;
    this.current = null;
    this.synth?.cancel();
  }

  private voiceFor(language: Language): SpeechSynthesisVoice | null {
    const voices = this.synth?.getVoices() ?? [];
    const own = voices.filter((v) => v.lang.toLowerCase().startsWith(TAG[language]));
    for (const name of PREFERRED[language]) {
      const found = own.find((v) => name.test(v.name));
      if (found) return found;
    }
    return own[0] ?? null;
  }
}
