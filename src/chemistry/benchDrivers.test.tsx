import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BenchContext } from '@/app/bench/shellMode';
import { PeriodicDriver } from './periodic/PeriodicDriver';
import { selectElement, usePeriodicStore } from './periodic/store';
import { ReactionDriver } from './reaction/ReactionDriver';
import { ReactionStage } from './reaction/ReactionStage';
import { selectReaction, useReactionStore } from './reaction/store';
import { TitrationDriver } from './titration/TitrationDriver';
import { setTitration, useTitrationStore } from './titration/store';

// The mechanism viewer draws with WebGL, which jsdom lacks; the player is what is tested here.
vi.mock('./reaction/MechanismViewer', () => ({ MechanismViewer: () => null }));

afterEach(() => {
  act(() => {
    selectReaction('neutralization');
    setTitration({ vb: 0 });
    selectElement(6);
  });
});

describe('chemistry on the bench edge (docs/BENCH_DESIGN.md §9.5, §9.10)', () => {
  it('the mechanism player: next / previous step, reset, "Bước i/n"', () => {
    act(() => {
      selectReaction('neutralization');
    });
    render(<ReactionDriver />);
    const group = screen.getByRole('group', { name: 'Điều khiển các bước' });
    expect(group).toHaveTextContent('Bước 1/');
    fireEvent.click(screen.getByRole('button', { name: 'Bước sau' }));
    expect(useReactionStore.getState().t).toBe(1);
    expect(group).toHaveTextContent('Bước 2/');
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(useReactionStore.getState().t).toBe(0);
  });

  it('a reaction without a mechanism has nothing to play', () => {
    act(() => {
      selectReaction('h2-o2');
    });
    render(<ReactionDriver />);
    expect(screen.getByRole('button', { name: 'Chạy' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Tiến trình phản ứng' })).toBeDisabled();
  });

  it('the stage leaves its player to the bench edge', () => {
    act(() => {
      selectReaction('neutralization');
    });
    const { unmount } = render(<ReactionStage />);
    expect(screen.getByRole('group', { name: 'Điều khiển cơ chế' })).toBeInTheDocument();
    unmount();
    render(
      <BenchContext.Provider value={true}>
        <ReactionStage />
      </BenchContext.Provider>,
    );
    expect(screen.queryByRole('group', { name: 'Điều khiển cơ chế' })).toBeNull();
  });

  it('titration: D0 adds NaOH (the one filled control), D1 removes it, D3 empties the burette', () => {
    render(<TitrationDriver />);
    const add = screen.getByRole('button', { name: /^Nhỏ thêm .* mL NaOH$/ });
    expect(add).toHaveClass('bench-play');
    fireEvent.click(add);
    fireEvent.click(add);
    const two = useTitrationStore.getState().vb;
    expect(two).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^Rút bớt .* mL NaOH$/ }));
    expect(useTitrationStore.getState().vb).toBeCloseTo(two / 2, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(useTitrationStore.getState().vb).toBe(0);
  });

  it('periodic table: the element stepper reads the data ("26 · Fe · Sắt")', () => {
    act(() => {
      selectElement(26);
    });
    render(<PeriodicDriver />);
    expect(screen.getByText('26 · Fe · Sắt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nguyên tố sau' }));
    expect(usePeriodicStore.getState().selected).toBe(27);
    expect(document.querySelector('.bench-play')).toBeNull();
  });
});
