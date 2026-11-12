import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '@/ui/toast';
import { useLoaded, type Loaded } from './useLoaded';

const Dialog = () => null;

afterEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('useLoaded (#205: a dialog loaded by hand on first use)', () => {
  it('loads once asked, keeps the code for the next opens', async () => {
    const slot: Loaded = { Component: null };
    const load = vi.fn(() => Promise.resolve(Dialog));
    const reset = vi.fn();
    const { result, rerender } = renderHook(
      ({ when }) => useLoaded(slot, when, load, 'Mình chưa mở được', reset),
      { initialProps: { when: false } },
    );
    expect(result.current).toBe(false);
    expect(load).not.toHaveBeenCalled();
    rerender({ when: true });
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(slot.Component).toBe(Dialog);
    rerender({ when: false });
    rerender({ when: true });
    expect(load).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it('a failed load says so, withdraws the request, and the next open tries again', async () => {
    const slot: Loaded = { Component: null };
    const load = vi
      .fn<() => Promise<typeof Dialog>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce(Dialog);
    let when = true;
    const reset = vi.fn(() => {
      when = false;
    });
    const { result, rerender } = renderHook(() =>
      useLoaded(slot, when, load, 'Mình chưa mở được phần này. Em thử mở lại nhé.', reset),
    );
    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(1);
    });
    expect(result.current).toBe(false);
    expect(slot.Component).toBeNull();
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        text: 'Mình chưa mở được phần này. Em thử mở lại nhé.',
      }),
    ]);
    // The learner opens it again: a second try, which works.
    act(() => {
      rerender();
    });
    when = true;
    rerender();
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(slot.Component).toBe(Dialog);
  });
});
