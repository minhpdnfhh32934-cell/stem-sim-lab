import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The desktop card list (src-tauri/src/gpu.rs) is replaced by a spy: no real GPU is touched.
vi.mock('@/ai/gpu', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/gpu')>();
  return { ...real, loadGpuStatus: vi.fn(() => Promise.resolve(null)) };
});

const { App } = await import('@/app/App');
const { loadGpuStatus } = await import('@/ai/gpu');

describe('app start-up (audit GPU-01)', () => {
  it('reads the graphics cards once, before any question reaches Gemma', () => {
    render(<App />);
    expect(loadGpuStatus).toHaveBeenCalledTimes(1);
  });
});
