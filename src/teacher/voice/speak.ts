/**
 * AI Teacher reads an answer aloud: the text is turned into Vietnamese words
 * (`vietnameseText.ts`), cut into phrases with natural pauses, and spoken by the chosen voice:
 * a voice installed in Windows, Gemini's cloud voice, or the on-device Vietnamese model.
 * When a cloud or on-device voice fails, the Windows voice takes over and Settings says why.
 */
import { newRequestId, getTransport } from '@/ai/transport';
import { useAiStore } from '@/ai/aiStore';
import { isQuotaError } from '@/ai/fallback';
import { AiError } from '@/ai/types';
import { decodeAudio, isSilent, pause, playPcm, stopAudio, type Pcm } from './audio';
import { synthesizeLocal } from './localVoice';
import { splitForSpeech, toSpeech, type SpeechChunk } from './vietnameseText';
import { GEMINI_STYLES, VOICE_PRESETS, useVoiceStore, type VoiceEngine } from './voiceStore';

/** Long answers are cut here so the teacher never reads forever. */
const MAX_SPEAK_CHARS = 2400;
/** Characters per Gemini request: a few sentences keep the intonation natural. */
const GEMINI_GROUP_CHARS = 420;

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
 * The voice list once it is known: Chromium/WebView2 return [] from getVoices() until the first
 * "voiceschanged". An empty list waits for that event (at most `timeoutMs`), then answers with
 * whatever is known, so a caller never decides on a list that has not loaded yet.
 */
export function voicesWhenLoaded(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  const known = listVoices();
  if (!s || known.length > 0) return Promise.resolve(known);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        s.removeEventListener('voiceschanged', finish);
      } catch {
        /* engine without events */
      }
      resolve(listVoices());
    };
    const timer = window.setTimeout(finish, timeoutMs);
    try {
      s.addEventListener('voiceschanged', finish);
    } catch {
      /* engine without events: the timeout decides */
    }
  });
}

/** Vietnamese voices installed in Windows or offered by the browser. */
export function vietnameseVoices(voices = listVoices()): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
}

/**
 * The voice to use: the one picked in Settings, else the best Vietnamese voice (natural /
 * online voices first, then the installed Windows voice "Microsoft An"), else none (the
 * engine then reads with its default voice and `lang = vi-VN`).
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  wanted: string,
): SpeechSynthesisVoice | null {
  if (wanted) {
    const exact = voices.find((v) => v.voiceURI === wanted);
    if (exact) return exact;
  }
  const vi = vietnameseVoices(voices);
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) +
    (/hoaimy|namminh/i.test(v.name) ? 2 : 0) +
    (v.localService ? 1 : 0);
  return [...vi].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Kept for callers that only want the cleaned text (the chat's copy, tests). */
export function toSpokenText(content: string): string {
  return toSpeech(content).slice(0, MAX_SPEAK_CHARS);
}

let controller: AbortController | null = null;

/**
 * One lesson's voice (the board keeps one per lesson; a chat answer gets its own). After the
 * chosen voice fails for a reason that will not pass within the lesson (a timeout, no network,
 * no quota, the daily cap, an on-device model that is missing, will not load, hangs or speaks
 * silence), the rest of it is read by the system voice at once instead of waiting for that voice
 * again at every sentence. Only that voice is skipped: another one chosen meanwhile is heard.
 */
export interface VoiceSession {
  /** The voice skipped for the rest of the session and why (null = the chosen voice is tried). */
  skipped: { engine: VoiceEngine; reason: string } | null;
}

export function newVoiceSession(): VoiceSession {
  return { skipped: null };
}

export interface SpeakOptions {
  /** Pace on top of the learner's voice speed (the board's 0,75–2×). */
  rate?: number;
  /** Shared by the sentences of one lesson (see `VoiceSession`). */
  session?: VoiceSession;
}

