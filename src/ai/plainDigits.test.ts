import { describe, expect, it } from 'vitest';
import { plainDigits } from './gemmaTransport';

describe('digits of another script in a Gemma answer', () => {
  it('become the plain digits they stand for (E2B wrote "mv^২", #342)', () => {
    expect(plainDigits('$K = 1/2 mv^২$')).toBe('$K = 1/2 mv^2$');
    // Arabic-Indic three, Devanagari nine, full-width seven, mathematical bold three.
    expect(plainDigits('٣ ९ ７ \u{1D7D1}')).toBe('3 9 7 3');
  });

  it('leave plain text, plain digits and superscripts as they are', () => {
    const text = 'v = 9,81 m/s²; x₁ = 2 m; t = 0.5 s';
    expect(plainDigits(text)).toBe(text);
  });
});
