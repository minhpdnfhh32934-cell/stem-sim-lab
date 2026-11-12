import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCutTip } from './useCutTip';

function Label({ text }: { text: string }) {
  const ref = useCutTip<HTMLHeadingElement>(text);
  return <h1 ref={ref}>{text}</h1>;
}

/** jsdom has no layout: the widths a browser would report. */
function widths(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(client);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCutTip (#205 A5)', () => {
  it('a cut label carries its whole text as a tip and joins the Tab order', () => {
    widths(320, 280);
    const { getByRole } = render(<Label text="Con mồi – vật ăn thịt (Lotka–Volterra)" />);
    const h1 = getByRole('heading');
    expect(h1.dataset.tip).toBe('Con mồi – vật ăn thịt (Lotka–Volterra)');
    expect(h1.tabIndex).toBe(0);
  });

  it('a label that fits is plain text: no tip, not focusable', () => {
    widths(200, 200);
    const { getByRole } = render(<Label text="Ném xiên" />);
    const h1 = getByRole('heading');
    expect(h1.dataset.tip).toBeUndefined();
    expect(h1.hasAttribute('tabindex')).toBe(false);
  });

  it('follows the text: a new name that fits drops the tip of the old one', () => {
    widths(320, 280);
    const { getByRole, rerender } = render(<Label text="Một tên rất dài bị cắt" />);
    expect(getByRole('heading').dataset.tip).toBe('Một tên rất dài bị cắt');
    widths(100, 280);
    rerender(<Label text="Ngắn" />);
    expect(getByRole('heading').dataset.tip).toBeUndefined();
    expect(getByRole('heading').hasAttribute('tabindex')).toBe(false);
  });
});
