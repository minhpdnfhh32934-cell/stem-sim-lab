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

  it('migrating from v5 keeps the engine and remembers it as the one to go back to', async () => {
    const migrate = useChatStore.persist.getOptions().migrate;
    if (!migrate) throw new Error('migrate missing');
    for (const [engine, chosen] of [
      ['cloud', true],
      ['gemma', false],
      ['gemma', true],
    ] as const) {
      const migrated = (await migrate(
        { engine, engineChosen: chosen, gemmaModel: 'gemma3-1b', memoryLength: 'long' },
        5,
      )) as Record<string, unknown>;
      expect(migrated).toMatchObject({
        engine,
        engineChosen: chosen,
        memoryLength: 'long',
        previousEngine: { engine, chosen },
      });
    }
    // An engine this version does not know is not trusted.
    const odd = (await migrate({ engine: 'ollama', engineChosen: true }, 5)) as Record<
      string,
      unknown
    >;
    expect(odd).toMatchObject({ engine: 'gemma', engineChosen: false });
    expect(useChatStore.persist.getOptions().version).toBe(6);
  });

  it('the local engine is saved and restored as it was (no check on load)', async () => {
    useChatStore.getState().setEngine('local');
    const raw = JSON.parse(localStorage.getItem('stemsim.teacher-chat') ?? '{}') as {
      state: { engine: string; engineChosen: boolean };
      version: number;
    };
    expect(raw.version).toBe(6);
    expect(raw.state).toMatchObject({ engine: 'local', engineChosen: true });
    useChatStore.setState({ engine: 'cloud' });
    localStorage.setItem('stemsim.teacher-chat', JSON.stringify(raw));
    await useChatStore.persist.rehydrate();
    expect(useChatStore.getState().engine).toBe('local');
  });

  it('"Bỏ chọn" goes back to the engine used before the local runtime, as it was', () => {
    // A pre-selected (not chosen) Gemma stays only a suggestion after going back.
    useChatStore.setState({
      engine: 'gemma',
      engineChosen: false,
      previousEngine: { engine: 'gemma', chosen: false },
    });
    const s = useChatStore.getState();
    s.setEngine('local');
    expect(useChatStore.getState()).toMatchObject({
      engine: 'local',
      engineChosen: true,
      previousEngine: { engine: 'gemma', chosen: false },
    });
    // Choosing local again keeps what to go back to.
    s.setEngine('local');
    expect(useChatStore.getState().previousEngine).toEqual({ engine: 'gemma', chosen: false });
    s.leaveLocal();
    expect(useChatStore.getState()).toMatchObject({ engine: 'gemma', engineChosen: false });

    s.setEngine('cloud');
    s.setEngine('local');
    s.leaveLocal();
    expect(useChatStore.getState()).toMatchObject({ engine: 'cloud', engineChosen: true });
    // Nothing happens when the local runtime is not the engine.
    s.leaveLocal();
    expect(useChatStore.getState().engine).toBe('cloud');
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
