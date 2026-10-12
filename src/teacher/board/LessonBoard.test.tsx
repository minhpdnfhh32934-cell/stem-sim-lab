import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { LessonBoard } from './LessonBoard';

const ANSWER = [
  '# Rơi tự do',
  '1. Chọn chiều dương hướng xuống.',
  '2. Viết công thức:',
  '$$s = \\frac{1}{2} g t^2$$',
  '3. Thay số đã cho trong đề.',
].join('\n');

function chatWith(answer: string) {
  useChatStore.setState({
    messages: [
      { id: 'q1', role: 'user', content: 'Giải bài rơi tự do' },
      { id: 'a1', role: 'assistant', content: answer, model: 'gemma3-1b' },
    ],
    answering: false,
  });
}

describe('"Giảng trên bảng" lesson board', () => {
  beforeEach(() => {
    useVoiceStore.setState({ enabled: false });
    useChatStore.setState({ messages: [], answering: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('empty board invites a question; while answering it says the lesson is being prepared', () => {
    const { rerender } = render(<LessonBoard />);
    expect(screen.getByText(/bài giảng sẽ được viết lên bảng từng bước/)).toBeInTheDocument();
    act(() => {
      useChatStore.setState({ answering: true });
    });
    rerender(<LessonBoard />);
    expect(screen.getByRole('status')).toHaveTextContent('Thầy đang chuẩn bị bài giảng…');
  });

  it('writes the answer step by step: first step at once, the next ones over time', () => {
    vi.useFakeTimers();
    chatWith(ANSWER);
    render(<LessonBoard />);
    const board = screen.getByRole('region', { name: 'Bảng giảng' });
    expect(within(board).getByRole('heading', { name: 'Rơi tự do' })).toBeInTheDocument();
    expect(within(board).getAllByRole('listitem')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(within(board).getAllByRole('listitem')).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(within(board).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Bước 3/3')).toBeInTheDocument();
  });

  it('is labelled as AI content and shows only the AI’s own text', async () => {
    const user = userEvent.setup();
    chatWith(ANSWER);
    render(<LessonBoard />);
    await user.click(screen.getByRole('button', { name: 'Hiện tất cả' }));
    expect(screen.getByText('Nội dung do AI hỗ trợ')).toBeInTheDocument();
    expect(screen.getByText('Thay số đã cho trong đề.')).toBeInTheDocument();
    expect(screen.getByText(/Bảng chép lại đúng câu trả lời của AI/)).toBeInTheDocument();
  });

  it('previous / next move the highlighted step', async () => {
    const user = userEvent.setup();
    chatWith(ANSWER);
    render(<LessonBoard />);
    await user.click(screen.getByRole('button', { name: 'Hiện tất cả' }));
    const current = () =>
      screen.getAllByRole('listitem').findIndex((li) => li.getAttribute('aria-current') === 'step');
    expect(current()).toBe(2);
    await user.click(screen.getByRole('button', { name: /Bước trước/ }));
    expect(current()).toBe(1);
    await user.click(screen.getByRole('button', { name: /Bước sau/ }));
    expect(current()).toBe(2);
    expect(screen.getByRole('button', { name: /Bước sau/ })).toBeDisabled();
  });

  it('an answer without a heading is titled with the learner’s question', () => {
    chatWith('Lực là tác dụng đẩy hoặc kéo.');
    render(<LessonBoard />);
    expect(screen.getByRole('heading', { name: 'Giải bài rơi tự do' })).toBeInTheDocument();
    expect(screen.getByText('Lực là tác dụng đẩy hoặc kéo.')).toBeInTheDocument();
  });
});
