import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModuleStore } from '@/modules/moduleStore';
import { usePerfStore } from '@/perf/perfStore';
import { Stage } from './Stage';

afterEach(() => {
  act(() => {
    usePerfStore.setState({ timeScale: 1, degraded: false });
    useModuleStore.setState({ active: null, loading: false, error: null });
  });
});

describe('the overload ladder is never silent on the bench (B8)', () => {
  it('slow motion and a lower display quality are said on the stage', () => {
    act(() => {
      useModuleStore.setState({
        active: { id: 'test', view: { title: { vi: 'T', en: 'T' }, Stage: () => <p>stage</p> } },
        loading: false,
        error: null,
      });
    });
    const { rerender } = render(<Stage />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => {
      usePerfStore.setState({ timeScale: 0.5, degraded: true });
    });
    rerender(<Stage />);
    const notes = screen.getByRole('status');
    expect(notes).toHaveTextContent('Chuyển động chậm ×0,5 để giữ độ chính xác');
    expect(notes).toHaveTextContent('Đã hạ chất lượng hiển thị để giữ độ mượt (số liệu không đổi)');
  });
});
