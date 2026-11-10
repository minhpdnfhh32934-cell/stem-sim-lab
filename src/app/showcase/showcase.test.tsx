import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { SHOWCASE, startShowcase, stopShowcase, useShowcase } from './showcase';
import { ShowcaseOverlay } from './ShowcaseOverlay';

const opened: string[] = [];
vi.mock('@/app/topics', () => ({
  openTopic: (id: string) => {
    opened.push(id);
    return Promise.resolve();
  },
}));
// No physics run in this test: the scenes are only opened.
vi.mock('@/physics/registry', () => ({ hasScene: () => false }));

beforeEach(() => {
  vi.useFakeTimers();
  opened.length = 0;
});
afterEach(() => {
  act(() => {
    stopShowcase();
  });
  vi.useRealTimers();
});

describe('showcase mode (#54 item 13)', () => {
  it('plays the scenes in turn in presentation mode, each for its own time', async () => {
    await act(async () => {
      startShowcase();
      await Promise.resolve();
    });
    expect(useLayoutStore.getState().presentation).toBe(true);
    expect(opened).toEqual([SHOWCASE[0]?.topic]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync((SHOWCASE[0]?.seconds ?? 0) * 1000);
    });
    expect(useShowcase.getState().index).toBe(1);
    expect(opened).toEqual([SHOWCASE[0]?.topic, SHOWCASE[1]?.topic]);
    for (const s of SHOWCASE) {
      expect(s.seconds).toBeGreaterThanOrEqual(30);
      expect(s.seconds).toBeLessThanOrEqual(60);
      // Words only: a caption never brings a number of its own ("3D" is a topic's name).
      expect(s.caption.vi.replace(/3D/g, '')).not.toMatch(/\d/);
    }
  });

  it('shows the caption; any press stops it and leaves presentation mode', async () => {
    render(<ShowcaseOverlay />);
    await act(async () => {
      startShowcase();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent(`1/${String(SHOWCASE.length)}`);
    expect(screen.getByRole('status')).toHaveTextContent('Bấm bất kì đâu');
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(useShowcase.getState().index).toBeNull();
    expect(useLayoutStore.getState().presentation).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    // Nothing more opens once stopped.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(opened).toHaveLength(1);
  });

  it('leaving presentation mode (Esc, its button) stops it too', async () => {
    render(<ShowcaseOverlay />);
    await act(async () => {
      startShowcase();
      await Promise.resolve();
    });
    act(() => {
      useLayoutStore.getState().setPresentation(false);
    });
    expect(useShowcase.getState().index).toBeNull();
  });
});
