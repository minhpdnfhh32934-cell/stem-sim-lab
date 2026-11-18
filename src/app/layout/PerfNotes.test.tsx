import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePerfStore } from '@/perf/perfStore';
import { PerfNotes } from './PerfNotes';
import { StatusBar } from './StatusBar';

afterEach(() => {
  act(() => {
    usePerfStore.setState({ timeScale: 1, degraded: false });
  });
});

describe('the overload ladder is never silent', () => {
  it('the classic status bar says slow motion and a lower display quality (#263)', () => {
    render(<StatusBar />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => {
      usePerfStore.setState({ timeScale: 0.5, degraded: true });
    });
    expect(screen.getAllByRole('status').map((note) => note.textContent)).toEqual([
      'Chuyển động chậm ×0,5 để giữ độ chính xác',
      'Đã hạ chất lượng hiển thị để giữ độ mượt (số liệu không đổi)',
    ]);
  });

  // Presentation mode hides the status bar; these notices say the same over the stage.
  it('PerfNotes: chips with the factor, and a live line without it', () => {
    const { rerender } = render(<PerfNotes className="stage__notes" />);
    // The live line is there before any notice, so the first one is read out.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(document.querySelector('.stage__notes')).toBeNull();
    act(() => {
      usePerfStore.setState({ timeScale: 0.5, degraded: true });
    });
    rerender(<PerfNotes className="stage__notes" />);
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent(
      'Chuyển động chậm hơn thời gian thực để giữ độ chính xác. Đã hạ chất lượng hiển thị để giữ độ mượt (số liệu không đổi)',
    );
    // The chips show the factor; the live line has none, so a new factor is not read out again.
    expect(screen.getByText('Chuyển động chậm ×0,5 để giữ độ chính xác')).toBeInTheDocument();
    const said = live.textContent;
    act(() => {
      usePerfStore.setState({ timeScale: 0.43 });
    });
    rerender(<PerfNotes className="stage__notes" />);
    expect(screen.getByText('Chuyển động chậm ×0,43 để giữ độ chính xác')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe(said);
  });
});
