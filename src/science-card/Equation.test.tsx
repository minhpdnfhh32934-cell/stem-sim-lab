import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Equation } from './Equation';
import { MIN_EQUATION_SCALE, fitScale } from './fitScale';

describe('equation width', () => {
  it('a wide equation is scaled to its box, but never below a readable size', () => {
    expect(fitScale(260, 200)).toBe(1);
    expect(fitScale(260, 320)).toBe(0.81);
    expect(fitScale(260, 1000)).toBe(MIN_EQUATION_SCALE);
    expect(fitScale(0, 300)).toBe(1);
    expect(fitScale(260, 0)).toBe(1);
  });

  describe('in the Science Card', () => {
    const descriptors = {
      scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
      clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
    };
    afterEach(() => {
      for (const [k, d] of Object.entries(descriptors))
        if (d) Object.defineProperty(HTMLElement.prototype, k, d);
      vi.unstubAllGlobals();
    });

    it('draws a too-wide display equation smaller instead of scrolling sideways', async () => {
      // The box (Inspector width) is 250 px; the rendered equation 400 px at full size.
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() {
          return 250;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains('equation') ? 400 : 250;
        },
      });
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        },
      );
      const { container } = render(
        <div className="science-card__equation">
          <Equation tex={'\\dfrac{dN}{dt} = rN\\left(1 - \\dfrac{N}{K}\\right)'} />
        </div>,
      );
      await waitFor(() => {
        expect(container.querySelector('.equation--display')).not.toBeNull();
      });
      const eq = container.querySelector<HTMLElement>('.equation--display');
      await waitFor(() => {
        expect(eq?.style.fontSize).toBe('0.62em');
      });
    });
  });
});
