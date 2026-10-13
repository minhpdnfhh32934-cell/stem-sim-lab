import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './chatStore';

// The on-device model is replaced by a fake that streams the given pieces, then answers.
const pieces = { current: [] as string[] };
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: (args: { onPartial?: (t: string) => void }) => {
    let soFar = '';
    for (const p of pieces.current) {
      soFar += p;
      args.onPartial?.(soFar);
    }
    return Promise.resolve({ content: soFar, model: 'gemma3-1b', truncated: false });
  },
}));
vi.mock('@/app/ai/engineChoice', () => ({ analysisEngine: () => Promise.resolve('gemma') }));

const { askTeacher } = await import('./chatService');

describe('streamed on-device answers', () => {
  beforeEach(() => {
    useChatStore.setState({ engine: 'gemma', engineChosen: true, messages: [], summary: null });
  });

  it('shows the answer as it is written', async () => {
    pieces.current = ['Rơi tự do ', 'là chuyển động ', 'chỉ chịu trọng lực.'];
    const seen: string[] = [];
    const result = await askTeacher('Rơi tự do là gì?', 'vi', [], {
      includeScreen: false,
      think: false,
      onPartial: (t) => seen.push(t),
    });
    expect(seen).toEqual([
      'Rơi tự do ',
      'Rơi tự do là chuyển động ',
      'Rơi tự do là chuyển động chỉ chịu trọng lực.',
    ]);
    expect(result.content).toBe('Rơi tự do là chuyển động chỉ chịu trọng lực.');
  });

  it('takes back the shown text as soon as a piece is unsafe, and the answer is blocked', async () => {
    pieces.current = ['Bài này ', 'gọi số 0912345678 ', 'để nhận lời giải'];
    const seen: string[] = [];
    await expect(
      askTeacher('Giải giúp em', 'vi', [], {
        includeScreen: false,
        think: false,
        onPartial: (t) => seen.push(t),
      }),
    ).rejects.toThrow();
    expect(seen[0]).toBe('Bài này ');
    expect(seen.at(-1)).toBe('');
    expect(seen.filter((t) => t.includes('0912345678'))).toEqual([]);
  });

  it('Think never streams the draft (it is reviewed before anyone sees it)', async () => {
    pieces.current = ['Bản nháp'];
    const seen: string[] = [];
    await askTeacher('Hỏi', 'vi', [], {
      includeScreen: false,
      think: true,
      onPartial: (t) => seen.push(t),
    }).catch(() => undefined);
    expect(seen).toEqual([]);
  });
});
