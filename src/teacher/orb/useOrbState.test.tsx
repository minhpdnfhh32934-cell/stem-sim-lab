import { act, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
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

const noScope = { current: null };

describe('useOrbState (#234)', () => {
  it('boots on the first open, then waits', () => {
    const { result } = renderHook(() => useOrbState(noScope));
    expect(result.current).toBe('boot');
    act(() => {
      vi.advanceTimersByTime(BOOT_MS);
    });
    expect(result.current).toBe('idle');
  });

  it('an answer on its way thinks, a voice speaks, a finished answer is done for a while', () => {
    const { result } = renderHook(() => useOrbState(noScope));
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

  it('a question being typed in the question box listens; an empty or left box does not', () => {
    let state = '';
    function Page() {
      const scope = useRef<HTMLDivElement>(null);
      state = useOrbState(scope);
      return (
        <div ref={scope}>
          <form className="chat-panel__composer">
            <textarea aria-label="q" />
          </form>
          <textarea aria-label="other" />
        </div>
      );
    }
    const view = render(<Page />);
    act(() => {
      vi.advanceTimersByTime(BOOT_MS);
    });
    const box = view.getByLabelText('q') as HTMLTextAreaElement;
    const type = (el: HTMLTextAreaElement, text: string) => {
      act(() => {
        el.focus();
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        vi.runOnlyPendingTimers();
      });
    };
    type(view.getByLabelText('other') as HTMLTextAreaElement, 'x');
    expect(state).toBe('idle');
    type(box, 'Vì sao');
    expect(state).toBe('listening');
    act(() => {
      box.blur();
      vi.runOnlyPendingTimers();
    });
    expect(state).toBe('idle');
    type(box, '   ');
    expect(state).toBe('idle');
    // Sending the question empties the box from code: thinking, never back to listening.
    type(box, 'Vì sao trời xanh?');
    act(() => {
      useChatStore.setState({ answering: true });
      useChatStore.setState({ answering: false });
    });
    expect(state).toBe('done');
  });
});
