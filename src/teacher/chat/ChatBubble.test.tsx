import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useSafetyStore } from '@/safety/safetyStore';
import { askInBubble } from '@/teacher/teacherStore';
import { ChatBubble } from './ChatBubble';

const minor = { termsVersion: 1, answered: true, aiAllowed: false, minor: true };
const before = useSafetyStore.getState().status;

afterEach(() => {
  useSafetyStore.setState({ status: before });
});

describe('ChatBubble under 18 (#246, classic window since #263)', () => {
  it('opens a lock card, not the chat: no message box, no way to the AI Teacher page', async () => {
    act(() => {
      useSafetyStore.setState({ status: minor });
    });
    const user = userEvent.setup();
    render(<ChatBubble />);
    await user.click(screen.getByRole('button', { name: 'AI Teacher' }));
    expect(screen.getByText('AI Teacher cần bạn đủ 18 tuổi')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mở trang AI Teacher' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Đóng chat' }));
    expect(screen.queryByText('AI Teacher cần bạn đủ 18 tuổi')).toBeNull();
  });

  it('a question from another screen ("Hỏi thầy") opens the same lock card', () => {
    act(() => {
      useSafetyStore.setState({ status: minor });
    });
    render(<ChatBubble />);
    act(() => {
      askInBubble('Vì sao vật rơi nhanh dần?');
    });
    expect(screen.getByText('AI Teacher cần bạn đủ 18 tuổi')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
