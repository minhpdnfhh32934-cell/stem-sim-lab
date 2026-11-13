import { describe, expect, it } from 'vitest';
import { evaluate, namesIn } from './expression';

const values: Record<string, number> = { height: 2, gravity: 1.62, '@fallTime': 1.5713484 };
const value = (name: string) => values[name];

describe('a worked example check expression (evaluate)', () => {
  it('reads numbers, operators in order, powers and parentheses', () => {
    expect(evaluate('1 + 2 * 3', value)).toBe(7);
    expect(evaluate('(1 + 2) * 3', value)).toBe(9);
    expect(evaluate('2 ^ 3 ^ 2', value)).toBe(512); // right to left
    expect(evaluate('-2 ^ 2', value)).toBe(-4);
    expect(evaluate('1.5e3 / 3', value)).toBe(500);
    expect(evaluate('6 × 2 ÷ 3 − 1', value)).toBe(3);
  });

  it('reads inputs, predictions and functions', () => {
    expect(evaluate('sqrt(2*height/gravity)', value)).toBeCloseTo(1.5713484, 6);
    expect(evaluate('gravity * @fallTime', value)).toBeCloseTo(2.5455844, 6);
    expect(evaluate('sin(rad(30))', value)).toBeCloseTo(0.5, 12);
    expect(evaluate('log(1e-3)', value)).toBeCloseTo(-3, 12);
    expect(evaluate('max(height, gravity) + pi', value)).toBeCloseTo(2 + Math.PI, 12);
  });

  it('says what it cannot read', () => {
    expect(() => evaluate('2 *', value)).toThrow(/expected a number/);
    expect(() => evaluate('mass * 2', value)).toThrow(/unknown name "mass"/);
    expect(() => evaluate('sqroot(4)', value)).toThrow(/unknown function/);
    expect(() => evaluate('(1 + 2', value)).toThrow(/missing "\)"/);
    expect(() => evaluate('1 2', value)).toThrow(/unexpected/);
    expect(() => evaluate('max(1)', value)).toThrow(/takes 2/);
  });

  it('lists the names it reads', () => {
    expect(namesIn('gravity * @fallTime + sqrt(height)')).toEqual([
      'gravity',
      '@fallTime',
      'height',
    ]);
  });
});
