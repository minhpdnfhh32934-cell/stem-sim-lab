import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { benchShellOn, DEV_SHELL_KEY } from './shellMode';

const store = (value: string | null) => ({
  getItem: (k: string) => (k === DEV_SHELL_KEY ? value : null),
});

describe('bench dev switch', () => {
  it('a development build shows the bench only for the exact key value', () => {
    expect(benchShellOn(true, store('bench'))).toBe(true);
    expect(benchShellOn(true, store('classic'))).toBe(false);
    expect(benchShellOn(true, store(null))).toBe(false);
  });

  it('a production build ignores the key', () => {
    expect(benchShellOn(false, store('bench'))).toBe(false);
  });

  it('storage that throws (blocked site data) keeps the classic shell', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(benchShellOn(true, broken)).toBe(false);
  });

  it('the default reads import.meta.env.DEV, which Vite sets to false in a production build', () => {
    const src = readFileSync(resolve(__dirname, 'shellMode.ts'), 'utf8');
    expect(src).toContain('dev: boolean = import.meta.env.DEV');
    expect(src).not.toMatch(/import.meta.env.VITE_/);
  });
});
