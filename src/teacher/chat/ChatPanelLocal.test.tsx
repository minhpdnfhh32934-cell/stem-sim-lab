import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import type { LocalChatResponse, LocalRuntimeClient } from '@/ai/local/types';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError, type ChatRequest } from '@/ai/types';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from './chatStore';

// The runtime on this computer and the cloud are scripted fakes: these tests check the chat panel.
const local = {
  detect: vi.fn<LocalRuntimeClient['detect']>(),
  probe: vi.fn<LocalRuntimeClient['probe']>(),
  models: vi.fn<LocalRuntimeClient['models']>(),
  modelInfo: vi.fn<LocalRuntimeClient['modelInfo']>(),
  test: vi.fn<LocalRuntimeClient['test']>(),
  chat: vi.fn<LocalRuntimeClient['chat']>(),
};
let cloudCalls: ChatRequest[];
const cloud: LlmTransport = {
  chat: (req) => {
    cloudCalls.push(req);
    return Promise.resolve({ content: 'online', model: 'gemini-model', durationMs: 1 });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};
const selection = {
  kind: 'ollama' as const,
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3:8b',
  label: 'Ollama · qwen3:8b',
};
const answer = (content: string): LocalChatResponse => ({
  content,
  model: 'qwen3:8b',
  runtime: 'ollama',
  durationMs: 3,
  firstPieceMs: 1,
  truncated: false,
  streamed: true,
});

describe('AI Teacher chat with the AI on this computer', () => {
  beforeEach(() => {
    cloudCalls = [];
    for (const fn of Object.values(local)) fn.mockReset();
    setLocalClientForTests(local);
    setTransportForTests(cloud);
    useAiStore.setState({ provider: 'gemini', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      previousEngine: { engine: 'cloud', chosen: true },
      messages: [],
      summary: null,
      thinkEnabled: false,
      webLookup: false,
      answering: false,
    });
    useLocalAiStore.setState({ selected: null, checks: {}, userEndpoints: [] });
    useWorkspaceStore.setState({ settingsOpen: false, settingsSection: 'appearance' });
  });
  afterEach(() => {
    setLocalClientForTests(null);
    setTransportForTests(null);
  });

  it('the engine menu offers it; chosen without a runtime, the notice opens its page and nothing is sent', async () => {
    const user = userEvent.setup();
    render(<ChatPanel teacherPage showScreenContext={false} />);
    const menu = screen.getByRole('combobox', { name: 'Chọn mô hình AI' });
    expect(
      within(menu)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['API', 'Gemma cục bộ', 'AI trên máy khác']);
    await user.selectOptions(menu, 'local');
    expect(useChatStore.getState()).toMatchObject({ engine: 'local', engineChosen: true });
    const notice = await screen.findByText(/chưa chọn chương trình và mô hình/);
    expect(notice).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa có câu hỏi nào được gửi đi/);
    expect(local.chat).not.toHaveBeenCalled();
    expect(cloudCalls).toHaveLength(0);

    const status = notice.closest('[role="status"]');
    if (!(status instanceof HTMLElement)) throw new Error('notice missing');
    await user.click(within(status).getByRole('button', { name: 'Cài đặt' }));
    expect(useWorkspaceStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: 'runtimes',
    });
  });

  it('with a runtime chosen: the local line names it, the answer is labelled with it, nothing online', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    local.chat.mockImplementation((_req, opts) => {
      opts?.onPartial?.('Lực là ');
      return Promise.resolve(answer('Lực là đại lượng vectơ.'));
    });
    render(<ChatPanel teacherPage showScreenContext={false} />);
    expect(
      screen.getByText(
        'Câu hỏi được xử lý cục bộ trên máy này bởi Ollama (127.0.0.1:11434), không gửi lên mạng.',
      ),
    ).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    expect(await screen.findByText('Lực là đại lượng vectơ.')).toBeInTheDocument();
    expect(screen.getByText(/Ollama · qwen3:8b/)).toBeInTheDocument();
    expect(useChatStore.getState().messages[1]?.model).toBe('Ollama · qwen3:8b');
    expect(cloudCalls).toHaveLength(0);
  });

  it('a failed answer says why, and "Hỏi lại" asks once more without repeating the question', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    local.chat.mockRejectedValueOnce(new AiError('network', 'local-unreachable: refused'));
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Mình chưa kết nối được tới Ollama trên máy này/);
    // Never asked again by itself, never sent online instead.
    expect(local.chat).toHaveBeenCalledTimes(1);
    expect(cloudCalls).toHaveLength(0);

    await user.click(within(alert).getByRole('button', { name: 'Cài đặt' }));
    expect(useWorkspaceStore.getState().settingsSection).toBe('runtimes');

    local.chat.mockResolvedValueOnce(answer('Lực là đại lượng vectơ.'));
    await user.click(within(alert).getByRole('button', { name: /Hỏi lại/ }));
    expect(await screen.findByText('Lực là đại lượng vectơ.')).toBeInTheDocument();
    await waitFor(() => {
      expect(local.chat).toHaveBeenCalledTimes(2);
    });
    const messages = useChatStore.getState().messages;
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[0]?.content).toBe('Lực là gì?');
    expect(cloudCalls).toHaveLength(0);
  });

  it('a refusal that asking again would not fix offers Settings only', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    local.chat.mockRejectedValueOnce(new AiError('notAllowed', 'remote-model'));
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/chạy trên mạng chứ không chạy trên máy em/);
    expect(within(alert).queryByRole('button', { name: /Hỏi lại/ })).not.toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Cài đặt' })).toBeInTheDocument();
  });
});
