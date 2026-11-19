import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from './Toaster';
import { toast, useToastStore } from './toast';

describe('Toaster', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('a toast with an action shows its button, which runs once and closes the toast', async () => {
    const run = vi.fn();
    toast('Đã xóa cuộc trò chuyện.', 'info', 8000, { label: 'Hoàn tác', run });
    toast('Không có nút');
    render(<Toaster />);
    expect(screen.getAllByRole('button', { name: 'Hoàn tác' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Đã xóa cuộc trò chuyện.')).not.toBeInTheDocument();
    expect(screen.getByText('Không có nút')).toBeInTheDocument();
  });
});
