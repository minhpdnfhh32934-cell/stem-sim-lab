/**
 * AI Teacher reads an answer aloud: the text is turned into Vietnamese words
 * (`vietnameseText.ts`), cut into phrases with natural pauses, and spoken by the chosen voice:
 * a voice installed in Windows, Gemini's cloud voice, or the on-device Vietnamese model.
 * When a cloud or on-device voice fails, the Windows voice takes over and Settings says why.
 */
import { newRequestId, getTransport } from '@/ai/transport';
import { useAiStore } from '@/ai/aiStore';
import { decodeAudio, pause, playPcm, stopAudio, type Pcm } from './audio';
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

/** Reads text aloud with the teacher's voice. Resolves when done, stopped or unavailable. */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  const chunks = splitForSpeech(toSpokenText(text));
  if (chunks.length === 0) return;
  const ctrl = new AbortController();
  controller = ctrl;
  const store = useVoiceStore.getState();
  store.setSpeaking(true);
  try {
    await speakWith(store.engine, chunks, ctrl.signal);
    if (!ctrl.signal.aborted) useVoiceStore.getState().setLastError(null);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[teacher-voice]', message);
    useVoiceStore.getState().setLastError(message);
    // The learner still hears the answer: the operating-system voice takes over.
    if (store.engine !== 'system' && speechSupported()) {
      await speakSystem(chunks, ctrl.signal).catch(() => undefined);
    }
  } finally {
    if (controller === ctrl) {
      controller = null;
      useVoiceStore.getState().setSpeaking(false);
    }
  }
}

function speakWith(engine: VoiceEngine, chunks: SpeechChunk[], signal: AbortSignal) {
  if (engine === 'gemini') return speakGemini(chunks, signal);
  if (engine === 'local') return speakLocal(chunks, signal);
  return speakSystem(chunks, signal);
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

async function speakSystem(chunks: SpeechChunk[], signal: AbortSignal): Promise<void> {
  const s = synth();
  if (!s) throw new Error('no-speech-engine');
  const store = useVoiceStore.getState();
  const preset = VOICE_PRESETS[store.style];
  const voice = pickVoice(listVoices(), store.voiceURI);
  for (const chunk of chunks) {
    if (signal.aborted) return;
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = voice?.lang ?? 'vi-VN';
      if (voice) utterance.voice = voice;
      utterance.rate = preset.rate * store.speed;
      utterance.pitch = preset.pitch;
      // Some engines never fire "end": a phrase may not hold the teacher for ever.
      const guard = window.setTimeout(done, 8000 + chunk.text.length * 150);
      function done() {
        window.clearTimeout(guard);
        signal.removeEventListener('abort', cancel);
        resolve();
      }
      function cancel() {
        s?.cancel();
        done();
      }
      utterance.onend = done;
      utterance.onerror = done;
      signal.addEventListener('abort', cancel, { once: true });
      s.speak(utterance);
    });
    await pause(chunk.pauseMs, signal);
  }
}

// ------------------------------------------------------------ Gemini voice

/** Phrases joined into requests of a few sentences; the pauses become Gemini pause tags. */
export function geminiGroups(chunks: SpeechChunk[], max = GEMINI_GROUP_CHARS): string[] {
  const groups: string[] = [];
  let current = '';
  for (const c of chunks) {
    const piece = c.pauseMs >= 450 ? `${c.text} <long pause>` : c.text;
    if (current && current.length + piece.length + 1 > max) {
      groups.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) groups.push(current);
  return groups.map((g) => g.replace(/\s*<long pause>$/, ''));
}

function speedWords(speed: number): string {
  if (speed <= 0.9) return ' Nói chậm.';
  if (speed < 0.98) return ' Nói hơi chậm.';
  if (speed >= 1.2) return ' Nói nhanh.';
  if (speed > 1.05) return ' Nói hơi nhanh.';
  return '';
}

async function speakGemini(chunks: SpeechChunk[], signal: AbortSignal): Promise<void> {
  const transport = getTransport();
  if (!transport.tts) throw new Error('gemini-tts-unavailable');
  if (!(await transport.hasKey('gemini'))) throw new Error('gemini-tts-no-key');
  const store = useVoiceStore.getState();
  const style = `${GEMINI_STYLES[store.style]}${speedWords(store.speed)}`;
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
    return decodeAudio(audio.audio, audio.mimeType);
  };
  // While one group plays, the next is already being made.
  const groups = geminiGroups(chunks);
  let next = groups[0] ? fetchGroup(groups[0]) : null;
  for (let i = 0; i < groups.length && next; i++) {
    const pcm = await next;
    const after = groups[i + 1];
    next = after ? fetchGroup(after) : null;
    next?.catch(() => undefined);
    if (signal.aborted) return;
    await playPcm(pcm, signal);
    await pause(220, signal);
  }
}

// ------------------------------------------------------------ on-device voice

async function speakLocal(chunks: SpeechChunk[], signal: AbortSignal): Promise<void> {
  const speed = useVoiceStore.getState().speed;
  // Commas are pauses for this model (it has no punctuation): one phrase per piece.
  const pieces = chunks.flatMap((c) => {
    const parts = c.text.split(/,\s*/).filter((p) => p.trim());
    return parts.map((text, i) => ({ text, pauseMs: i === parts.length - 1 ? c.pauseMs : 140 }));
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
    await pause(pieces[i]?.pauseMs ?? 0, signal);
  }
}
