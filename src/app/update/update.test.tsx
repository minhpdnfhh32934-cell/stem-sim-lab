import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The desktop backend (src-tauri/src/webupdate.rs) is replaced by a fake answer.
const answer = { current: {} as Record<string, unknown> };
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: vi.fn((cmd: string) =>
    Promise.resolve(
      cmd === 'web_update_check'
        ? answer.current
        : { native: '0.3.0', embedded: '0.3.0', downloaded: null, running: '0.3.0' },
    ),
  ),
}));

const { checkForUpdate, useUpdateStore } = await import('./updater');
const { UpdateDialog } = await import('./UpdateDialog');

function result(over: Record<string, unknown>) {
  return {
    status: { native: '0.3.0', embedded: '0.3.0', downloaded: null, running: '0.3.0' },
    manifest: { webVersion: '0.3.1', minNative: '0.3.0', size: 4e6, notes: '', date: '2026-10-07' },
    available: true,
    needsInstaller: false,
    required: false,
    ...over,
  };
}

async function startUpCheck(over: Record<string, unknown>) {
  answer.current = result(over);
  render(<UpdateDialog />);
  await act(async () => {
    await checkForUpdate(true);
  });
}

describe('update window at start-up (in-app updates)', () => {
  beforeEach(() => {
    useUpdateStore.setState({
      phase: 'idle',
      dialogOpen: false,
      required: false,
      manifest: null,
      status: null,
      error: null,
    });
  });

  it('a new version opens the window with "Cập nhật ngay" and "Để sau"', async () => {
    const user = userEvent.setup();
    await startUpCheck({});
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Cập nhật ngay' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Để sau' }));
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('nothing new: no window at start-up', async () => {
    await startUpCheck({ available: false });
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('a new installer is needed: the window offers the download page and "Để sau"', async () => {
    await startUpCheck({ available: false, needsInstaller: true });
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Mở trang tải bộ cài' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Để sau' })).toBeInTheDocument();
  });

  it('a mandatory update cannot be dismissed: no ✕, no "Để sau", Esc does nothing', async () => {
    await startUpCheck({ required: true });
    expect(screen.getByRole('alert')).toHaveTextContent('bắt buộc');
    expect(screen.queryByRole('button', { name: 'Để sau' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
    const dialog = document.querySelector('dialog');
    if (!dialog) throw new Error('no dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Cập nhật ngay' })).toBeInTheDocument();
  });

  it('mandatory and a new installer: only the download page', async () => {
    await startUpCheck({ available: false, needsInstaller: true, required: true });
    expect(screen.getByRole('button', { name: 'Mở trang tải bộ cài' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Để sau' })).toBeNull();
  });
});
