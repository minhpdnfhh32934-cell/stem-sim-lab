import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setLocalClientForTests } from '@/ai/local/client';
import { checkKey, useLocalAiStore } from '@/ai/local/localAiStore';
import {
  UNVERIFIED,
  type LocalModels,
  type LocalRuntimeClient,
  type ModelDetails,
  type RuntimeProbe,
} from '@/ai/local/types';
import { AiError } from '@/ai/types';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useChatStore } from '../chatStore';

/** The desktop app or a browser, per test (the page shows the CORS note only in a browser). */
const desktop = vi.hoisted(() => ({ current: false }));
vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@tauri-apps/api/core')>();
  return { ...real, isTauri: () => desktop.current };
});

/** Whether the in-app Gemma model is downloaded (no model file is read in these tests). */
const gemma = vi.hoisted(() => ({ ready: false }));
vi.mock('@/ai/gemmaTransport', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gemmaTransport')>();
  return { ...real, gemmaReady: () => Promise.resolve(gemma.ready) };
});

const { LocalRuntimeSettings } = await import('./LocalRuntimeSettings');

// Every runtime is a scripted fake: these tests check the page, never a real runtime.
const client = {
  detect: vi.fn<LocalRuntimeClient['detect']>(),
  probe: vi.fn<LocalRuntimeClient['probe']>(),
  models: vi.fn<LocalRuntimeClient['models']>(),
  modelInfo: vi.fn<LocalRuntimeClient['modelInfo']>(),
  test: vi.fn<LocalRuntimeClient['test']>(),
  chat: vi.fn<LocalRuntimeClient['chat']>(),
};

const OLLAMA = 'http://127.0.0.1:11434';
const PROBES: RuntimeProbe[] = [
  { expected: 'ollama', kind: 'ollama', baseUrl: OLLAMA, status: 'found', version: '0.12.6' },
  {
    expected: 'lmStudio',
    kind: null,
    baseUrl: 'http://127.0.0.1:1234',
    status: 'unreachable',
    version: null,
  },
  {
    expected: 'llamaCpp',
    kind: null,
    baseUrl: 'http://127.0.0.1:8080',
    status: 'notRuntime',
    version: null,
  },
];
const MODELS: LocalModels = {
  models: [
    {
      id: 'qwen3:8b',
      sizeBytes: 5_200_000_000,
      family: 'qwen3',
      parameterSize: '8.2B',
      quantization: 'Q4_K_M',
      contextLength: null,
      vision: 'unverified',
      loaded: null,
      remote: false,
    },
    {
      id: 'gpt-oss:120b-cloud',
      sizeBytes: null,
      family: null,
      parameterSize: null,
      quantization: null,
      contextLength: null,
      vision: 'unverified',
      loaded: null,
      remote: true,
    },
  ],
  more: false,
};
const DETAILS: ModelDetails = {
  model: 'qwen3:8b',
  contextLength: 40960,
  vision: 'no',
  thinking: 'yes',
  loaded: null,
  remote: false,
  capabilities: { ...UNVERIFIED, listModels: 'yes', contextLength: 'yes', vision: 'no' },
  declared: UNVERIFIED,
};

function renderPage() {
  return render(<LocalRuntimeSettings />);
}

async function detectAndPick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
  await user.click(await screen.findByRole('radio', { name: /qwen3:8b/ }));
}

beforeEach(() => {
  desktop.current = false;
  gemma.ready = false;
  useAiStore.setState({ provider: 'gemini', status: 'unknown' });
  for (const fn of Object.values(client)) fn.mockReset();
  client.detect.mockResolvedValue(PROBES);
  client.models.mockResolvedValue(MODELS);
  client.probe.mockResolvedValue(PROBES[0] as RuntimeProbe);
  client.modelInfo.mockResolvedValue(DETAILS);
  setLocalClientForTests(client);
  useLocalAiStore.setState({
    userEndpoints: [],
    selected: null,
    checks: {},
    status: { phase: 'idle', probes: [], error: null },
    detectedAt: null,
    lists: {},
  });
  useChatStore.setState({
    engine: 'cloud',
    engineChosen: true,
    previousEngine: { engine: 'cloud', chosen: true },
  });
  useSettingsStore.setState({ uiMode: 'advanced', locale: 'vi' });
});
afterEach(() => {
  setLocalClientForTests(null);
});

