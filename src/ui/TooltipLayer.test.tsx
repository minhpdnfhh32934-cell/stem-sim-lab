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
});