/** "code: message" for AI errors (Settings tells a timeout from a quota), else the message. */
function errorText(e: unknown): string {
  if (e instanceof AiError) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

/** A failure that will not pass within a lesson: trying that voice again only adds waiting. */
function lastingFailure(e: unknown): boolean {
  if (e instanceof AiError) {
    return isQuotaError(e) || ['timeout', 'network', 'dailyLimit', 'missingKey'].includes(e.code);
  }
  const message = e instanceof Error ? e.message : String(e);
  return (
    /^(?:gemini-tts-(?:no-key|unavailable)|voice-model-(?:missing|timeout|silent)|worker-crashed)$/.test(
      message,
    ) || message.startsWith('voice-model-load-')
  );
}

/** How far a voice got: phrases fully played (the fallback continues from there, VOI-01). */
interface Progress {
  played: number;
}

/** The style's pace and pitch; an unknown stored style falls back to the default (VOI-03). */
function stylePreset(style: string): { rate: number; pitch: number } {
  const presets: Partial<Record<string, { rate: number; pitch: number }>> = VOICE_PRESETS;
  return presets[style] ?? VOICE_PRESETS.vui;
}

/** Read through a function: the signal is aborted while a phrase plays. */
const stopped = (signal: AbortSignal) => signal.aborted;

/** Reads text aloud with the teacher's voice. Resolves when done, stopped or unavailable. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  stopSpeaking();
  const chunks = splitForSpeech(toSpokenText(text));
  if (chunks.length === 0) return;
  const ctrl = new AbortController();
  controller = ctrl;
  const store = useVoiceStore.getState();
  store.setSpeaking(true);
  const rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));
  const progress: Progress = { played: 0 };
  const session = opts.session ?? newVoiceSession();
  // Skipped for this lesson: the system voice reads at once, and Settings keeps the reason.
  const engine = session.skipped?.engine === store.engine ? 'system' : store.engine;
  try {
    await speakWith(engine, chunks, ctrl.signal, rate, progress);
    if (!ctrl.signal.aborted && engine === store.engine) {
      useVoiceStore.getState().setLastError(null);
    }
  } catch (e) {
    if (ctrl.signal.aborted) return;
    const message = errorText(e);
    console.warn('[teacher-voice]', message);
    useVoiceStore.getState().setLastError(message);
    if (engine !== 'system' && lastingFailure(e)) session.skipped = { engine, reason: message };
    // The learner still hears the answer: the operating-system voice takes over from the first
    // phrase not yet heard, so nothing is read twice (audit VOI-01).
    if (engine !== 'system' && speechSupported()) {
      await speakSystem(chunks.slice(progress.played), ctrl.signal, rate, {
        played: 0,
      }).catch((fallback: unknown) => {
        console.warn('[teacher-voice] fallback', errorText(fallback));
      });
    }
  } finally {
    if (controller === ctrl) {
      controller = null;
      useVoiceStore.getState().setSpeaking(false);
    }
  }
}

function speakWith(
  engine: VoiceEngine,
  chunks: SpeechChunk[],
  signal: AbortSignal,
  rate: number,
  progress: Progress,
) {
  if (engine === 'gemini') return speakGemini(chunks, signal, rate, progress);
  if (engine === 'local') return speakLocal(chunks, signal, rate, progress);
  return speakSystem(chunks, signal, rate, progress);
}

/** Stops any ongoing teacher speech. Safe to call anytime. */
export function stopSpeaking(): void {
  controller?.abort();
  controller = null;
  try {
    synth()?.cancel();
  } catch {
    /* no speech engine */
  }
  stopAudio();
  if (useVoiceStore.getState().speaking) useVoiceStore.getState().setSpeaking(false);
}

// ------------------------------------------------------------ operating-system voice

async function speakSystem(
  chunks: SpeechChunk[],
  signal: AbortSignal,
  rate: number,
  progress: Progress,
): Promise<void> {
  const s = synth();
  if (!s) throw new Error('no-speech-engine');
  const store = useVoiceStore.getState();
  const preset = stylePreset(store.style);
  const voice = pickVoice(listVoices(), store.voiceURI);
  for (const chunk of chunks) {
    if (signal.aborted) return;
    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = voice?.lang ?? 'vi-VN';
      if (voice) utterance.voice = voice;
      utterance.rate = preset.rate * store.speed * rate;
      utterance.pitch = preset.pitch;
      // Some engines never fire "end": a phrase may not hold the teacher for ever.
      const guard = window.setTimeout(done, 8000 + chunk.text.length * 150);
      function settle() {
        window.clearTimeout(guard);
        signal.removeEventListener('abort', cancel);
      }
      function done() {
        settle();
        resolve();
      }
      function cancel() {
        s?.cancel();
        done();
      }
      utterance.onend = done;
      // A stop or a new phrase interrupts or cancels: not an error. Anything else (not allowed,
      // synthesis failed…) is reported and the phrase was not heard.
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        const error = (event as Partial<SpeechSynthesisErrorEvent>).error ?? 'unknown';
        if (error === 'interrupted' || error === 'canceled' || signal.aborted) {
          done();
          return;
        }
        settle();
        reject(new Error(`system-voice-${error}`));
      };
      signal.addEventListener('abort', cancel, { once: true });
      s.speak(utterance);
    });
    if (!stopped(signal)) progress.played++;
    await pause(chunk.pauseMs, signal);
  }
}

