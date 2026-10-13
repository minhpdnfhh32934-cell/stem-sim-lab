import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useVoiceStore } from './voiceStore';

/**
 * Audit VOI-01: when the Gemini voice fails half-way, the Windows voice goes on from the first
 * phrase the learner has not heard yet; nothing is read twice.
 */
vi.mock('./audio', () => ({
  decodeAudio: () => ({ samples: new Float32Array(8), sampleRate: 24000 }),
  playPcm: () => Promise.resolve(),
  stopAudio: () => undefined,
  pause: () => Promise.resolve(),
}));

const { geminiGroupSizes, speak, stopSpeaking } = await import('./speak');
const { splitForSpeech, toSpeech } = await import('./vietnameseText');

function fakeSystemVoice() {
  const spoken: string[] = [];
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
    getVoices: () => [],
    cancel: () => undefined,
    speak: (u: Utterance) => {
      spoken.push(u.text);
      queueMicrotask(() => u.onend?.());
    },
  });
  return spoken;
}

const sentence = (i: number) =>
  `Đây là câu số ${String(i)} trong bài giảng về chuyển động thẳng biến đổi đều, nói chậm và rõ để học sinh theo kịp nhé.`;
const text = Array.from({ length: 12 }, (_, i) => sentence(i + 1)).join(' ');

describe('voice fallback (VOI-01)', () => {
  beforeEach(() => {
    useVoiceStore.setState({ enabled: true, engine: 'gemini', style: 'vui', speed: 1 });
  });
  afterEach(() => {
    stopSpeaking();
    setTransportForTests(null);
    vi.unstubAllGlobals();
  });

  it('continues with the Windows voice from the first phrase not yet heard', async () => {
    const spoken = fakeSystemVoice();
    let calls = 0;
    setTransportForTests({
      hasKey: () => Promise.resolve(true),
      tts: () => {
        calls++;
        return calls === 1
          ? Promise.resolve({ audio: '', mimeType: 'audio/L16;rate=24000' })
          : Promise.reject(new Error('503 overloaded'));
      },
    } as unknown as LlmTransport);
    const chunks = splitForSpeech(toSpeech(text));
    const groups = geminiGroupSizes(chunks);
    expect(groups.length).toBeGreaterThan(1);
    const heard = groups[0]?.phrases ?? 0;

    await speak(text);

    expect(useVoiceStore.getState().lastError).toContain('503');
    // Exactly the phrases after the first Gemini group, in order, once each.
    expect(spoken).toEqual(chunks.slice(heard).map((c) => c.text));
  });
});
