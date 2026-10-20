import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * KaTeX is a lazy chunk: when it cannot be fetched (offline update, a broken install) the board
 * must still start its lesson, and a later lesson must try to load it again (0.7 fix).
 */
const chunk = vi.hoisted(() => ({ fail: true, loads: 0 }));

vi.mock('katex', () => {
  chunk.loads++;
  if (chunk.fail) throw new Error('Failed to fetch dynamically imported module');
  return { default: { renderToString: () => '<span>x</span>' } };
});
vi.mock('katex/dist/katex.min.css', () => ({}));

afterEach(() => {
  vi.resetModules();
  chunk.fail = true;
  chunk.loads = 0;
});

describe('KaTeX that cannot load (0.7 fix)', () => {
  it('the board still prepares its measures, with the fallback formula size', async () => {
    const { prepareMeasure, browserMeasure } = await import('./measure');
    await expect(prepareMeasure()).resolves.toBeUndefined();
    expect(browserMeasure.math('a = \\frac{F}{m}', 20)).toEqual({ w: 15 * 20 * 0.5, h: 20 * 1.4 });
  });

  it('a failed load is not kept: the next call loads KaTeX again', async () => {
    const { loadKatex } = await import('@/science-card/katex');
    await expect(loadKatex()).rejects.toThrow();
    chunk.fail = false;
    vi.resetModules();
    // The same module instance (no reset of its own cache) must retry.
    const k = await loadKatex().catch(() => null);
    expect(k).not.toBeNull();
  });
});
