import { render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(() => {
  localStorage.removeItem('stemsim.dev.shell');
});

describe('the bench is the only shell (B8, #193)', () => {
  it('the app opens "Bàn thí nghiệm", whatever the old dev switch says', async () => {
    localStorage.setItem('stemsim.dev.shell', 'classic');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(document.documentElement.dataset.shell).toBe('bench');
    });
    expect(container.querySelector('.shell')).toBeNull();
  });

  it('no build mode or flag decides the shell, so a release build shows the bench too', () => {
    const src = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');
    expect(src).toContain('<BenchShell />');
    expect(src).not.toMatch(/import\.meta\.env/);
  });
});
