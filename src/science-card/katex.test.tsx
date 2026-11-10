import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { prepareMeasure, renderMath } from '@/teacher/board/measure';
import { Equation } from './Equation';
import { loadKatex, tightDecimalCommas } from './katex';

describe('a decimal comma in a formula (#134)', () => {
  it.each([
    ['g = 9,81', 'g = 9{,}81'],
    ['t = \\sqrt{2 \\cdot 9,8}', 't = \\sqrt{2 \\cdot 9{,}8}'],
    ['1,250,000', '1{,}250{,}000'],
  ])('%s is read as one number', (tex, expected) => {
    expect(tightDecimalCommas(tex)).toBe(expected);
  });

  it.each(['g = 9{,}81', 'x = 1, 2', 'f(x, y)', 'a,b', 'x_1, x_2'])(
    '%s is left as it is',
    (tex) => {
      expect(tightDecimalCommas(tex)).toBe(tex);
    },
  );

  it('is what KaTeX needs: no space inside the number', async () => {
    const k = await loadKatex();
    const html = (tex: string) => k.default.renderToString(tex, { output: 'html' });
    expect(html('9,81')).toContain('mspace');
    expect(html(tightDecimalCommas('9,81'))).not.toContain('mspace');
  });

  it('in the chat and the Science Card (Equation)', async () => {
    const { container } = render(<Equation tex="9,81" display={false} />);
    await waitFor(() => {
      expect(container.querySelector('.katex')).not.toBeNull();
    });
    expect(container.querySelector('.mspace')).toBeNull();
  });

  it('on the board (renderMath)', async () => {
    await prepareMeasure();
    expect(renderMath('9,81')).not.toContain('mspace');
  });
});
