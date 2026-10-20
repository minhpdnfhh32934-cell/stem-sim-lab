import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSafetyStore } from '@/safety/safetyStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { AiStatusPill } from './AiStatusPill';

/** Whether the in-app Gemma model is downloaded (no model file is read in these tests). */
const gemma = vi.hoisted(() => ({ ready: false }));
vi.mock('@/ai/gemmaTransport', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gemmaTransport')>();
  return { ...real, gemmaReady: () => Promise.resolve(gemma.ready) };
});

const selection = {
  kind: 'ollama' as const,
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3:8b',
  label: 'Ollama · qwen3:8b',
};

function pill(onClick = vi.fn()) {
  render(<AiStatusPill onClick={onClick} />);
  return { button: screen.getByRole('button'), onClick };
}

/** The top-bar pill follows the engine the learner chose, not only the online API. */
describe('AI status pill', () => {
  beforeEach(() => {
    gemma.ready = false;
    useSettingsStore.setState({ locale: 'vi' });
    useAiStore.setState({ provider: 'gemini', status: 'ok' });
    useChatStore.setState({ engine: 'cloud', engineChosen: true, gemmaModel: 'gemma3-1b' });
    useLocalAiStore.setState({ selected: null });
  });

  it('the API engine: connected to the provider, the problem goes to its servers', () => {
    const { button } = pill();
    expect(button).toHaveAttribute('data-status', 'cloud');
    expect(button).toHaveAccessibleName(/^Đã kết nối Gemini\. .*Đề bài sẽ được gửi lên máy chủ\.$/);
  });

  it('a runtime on this computer: named with its address, nothing claimed to go online', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    const { button, onClick } = pill();
    expect(button).toHaveAttribute('data-status', 'local');
    expect(button).toHaveTextContent('AI trên máy: Ollama');
    expect(button).toHaveAccessibleName(/Ollama · qwen3:8b tại 127\.0\.0\.1:11434/);
    expect(button).toHaveAccessibleName(
      /chỉ gửi đề bài tới chương trình này trên máy em, không tự gửi lên mạng/,
    );
    expect(button.getAttribute('aria-label')).not.toMatch(/Gemini|gửi lên máy chủ|trung gian/);
    await user.click(button);
    expect(onClick).toHaveBeenCalledWith('runtimes');
  });

  it('a runtime on this computer needs no API key: never "Chưa kết nối AI"', () => {
    useAiStore.setState({ status: 'noKey' });
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    const { button } = pill();
    expect(button).toHaveTextContent('AI trên máy: Ollama');
    expect(button.getAttribute('aria-label')).not.toMatch(/Chưa kết nối AI|khóa API/);
  });

  it('chosen without a runtime and model: says so and opens their page', async () => {
    const user = userEvent.setup();
    useAiStore.setState({ provider: 'off', status: 'unknown' });
    useChatStore.setState({ engine: 'local' });
    const { button, onClick } = pill();
    expect(button).toHaveAttribute('data-status', 'warn');
    expect(button).toHaveTextContent('AI trên máy: chưa chọn');
    expect(button).toHaveAccessibleName(/chưa có gì được gửi đi/);
    await user.click(button);
    expect(onClick).toHaveBeenCalledWith('runtimes');
  });

  it('Gemma: on this computer when downloaded; a pre-selected Gemma without it is the API', async () => {
    const user = userEvent.setup();
    useChatStore.setState({ engine: 'gemma', engineChosen: false });
    const { button, onClick } = pill();
    // Not downloaded and never chosen: the connected API answers, as it says.
    expect(button).toHaveTextContent('Đã kết nối Gemini');
    gemma.ready = true;
    window.dispatchEvent(new Event('stemsim:gemma-changed'));
    expect(await screen.findByText('Gemma trên máy')).toBeInTheDocument();
    expect(button).toHaveAttribute('data-status', 'local');
    expect(button).toHaveAccessibleName(/gemma3-1b.*không gửi lên mạng/);
    await user.click(button);
    expect(onClick).toHaveBeenCalledWith('local');
  });

  it('the model is named in today’s language; a generic server may relay online, as it says', () => {
    useLocalAiStore.setState({
      selected: {
        kind: 'openAiCompatible',
        baseUrl: 'http://127.0.0.1:8000',
        model: 'm',
        // Saved while the app was in English.
        label: 'OpenAI-compatible server · m',
      },
    });
    useChatStore.setState({ engine: 'local' });
    const { button } = pill();
    expect(button).toHaveAccessibleName(/Máy chủ tương thích OpenAI · m tại 127\.0\.0\.1:8000/);
    expect(button.getAttribute('aria-label')).not.toMatch(/OpenAI-compatible server/);
    expect(button).toHaveAccessibleName(/chương trình trung gian tự chuyển câu hỏi lên mạng/);
  });

  it('the safety gate closed while the API is off: the AI on this computer is closed too', () => {
    const before = useSafetyStore.getState().status;
    useAiStore.setState({ provider: 'off', status: 'offline' });
    useSafetyStore.setState({
      status: { termsVersion: 1, answered: true, aiAllowed: false, minor: true },
    });
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    try {
      const { button } = pill();
      expect(button).toHaveTextContent('AI: chưa mở');
      expect(button).not.toHaveTextContent('AI trên máy');
    } finally {
      useSafetyStore.setState({ status: before });
    }
  });

  it('the safety gate closes every AI, on this computer too', () => {
    useAiStore.setState({ status: 'notAllowed' });
    useLocalAiStore.setState({ selected: selection });
    useChatStore.setState({ engine: 'local' });
    const { button } = pill();
    expect(button).toHaveTextContent('AI: chưa mở');
  });
});
