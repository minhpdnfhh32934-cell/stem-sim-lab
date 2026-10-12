import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, useWorkspaceStore } from '@/app/workspaceStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import { SettingsDialog } from './SettingsDialog';

function renderOpen() {
  return render(
    <SettingsDialog
      open
      onClose={() => {
        useWorkspaceStore.getState().setSettingsOpen(false);
      }}
    />,
  );
}

describe('Settings: one small page per section', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ settingsOpen: true, settingsSection: 'appearance' });
    useChatStore.setState({ messages: [], memorySize: 12, saveHistory: true });
  });

  it('lists every section in the navigation and shows only the chosen page', () => {
    renderOpen();
    const nav = screen.getByRole('tablist');
    expect(within(nav).getAllByRole('tab')).toHaveLength(SETTINGS_SECTIONS.length);
    for (const name of [
      'Giao diện',
      'Kết nối AI',
      'AI local (Gemma)',
      'GPU cho Gemma',
      'Trí nhớ hội thoại',
      'Giọng nói',
    ]) {
      expect(within(nav).getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole('tab', { name: 'Giao diện' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // One visible page; the others are not rendered or hidden.
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Giao diện', level: 3 })).toBeInTheDocument();
  });

  it('switches page on click and with the arrow keys', async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole('tab', { name: 'Trí nhớ hội thoại' }));
    expect(useWorkspaceStore.getState().settingsSection).toBe('memory');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'settings-memory');
    expect(screen.getByRole('radio', { name: '12' })).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowDown}');
    expect(useWorkspaceStore.getState().settingsSection).toBe('voice');
    expect(screen.getByRole('tab', { name: 'Giọng nói' })).toHaveFocus();
  });

  it('opens on the page another screen asks for', () => {
    renderOpen();
    act(() => {
      useWorkspaceStore.getState().openSettingsAt('gpu');
    });
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'settings-gpu');
    expect(screen.getByText('Độ dài câu trả lời của Gemma')).toBeInTheDocument();
  });

  it('conversation memory: the choice and the clear button change the chat store', async () => {
    const user = userEvent.setup();
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'F = ma là gì?' },
        { id: '2', role: 'assistant', content: 'Định luật II Newton.' },
      ],
    });
    useWorkspaceStore.setState({ settingsSection: 'memory' });
    renderOpen();
    await user.click(screen.getByRole('radio', { name: 'Không' }));
    expect(useChatStore.getState().memorySize).toBe(0);
    expect(screen.getByText(/không nhớ những gì vừa nói/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Lưu lịch sử trò chuyện/ }));
    expect(useChatStore.getState().saveHistory).toBe(false);

    expect(screen.getByText('Đang có 2 tin nhắn.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' }));
    await user.click(screen.getByRole('button', { name: 'Xóa hẳn' }));
    expect(useChatStore.getState().messages).toHaveLength(0);
  });
});
