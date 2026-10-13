import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { decodeAudio } from './audio';
import { geminiGroups, pickVoice, speak, stopSpeaking, toSpokenText } from './speak';
import { textForModel } from './localVoice';
import { VOICE_PRESETS, VOICE_SAMPLE, VOICE_STYLES, useVoiceStore } from './voiceStore';

const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, voiceURI: name, localService, default: false }) as SpeechSynthesisVoice;

/** A fake Web Speech engine that "speaks" instantly and records what it was given. */
function fakeSpeech(voices: SpeechSynthesisVoice[]) {
  const spoken: { text: string; lang: string; rate: number; voice: string | undefined }[] = [];
  class Utterance {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    cancel: () => undefined,
    speak: (u: Utterance) => {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name });
      queueMicrotask(() => u.onend?.());
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  return spoken;
}

describe('teacher voice', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useVoiceStore.setState({
      enabled: false,
      engine: 'system',
      style: 'vui',
      speed: 1,
      voiceURI: '',
      lastError: null,
      speaking: false,
    });
  });
  afterEach(() => {
    stopSpeaking();
    setTransportForTests(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('is off by default, reads with the Windows voice and the cheerful style', () => {
    const fresh = useVoiceStore.getInitialState();
    expect(fresh.enabled).toBe(false);
    expect(fresh.engine).toBe('system');
    expect(fresh.style).toBe('vui');
    expect(VOICE_STYLES).toEqual(['vui', 'am', 'lanh', 'hai']);
    expect(VOICE_PRESETS.lanh.rate).toBeGreaterThan(VOICE_PRESETS.am.rate);
  });

  it('previews with a sentence that has numbers, a unit and a formula, under the new name', () => {
    expect(VOICE_SAMPLE).toContain('SimLab');
    expect(VOICE_SAMPLE).not.toContain('Steam');
    expect(toSpokenText(VOICE_SAMPLE)).toContain('chín phẩy tám mốt mét trên giây bình phương');
  });

  it('prefers natural Vietnamese voices, then any Vietnamese voice, never an English one', () => {
    const david = voice('Microsoft David', 'en-US');
    const an = voice('Microsoft An - Vietnamese (Vietnam)', 'vi-VN');
    const hoaiMy = voice('Microsoft HoaiMy Online (Natural) - Vietnamese', 'vi-VN', false);
    expect(pickVoice([david, an], '')?.name).toBe(an.name);
    expect(pickVoice([david, an, hoaiMy], '')?.name).toBe(hoaiMy.name);
    expect(pickVoice([david], '')).toBeNull();
    expect(pickVoice([david, an], 'Microsoft David')?.name).toBe('Microsoft David');
  });

  it('speaks phrase by phrase in Vietnamese with the chosen speed', async () => {
    const an = voice('Microsoft An', 'vi-VN');
    const spoken = fakeSpeech([voice('Microsoft David', 'en-US'), an]);
    useVoiceStore.setState({ speed: 1.2 });
    await speak('Gia tốc g = 9,81 m/s². Vậy F = m·a.');
    expect(spoken.map((s) => s.text)).toEqual([
      'Gia tốc gờ bằng chín phẩy tám mốt mét trên giây bình phương.',
      'Vậy ép bằng mờ nhân a.',
    ]);
    expect(spoken.every((s) => s.lang === 'vi-VN' && s.voice === 'Microsoft An')).toBe(true);
    expect(spoken[0]?.rate).toBeCloseTo(VOICE_PRESETS.vui.rate * 1.2);
    expect(useVoiceStore.getState().speaking).toBe(false);
  });

  it('Gemini without a key: says why in Settings and the Windows voice reads instead', async () => {
    const spoken = fakeSpeech([voice('Microsoft An', 'vi-VN')]);
    setTransportForTests({
      hasKey: () => Promise.resolve(false),
      tts: () => Promise.reject(new Error('should not be called')),
    } as unknown as LlmTransport);
    useVoiceStore.setState({ engine: 'gemini' });
    await speak('Xin chào.');
    expect(useVoiceStore.getState().lastError).toBe('gemini-tts-no-key');
    expect(spoken.map((s) => s.text)).toEqual(['Xin chào.']);
  });

  it('groups phrases for Gemini without cutting sentences and marks long pauses', () => {
    const groups = geminiGroups(
      [
        { text: 'Câu một.', pauseMs: 320 },
        { text: 'Câu hai.', pauseMs: 520 },
        { text: 'Câu ba.', pauseMs: 0 },
      ],
      40,
    );
    expect(groups).toEqual(['Câu một. Câu hai. <long pause> Câu ba.']);
    expect(
      geminiGroups(
        [
          { text: 'a'.repeat(30), pauseMs: 0 },
          { text: 'b'.repeat(30), pauseMs: 0 },
        ],
        40,
      ),
    ).toHaveLength(2);
  });

  it('decodes Gemini WAV and raw PCM audio', () => {
    // 44-byte WAV header + two 16-bit samples (0, -32768) at 24 kHz.
    const header = new Uint8Array(48);
    const view = new DataView(header.buffer);
    header.set([82, 73, 70, 70], 0); // RIFF
    view.setUint32(4, 40, true);
    header.set([87, 65, 86, 69, 102, 109, 116, 32], 8); // WAVEfmt
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint16(34, 16, true);
    header.set([100, 97, 116, 97], 36); // data
    view.setUint32(40, 4, true);
    view.setInt16(44, 0, true);
    view.setInt16(46, -32768, true);
    const wav = decodeAudio(btoa(String.fromCharCode(...header)), 'audio/wav');
    expect(wav.sampleRate).toBe(24000);
    expect([...wav.samples]).toEqual([0, -1]);
    const pcm = decodeAudio(btoa(String.fromCharCode(0, 64)), 'audio/L16;codec=pcm;rate=16000');
    expect(pcm.sampleRate).toBe(16000);
    expect(pcm.samples[0]).toBeCloseTo(0.5);
  });

  it('gives the on-device model only letters it knows', () => {
    expect(textForModel('Ép bằng mờ nhân a, Niu-tơn!')).toBe('ép bằng mờ nhân a niu tơn');
    expect(textForModel('Fe và Zn, Wifi')).toBe('phe và dn quiphi');
  });
});
