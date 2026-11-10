import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BenchContext } from '@/app/bench/shellMode';
import { usePerfStore } from '@/perf/perfStore';
import { No3dNotice } from './No3dNotice';

afterEach(() => {
  act(() => {
    usePerfStore.setState({ degraded: false });
  });
});

describe('the 2D notice (docs/BENCH_DESIGN.md §9.6)', () => {
  it('on the bench, after an overload: "Thử lại 3D" forgets the overload', () => {
    act(() => {
      usePerfStore.setState({ degraded: true, preference: 'medium' });
    });
    render(
      <BenchContext.Provider value={true}>
        <No3dNotice text="Máy đang chạy chậm" />
      </BenchContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại 3D' }));
    expect(usePerfStore.getState().degraded).toBe(false);
  });

  it('the classic shell keeps the plain notice; nothing to retry without an overload', () => {
    act(() => {
      usePerfStore.setState({ degraded: true, preference: 'medium' });
    });
    const { unmount } = render(<No3dNotice text="Máy đang chạy chậm" />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    act(() => {
      usePerfStore.setState({ degraded: false });
    });
    render(
      <BenchContext.Provider value={true}>
        <No3dNotice text="Máy này chưa vẽ được 3D" />
      </BenchContext.Provider>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
