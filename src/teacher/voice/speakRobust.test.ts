import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError } from '@/ai/types';
import { useVoiceStore } from './voiceStore';

/**
 * Audit G5: a voice that "speaks" silence did not speak, a failing system voice is reported, and
 * one lasting cloud failure (timeout, offline, quota, daily cap) does not make every later
 * sentence of the same lesson wait for the cloud again.
 */
vi.mock('./audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio')>()),
  playPcm: () => Promise.resolve(),
  stopAudio: () => undefined,
  pause: () => Promise.resolve(),
}));
const local = vi.hoisted(() => ({ fail: new Map<string, string>(), said: [] as string[] }));
vi.mock('./localVoice', () => ({
  synthesizeLocal: (text: string) => {
    local.said.push(text);
    const error = local.fail.get(text);
    return error
      ? Promise.reject(new Error(error))
      : Promise.resolve({
          samples: Float32Array.from([0.2, -0.2]),
          sampleRate: 16000,
          applied: [],
        });
  },
}));

const { newVoiceSession, speak, stopSpeaking } = await import('./speak');
const { voiceErrorKey } = await import('./voiceErrors');

/** A Windows voice that fails with `errors[text]` and speaks everything else at once. */
function fakeSystemVoice(errors: Record<string, string> = {}) {
  const spoken: string[] = [];
  class Utterance {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [],
    cancel: () => undefined,
    speak: (u: Utterance) => {
      spoken.push(u.text);
      const error = errors[u.text];
      queueMicrotask(() => {
        if (error) u.onerror?.({ error });
        else u.onend?.();
      });
    },
  });
  return spoken;
}

/** A 16-bit PCM clip that is really heard (not silence). */
const VOICE_AUDIO = btoa(String.fromCharCode(0, 64, 0, 192));

function gemini(tts: () => Promise<{ audio: string; mimeType: string }>) {
  const calls = { count: 0 };
  setTransportForTests({
    hasKey: () => Promise.resolve(true),
    tts: () => {
      calls.count++;
      return tts();
    },
  } as unknown as LlmTransport);
  return calls;
}

describe('the teacher voice when something goes wrong', () => {
  beforeEach(() => {
    local.fail.clear();
    local.said.length = 0;
    useVoiceStore.setState({
      enabled: true,
      engine: 'gemini',
      style: 'vui',
      speed: 1,
      lastError: null,
      speaking: false,
    });
  });
  afterEach(() => {
    stopSpeaking();
    setTransportForTests(null);
    vi.unstubAllGlobals();
  });

  it('empty or silent Gemini audio is a failure: the Windows voice reads the phrase', async () => {
    const spoken = fakeSystemVoice();
    gemini(() => Promise.resolve({ audio: '', mimeType: 'audio/L16;rate=24000' }));
    await speak('Câu một. Câu hai.');
    expect(spoken).toEqual(['Câu một.', 'Câu hai.']);
    expect(useVoiceStore.getState().lastError).toBe('gemini-tts-silent');

    const silence = btoa(String.fromCharCode(0, 0, 0, 0));
    gemini(() => Promise.resolve({ audio: silence, mimeType: 'audio/L16;rate=24000' }));
    spoken.length = 0;
    await speak('Câu ba.');
    expect(spoken).toEqual(['Câu ba.']);
  });

  it('real Gemini audio is played and clears the last error', async () => {
    const spoken = fakeSystemVoice();
    useVoiceStore.setState({ lastError: 'old' });
    gemini(() => Promise.resolve({ audio: VOICE_AUDIO, mimeType: 'audio/L16;rate=24000' }));
    await speak('Câu một.');
    expect(spoken).toEqual([]);
    expect(useVoiceStore.getState().lastError).toBeNull();
  });

  it('an on-device voice failure mid-way: the Windows voice goes on from the unheard phrase', async () => {
    useVoiceStore.setState({ engine: 'local' });
    const spoken = fakeSystemVoice();
    local.fail.set('Câu hai.', 'voice-model-silent');
    await speak('Câu một. Câu hai. Câu ba.');
    expect(spoken).toEqual(['Câu hai.', 'Câu ba.']);
    expect(useVoiceStore.getState().lastError).toBe('voice-model-silent');
  });

  it('reports a Windows voice error and does not count the phrase as heard', async () => {
    useVoiceStore.setState({ engine: 'system' });
    const spoken = fakeSystemVoice({ 'Câu hai.': 'synthesis-failed' });
    await speak('Câu một. Câu hai. Câu ba.');
    expect(spoken).toEqual(['Câu một.', 'Câu hai.']);
    expect(useVoiceStore.getState().lastError).toBe('system-voice-synthesis-failed');
    expect(useVoiceStore.getState().speaking).toBe(false);
  });

  it('an interrupted or cancelled phrase is not an error', async () => {
    useVoiceStore.setState({ engine: 'system' });
    const spoken = fakeSystemVoice({ 'Câu một.': 'interrupted', 'Câu hai.': 'canceled' });
    await speak('Câu một. Câu hai. Câu ba.');
    expect(spoken).toEqual(['Câu một.', 'Câu hai.', 'Câu ba.']);
    expect(useVoiceStore.getState().lastError).toBeNull();
  });

  it.each([
    ['a timeout', new AiError('timeout', '30s')],
    ['no network', new AiError('network', 'Failed to fetch')],
    ['429', new AiError('http', '429: RESOURCE_EXHAUSTED')],
    ['the daily cap', new AiError('dailyLimit', '50')],
  ])('after %s the rest of the lesson uses the Windows voice at once', async (_name, error) => {
    const spoken = fakeSystemVoice();
    const calls = gemini(() => Promise.reject(error));
    const session = newVoiceSession();
    await speak('Câu một.', { session });
    await speak('Câu hai.', { session });
    await speak('Câu ba.', { session });
    expect(calls.count).toBe(1);
    expect(spoken).toEqual(['Câu một.', 'Câu hai.', 'Câu ba.']);
    // Settings still says why the chosen voice was not heard.
    expect(useVoiceStore.getState().lastError).toContain(error.message);
    // A new lesson (or a chat answer, which has its own session) tries the cloud again.
    await speak('Câu bốn.');
    expect(calls.count).toBe(2);
  });

  it('a passing error (503) is tried again at the next sentence', async () => {
    fakeSystemVoice();
    const calls = gemini(() => Promise.reject(new AiError('http', '503: overloaded')));
    const session = newVoiceSession();
    await speak('Câu một.', { session });
    await speak('Câu hai.', { session });
    expect(calls.count).toBe(2);
  });

  it('a hung on-device voice also stops being asked for the rest of the lesson', async () => {
    useVoiceStore.setState({ engine: 'local' });
    const spoken = fakeSystemVoice();
    local.fail.set('Câu một.', 'voice-model-timeout');
    const session = newVoiceSession();
    await speak('Câu một.', { session });
    await speak('Câu hai.', { session });
    expect(local.said).toEqual(['Câu một.']);
    expect(spoken).toEqual(['Câu một.', 'Câu hai.']);
  });
});

