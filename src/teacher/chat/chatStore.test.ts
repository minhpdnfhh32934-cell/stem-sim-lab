import { describe, expect, it } from 'vitest';
import { GEMMA_MEMORY_CAP, memoryFor, useChatStore } from './chatStore';

const records = Array.from({ length: 30 }, (_, i) => i);

describe('conversation memory', () => {
  it('sends the chosen number of earlier messages; 0 sends none (never all)', () => {
    expect(memoryFor(records, 0, false)).toEqual([]);
    expect(memoryFor(records, 4, false)).toEqual([26, 27, 28, 29]);
    expect(memoryFor(records, 12, false)).toHaveLength(12);
    expect(memoryFor(records, 24, false)).toHaveLength(24);
  });

  it('Gemma never takes more than its cap', () => {
    expect(memoryFor(records, 24, true)).toHaveLength(GEMMA_MEMORY_CAP);
    expect(memoryFor(records, 0, true)).toEqual([]);
  });

  it('migrating from v4 keeps every setting and adds the memory defaults', async () => {
    const options = useChatStore.persist.getOptions();
    const migrated = (await options.migrate?.(
      {
        engine: 'cloud',
        engineChosen: true,
        gemmaModel: 'gemma3-270m',
        verifierProvider: 'groq',
        verifierModel: 'x',
        webLookup: true,
        messages: [],
        documents: [],
      },
      4,
    )) as Record<string, unknown>;
    expect(migrated).toMatchObject({
      engineChosen: true,
      webLookup: true,
      gemmaModel: 'gemma3-270m',
      memorySize: 12,
      saveHistory: true,
    });
  });

  it('"Không lưu lịch sử" keeps the conversation out of storage', () => {
    const partialize = useChatStore.persist.getOptions().partialize;
    if (!partialize) throw new Error('partialize missing');
    const message = { id: '1', role: 'user' as const, content: 'Xin chào' };
    const base = { ...useChatStore.getState(), messages: [message] };
    expect(
      (partialize({ ...base, saveHistory: true }) as { messages: unknown[] }).messages,
    ).toHaveLength(1);
    expect(
      (partialize({ ...base, saveHistory: false }) as { messages: unknown[] }).messages,
    ).toHaveLength(0);
  });
});
