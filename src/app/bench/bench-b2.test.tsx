import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { usePoeRun } from '@/learn/poeRun';
import { freeFall } from '@/physics/projectile/scenes';
import type { ScienceCardData } from '@/science-card/types';
import { DriverGrid } from './DriverGrid';
import { ScienceSummary } from './ScienceSummary';
import { ToolSwitches } from './ToolSwitches';

const card = (userIntervened: boolean): ScienceCardData => ({
  title: { vi: 'Rơi tự do', en: 'Free fall' },
  model: { vi: 'Chất điểm', en: 'Point mass' },
  equations: [],
  assumptions: [],
  validity: { vi: 'Bỏ qua sức cản không khí.', en: 'No air resistance.' },
  confidence: 'exact',
  userIntervened,
  sources: [],
});

afterEach(() => {
  act(() => {
    useWorkspaceStore.setState({ scienceCard: null, hasSimulation: false, activeTool: 'select' });
    useSimStore.setState({ scene: null, vectors: false, stopwatch: false, trail: false });
    usePoeRun.setState({ run: null });
    useLayoutStore.setState({ notebookOpen: false, notebookTabBySubject: {}, challengeSeen: [] });
    useSettingsStore.getState().setUiMode('basic');
  });
});

describe('bench B2 (docs/BENCH_DESIGN.md §9.4)', () => {
  it('the tray summary: confidence, model, validity; "Xem thẻ" opens the whole card', () => {
    act(() => {
      useWorkspaceStore.setState({ scienceCard: card(false), subject: 'physics' });
    });
    render(<ScienceSummary />);
    expect(screen.getByText('Rơi tự do')).toBeInTheDocument();
    expect(screen.getByText('Bỏ qua sức cản không khí.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xem thẻ' }));
    expect(useLayoutStore.getState().notebookOpen).toBe(true);
    expect(useLayoutStore.getState().notebookTabBySubject.physics).toBe('science');
  });

  it('after an intervention the summary says so and offers the reset', () => {
    act(() => {
      useWorkspaceStore.setState({ scienceCard: card(true) });
      useSimStore.setState({ scene: freeFall });
    });
    render(<ScienceSummary />);
    expect(screen.getByRole('status')).toHaveTextContent('Đã có can thiệp');
    expect(
      screen.getByRole('button', { name: 'Đặt lại để về kết quả chính xác' }),
    ).toBeInTheDocument();
  });

  it('"Dụng cụ đo": switches with the tool names; Basic shows the ruler and the vectors', () => {
    act(() => {
      useWorkspaceStore.setState({ hasSimulation: true });
    });
    render(<ToolSwitches />);
    const names = screen.getAllByRole('switch').map((s) => s.textContent);
    expect(names).toHaveLength(2);
    const ruler = screen.getAllByRole('switch')[0];
    const vectors = screen.getAllByRole('switch')[1];
    if (!ruler || !vectors) throw new Error('no switches');
    fireEvent.click(ruler);
    expect(useWorkspaceStore.getState().activeTool).toBe('ruler');
    expect(ruler).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(ruler);
    expect(useWorkspaceStore.getState().activeTool).toBe('select');
    fireEvent.click(vectors);
    expect(useSimStore.getState().vectors).toBe(true);
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
    });
    expect(screen.getAllByRole('switch')).toHaveLength(5);
  });

  it('a locked prediction makes the main action "Chạy để kiểm tra", which runs it once', () => {
    const run = vi.fn();
    act(() => {
      useWorkspaceStore.setState({ hasSimulation: true, playing: false });
      useSimStore.setState({ scene: freeFall, validation: [] });
      usePoeRun.setState({ run });
    });
    render(<DriverGrid />);
    const main = screen.getByRole('button', { name: 'Chạy để kiểm tra' });
    fireEvent.click(main);
    expect(run).toHaveBeenCalledTimes(1);
    expect(usePoeRun.getState().run).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chạy để kiểm tra' })).toBeNull();
  });

  it('D2 pins the run to compare when the scene has a trail', () => {
    act(() => {
      useWorkspaceStore.setState({ hasSimulation: true });
      useSimStore.setState({ scene: freeFall, validation: [] });
    });
    render(<DriverGrid />);
    expect(freeFall.trail).toBeDefined();
    expect(screen.getByRole('button', { name: /Ghim/ })).toBeInTheDocument();
  });

  it('the first visit of a topic lands its notebook on Thử thách; later visits keep the choice', () => {
    const layout = useLayoutStore.getState();
    expect(layout.landOnChallenge('freeFall', 'physics')).toBe(true);
    expect(useLayoutStore.getState().notebookTabBySubject.physics).toBe('challenge');
    useLayoutStore.getState().setNotebookTab('physics', 'graphs');
    expect(useLayoutStore.getState().landOnChallenge('freeFall', 'physics')).toBe(false);
    expect(useLayoutStore.getState().notebookTabBySubject.physics).toBe('graphs');
    // Landing is not opening: the drawer stays closed until the learner opens it (§9.4).
    expect(useLayoutStore.getState().notebookOpen).toBe(false);
  });
});
