import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useChatStore, type ChatMessageRecord } from '@/teacher/chat/chatStore';
import { MemoryView } from './MemoryView';

const message = (id: string, role: 'user' | 'assistant', content: string): ChatMessageRecord =>
  ({ id, role, content, createdAt: 0 }) as ChatMessageRecord;

describe('"Ghi nhớ": what AI Teacher keeps of this conversation', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'vi' });
    useChatStore.setState({
      messages: [],
      summary: null,
      memoryLength: 'medium',
      saveHistory: true,
    });
  });

  it('an empty conversation: nothing to remember yet', () => {
    render(<MemoryView />);
    expect(screen.getByText('Chưa có gì để nhớ: cuộc trò chuyện còn trống.')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt phần trò chuyện cũ')).toBeNull();
  });

  it('a short conversation: the count, the level, kept on this computer, no summary yet', () => {
    useChatStore.setState({
      messages: [message('1', 'user', 'Gia tốc là gì?'), message('2', 'assistant', 'Là …')],
    });
    render(<MemoryView />);
    expect(screen.getByText('Đang có 2 tin nhắn.')).toBeInTheDocument();
    expect(screen.getByText(/Mức nhớ: Vừa\./)).toBeInTheDocument();
    expect(screen.getByText(/Mở lại ứng dụng vẫn thấy cuộc trò chuyện/)).toBeInTheDocument();
    expect(screen.getByText(/chưa cần tóm tắt/)).toBeInTheDocument();
  });

  it('older turns summarised: the AI-written summary, labelled as AI content with a report button', () => {
    useChatStore.setState({
      messages: [message('1', 'user', 'a'), message('2', 'assistant', 'b')],
      summary: { text: 'Em đang học rơi tự do; đã hỏi về g.', upto: '1' },
      memoryLength: 'long',
      saveHistory: false,
    });
    render(<MemoryView />);
    expect(screen.getByText('Em đang học rơi tự do; đã hỏi về g.')).toBeInTheDocument();
    expect(screen.getByText('Nội dung do AI hỗ trợ')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Báo cáo nội dung không phù hợp' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mức nhớ: Dài\./)).toBeInTheDocument();
    expect(screen.getByText(/chỉ giữ đến khi đóng ứng dụng/)).toBeInTheDocument();
    expect(screen.queryByText(/chưa cần tóm tắt/)).toBeNull();
  });

  it('"Đổi trong Cài đặt" opens Settings → Trí nhớ hội thoại', async () => {
    const openSettingsAt = vi.fn();
    useWorkspaceStore.setState({ openSettingsAt });
    render(<MemoryView />);
    await userEvent.click(screen.getByRole('button', { name: 'Đổi trong Cài đặt' }));
    expect(openSettingsAt).toHaveBeenCalledWith('memory');
  });
});
