import { describe, expect, it } from 'vitest';
import { splitFormula } from './formulaSplit';
import { checkNumbers } from './provenance';

const trimmed = (tex: string) => splitFormula(tex).map((p) => p.trim());

describe('splitFormula (an equality chain written on several lines)', () => {
  it('splits a chain at its later relations; each continuation starts with its relation', () => {
    expect(trimmed('a = \\frac{F}{m} = \\frac{10}{2} = 5\\ \\text{m/s}^2')).toEqual([
      'a = \\frac{F}{m}',
      '= \\frac{10}{2}',
      '= 5\\ \\text{m/s}^2',
    ]);
    expect(trimmed('v \\approx 19{,}8 \\le 20')).toEqual(['v \\approx 19{,}8', '\\le 20']);
  });

  it('an arrow starts a new statement and keeps its own relation', () => {
    expect(trimmed('F = ma \\Rightarrow a = \\frac{F}{m} = 5')).toEqual([
      'F = ma',
      '\\Rightarrow a = \\frac{F}{m}',
      '= 5',
    ]);
  });

  it('gives back the formula exactly when joined (nothing changed, dropped or added)', () => {
    const formulas = [
      'a = \\frac{F}{m} = \\frac{10}{2} = 5\\ \\text{m/s}^2',
      's = v_0 t + \\frac{1}{2} a t^2 = 2 \\cdot 3 + \\frac{1}{2} \\cdot 4 \\cdot 9 = 24\\,\\text{m}',
      'x := 2 = 1 + 1',
      'p = mv \\Rightarrow v = \\frac{p}{m} \\approx 3{,}33',
      '2H_2 + O_2 \\rightarrow 2H_2O',
      'E = mc^2',
    ];
    for (const tex of formulas) expect(splitFormula(tex).join('')).toBe(tex);
  });

  it('never splits inside a group, \\left…\\right, an environment or \\text{…}', () => {
    for (const tex of [
      'f\\left(x = 2\\right) = 4',
      '\\text{a = b} = c',
      'x^{a = b} = c',
      '\\begin{aligned} a &= b \\\\ &= c \\end{aligned}',
      '\\{ x = 1 \\} = A',
      '\\lim_{x \\to 0} f(x) = L',
    ])
      expect(splitFormula(tex)).toEqual([tex]);
  });

  it('does not mistake longer commands for relations (\\left, \\neg, \\top)', () => {
    expect(splitFormula('\\left( a \\right) \\neg b \\top c = d')).toHaveLength(1);
  });

  it('leaves unbalanced or unreadable formulas whole', () => {
    for (const tex of [
      'a = \\frac{1}{2 = 3',
      'a = b) = c',
      '\\left( a = b = c',
      'a = b = c % note',
      'a & = b = c',
      'a = b = \\text{c',
    ])
      expect(splitFormula(tex)).toEqual([tex]);
  });

  it('a single relation, or none, is one piece', () => {
    expect(splitFormula('s = \\frac{1}{2} g t^2')).toEqual(['s = \\frac{1}{2} g t^2']);
    expect(splitFormula('\\frac{1}{2} g t^2')).toEqual(['\\frac{1}{2} g t^2']);
    expect(splitFormula('')).toEqual(['']);
  });

  it('":=", "<=" and "==" are one relation each, never cut in two', () => {
    expect(splitFormula('a <= b')).toEqual(['a <= b']);
    expect(splitFormula('x == y')).toEqual(['x == y']);
    expect(trimmed('a <= b == c')).toEqual(['a <= b', '== c']);
    expect(trimmed('x := 2 = 1 + 1')).toEqual(['x := 2', '= 1 + 1']);
  });

  it('the number check reads the whole formula, as before the split', () => {
    const tex = 'v = \\frac{72}{3{,}6} = 20\\ \\text{m/s} = 72\\ \\text{km/h}';
    expect(splitFormula(tex).length).toBeGreaterThan(1);
    expect(checkNumbers(splitFormula(tex).join(''), [72], [])).toEqual(checkNumbers(tex, [72], []));
  });
});
