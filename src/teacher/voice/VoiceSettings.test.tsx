import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from './voiceStore';

// A speech counter like speak.ts's: every new speech or stop makes a new id.
const voice = vi.hoisted(() => ({ id: 0, pending: [] as (() => void)[] }));

vi.mock('./speak', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./speak')>()),
  speak: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        voice.id++;
        voice.pending.push(resolve);
      }),
  ),
  stopSpeaking: vi.fn(() => {
    voice.id++;
  }),
  speechId: () => voice.id,
}));

vi.mock('@/teacher/board/lesson', () => ({ pauseLesson: vi.fn() }));

vi.mock('./localVoice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./localVoice')>()),
  localVoiceStatus: vi.fn(() => new Promise(() => undefined)),
}));

const { speak, stopSpeaking } = await import('./speak');
const { pauseLesson } = await import('@/teacher/board/lesson');
const { VoiceSettings } = await import('./VoiceSettings');

beforeEach(() => {
  voice.id = 0;
  voice.pending = [];
  vi.mocked(speak).mockClear();
  vi.mocked(stopSpeaking).mockClear();
  vi.mocked(pauseLesson).mockClear();
  useVoiceStore.getState().setSpeaking(false);
});

afterEach(() => {
  cleanup();
});

const previewButton = () => screen.getByRole('button', { name: /nghe thử|preview/i });

describe('Settings → Giọng nói: the preview stops only itself (0.7 fix)', () => {
  it('closing Settings while a lesson is read never stops the lesson', () => {
    const view = render(<VoiceSettings />);
    // A board lesson is reading a sentence meanwhile.
    void speak('Câu của bài giảng.');
    act(() => {
      useVoiceStore.getState().setSpeaking(true);
    });
    view.unmount();
    expect(stopSpeaking).not.toHaveBeenCalled();
  });

  it('closing Settings stops the preview it started', () => {
    const view = render(<VoiceSettings />);
    fireEvent.click(previewButton());
    expect(speak).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
  });

  it('a speech started after the preview is not stopped on closing', () => {
    const view = render(<VoiceSettings />);
    fireEvent.click(previewButton());
    void speak('Câu trả lời trong khung chat.');
    view.unmount();
    expect(stopSpeaking).not.toHaveBeenCalled();
  });

  it('a lesson being read is paused before the preview, so its sentence is read again', () => {
    useVoiceStore.getState().setSpeaking(true);
    render(<VoiceSettings />);
    fireEvent.click(previewButton());
    expect(pauseLesson).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
