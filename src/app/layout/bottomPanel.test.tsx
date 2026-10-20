import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModuleView } from '@/modules/types';

// The desktop card list (src-tauri/src/gpu.rs) is replaced by a stub: no real GPU is touched.
vi.mock('@/ai/gpu', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gpu')>();
  return { ...real, loadGpuStatus: vi.fn(() => Promise.resolve(null)) };
});

const { App } = await import('@/app/App');
const { useModuleStore } = await import('@/modules/moduleStore');
const { useNavigationStore } = await import('@/app/navigationStore');

const L = (s: string) => ({ vi: s, en: s });
const Stage = () => <p>stage</p>;

function open(view: ModuleView) {
  act(() => {
    useNavigationStore.getState().setScreen('lab');
    useModuleStore.setState({ active: { id: 'test', view }, loading: false, error: null });
  });
}

afterEach(() => {
  act(() => {
    useModuleStore.setState({ active: null, loading: false, error: null });
  });
});

describe('bottom panel of a topic', () => {
  it('is not shown for a topic without a table or chart (no empty box)', () => {
    render(<App />);
    open({ title: L('Mendel'), Stage });
    expect(screen.getByText('stage')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bảng đồ thị và lời giải' })).toBeNull();
    expect(screen.queryByText('Chủ đề này không có bảng phụ.')).toBeNull();
  });

  it('is shown when the topic has one', () => {
    render(<App />);
    open({ title: L('Logistic'), Stage, Bottom: () => <p>chart</p> });
    expect(screen.getByRole('region', { name: 'Bảng đồ thị và lời giải' })).toBeInTheDocument();
    expect(screen.getByText('chart')).toBeInTheDocument();
  });
});
