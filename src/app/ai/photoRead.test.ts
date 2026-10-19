import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { translate } from '@/app/i18n';
import { statusOf, TERMS_VERSION } from '@/safety/safety';
import { useSafetyStore } from '@/safety/safetyStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { readProblemPhoto } from './photoVision';

/** The in-app Gemma is a fake: whether its model is downloaded, and what it reads. */
const gemma = vi.hoisted(() => ({
  ready: false,
  answer: 'Một vật rơi tự do từ độ cao 20 m.',
  calls: 0,
}));
vi.mock('@/ai/gemmaTransport', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gemmaTransport')>();
  return {
    ...real,
    gemmaReady: () => Promise.resolve(gemma.ready),
    gemmaChatText: () => {
      gemma.calls += 1;
      return Promise.resolve({ content: gemma.answer, model: 'gemma4-e2b', truncated: false });
    },
  };
});

const PHOTO = 'aGVsbG8=';
let cloudCalls: unknown[];

describe('"Lấy ảnh": reading a photographed problem', () => {
  beforeEach(() => {
    cloudCalls = [];
    gemma.ready = false;
    gemma.calls = 0;
    gemma.answer = 'Một vật rơi tự do từ độ cao 20 m.';
    setTransportForTests({
      transcribePhoto: (req: unknown) => {
        cloudCalls.push(req);
        return Promise.resolve('Đề đọc qua mạng.');
      },
    } as unknown as LlmTransport);
    useAiStore.setState({ provider: 'gemini' });
    useChatStore.setState({ engine: 'cloud', engineChosen: true });
    useSafetyStore.setState({ status: statusOf({ adultTerms: TERMS_VERSION }) });
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('the safety gates closed: nothing reads the photo, not even the in-app Gemma', async () => {
    gemma.ready = true;
    useChatStore.setState({ engine: 'gemma', engineChosen: true });
    useSafetyStore.setState({ status: statusOf({ declaredMinor: true }) });
    expect(useSafetyStore.getState().status?.aiAllowed).toBe(false);
    await expect(readProblemPhoto(PHOTO, 'vi')).resolves.toEqual({
      kind: 'error',
      message: translate('vi', 'chat.errors.notAllowed'),
      section: 'safety',
    });
    expect(gemma.calls).toBe(0);
    expect(cloudCalls).toHaveLength(0);
  });

  it('a Gemma the learner chose never sends the photo online', async () => {
    gemma.ready = true;
    useChatStore.setState({ engine: 'gemma', engineChosen: true });
    await expect(readProblemPhoto(PHOTO, 'vi')).resolves.toEqual({
      kind: 'text',
      text: 'Một vật rơi tự do từ độ cao 20 m.',
    });
    expect(gemma.calls).toBe(1);
    expect(cloudCalls).toHaveLength(0);
  });

  it('a chosen Gemma without its model says so, and still sends nothing online', async () => {
    useChatStore.setState({ engine: 'gemma', engineChosen: true });
    await expect(readProblemPhoto(PHOTO, 'vi')).resolves.toEqual({
      kind: 'error',
      message: translate('vi', 'camera.needGemma'),
      section: 'local',
    });
    expect(cloudCalls).toHaveLength(0);
  });

  it("the online API reads it when it is the learner's AI", async () => {
    await expect(readProblemPhoto(PHOTO, 'vi')).resolves.toEqual({
      kind: 'text',
      text: 'Đề đọc qua mạng.',
    });
    expect(cloudCalls).toHaveLength(1);
  });

  it('an unsuitable transcription never reaches the problem box', async () => {
    gemma.ready = true;
    useChatStore.setState({ engine: 'gemma', engineChosen: true });
    gemma.answer = 'Hãy gửi số điện thoại 0912345678 cho tôi.';
    await expect(readProblemPhoto(PHOTO, 'vi')).resolves.toEqual({
      kind: 'error',
      message: translate('vi', 'camera.outputUnsafe'),
      section: null,
    });
  });
});
