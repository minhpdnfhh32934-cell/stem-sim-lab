import { describe, expect, it } from 'vitest';
import { splitSubscripts, subscriptElement } from './subscripts';

describe('subscripts written as "_" (UI-20)', () => {
  it('splits one letter, a word and a braced group', () => {
    expect(splitSubscripts('W_đ (J)')).toEqual([
      { text: 'W', sub: false },
      { text: 'đ', sub: true },
      { text: ' (J)', sub: false },
    ]);
    expect(splitSubscripts('F_ms (N)').map((p) => p.text)).toEqual(['F', 'ms', ' (N)']);
    expect(splitSubscripts('Thành phần E_y')).toEqual([
      { text: 'Thành phần E', sub: false },
      { text: 'y', sub: true },
    ]);
    expect(splitSubscripts('t_{max} = 2 s').map((p) => p.sub)).toEqual([false, true, false]);
    expect(splitSubscripts('vₓ (m/s)')).toEqual([{ text: 'vₓ (m/s)', sub: false }]);
  });

  it('rewrites a legend label that a library put into the DOM', () => {
    const el = document.createElement('span');
    el.textContent = 'v_y (m/s)';
    subscriptElement(el);
    expect(el.innerHTML).toBe('v<sub>y</sub> (m/s)');
    const plain = document.createElement('span');
    plain.textContent = 'x';
    subscriptElement(plain);
    expect(plain.innerHTML).toBe('x');
  });
});
