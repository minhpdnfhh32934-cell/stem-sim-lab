import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useSafetyStore } from '@/safety/safetyStore';
import { BenchLanding } from './Landing';

const status = { termsVersion: 1, answered: true, aiAllowed: true, minor: false };

afterEach(() => {
  act(() => {
    useProfileStore.setState({ lastTopic: null });
    useSafetyStore.setState({ status: null });
  });
});

describe('"Cửa vào" (docs/BENCH_DESIGN.md §9.1)', () => {
  it('two doors under the title; no resume button on a first visit', () => {
    act(() => {
      useSafetyStore.setState({ status });
    });
    render(<BenchLanding />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Chào mừng đến với SimLab' }),
    ).toHaveAttribute('id', 'launch-title');
    expect(screen.getByRole('button', { name: /Virtual Lab/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI Teacher là một AI nên có thể sai/ })).toHaveClass(
      'launch-card--teacher',
    );
    expect(screen.queryByRole('button', { name: /Tiếp tục/ })).toBeNull();
  });

  it('a returning learner gets "Tiếp tục: <topic> (<subject>)"', () => {
    act(() => {
      useProfileStore.setState({ lastTopic: 'obliqueProjectile' });
    });
    render(<BenchLanding />);
    expect(screen.getByRole('button', { name: 'Tiếp tục: Ném xiên (Vật lý)' })).toBeInTheDocument();
  });

  it('under 18 the AI Teacher door is a locked card, not a button', () => {
    act(() => {
      useSafetyStore.setState({ status: { ...status, aiAllowed: false, minor: true } });
    });
    render(<BenchLanding />);
    expect(screen.getByText('AI Teacher cần bạn đủ 18 tuổi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /AI Teacher/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
