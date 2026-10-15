import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useVoiceStore } from './voiceStore';

/**
 * Text that must stay on this computer (the on-device reading of a circled picture): only a voice
 * that reads here says it. The Gemini voice never gets it, nor an online Windows voice ("Online
 * (Natural)" in Edge/WebView2), also not when the on-device voice fails and the system voice
 * takes over.
 */
vi.mock('./audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio')>()),
  decodeAudio: () => ({ samples: Float32Array.from([0.2, -0.2, 0.1, -0.1]), sampleRate: 24000 }),
  playPcm: () => Promise.resolve(),
  stopAudio: () => undefined,
  pause: () => Promise.resolve(),
}));
const natural = vi.hoisted(() => ({ calls: 0, fail: false }));
vi.mock('./naturalVoice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./naturalVoice')>()),
  speakNatural: () => {
    natural.calls += 1;
    return natural.fail ? Promise.reject(new Error('voice-model-missing')) : Promise.resolve();
  },
}));

const { canSpeakOnDevice, onDeviceSystemVoice, speak, stopSpeaking, voiceStaysOnDevice } =
  await import('./speak');

function voice(name: string, lang: string, localService: boolean): SpeechSynthesisVoice {
  return { name, lang, localService, voiceURI: name, default: false };
}
const HOAIMY = voice('Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', 'vi-VN', false);
const GOOGLE = voice('Google Tiếng Việt', 'vi-VN', false);
const AN = voice('Microsoft An - Vietnamese (Vietnam)', 'vi-VN', true);
const DAVID = voice('Microsoft David - English (United States)', 'en-US', true);
/** Reported as installed, but named as an online voice: never trusted to stay here. */
const NATURAL_LOCAL = voice('Microsoft NamMinh Natural - Vietnamese', 'vi-VN', true);

/** A fake Windows voice: records each phrase and the voice it was read with. */
function fakeSystemVoice(voices: SpeechSynthesisVoice[]) {
  const spoken: { text: string; voice: string | null }[] = [];
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
      spoken.push({ text: u.text, voice: u.voice?.name ?? null });
      queueMicrotask(() => u.onend?.());
    },
  });
  return spoken;
}

const TEXT = 'Em vẽ một hình tam giác có ghi chữ PRIVATE-HANDWRITING.';
let ttsTexts: string[];

beforeEach(() => {
  ttsTexts = [];
  natural.calls = 0;
  natural.fail = false;
  setTransportForTests({
    hasKey: () => Promise.resolve(true),
    tts: (req: { text: string }) => {
      ttsTexts.push(req.text);
      return Promise.resolve({ audio: 'AEA=', mimeType: 'audio/L16;rate=24000' });
    },
  } as unknown as LlmTransport);
  useVoiceStore.setState({
    enabled: true,
    engine: 'system',
    style: 'vui',
    speed: 1,
    voiceURI: '',
    lastError: null,
  });
});
afterEach(() => {
  stopSpeaking();
  setTransportForTests(null);
  vi.unstubAllGlobals();
});

describe('which voices read on this computer', () => {
  it('installed and not named online or natural', () => {
    expect(voiceStaysOnDevice(AN)).toBe(true);
    expect(voiceStaysOnDevice(DAVID)).toBe(true);
    expect(voiceStaysOnDevice(HOAIMY)).toBe(false);
    expect(voiceStaysOnDevice(GOOGLE)).toBe(false);
    expect(voiceStaysOnDevice(NATURAL_LOCAL)).toBe(false);
  });

  it('automatic: the best Vietnamese voice that reads here; a picked voice is never swapped', () => {
    const all = [HOAIMY, GOOGLE, NATURAL_LOCAL, DAVID, AN];
    expect(onDeviceSystemVoice(all, '')?.name).toBe(AN.name);
    // Picked in Settings and reads here: kept, even in another language.
    expect(onDeviceSystemVoice(all, DAVID.voiceURI)?.name).toBe(DAVID.name);
    // Picked in Settings but reads online: nothing, not "Microsoft An" in its place.
    expect(onDeviceSystemVoice(all, HOAIMY.voiceURI)).toBeNull();
    // Only online Vietnamese voices: none (the engine's own default may read online too).
    expect(onDeviceSystemVoice([HOAIMY, GOOGLE, DAVID], '')).toBeNull();
    expect(onDeviceSystemVoice([], '')).toBeNull();
  });
});

describe('speak(…, { onDevice: true })', () => {
  it('the Gemini voice never gets the text, and nothing else reads it', async () => {
    useVoiceStore.setState({ engine: 'gemini' });
    const spoken = fakeSystemVoice([AN]);
    expect(await canSpeakOnDevice()).toBe(false);
    await speak(TEXT, { onDevice: true });
    expect(ttsTexts).toEqual([]);
    expect(spoken).toEqual([]);
    // The same text without the flag goes to Gemini (the fake records it): the check is real.
    await speak(TEXT);
    expect(ttsTexts.join(' ')).toContain('PRIVATE-HANDWRITING');
  });

  it('a Windows voice reads it only when that voice reads here', async () => {
    let spoken = fakeSystemVoice([HOAIMY, GOOGLE]);
    expect(await canSpeakOnDevice()).toBe(false);
    await speak(TEXT, { onDevice: true });
    expect(spoken).toEqual([]);
    // Without the flag the online voice is the automatic choice (natural voices first).
    await speak(TEXT);
    expect(spoken.map((s) => s.voice)).toContain(HOAIMY.name);

    spoken = fakeSystemVoice([HOAIMY, AN]);
    expect(await canSpeakOnDevice()).toBe(true);
    await speak(TEXT, { onDevice: true });
    expect(spoken.length).toBeGreaterThan(0);
    expect(new Set(spoken.map((s) => s.voice))).toEqual(new Set([AN.name]));
    expect(ttsTexts).toEqual([]);
  });

  it('the on-device voice reads it; when it fails, only a Windows voice that reads here goes on', async () => {
    useVoiceStore.setState({ engine: 'local' });
    let spoken = fakeSystemVoice([HOAIMY]);
    expect(await canSpeakOnDevice()).toBe(true);
    await speak(TEXT, { onDevice: true });
    expect(natural.calls).toBe(1);
    expect(spoken).toEqual([]);

    natural.fail = true;
    await speak(TEXT, { onDevice: true });
    expect(natural.calls).toBe(2);
    // The online Windows voice never takes over this text.
    expect(spoken).toEqual([]);

    spoken = fakeSystemVoice([HOAIMY, AN]);
    await speak(TEXT, { onDevice: true });
    expect(spoken.length).toBeGreaterThan(0);
    expect(new Set(spoken.map((s) => s.voice))).toEqual(new Set([AN.name]));
    expect(ttsTexts).toEqual([]);
  });
});
