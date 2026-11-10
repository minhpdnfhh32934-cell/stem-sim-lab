import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSafetyStore } from '@/safety/safetyStore';
import { Notebook } from './Notebook';
import { BenchContext } from './shellMode';

const status = { termsVersion: 1, answered: true, aiAllowed: false, minor: true };

afterEach(() => {
  act(() => {
    useSafetyStore.setState({ status: null });
    useLayoutStore.getState().setNotebookOpen(false);
  });
});

describe('"Hỏi AI" under 18 (docs/BENCH_DESIGN.md §9.10)', () => {
  it('the tab is a lock and one explanation: no chat, no question box', () => {
    act(() => {
      useSafetyStore.setState({ status });
    });
    render(
      <BenchContext.Provider value={true}>
        <Notebook push={false} pinnedOnly />
      </BenchContext.Provider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Hỏi AI' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('AI Teacher cần bạn đủ 18 tuổi');
    expect(screen.queryByRole('textbox', { name: 'Nhập câu hỏi' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Trò chuyện với AI Teacher' })).toBeNull();
  });
});
