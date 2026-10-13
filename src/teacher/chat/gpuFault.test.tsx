import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allowGemmaAgain,
  forgetGpuFault,
  gemmaBlockedByGpuFault,
  noteGpuFault,
} from '@/ai/gpuSafety';
import { GpuSettings } from './GpuSettings';

describe('Settings after a GPU fault (audit GPU-01)', () => {
  afterEach(() => {
    allowGemmaAgain();
    forgetGpuFault();
  });

  it('explains the fault, keeps Gemma paused, and lets the learner choose to run it again', async () => {
    const user = userEvent.setup();
    act(() => {
      noteGpuFault('device-lost', { vendor: 'amd', architecture: 'rdna-3' });
    });
    render(<GpuSettings />);
    expect(screen.getByText('Card đồ họa đã bị treo khi chạy Gemma')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('amd rdna-3');
    expect(screen.getByRole('alert')).toHaveTextContent('Gemma đang tạm dừng');
    expect(gemmaBlockedByGpuFault()).toBe(true);
    // While Gemma is paused the notice cannot be hidden: it holds the only way to resume.
    expect(screen.queryByRole('button', { name: 'Ẩn thông báo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vẫn cho Gemma chạy lại' }));
    expect(gemmaBlockedByGpuFault()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Ẩn thông báo' }));
    expect(screen.queryByText('Card đồ họa đã bị treo khi chạy Gemma')).not.toBeInTheDocument();
  });

  it('shows the pause and the way out even when the stored record is gone', async () => {
    const user = userEvent.setup();
    act(() => {
      noteGpuFault('worker-crashed', null);
    });
    // Storage blocked or cleared: only the in-memory block remains.
    forgetGpuFault();
    render(<GpuSettings />);
    expect(screen.getByRole('alert')).toHaveTextContent('Gemma đang tạm dừng');
    await user.click(screen.getByRole('button', { name: 'Vẫn cho Gemma chạy lại' }));
    expect(gemmaBlockedByGpuFault()).toBe(false);
    expect(screen.queryByText('Card đồ họa đã bị treo khi chạy Gemma')).not.toBeInTheDocument();
  });
});
