import { describe, expect, it } from 'vitest';
import { formulaPieces, splitFormula } from './formulaSplit';
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

  it('a negated relation is never cut from its "\\not": "≠" stays "≠"', () => {
    expect(trimmed('a \\not= b \\not= c')).toEqual(['a \\not= b', '\\not= c']);
    expect(trimmed('a \\equiv b \\not\\equiv c')).toEqual(['a \\equiv b', '\\not\\equiv c']);
    expect(trimmed('a = b \\not = c')).toEqual(['a = b', '\\not = c']);
    expect(trimmed('a \\not= b = c')).toEqual(['a \\not= b', '= c']);
    for (const tex of [
      'a \\not= b \\not= c',
      'x \\not\\le y \\not\\ge z',
      'a = b \\not \\approx c = d',
      'a = b \\not\\in C = D',
    ]) {
      expect(splitFormula(tex).join('')).toBe(tex);
      for (const piece of splitFormula(tex)) expect(piece.trimEnd()).not.toMatch(/\\not$/);
    }
  });

  it('a list of statements is cut after its separators, never between a name and its value', () => {
    const givens = 'v_0 = 0,\\quad a = 2\\ \\text{m/s}^2,\\quad t = 3\\ \\text{s},\\quad s = ?';
    expect(trimmed(givens)).toEqual([
      'v_0 = 0,\\quad',
      'a = 2\\ \\text{m/s}^2,\\quad',
      't = 3\\ \\text{s},\\quad',
      's = ?',
    ]);
    expect(trimmed('m = 4\\ \\text{kg};\\; F = 20\\ \\text{N}')).toEqual([
      'm = 4\\ \\text{kg};\\;',
      'F = 20\\ \\text{N}',
    ]);
    expect(trimmed('h = 20\\ \\text{m} \\qquad g = 10')).toEqual([
      'h = 20\\ \\text{m} \\qquad',
      'g = 10',
    ]);
    // A connective written as text: with spaces inside it, or set apart by spacing.
    expect(trimmed('F = 10\\ \\text{N} \\text{ và } m = 2\\ \\text{kg}')).toEqual([
      'F = 10\\ \\text{N} \\text{ và }',
      'm = 2\\ \\text{kg}',
    ]);
    expect(splitFormula('F = 10\\ \\text{N}\\ \\text{và}\\ m = 2\\ \\text{kg}')).toEqual([
      'F = 10\\ \\text{N}\\ \\text{và}\\ ',
      'm = 2\\ \\text{kg}',
    ]);
    // Each statement still has its own chain.
    expect(trimmed('a = b = c,\\quad d = e = f')).toEqual(['a = b', '= c,\\quad', 'd = e', '= f']);
    for (const tex of [givens, 'a = b = c,\\quad d = e = f', 'x = 1, 2, 3'])
      expect(splitFormula(tex).join('')).toBe(tex);
  });

  it('a connective written as text separates two statements also after a number or a unit (fix round A4)', () => {
    // The reviewer's inputs: before, each was cut only as a chain ("… a " over "= 2 …").
    const lists: [string, string[]][] = [
      [
        'v_0 = 0\\ \\text{và}\\ a = 2\\ \\text{m/s}^2\\ \\text{và}\\ t = 3\\ \\text{s}',
        ['v_0 = 0\\ \\text{và}\\ ', 'a = 2\\ \\text{m/s}^2\\ \\text{và}\\ ', 't = 3\\ \\text{s}'],
      ],
      [
        'x = 1\\;\\text{hoặc}\\; x = 2\\;\\text{hoặc}\\; x = 3\\;\\text{hoặc}\\; x = 4',
        [
          'x = 1\\;\\text{hoặc}\\; ',
          'x = 2\\;\\text{hoặc}\\; ',
          'x = 3\\;\\text{hoặc}\\; ',
          'x = 4',
        ],
      ],
      [
        'm = 4\\ \\text{kg} \\ \\text{và} \\ F = 20\\ \\text{N}',
        ['m = 4\\ \\text{kg} \\ \\text{và} \\ ', 'F = 20\\ \\text{N}'],
      ],
    ];
    for (const [tex, pieces] of lists) {
      expect(splitFormula(tex)).toEqual(pieces);
      expect(formulaPieces(tex).every((p) => !p.continues)).toBe(true);
    }
    // A unit after a number is still never a separator.
    expect(splitFormula('F = 20\\ \\text{N}')).toEqual(['F = 20\\ \\text{N}']);
    expect(splitFormula('s = 3\\ \\text{s} = 3000\\ \\text{ms}')).toEqual([
      's = 3\\ \\text{s} ',
      '= 3000\\ \\text{ms}',
    ]);
  });

  it('only a chain’s continuation is marked as one (it is written indented)', () => {
    const kinds = (tex: string) => formulaPieces(tex).map((p) => p.continues);
    expect(kinds('a = b = c,\\quad d = e')).toEqual([false, true, false]);
    expect(kinds('v_0 = 0,\\quad a = 2,\\quad s = ?')).toEqual([false, false, false]);
    expect(kinds('F = ma \\Rightarrow a = \\frac{F}{m} = 5')).toEqual([false, true, true]);
    expect(kinds('E = mc^2')).toEqual([false]);
  });

  it('a decimal comma, a unit’s exponent and a trailing separator are never cut', () => {
    expect(splitFormula('g = 9,81')).toEqual(['g = 9,81']);
    expect(trimmed('g = 9,81 = 9{,}81')).toEqual(['g = 9,81', '= 9{,}81']);
    expect(splitFormula('a = b,')).toEqual(['a = b,']);
    expect(splitFormula('a = b,\\quad')).toEqual(['a = b,\\quad']);
    expect(splitFormula(',\\quad a = b')).toEqual([',\\quad a = b']);
    // A group set apart by spaces right before an exponent is part of what the exponent raises.
    const unit = 'v = 5\\ \\text{ m }^2 = 5';
    expect(splitFormula(unit).every((p) => !p.startsWith('^'))).toBe(true);
    expect(splitFormula(unit).join('')).toBe(unit);
    // Commas inside a group are not separators.
    expect(splitFormula('f(x, y) = \\max\\{x, y\\}')).toEqual(['f(x, y) = \\max\\{x, y\\}']);
  });

  it('the number check reads the whole formula, as before the split', () => {
    const tex = 'v = \\frac{72}{3{,}6} = 20\\ \\text{m/s} = 72\\ \\text{km/h}';
    expect(splitFormula(tex).length).toBeGreaterThan(1);
    expect(checkNumbers(splitFormula(tex).join(''), [72], [])).toEqual(checkNumbers(tex, [72], []));
  });
});
