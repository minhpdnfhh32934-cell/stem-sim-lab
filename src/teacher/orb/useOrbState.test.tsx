import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '@/teacher/chat/chatStore';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { BOOT_MS, DONE_MS, useOrbState } from './useOrbState';

beforeEach(() => {
  vi.useFakeTimers();
  useChatStore.setState({ answering: false });
  useVoiceStore.setState({ speaking: false });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useOrbState (#234)', () => {
  it('boots on the first open, then waits', () => {
    const { result } = renderHook(() => useOrbState(false));
    expect(result.current).toBe('boot');
    act(() => {
      vi.advanceTimersByTime(BOOT_MS);
    });
    expect(result.current).toBe('idle');
  });

  it('an answer on its way thinks, a voice speaks, a finished answer is done for a while', () => {
    const { result } = renderHook(() => useOrbState(false));
    act(() => {
      vi.advanceTimersByTime(BOOT_MS);
      useChatStore.setState({ answering: true });
    });
    expect(result.current).toBe('thinking');
    act(() => {
      useVoiceStore.setState({ speaking: true });
    });
    expect(result.current).toBe('speaking');
    act(() => {
      useVoiceStore.setState({ speaking: false });
      useChatStore.setState({ answering: false });
    });
    expect(result.current).toBe('done');
    act(() => {
      vi.advanceTimersByTime(DONE_MS);
    });
    expect(result.current).toBe('idle');
  });

  it('a question being typed listens; sending it thinks, then done, never back to listening', () => {
    const { result, rerender } = renderHook(({ typing }) => useOrbState(typing), {
      initialProps: { typing: false },
    });
    act(() => {
      vi.advanceTimersByTime(BOOT_MS);
    });
    expect(result.current).toBe('idle');
    rerender({ typing: true });
    expect(result.current).toBe('listening');
    // Sent: the answer is on its way (the panel reports the emptied box at the same time).
    act(() => {
      useChatStore.setState({ answering: true });
    });
    rerender({ typing: false });
    expect(result.current).toBe('thinking');
    act(() => {
      useChatStore.setState({ answering: false });
    });
    expect(result.current).toBe('done');
  });
});
