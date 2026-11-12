/**
 * How loud AI Teacher's voice is right now, 0–1, for the orb (#234 step 3). Read on demand (the
 * orb asks once per frame while it shows); nothing is recorded or stored.
 *
 * - Voices played by the app (Gemini, the on-device model): an `AnalyserNode` sits between the
 *   sound and the speakers; the level is the RMS of its latest window (a buffer made once).
 * - The system voice (Windows / Web Speech): its sound never passes through the page, so each
 *   spoken word gives a short pulse that fades (`markWord`): an illustration, not a measurement.
 */

/** RMS of ordinary speech is about 0.05–0.25 of full scale: × 4 brings it to 0.2–1. */
const RMS_GAIN = 4;
/** A word's pulse fades over this long (ms). */
export const WORD_PULSE_MS = 180;
/** Samples read per frame (an `AnalyserNode` window). */
const WINDOW = 1024;

let analyser: AnalyserNode | null = null;
let window_: Float32Array<ArrayBuffer> | null = null;
let playing = 0;
let lastWord = -Infinity;

/**
 * The node a voice's sound goes through on its way to the speakers (one per audio context):
 * connect the source here instead of to `ctx.destination`.
 */
export function levelInput(ctx: BaseAudioContext): AudioNode {
  if (!analyser || analyser.context !== ctx) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = WINDOW;
    analyser.connect(ctx.destination);
    window_ = new Float32Array(WINDOW);
  }
  return analyser;
}

/** A played sound starts / ends: the level reads the analyser only while something plays. */
export function soundStarted(): void {
  playing += 1;
}
export function soundEnded(): void {
  playing = Math.max(0, playing - 1);
}

/** The system voice reached a word (its `boundary` event). */
export function markWord(now = performance.now()): void {
  lastWord = now;
}

/** The voice level now, 0–1. */
export function voiceLevel(now = performance.now()): number {
  if (playing > 0 && analyser && window_) {
    analyser.getFloatTimeDomainData(window_);
    let sum = 0;
    for (const v of window_) sum += v * v;
    return Math.min(1, Math.sqrt(sum / window_.length) * RMS_GAIN);
  }
  const since = now - lastWord;
  return since >= 0 && since < WORD_PULSE_MS ? 1 - since / WORD_PULSE_MS : 0;
}

/** For tests: forget the analyser, the playing count and the last word. */
export function resetVoiceLevel(): void {
  analyser = null;
  window_ = null;
  playing = 0;
  lastWord = -Infinity;
}
