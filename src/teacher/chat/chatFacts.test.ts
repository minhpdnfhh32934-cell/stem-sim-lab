import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './chatStore';

/**
 * Results computed by the app travel with the answer (audit G3): in the 2026-10-13 evaluation,
 * Gemma 1B was given "2H2 + O2 → 2H2O" and still wrote "2H₃O(l)". The app shows its own result.
 */
const seen = vi.hoisted(() => ({ system: '' }));
vi.mock('@/ai/webGemma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/webGemma')>();
  return { ...real, webGPUStatus: () => 'webgpu' };
});
vi.mock('@/ai/gemmaTransport', () => ({
  gemmaReady: () => Promise.resolve(true),
  gemmaChatText: (args: { system: string }) => {
    seen.system = args.system;
    return Promise.resolve({
      content: 'Phương trình: 2H₂ + O₂ → 2H₃O(l). Em hiểu chưa?',
      model: 'gemma3-1b',
      truncated: false,
    });
  },
}));
vi.mock('@/app/ai/engineChoice', () => ({ analysisEngine: () => Promise.resolve('gemma') }));

const { askTeacher } = await import('./chatService');

describe('app-computed results next to the answer', () => {
  beforeEach(() => {
    useChatStore.setState({ engine: 'gemma', engineChosen: true, messages: [], summary: null });
  });

  it('gives the AI the exact result and returns it for the app to show', async () => {
    const result = await askTeacher('Cân bằng phương trình: H2 + O2 → H2O', 'vi', [], {
      includeScreen: false,
      think: false,
    });
    expect(seen.system).toContain('KẾT QUẢ DO SIMLAB TÍNH');
    expect(seen.system).toContain('2H2 + O2 → 2H2O');
    expect(result.metadata.facts).toEqual(['Phương trình cân bằng: 2H2 + O2 → 2H2O']);
  });

  it('adds nothing for questions without a computation', async () => {
    const result = await askTeacher('Lực ma sát nghỉ là gì?', 'vi', [], {
      includeScreen: false,
      think: false,
    });
    expect(result.metadata.facts).toEqual([]);
    expect(seen.system).not.toContain('KẾT QUẢ DO SIMLAB TÍNH (dùng đúng');
  });

  it('never shows a physics question as an exact chemistry result (audit G3)', async () => {
    const result = await askTeacher(
      'Vật m = 2kg chịu lực kéo F = 10N, hệ số ma sát 0,1. Tính gia tốc.',
      'vi',
      [],
      { includeScreen: false, think: false },
    );
    expect(result.metadata.facts).toEqual([]);
    expect(seen.system).not.toContain('KẾT QUẢ DO SIMLAB TÍNH (dùng đúng');
  });
});
