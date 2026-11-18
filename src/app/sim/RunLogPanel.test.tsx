import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { fmtQty } from '@/physics/common/tex';
import { loadScene } from '@/physics/registry';
import { RunLogPanel } from './RunLogPanel';
import { runEntry, useRunLog } from './runLog';
import { useSimStore } from './simStore';

afterEach(() => {
  useRunLog.setState({ rows: {} });
  useSimStore.setState({ scene: null, params: {}, sources: {} });
});

describe('Sổ ghi tab (#195 step 4)', () => {
  it('lists the runs newest first with their answers; "Xóa sổ" empties it', async () => {
    useSettingsStore.setState({ locale: 'vi' });
    const scene = await loadScene('obliqueProjectile');
    const params = { ...scene.defaults, g: 9.8 };
    useSimStore.setState({ scene, params });
    render(<RunLogPanel />);
    expect(screen.getByText(/Chưa có lần chạy nào/)).toBeInTheDocument();

    const first = runEntry(scene, params, {}, false, 'vi', Date.UTC(2026, 10, 18, 3, 0, 0));
    const second = runEntry(
      scene,
      { ...params, v0: 20 },
      { v0: 'user' },
      true,
      'vi',
      Date.UTC(2026, 10, 18, 3, 1, 0),
    );
    useRunLog.getState().add(scene.id, first);
    useRunLog.getState().add(scene.id, second);
    const rows = await screen.findAllByRole('row');
    // Header, then run 2 (intervened, v0 changed), then run 1 (defaults, exact answers).
    expect(within(rows[1] as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('Đã can thiệp')).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText(fmtQty('vi', 20, 'm/s', 4)),
    ).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('Mặc định')).toBeInTheDocument();
    const a = first.answers?.[0];
    if (!a) throw new Error('no answer');
    expect(
      within(rows[2] as HTMLElement).getByText(fmtQty('vi', a.value, a.unit, 4)),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa sổ' }));
    expect(screen.getByText(/Chưa có lần chạy nào/)).toBeInTheDocument();
  });
});