describe('Settings → AI trên máy khác', () => {
  it('asks no runtime when it opens, also with a saved choice (restored as saved)', () => {
    useLocalAiStore.setState({
      selected: { kind: 'ollama', baseUrl: OLLAMA, model: 'qwen3:8b', label: 'Ollama · qwen3:8b' },
    });
    useChatStore.setState({ engine: 'local' });
    renderPage();
    expect(screen.getByText('Ollama · qwen3:8b tại 127.0.0.1:11434')).toBeInTheDocument();
    expect(screen.getByText(/SimLab chưa hỏi chương trình lần này/)).toBeInTheDocument();
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
  });

  it('"Tìm trên máy này" shows each runtime as found, not found or not an AI program', async () => {
    const user = userEvent.setup();
    renderPage();
    // It says plainly what is asked and that nothing is read from the disk or sent away.
    expect(
      screen.getByText(/127\.0\.0\.1:11434, 127\.0\.0\.1:1234, 127\.0\.0\.1:8080/),
    ).toHaveTextContent(/không quét ổ đĩa, không gửi gì ra khỏi máy/);
    expect(screen.getAllByText(/không tự chuyển sang API/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
    expect(client.detect).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Đang chạy · phiên bản 0.12.6')).toBeInTheDocument();
    expect(screen.getByText('Phát hiện')).toBeInTheDocument();
    expect(screen.getByText('Không thấy')).toBeInTheDocument();
    expect(screen.getByText('Không phải chương trình AI')).toBeInTheDocument();
    // Models only of the runtime that answered.
    expect(client.models).toHaveBeenCalledTimes(1);
    expect(client.models).toHaveBeenCalledWith('ollama', OLLAMA);
    const group = await screen.findByRole('radiogroup', { name: 'Mô hình của Ollama' });
    expect(within(group).getByRole('radio', { name: /qwen3:8b/ })).toBeEnabled();
    expect(within(group).getAllByText('Có trong danh sách')).toHaveLength(2);
    // A model that runs online is listed, never selectable.
    expect(within(group).getByRole('radio', { name: /gpt-oss:120b-cloud/ })).toBeDisabled();
    expect(within(group).getByText('Không dùng được: chạy trên mạng')).toBeInTheDocument();
    // Nothing generated anything.
    expect(client.test).not.toHaveBeenCalled();
    expect(client.chat).not.toHaveBeenCalled();
  });

  it('refuses an address off this computer and says why, without asking anything', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole('textbox', { name: 'Địa chỉ trên máy này' });
    await user.type(input, 'http://192.168.1.5:11434');
    await user.click(screen.getByRole('button', { name: 'Thêm' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/chỉ nhận địa chỉ trên chính máy này/);
    expect(useLocalAiStore.getState().userEndpoints).toEqual([]);
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, 'http://localhost:11435/v1');
    await user.click(screen.getByRole('button', { name: 'Thêm' }));
    expect(useLocalAiStore.getState().userEndpoints).toEqual(['http://localhost:11435']);
    expect(screen.getByRole('button', { name: 'Xóa localhost:11435' })).toBeInTheDocument();
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
  });

  it('the capability table shows only what was seen here; the rest is "Chưa xác minh"', async () => {
    const user = userEvent.setup();
    renderPage();
    await detectAndPick(user);
    const table = screen.getByRole('table');
    const row = (name: string) => within(table).getByRole('row', { name: new RegExp(name) });
    expect(row('Liệt kê mô hình')).toHaveTextContent('Có');
    expect(row('Đọc ảnh')).toHaveTextContent('Chưa xác minh');
    expect(row('Dừng giữa chừng')).toHaveTextContent('Chưa xác minh');
    // Documentation only hints; it is never shown as checked.
    expect(row('Trả lời từng phần')).toHaveTextContent('Chưa xác minh');
    expect(row('Trả lời từng phần')).toHaveTextContent('nói là có (chưa thấy trên máy này)');
    expect(
      screen.getByText('RAM/VRAM cần: Chưa xác minh (chương trình không cho biết)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Độ dài ngữ cảnh: Chưa xác minh')).toBeInTheDocument();

    // "Kiểm tra kết nối": who answers, then what it says about the model (nothing generates).
    await user.click(screen.getByRole('button', { name: 'Kiểm tra kết nối' }));
    expect(await screen.findByText(/Kết nối được/)).toBeInTheDocument();
    expect(client.probe).toHaveBeenCalledWith(OLLAMA);
    expect(client.modelInfo).toHaveBeenCalledWith('ollama', OLLAMA, 'qwen3:8b');
    expect(client.test).not.toHaveBeenCalled();
    expect(row('Đọc ảnh')).toHaveTextContent('Không');
    expect(row('Cho biết độ dài ngữ cảnh')).toHaveTextContent('Có');
    // In the model's line and in its resources.
    expect(screen.getAllByText(/Độ dài ngữ cảnh: 40\.960/)).toHaveLength(2);
  });

  it('"Kiểm tra trả lời" never runs by itself; one click is one request', async () => {
    const user = userEvent.setup();
    client.test.mockResolvedValue({ status: 'ok', firstPieceMs: 1500, streamed: true, detail: '' });
    const page = renderPage();
    await detectAndPick(user);
    expect(screen.getByText(/nạp mô hình vào RAM\/VRAM/)).toBeInTheDocument();
    expect(client.test).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Kiểm tra trả lời' }));
    expect(
      await screen.findByText('Mô hình đã trả lời (chữ đầu tiên sau 1,5 giây).'),
    ).toBeInTheDocument();
    expect(client.test).toHaveBeenCalledTimes(1);
    expect(client.test).toHaveBeenCalledWith('ollama', OLLAMA, 'qwen3:8b');
    // Saved: the time and the streaming seen on this computer.
    const check = useLocalAiStore.getState().checks[checkKey('ollama', OLLAMA, 'qwen3:8b')];
    expect(check?.testedAt).toBeTypeOf('number');
    expect(check?.capabilities.streaming).toBe('yes');
    expect(screen.getAllByText(/Đã thử trả lời/).length).toBeGreaterThan(0);

    // A failed test says why (in the learner's words) and is not tried again.
    client.test.mockResolvedValue({
      status: 'loading',
      firstPieceMs: null,
      streamed: false,
      detail: '',
    });
    await user.click(screen.getByRole('button', { name: 'Kiểm tra trả lời' }));
    expect(await screen.findByText(/Chương trình đang nạp mô hình/)).toBeInTheDocument();
    expect(client.test).toHaveBeenCalledTimes(2);
    // Reopened: the latest result is the failure, never the earlier success.
    page.unmount();
    renderPage();
    await detectAndPick(user);
    expect(screen.getAllByText(/Lần thử gần nhất chưa trả lời được/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Đã thử trả lời/)).toBeNull();
  });

  it('"Dùng cho AI Teacher" saves the choice and the engine; "Bỏ chọn" goes back', async () => {
    const user = userEvent.setup();
    renderPage();
    await detectAndPick(user);
    await user.click(screen.getByRole('button', { name: 'Dùng cho AI Teacher' }));
    expect(useLocalAiStore.getState().selected).toEqual({
      kind: 'ollama',
      baseUrl: OLLAMA,
      model: 'qwen3:8b',
      label: 'Ollama · qwen3:8b',
    });
    expect(useChatStore.getState().engine).toBe('local');
    // Saved for the next start (read back without asking any runtime).
    const saved = JSON.parse(localStorage.getItem('stemsim.local-ai') ?? '{}') as {
      state: { selected: unknown };
    };
    expect(saved.state.selected).toMatchObject({ model: 'qwen3:8b' });
    expect(
      screen.getByText('AI Teacher đang trả lời bằng mô hình này, ngay trên máy em.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Đang chọn cho AI Teacher').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(useLocalAiStore.getState().selected).toBeNull();
    expect(useChatStore.getState().engine).toBe('cloud');
    expect(
      await screen.findByText(
        'Đã bỏ chọn. Câu hỏi cho AI Teacher đang được gửi lên mạng tới Gemini.',
      ),
    ).toBeInTheDocument();
  });

  it('"Bỏ chọn" names the engine that really answers: a pre-selected Gemma without its model is the API', async () => {
    const user = userEvent.setup();
    // A fresh install: Gemma is only pre-selected, and its model was never downloaded.
    useChatStore.setState({
      engine: 'gemma',
      engineChosen: false,
      previousEngine: { engine: 'gemma', chosen: false },
    });
    renderPage();
    await detectAndPick(user);
    await user.click(screen.getByRole('button', { name: 'Dùng cho AI Teacher' }));
    expect(useChatStore.getState().engine).toBe('local');
    await user.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(useChatStore.getState()).toMatchObject({ engine: 'gemma', engineChosen: false });
    const note = await screen.findByText(/^Đã bỏ chọn\./);
    // The next question goes online: the learner is told so, never "back to local Gemma".
    expect(note).toHaveTextContent(
      'Đã bỏ chọn. Câu hỏi cho AI Teacher đang được gửi lên mạng tới Gemini.',
    );
    expect(note).not.toHaveTextContent(/Gemma/);
  });

  it('"Bỏ chọn" back to a downloaded Gemma, or to a chosen Gemma without its model', async () => {
    const user = userEvent.setup();
    gemma.ready = true;
    useChatStore.setState({
      engine: 'gemma',
      engineChosen: true,
      previousEngine: { engine: 'gemma', chosen: true },
    });
    renderPage();
    await detectAndPick(user);
    await user.click(screen.getByRole('button', { name: 'Dùng cho AI Teacher' }));
    await user.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(
      await screen.findByText(
        'Đã bỏ chọn. AI Teacher đang trả lời bằng Gemma cục bộ, ngay trên máy em.',
      ),
    ).toBeInTheDocument();

    gemma.ready = false;
    await detectAndPick(user);
    await user.click(screen.getByRole('button', { name: 'Dùng cho AI Teacher' }));
    await user.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(
      await screen.findByText(
        'Đã bỏ chọn. AI Teacher đang chọn Gemma cục bộ nhưng chưa tải mô hình, nên chưa có câu hỏi nào được gửi đi.',
      ),
    ).toBeInTheDocument();
  });

  it('a saved model the AI Teacher does not use is never shown as in use', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({
      selected: { kind: 'ollama', baseUrl: OLLAMA, model: 'qwen3:8b', label: 'Ollama · qwen3:8b' },
    });
    // The learner switched the chat back to the pre-selected Gemma, which has no model.
    useChatStore.setState({ engine: 'gemma', engineChosen: false });
    renderPage();
    expect(screen.queryByText('Đang chọn cho AI Teacher')).not.toBeInTheDocument();
    expect(screen.getByText('Mô hình đã chọn ở trang này')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Đã chọn mô hình này nhưng AI Teacher chưa dùng nó. Câu hỏi cho AI Teacher đang được gửi lên mạng tới Gemini. Bấm “Dùng cho AI Teacher” để chuyển.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Đã chọn · AI Teacher đang dùng API · Gemini')).toBeInTheDocument();
    // The model's own row says the same after "Tìm trên máy này".
    await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
    const row = (await screen.findByRole('radio', { name: /qwen3:8b/ })).closest('article');
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLElement).getByText('Đã chọn · AI Teacher đang dùng API · Gemini'),
    ).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('Đang chọn cho AI Teacher')).toBeNull();
    // A downloaded Gemma answers: the badge names it.
    gemma.ready = true;
    window.dispatchEvent(new Event('stemsim:gemma-changed'));
    expect(
      await within(row as HTMLElement).findByText('Đã chọn · AI Teacher đang dùng Gemma cục bộ'),
    ).toBeInTheDocument();
  });

  it('"Khôi phục mặc định" asks first, then forgets this page’s data only', async () => {
    const user = userEvent.setup();
    useLocalAiStore.setState({
      selected: { kind: 'ollama', baseUrl: OLLAMA, model: 'qwen3:8b', label: 'Ollama · qwen3:8b' },
      userEndpoints: ['http://127.0.0.1:11435'],
    });
    useChatStore.setState({ engine: 'local', thinkEnabled: true });
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Khôi phục mặc định' }));
    expect(useLocalAiStore.getState().userEndpoints).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Xóa hẳn' }));
    expect(useLocalAiStore.getState()).toMatchObject({
      selected: null,
      userEndpoints: [],
      checks: {},
    });
    // Nothing else changes: the engine stays local, so nothing is sent until a model is chosen.
    expect(useChatStore.getState()).toMatchObject({ engine: 'local', thinkEnabled: true });
    expect(screen.getAllByText(/chưa có câu hỏi nào được gửi đi/).length).toBeGreaterThan(0);
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
  });

  it('a failed list or detection is explained in the learner’s words', async () => {
    const user = userEvent.setup();
    client.models.mockRejectedValue(new AiError('network', 'local-unreachable: refused'));
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
    expect(await screen.findByText(/Mình chưa kết nối được tới Ollama/)).toBeInTheDocument();
    client.detect.mockRejectedValue(new AiError('notAllowed', 'ageGate'));
    await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
    expect(await screen.findByText(/Cần hoàn tất bước an toàn/)).toBeInTheDocument();
  });

  it('shows the CORS note in a browser only, and the troubleshooting and honesty notes', () => {
    renderPage();
    // Under "Tìm trên máy này" and in the troubleshooting list.
    expect(screen.getAllByText(/phải cho phép trang này truy cập \(CORS\)/)).toHaveLength(2);
    expect(screen.getByText(/SimLab không chọn card đồ họa/)).toBeInTheDocument();
    expect(
      screen.getByText(/SimLab không biết chương trình đó ghi lại những gì/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /một chương trình trung gian chạy trên máy vẫn có thể chuyển câu hỏi lên mạng/,
      ),
    ).toBeInTheDocument();
    // "Phương án dự phòng": under "Tìm trên máy này" and in the honesty notes.
    const fallback = screen.getAllByText(
      /Phương án dự phòng: khi AI trên máy gặp lỗi, SimLab báo cho em biết và không gửi câu hỏi lên mạng/,
    );
    expect(fallback).toHaveLength(2);
    for (const line of fallback) expect(line).toBeVisible();
    expect(screen.getByText(/SimLab không lưu khóa cho AI trên máy/)).toBeInTheDocument();
    expect(screen.getByText(/cổng 8080 hay bị chương trình khác dùng/)).toBeInTheDocument();
  });

  it('the desktop app shows no CORS note', () => {
    desktop.current = true;
    renderPage();
    expect(screen.queryByText(/\(CORS\)/)).not.toBeInTheDocument();
  });

  it('Basic mode folds the technical parts behind one line', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ uiMode: 'basic' });
    renderPage();
    await detectAndPick(user);
    const caps = screen
      .getAllByText('Khả năng (chỉ tính điều đã thấy trên máy này)')
      .map((e) => e.tagName);
    expect(caps).toContain('SUMMARY');
    expect(screen.getByText('Hiện phần nâng cao').tagName).toBe('SUMMARY');
    // The main action stays visible.
    expect(screen.getByRole('button', { name: 'Dùng cho AI Teacher' })).toBeVisible();
  });

  describe('the chosen model, checked against the last search', () => {
    const LLAMA = {
      kind: 'ollama' as const,
      baseUrl: OLLAMA,
      model: 'llama3:8b',
      label: 'Ollama · llama3:8b',
    };
    const card = () =>
      screen.getByText('Đang chọn cho AI Teacher', { selector: 'legend' }).closest('fieldset');

    it('a runtime the search did not find: "chưa dùng được", with why, never "đang trả lời"', async () => {
      const user = userEvent.setup();
      useLocalAiStore.setState({ selected: LLAMA });
      useChatStore.setState({ engine: 'local' });
      client.detect.mockResolvedValue([
        { ...(PROBES[0] as RuntimeProbe), kind: null, status: 'unreachable', version: null },
        ...PROBES.slice(1),
      ]);
      renderPage();
      // Nothing is asked when the page opens: the saved choice is shown as saved, and never as
      // answering before anything was checked.
      expect(card()).toHaveTextContent(
        'Lần mở này SimLab chưa kiểm tra chương trình có đang chạy không',
      );
      expect(card()).not.toHaveTextContent('AI Teacher đang trả lời bằng mô hình này');
      await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
      const chosen = await within(card() as HTMLElement).findByText('Chưa dùng được');
      expect(chosen).toBeInTheDocument();
      const box = card() as HTMLElement;
      expect(within(box).getByRole('alert')).toHaveTextContent(
        /Mình chưa kết nối được tới Ollama trên máy này/,
      );
      expect(box).not.toHaveTextContent('AI Teacher đang trả lời bằng mô hình này');
      expect(box).toHaveTextContent(/không được gửi đi nơi khác/);
      // The learner can still unselect it.
      expect(within(box).getByRole('button', { name: 'Bỏ chọn' })).toBeEnabled();
      expect(client.chat).not.toHaveBeenCalled();
      expect(client.test).not.toHaveBeenCalled();
    });

    it('a model missing from the runtime’s full list: says so, and another one can be picked', async () => {
      const user = userEvent.setup();
      useLocalAiStore.setState({ selected: LLAMA });
      useChatStore.setState({ engine: 'local' });
      renderPage();
      await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
      const box = card() as HTMLElement;
      expect(await within(box).findByText('Chưa dùng được')).toBeInTheDocument();
      expect(within(box).getByRole('alert')).toHaveTextContent(/Ollama chưa có mô hình em đã chọn/);
      await user.click(screen.getByRole('radio', { name: /qwen3:8b/ }));
      await user.click(screen.getByRole('button', { name: 'Dùng cho AI Teacher' }));
      expect(useLocalAiStore.getState().selected?.model).toBe('qwen3:8b');
      expect(within(card() as HTMLElement).queryByText('Chưa dùng được')).toBeNull();
      expect(card()).toHaveTextContent('AI Teacher đang trả lời bằng mô hình này');
    });

    it('a list that is cut short proves nothing: no "missing" claim', async () => {
      const user = userEvent.setup();
      useLocalAiStore.setState({ selected: LLAMA });
      useChatStore.setState({ engine: 'local' });
      client.models.mockResolvedValue({ ...MODELS, more: true });
      renderPage();
      await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
      await screen.findByRole('radio', { name: /qwen3:8b/ });
      expect(within(card() as HTMLElement).queryByText('Chưa dùng được')).toBeNull();
      expect(card()).toHaveTextContent('AI Teacher đang trả lời bằng mô hình này');
    });
  });

  it('reopened in the same session: the last search and its lists come back, with their time', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await user.click(screen.getByRole('button', { name: 'Tìm trên máy này' }));
    expect(await screen.findByRole('radio', { name: /qwen3:8b/ })).toBeInTheDocument();
    expect(screen.getByText(/^Kết quả lần tìm lúc /)).not.toHaveTextContent(/có thể đã tắt/);
    first.unmount();

    renderPage();
    expect(screen.getByText('Đang chạy · phiên bản 0.12.6')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /qwen3:8b/ })).toBeInTheDocument();
    // An older result says when it was seen and that it may be out of date.
    expect(screen.getByText(/^Kết quả lần tìm lúc /)).toHaveTextContent(
      /có thể đã tắt hoặc đổi mô hình từ lúc đó/,
    );
    // Nothing was asked again.
    expect(client.detect).toHaveBeenCalledTimes(1);
    expect(client.models).toHaveBeenCalledTimes(1);
  });

  it('a found runtime without its list says how to see it again', () => {
    useLocalAiStore.setState({
      status: { phase: 'done', probes: PROBES, error: null },
      detectedAt: Date.now(),
      lists: {},
    });
    renderPage();
    expect(
      screen.getByText('Bấm “Tìm trên máy này” để xem lại danh sách mô hình.'),
    ).toBeInTheDocument();
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
  });

  it('"Bỏ chọn" without an API key says nothing can be sent yet, and never advertises', async () => {
    const user = userEvent.setup();
    useAiStore.setState({ provider: 'gemini', status: 'noKey' });
    useLocalAiStore.setState({
      selected: { kind: 'ollama', baseUrl: OLLAMA, model: 'qwen3:8b', label: 'Ollama · qwen3:8b' },
    });
    useChatStore.setState({ engine: 'local' });
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    const note = await screen.findByText(/^Đã bỏ chọn\./);
    expect(note).toHaveTextContent(
      'Đã bỏ chọn. AI Teacher đang chọn API Gemini nhưng chưa có khóa, nên chưa có câu hỏi nào được gửi đi cho tới khi em thêm khóa.',
    );
    expect(note).not.toHaveTextContent(/khuyên dùng|đang được gửi lên mạng/);
  });
});