// ------------------------------------------------------------ Gemini voice

/** Phrases joined into requests of a few sentences; the pauses become Gemini pause tags. */
export function geminiGroups(chunks: SpeechChunk[], max = GEMINI_GROUP_CHARS): string[] {
  return geminiGroupSizes(chunks, max).map((g) => g.text);
}

/** The groups and how many phrases each holds (so a failure knows what was already heard). */
export function geminiGroupSizes(
  chunks: SpeechChunk[],
  max = GEMINI_GROUP_CHARS,
): { text: string; phrases: number }[] {
  const groups: { text: string; phrases: number }[] = [];
  let current = '';
  let count = 0;
  for (const c of chunks) {
    const piece = c.pauseMs >= 450 ? `${c.text} <long pause>` : c.text;
    if (current && current.length + piece.length + 1 > max) {
      groups.push({ text: current, phrases: count });
      current = piece;
      count = 1;
    } else {
      current = current ? `${current} ${piece}` : piece;
      count++;
    }
  }
  if (current) groups.push({ text: current, phrases: count });
  return groups.map((g) => ({ ...g, text: g.text.replace(/\s*<long pause>$/, '') }));
}

function speedWords(speed: number): string {
  if (speed <= 0.9) return ' Nói chậm.';
  if (speed < 0.98) return ' Nói hơi chậm.';
  if (speed >= 1.2) return ' Nói nhanh.';
  if (speed > 1.05) return ' Nói hơi nhanh.';
  return '';
}

async function speakGemini(
  chunks: SpeechChunk[],
  signal: AbortSignal,
  rate: number,
  progress: Progress,
): Promise<void> {
  const transport = getTransport();
  if (!transport.tts) throw new Error('gemini-tts-unavailable');
  if (!(await transport.hasKey('gemini'))) throw new Error('gemini-tts-no-key');
  const store = useVoiceStore.getState();
  const styles: Partial<Record<string, string>> = GEMINI_STYLES;
  const style = `${styles[store.style] ?? GEMINI_STYLES.vui}${speedWords(store.speed * rate)}`;
  const timeoutSecs = Math.max(30, useAiStore.getState().timeoutSecs);
  const tts = transport.tts.bind(transport);
  const fetchGroup = async (text: string): Promise<Pcm> => {
    const audio = await tts(
      {
        requestId: newRequestId(),
        model: store.geminiModel,
        voice: store.geminiVoice,
        style,
        text,
        timeoutSecs,
      },
      signal,
    );
    const pcm = decodeAudio(audio.audio, audio.mimeType);
    // Empty or silent audio is not speech: the system voice then reads these phrases.
    if (isSilent(pcm)) throw new Error('gemini-tts-silent');
    return pcm;
  };
  // While one group plays, the next is already being made.
  const groups = geminiGroupSizes(chunks);
  let next = groups[0] ? fetchGroup(groups[0].text) : null;
  for (let i = 0; i < groups.length && next; i++) {
    const pcm = await next;
    const after = groups[i + 1];
    next = after ? fetchGroup(after.text) : null;
    next?.catch(() => undefined);
    if (signal.aborted) return;
    await playPcm(pcm, signal);
    if (!stopped(signal)) progress.played += groups[i]?.phrases ?? 0;
    await pause(220, signal);
  }
}

// ------------------------------------------------------------ on-device voice

async function speakLocal(
  chunks: SpeechChunk[],
  signal: AbortSignal,
  rate: number,
  progress: Progress,
): Promise<void> {
  const speed = useVoiceStore.getState().speed * rate;
  // Commas are pauses for this model (it has no punctuation): one phrase per piece.
  const pieces = chunks.flatMap((c) => {
    const parts = c.text.split(/,\s*/).filter((p) => p.trim());
    return parts.map((text, i) => ({
      text,
      pauseMs: i === parts.length - 1 ? c.pauseMs : 140,
      // The last piece of a phrase completes it.
      ends: i === parts.length - 1,
    }));
  });
  let next = pieces[0] ? synthesizeLocal(pieces[0].text, signal) : null;
  for (let i = 0; i < pieces.length && next; i++) {
    const pcm = await next;
    const after = pieces[i + 1];
    next = after ? synthesizeLocal(after.text, signal) : null;
    next?.catch(() => undefined);
    if (signal.aborted) return;
    // Playback rate is the only speed control this model has (it also shifts the pitch a bit).
    await playPcm(pcm, signal, speed);
    if (!stopped(signal) && pieces[i]?.ends) progress.played++;
    await pause(pieces[i]?.pauseMs ?? 0, signal);
  }
}