describe('a lesson skips only the voice that failed (second review)', () => {
  beforeEach(() => {
    local.fail.clear();
    local.said.length = 0;
    useVoiceStore.setState({
      enabled: true,
      engine: 'gemini',
      style: 'vui',
      speed: 1,
      lastError: null,
      speaking: false,
    });
  });
  afterEach(() => {
    stopSpeaking();
    setTransportForTests(null);
    vi.unstubAllGlobals();
  });

  it('switching to the on-device voice mid-lesson uses it at once after a cloud failure', async () => {
    const spoken = fakeSystemVoice();
    gemini(() => Promise.reject(new AiError('http', '429: RESOURCE_EXHAUSTED')));
    const session = newVoiceSession();
    await speak('Câu một.', { session });
    expect(spoken).toEqual(['Câu một.']);
    // The learner picks the downloaded voice in Settings: it is heard, not the system voice.
    useVoiceStore.setState({ engine: 'local' });
    await speak('Câu hai.', { session });
    expect(local.said).toEqual(['Câu hai.']);
    expect(spoken).toEqual(['Câu một.']);
    // Back to Gemini in the same lesson: still skipped (it ran out of quota).
    useVoiceStore.setState({ engine: 'gemini' });
    await speak('Câu ba.', { session });
    expect(spoken).toEqual(['Câu một.', 'Câu ba.']);
  });

  it.each([
    ['silent audio', 'voice-model-silent'],
    ['a model that does not load', 'voice-model-load-failed: Error: no available backend'],
    ['a load that hangs', 'voice-model-load-timeout'],
  ])('after %s the on-device voice is not asked again in the lesson', async (_name, error) => {
    useVoiceStore.setState({ engine: 'local' });
    const spoken = fakeSystemVoice();
    local.fail.set('Câu một.', error);
    local.fail.set('Câu hai.', error);
    const session = newVoiceSession();
    await speak('Câu một.', { session });
    await speak('Câu hai.', { session });
    expect(local.said).toEqual(['Câu một.']);
    expect(spoken).toEqual(['Câu một.', 'Câu hai.']);
  });
});

describe('why the chosen voice was not heard (Settings)', () => {
  it.each([
    ['timeout: 30s', 'voice.errors.timeout'],
    ['voice-model-timeout', 'voice.errors.timeout'],
    ['dailyLimit: 50', 'voice.errors.dailyLimit'],
    ['http: 429: RESOURCE_EXHAUSTED', 'voice.errors.quota'],
    ['network: Failed to fetch', 'voice.errors.offline'],
    ['gemini-tts-no-key', 'voice.errors.noKey'],
    ['missingKey: gemini', 'voice.errors.noKey'],
    ['voice-model-missing', 'voice.errors.noModel'],
    ['notAllowed: ageGate', 'voice.errors.notAllowed'],
    ['system-voice-synthesis-failed', 'voice.errors.systemVoice'],
    ['gemini-tts-silent', 'voice.errors.other'],
  ])('%s → %s', (error, key) => {
    expect(voiceErrorKey(error)).toBe(key);
  });
});
