import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { CameraDialog } from './CameraDialog';

// No camera in jsdom: the dialog shows "unsupported", which does not matter for these tests.
describe('camera dialog errors', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ settingsOpen: false, settingsSection: 'appearance' });
  });

  it('an error with a Settings page offers it, closing the camera first', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CameraDialog
        open
        busy={false}
        error="Mình chưa kết nối được tới Ollama trên máy này."
        errorSection="runtimes"
        onClose={onClose}
        onCapture={() => undefined}
      />,
    );
    expect(screen.getByText('Mình chưa kết nối được tới Ollama trên máy này.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cài đặt' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useWorkspaceStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: 'runtimes',
    });
  });

  it('an error without a Settings page shows no Settings button', () => {
    render(
      <CameraDialog
        open
        busy={false}
        error="Chưa đọc được đề trong ảnh. Hãy chụp lại rõ hơn."
        onClose={() => undefined}
        onCapture={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument();
  });
});
