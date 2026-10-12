import { describe, expect, it } from 'vitest';
import { STORED_MESSAGES, useChatStore } from './chatStore';

describe('conversation memory settings', () => {
  it('migrating from v4 keeps every setting (new ones come from the defaults)', async () => {
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
    });
    const fresh = useChatStore.getInitialState();
    expect(fresh.saveHistory).toBe(true);
    expect(fresh.memoryLength).toBe('medium');
  });

  it('"Không lưu lịch sử" keeps the conversation and its summary out of storage', () => {
    const partialize = useChatStore.persist.getOptions().partialize;
    if (!partialize) throw new Error('partialize missing');
    const message = { id: '1', role: 'user' as const, content: 'Xin chào' };
    const base = {
      ...useChatStore.getState(),
      messages: [message],
      summary: { text: 'Tóm tắt', upto: '1' },
    };
    const kept = partialize({ ...base, saveHistory: true }) as {
      messages: unknown[];
      summary: unknown;
    };
    expect(kept.messages).toHaveLength(1);
    expect(kept.summary).not.toBeNull();
    const dropped = partialize({ ...base, saveHistory: false }) as {
      messages: unknown[];
      summary: unknown;
    };
    expect(dropped.messages).toHaveLength(0);
    expect(dropped.summary).toBeNull();
  });

  it('keeps at most the newest messages on this computer', () => {
    useChatStore.setState({ messages: [] });
    for (let i = 0; i < STORED_MESSAGES + 5; i++) {
      useChatStore
        .getState()
        .addMessage({ id: String(i), role: 'user', content: `câu ${String(i)}` });
    }
    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(STORED_MESSAGES);
    expect(messages[0]?.id).toBe('5');
    useChatStore.getState().clearMessages();
  });
});
