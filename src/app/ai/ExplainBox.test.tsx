import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setLocalClientForTests } from '@/ai/local/client';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import type { LocalRuntimeClient } from '@/ai/local/types';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { AiError, type ChatRequest } from '@/ai/types';
import { useWorkspaceStore } from '@/app/workspaceStore';
import type { PhysicsScene, Solution } from '@/physics/types';
import { useSafetyStore } from '@/safety/safetyStore';
import { statusOf, TERMS_VERSION } from '@/safety/safety';
import { useChatStore } from '@/teacher/chat/chatStore';
import { ExplainBox } from './ExplainBox';

/** Whether the in-app Gemma model is downloaded (no model file is read in these tests). */
const gemma = vi.hoisted(() => ({ ready: false }));
vi.mock('@/ai/gemmaTransport', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gemmaTransport')>();
  return { ...real, gemmaReady: () => Promise.resolve(gemma.ready) };
});

// The runtime on this computer and the cloud are scripted fakes.
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
// Only the title is read from the scene.
const scene = { title: { vi: 'Rơi tự do', en: 'Free fall' } } as unknown as PhysicsScene;
const solution: Solution = {
  answers: [{ id: 't', label: { vi: 'Thời gian rơi', en: 'Fall time' }, value: 2, unit: 's' }],
  steps: [{ text: { vi: 't = căn(2h/g)', en: 't = sqrt(2h/g)' } }],
};

describe('"AI diễn giải" with the AI on this computer', () => {
  beforeEach(() => {
    cloudCalls = [];
    for (const fn of Object.values(local)) fn.mockReset();
    setLocalClientForTests(local);
    setTransportForTests(cloud);
    useSafetyStore.setState({ status: statusOf({ adultTerms: TERMS_VERSION }) });
    // The online AI is off: the button stays, because the AI on this computer explains.
    useAiStore.setState({ provider: 'off' });
    useChatStore.setState({ engine: 'local', engineChosen: true });
    useWorkspaceStore.setState({ settingsOpen: false, settingsSection: 'appearance' });
    gemma.ready = false;
    useLocalAiStore.setState({
      selected: {
        kind: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen3:8b',
        label: 'Ollama · qwen3:8b',
      },
    });
  });
  afterEach(() => {
    setLocalClientForTests(null);
    setTransportForTests(null);
    useLocalAiStore.setState({ selected: null });
  });

  it('explains with the chosen runtime, labelled with it; the cloud is never asked', async () => {
    const user = userEvent.setup();
    local.chat.mockResolvedValue({
      content: 'Vật rơi trong 2 s vì chỉ chịu trọng lực.',
      model: 'qwen3:8b',
      runtime: 'ollama',
      durationMs: 3,
      firstPieceMs: 1,
      truncated: false,
      streamed: true,
    });
    render(<ExplainBox scene={scene} solution={solution} problemText="Thả vật từ 20 m." />);
    await user.click(screen.getByRole('button', { name: /AI diễn giải/ }));
    expect(await screen.findByText('Vật rơi trong 2 s vì chỉ chịu trọng lực.')).toBeInTheDocument();
    expect(screen.getByText(/Ollama · qwen3:8b/)).toBeInTheDocument();
    expect(local.chat).toHaveBeenCalledTimes(1);
    expect(local.chat.mock.calls[0]?.[0]).toMatchObject({ kind: 'ollama', model: 'qwen3:8b' });
    expect(cloudCalls).toHaveLength(0);
  });

  it('a runtime that does not answer is said in plain words; nothing goes online', async () => {
    const user = userEvent.setup();
    local.chat.mockRejectedValue(new AiError('network', 'local-unreachable: refused'));
    render(<ExplainBox scene={scene} solution={solution} problemText="" />);
    await user.click(screen.getByRole('button', { name: /AI diễn giải/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Mình chưa kết nối được tới Ollama trên máy này/,
    );
    expect(cloudCalls).toHaveLength(0);
  });

  it('a chosen Gemma without its model is said in plain words, with its Settings page', async () => {
    const user = userEvent.setup();
    useAiStore.setState({ provider: 'gemini' });
    useChatStore.setState({ engine: 'gemma', engineChosen: true });
    render(<ExplainBox scene={scene} solution={solution} problemText="" />);
    await user.click(await screen.findByRole('button', { name: /AI diễn giải/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Không lấy được diễn giải: Gemma chưa sẵn sàng: chưa tải mô hình này.',
    );
    // Never an internal code such as "gemma".
    expect(alert.textContent).not.toMatch(/: gemma$/);
    await user.click(within(alert).getByRole('button', { name: 'Cài đặt' }));
    expect(useWorkspaceStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: 'local',
    });
    expect(local.chat).not.toHaveBeenCalled();
    expect(cloudCalls).toHaveLength(0);
  });

  it('a failed runtime offers its Settings page too', async () => {
    const user = userEvent.setup();
    local.chat.mockRejectedValue(new AiError('http', 'model-missing: 404: model not found'));
    render(<ExplainBox scene={scene} solution={solution} problemText="" />);
    await user.click(screen.getByRole('button', { name: /AI diễn giải/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Ollama chưa có mô hình em đã chọn/);
    await user.click(within(alert).getByRole('button', { name: 'Cài đặt' }));
    expect(useWorkspaceStore.getState().settingsSection).toBe('runtimes');
    expect(cloudCalls).toHaveLength(0);
  });

  it('a runtime that wrote only its reasoning is said in plain words, never as a code', async () => {
    const user = userEvent.setup();
    for (const message of ['reasoningOnly', 'empty answer (stop)']) {
      local.chat.mockRejectedValueOnce(new AiError('badResponse', message));
      const view = render(<ExplainBox scene={scene} solution={solution} problemText="" />);
      await user.click(screen.getByRole('button', { name: /AI diễn giải/ }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Ollama chưa viết ra câu trả lời nào/);
      expect(alert.textContent).not.toMatch(/reasoningOnly|empty answer/);
      view.unmount();
    }
    expect(cloudCalls).toHaveLength(0);
  });

  it('an explanation too long for the model points to a larger model, not to Trí nhớ', async () => {
    const user = userEvent.setup();
    local.chat.mockRejectedValue(
      new AiError('http', 'local-failed: 400: the request exceeds the available context size'),
    );
    render(<ExplainBox scene={scene} solution={solution} problemText="" />);
    await user.click(screen.getByRole('button', { name: /AI diễn giải/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/chọn mô hình có ngữ cảnh lớn hơn/);
    expect(alert.textContent).not.toMatch(/Trí nhớ|xóa bớt cuộc trò chuyện/);
    await user.click(within(alert).getByRole('button', { name: 'Cài đặt' }));
    expect(useWorkspaceStore.getState().settingsSection).toBe('runtimes');
    expect(cloudCalls).toHaveLength(0);
  });

  it('chosen but no runtime picked: nothing is sent anywhere', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({ selected: null });
    render(<ExplainBox scene={scene} solution={solution} problemText="" />);
    await user.click(screen.getByRole('button', { name: /AI diễn giải/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa chọn chương trình và mô hình/);
    expect(local.chat).not.toHaveBeenCalled();
    expect(cloudCalls).toHaveLength(0);
  });
});
