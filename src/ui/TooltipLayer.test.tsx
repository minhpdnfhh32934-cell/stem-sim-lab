import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipLayer } from './TooltipLayer';

describe('TooltipLayer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it('WCAG 1.4.13: the pointer may rest on the bubble or cross the gap; leaving it hides it', () => {
    vi.useFakeTimers();
    // jsdom lays nothing out: the bubble sits at x 100–200, y 50–70.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('role') === 'tooltip'
        ? DOMRect.fromRect({ x: 100, y: 50, width: 100, height: 20 })
        : DOMRect.fromRect();
    });
    render(
      <>
        <TooltipLayer />
        <button type="button" data-tip="Đặt lại (R)" aria-label="Đặt lại" />
        <button type="button" data-tip="Bước" aria-label="Bước" />
        <p>Chỗ khác</p>
      </>,
    );
    const tipOpen = () => screen.queryByRole('tooltip', { hidden: true });
    const wait = (ms: number) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };
    const elsewhere = screen.getByText('Chỗ khác');
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Đặt lại' }));
    wait(400);
    expect(tipOpen()).toHaveTextContent('Đặt lại (R)');
    // Crossing the 8 px gap, then resting on the bubble (the page under it gets the events).
    fireEvent.pointerOver(elsewhere, { clientX: 150, clientY: 76 });
    fireEvent.pointerMove(elsewhere, { clientX: 150, clientY: 60 });
    // Another control under the bubble does not take over while the pointer is on the bubble.
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Bước' }), {
      clientX: 160,
      clientY: 60,
    });
    wait(1000);
    expect(tipOpen()).toHaveTextContent('Đặt lại (R)');
    // Leaving the bubble hides it.
    fireEvent.pointerMove(elsewhere, { clientX: 400, clientY: 300 });
    expect(tipOpen()).toBeNull();
  });

  it('Esc hides a shown bubble and stops there; the next Esc reaches the drawer or dialog', () => {
    vi.useFakeTimers();
    const drawerEsc = vi.fn();
    render(
      <>
        <TooltipLayer />
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape') drawerEsc();
          }}
        >
          <button type="button" data-tip="Đóng sổ" aria-label="Đóng sổ" />
        </div>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Đóng sổ' });
    fireEvent.pointerOver(button);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip', { hidden: true })).toBeInTheDocument();
    const first = fireEvent.keyDown(button, { key: 'Escape' });
    expect(first).toBe(false); // default prevented: a dialog does not close either
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    expect(drawerEsc).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(drawerEsc).toHaveBeenCalledTimes(1);
  });

  it("moving straight from one control to the next shows the next one's tip", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('role') === 'tooltip'
        ? DOMRect.fromRect({ x: 100, y: 50, width: 100, height: 20 })
        : DOMRect.fromRect();
    });
    render(
      <>
        <TooltipLayer />
        <button type="button" data-tip="Hoàn tác" aria-label="Hoàn tác" />
        <button type="button" data-tip="Làm lại" aria-label="Làm lại" />
      </>,
    );
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Hoàn tác' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    // A browser sends pointerover, then pointermove, on the new control (away from the bubble).
    const redo = screen.getByRole('button', { name: 'Làm lại' });
    fireEvent.pointerOver(redo, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(redo, { clientX: 400, clientY: 300 });
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Làm lại');
  });

  it('Esc with a bubble shown by focus hides it and still reaches the dialog', () => {
    const dialogEsc = vi.fn();
    render(
      <>
        <TooltipLayer />
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape') dialogEsc();
          }}
        >
          <button type="button" data-tip="Đóng" aria-label="Đóng" />
        </div>
      </>,
    );
    const close = screen.getByRole('button', { name: 'Đóng' });
    // A dialog opened from the keyboard focuses its X: :focus-visible (jsdom has none).
    vi.spyOn(close, 'matches').mockReturnValue(true);
    act(() => {
      close.focus();
    });
    expect(screen.getByRole('tooltip', { hidden: true })).toBeInTheDocument();
    const notPrevented = fireEvent.keyDown(close, { key: 'Escape' });
    expect(notPrevented).toBe(true);
    expect(dialogEsc).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
  });
});
