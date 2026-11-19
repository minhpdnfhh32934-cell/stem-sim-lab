import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh module each time: the opening plays once per start of the app. */
async function loadIntro() {
  vi.resetModules();
  return import('./Intro');
}

const overlay = () => document.querySelector('.fx-intro');

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('MODE', 'development');
  Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.motion;
  document.querySelectorAll('dialog').forEach((d) => {
    d.remove();
  });
});

describe('the opening (Intro)', () => {
  it('never in unit tests or automated browsers', async () => {
    vi.stubEnv('MODE', 'test');
    const { Intro } = await loadIntro();
    render(<Intro />);
    expect(overlay()).toBeNull();
  });

  it('plays once: the name letter by letter, hidden from screen readers, then fades away', async () => {
    const { Intro, PLAY_MS } = await loadIntro();
    const first = render(<Intro />);
    expect(overlay()?.getAttribute('aria-hidden')).toBe('true');
    expect(overlay()?.querySelectorAll('.fx-intro__word > span')).toHaveLength('SimLab'.length);
    // The launch page's reveal waits for it.
    expect(document.documentElement.dataset.intro).toBe('on');
    act(() => {
      vi.advanceTimersByTime(PLAY_MS);
    });
    expect(overlay()?.classList.contains('is-leaving')).toBe(true);
    expect(document.documentElement.dataset.intro).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(overlay()).toBeNull();
    first.unmount();
    // Back on the launch page later: not again.
    render(<Intro />);
    expect(overlay()).toBeNull();
  });

  it('a key or a press skips it', async () => {
    const { Intro } = await loadIntro();
    render(<Intro />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(overlay()?.classList.contains('is-leaving')).toBe(true);
  });

  it('gives way to a dialog at start (first run, an update)', async () => {
    const { Intro } = await loadIntro();
    render(<Intro />);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(overlay()?.classList.contains('is-leaving')).toBe(true);
  });

  it('with reduced motion: a short still', async () => {
    document.documentElement.dataset.motion = 'reduce';
    const { Intro, PLAY_MS_STILL } = await loadIntro();
    render(<Intro />);
    act(() => {
      vi.advanceTimersByTime(PLAY_MS_STILL);
    });
    expect(overlay()?.classList.contains('is-leaving')).toBe(true);
  });
});
