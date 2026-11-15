import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(() => {
  localStorage.removeItem('stemsim.dev.shell');
});

describe('the classic window is the only shell (#263)', () => {
  it('the app opens the classic window, whatever the old dev switch says', () => {
    localStorage.setItem('stemsim.dev.shell', 'bench');
    const { container } = render(<App />);
    expect(container.querySelector('.shell')).not.toBeNull();
    expect(container.querySelector('.bench-header')).toBeNull();
    expect(document.documentElement.dataset.shell).toBeUndefined();
  });

  it('no build mode or flag decides the shell, so a release build shows the same window', () => {
    const src = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');
    expect(src).toContain('<AppShell />');
    expect(src).not.toContain('BenchShell');
    expect(src).not.toMatch(/import\.meta\.env/);
  });
});
