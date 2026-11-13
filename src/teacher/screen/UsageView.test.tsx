import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { UsageView } from './UsageView';

/** Who answers now: the header pill's state (aiStatusView.ts), set per test. */
type Kind = 'cloud' | 'local' | 'offline' | 'warn';
const status = vi.hoisted((): { kind: Kind } => ({ kind: 'cloud' }));
vi.mock('@/app/ai/aiStatusView', () => ({
  useAiStatusView: () => ({ kind: status.kind }),
}));

/** The online transport with the desktop app's day counter (`ai_usage`), or without one. */
function transport(count?: number): LlmTransport {
  const base: LlmTransport = {
    chat: () => Promise.reject(new Error('not used')),
    models: () => Promise.resolve([]),
    setKey: () => Promise.resolve(),
    hasKey: () => Promise.resolve(true),
    deleteKey: () => Promise.resolve(),
  };
  return count === undefined ? base : { ...base, usageToday: () => Promise.resolve(count) };
}

describe('"Lượt dùng": the online calls of today, from the app’s own counter', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'vi' });
    status.kind = 'cloud';
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('the count and the daily cap the learner set, and what is left', async () => {
    setTransportForTests(transport(12));
    useAiStore.setState({ dailyCap: 50 });
    render(<UsageView />);
    expect(await screen.findByText('Hôm nay đã dùng 12/50 lượt.')).toBeInTheDocument();
    expect(screen.getByText('Còn 38 lượt đến hết ngày.')).toBeInTheDocument();
    // Plain words: what a call is, and that the provider's own limits are not known here.
    expect(screen.getByText(/là một lượt: câu hỏi, lượt rà soát/)).toBeInTheDocument();
    expect(screen.getByText(/SimLab không đọc được giới hạn đó/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/token|LLM|JSON/i);
  });

  it('the cap reached: the online AI rests until tomorrow', async () => {
    setTransportForTests(transport(50));
    useAiStore.setState({ dailyCap: 50 });
    render(<UsageView />);
    expect(await screen.findByText('Hôm nay đã dùng 50/50 lượt.')).toBeInTheDocument();
    expect(screen.getByText(/Đã hết lượt hôm nay/)).toBeInTheDocument();
    expect(screen.queryByText(/Còn .* lượt/)).toBeNull();
  });

  it('no daily cap (0): the count alone, nothing "left"', async () => {
    setTransportForTests(transport(7));
    useAiStore.setState({ dailyCap: 0 });
    render(<UsageView />);
    expect(
      await screen.findByText('Hôm nay đã dùng 7 lượt. Em không đặt giới hạn mỗi ngày.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Còn .* lượt|Đã hết lượt/)).toBeNull();
  });

  it('outside the desktop app there is no counter: it says so, no number', () => {
    setTransportForTests(transport());
    useAiStore.setState({ dailyCap: 50 });
    render(<UsageView />);
    expect(
      screen.getByText('Số lượt chỉ đếm được trong ứng dụng SimLab trên máy tính.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Hôm nay đã dùng/)).toBeNull();
  });

  it('the AI on this computer answering: no calls used', async () => {
    status.kind = 'local';
    setTransportForTests(transport(3));
    useAiStore.setState({ dailyCap: 50 });
    render(<UsageView />);
    expect(await screen.findByText('Hôm nay đã dùng 3/50 lượt.')).toBeInTheDocument();
    expect(
      screen.getByText('Lúc này AI trên máy này đang trả lời: không tính lượt.'),
    ).toBeInTheDocument();
  });

  it('"Đổi giới hạn mỗi ngày" opens Settings → Kết nối AI', async () => {
    setTransportForTests(transport(1));
    const openSettingsAt = vi.fn();
    useWorkspaceStore.setState({ openSettingsAt });
    render(<UsageView />);
    await userEvent.click(screen.getByRole('button', { name: 'Đổi giới hạn mỗi ngày' }));
    expect(openSettingsAt).toHaveBeenCalledWith('ai');
  });
});
