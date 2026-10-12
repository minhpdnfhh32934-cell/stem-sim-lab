import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The desktop backend (src-tauri/src/gpu.rs) is replaced by a fake: these tests check the
// screen only, not a real graphics card (that is checked by hand in the desktop app).
const backend = vi.hoisted(() => ({
  status: null as Record<string, unknown> | null,
  calls: [] as { cmd: string; args: unknown }[],
}));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: vi.fn((cmd: string, args?: { id?: string | null }) => {
    backend.calls.push({ cmd, args });
    if (cmd === 'gpu_set_choice' && backend.status) {
      const choice = args?.id ?? null;
      backend.status = {
        ...backend.status,
        choice,
        choiceName: choice ? 'NVIDIA GeForce RTX 5070 Laptop GPU' : null,
        restartNeeded: choice !== backend.status.startupChoice,
      };
    }
    return Promise.resolve(cmd === 'app_restart' ? undefined : backend.status);
  }),
}));

const { GpuSettings, GpuRestartReminder } = await import('./GpuSettings');
const { useGpuStore } = await import('@/ai/gpu');

const ADAPTERS = [
  {
    id: '1002:164e:10741043',
    name: 'AMD Radeon(TM) 610M',
    vendorId: 0x1002,
    deviceId: 0x164e,
    kind: 'integrated',
    dedicatedMb: 483,
    sharedMb: 7788,
  },
  {
    id: '10de:2d58:10741043',
    name: 'NVIDIA GeForce RTX 5070 Laptop GPU',
    vendorId: 0x10de,
    deviceId: 0x2d58,
    kind: 'discrete',
    dedicatedMb: 7891,
    sharedMb: 7788,
  },
];

function status(over: Record<string, unknown> = {}) {
  return {
    supported: true,
    adapters: ADAPTERS,
    choice: null,
    choiceName: null,
    startupChoice: null,
    startupApplied: false,
    restartNeeded: false,
    ...over,
  };
}

describe('Settings → graphics card for Gemma (desktop)', () => {
  beforeEach(() => {
    backend.calls = [];
    backend.status = status();
    useGpuStore.setState({ status: null, gemmaInfo: null, reminderHidden: false });
  });

  it('lists the cards with their type and suggests the dedicated one', async () => {
    render(<GpuSettings />);
    expect(await screen.findByText('NVIDIA GeForce RTX 5070 Laptop GPU')).toBeInTheDocument();
    expect(screen.getByText('AMD Radeon(TM) 610M')).toBeInTheDocument();
    expect(screen.getByText('Card tích hợp · dùng chung RAM')).toBeInTheDocument();
    expect(screen.getByText('Card rời · 7,7 GB VRAM')).toBeInTheDocument();
    expect(screen.getByText('Nên dùng cho Gemma')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Tự động/ })).toBeChecked();
  });

  it('choosing a card saves it and asks for a restart, here and app-wide', async () => {
    const user = userEvent.setup();
    render(
      <>
        <GpuSettings />
        <GpuRestartReminder />
      </>,
    );
    await user.click(await screen.findByRole('radio', { name: /NVIDIA GeForce RTX 5070/ }));
    await waitFor(() => {
      expect(backend.calls).toContainEqual({
        cmd: 'gpu_set_choice',
        args: { id: '10de:2d58:10741043' },
      });
    });
    const notices = await screen.findAllByText(/Cần mở lại ứng dụng để dùng card mới/);
    expect(notices).toHaveLength(2); // Settings + the reminder above the status bar
    await user.click(screen.getAllByRole('button', { name: 'Mở lại ngay' })[0]!);
    expect(backend.calls.some((c) => c.cmd === 'app_restart')).toBe(true);
  });

  it('"Để sau" hides the app-wide reminder; Settings keeps telling the truth', async () => {
    const user = userEvent.setup();
    backend.status = status({ choice: '10de:2d58:10741043', restartNeeded: true });
    render(
      <>
        <GpuSettings />
        <GpuRestartReminder />
      </>,
    );
    expect(await screen.findAllByText(/Cần mở lại ứng dụng/)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Để sau' }));
    expect(screen.getAllByText(/Cần mở lại ứng dụng/)).toHaveLength(1);
  });

  it('explains a chosen card that was missing at start-up (e.g. turned off)', async () => {
    backend.status = status({
      choice: '10de:2d58:10741043',
      choiceName: 'NVIDIA GeForce RTX 5070 Laptop GPU',
      startupChoice: '10de:2d58:10741043',
      startupApplied: false,
      adapters: ADAPTERS.slice(0, 1),
    });
    render(<GpuSettings />);
    expect(
      await screen.findByText(/không thấy card đã chọn \(NVIDIA GeForce RTX 5070 Laptop GPU\)/),
    ).toBeInTheDocument();
  });

  it('warns when WebGPU runs on another card than the one requested', async () => {
    backend.status = status({
      choice: '10de:2d58:10741043',
      startupChoice: '10de:2d58:10741043',
      startupApplied: true,
    });
    useGpuStore.setState({ gemmaInfo: { vendor: 'amd', architecture: 'rdna-2' } });
    render(<GpuSettings />);
    expect(
      await screen.findByText(
        /đã yêu cầu NVIDIA GeForce RTX 5070 Laptop GPU nhưng WebGPU đang chạy trên AMD Radeon\(TM\) 610M/,
      ),
    ).toBeInTheDocument();
  });
});
