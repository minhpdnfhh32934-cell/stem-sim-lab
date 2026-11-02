import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipLayer } from './TooltipLayer';

describe('TooltipLayer', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  });

  it('joins the top layer, so a tooltip inside a modal dialog is drawn above it', () => {
    vi.useFakeTimers();
    // jsdom has no popover API: record the call a browser would make.
    const shown: Element[] = [];
    Object.defineProperty(HTMLElement.prototype, 'showPopover', {
      configurable: true,
      value(this: HTMLElement) {
        shown.push(this);
      },
    });
    render(
      <>
        <TooltipLayer />
        <dialog open>
          <button type="button" data-tip="Đóng" aria-label="Đóng" />
        </dialog>
      </>,
    );
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Đóng', hidden: true }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    // `hidden`: jsdom styles a popover that never really opened as display: none.
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).toHaveTextContent('Đóng');
    expect(tip).toHaveAttribute('popover', 'manual');
    expect(shown).toEqual([tip]);
  });

  it('WCAG 1.4.13: the pointer can move onto the bubble, Esc hides it, leaving it hides it', () => {
    vi.useFakeTimers();
    render(
      <>
        <TooltipLayer />
        <button type="button" data-tip="Đặt lại (R)" aria-label="Đặt lại" />
        <p>Chỗ khác</p>
      </>,
    );
    const tipOpen = () => screen.queryByRole('tooltip', { hidden: true });
    const wait = (ms: number) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Đặt lại' }));
    wait(400);
    const tip = tipOpen();
    // Shown by hover: the bubble takes the pointer (ui.css), so it can be hovered.
    expect(tip).toHaveAttribute('data-hover');
    // Crossing the gap, then resting on the bubble: it stays.
    fireEvent.pointerOver(screen.getByText('Chỗ khác'));
    wait(50);
    fireEvent.pointerOver(tip as HTMLElement);
    wait(1000);
    expect(tipOpen()).not.toBeNull();
    // Esc dismisses it without moving the pointer or the focus.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(tipOpen()).toBeNull();
    // Shown again, then the pointer leaves for good: gone after the short grace.
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Đặt lại' }));
    wait(400);
    fireEvent.pointerOver(screen.getByText('Chỗ khác'));
    wait(100);
    expect(tipOpen()).not.toBeNull();
    wait(100);
    expect(tipOpen()).toBeNull();
  });

  it('a bubble shown by keyboard focus never takes the pointer', () => {
    render(
      <>
        <TooltipLayer />
        <button type="button" data-tip="Bước tiếp theo (.)" aria-label="Bước" />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Bước' });
    // jsdom has no :focus-visible; a keyboard focus matches it in a browser.
    const matches = vi.spyOn(button, 'matches').mockReturnValue(true);
    act(() => {
      button.focus();
    });
    expect(screen.getByRole('tooltip', { hidden: true })).not.toHaveAttribute('data-hover');
    matches.mockRestore();
  });
});
