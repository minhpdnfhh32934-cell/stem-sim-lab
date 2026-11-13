import { describe, expect, it } from 'vitest';
import strings from '../content/strings.json';
import rawFreeFall from '../content/experiments/free-fall.json';
import { createTexts, ENGLISH } from '../core/i18n';
import { ExperimentDefinitionSchema } from './experiment';
import { BUILT_IN_MODELS } from './models';
import { checkExample, figures, fillExample, workExample } from './workedExample';

const freeFall = ExperimentDefinitionSchema.parse(rawFreeFall);
const model = BUILT_IN_MODELS.find((m) => m.id === freeFall.model)!;
const [moon, earth] = freeFall.examples;

describe('a worked example on the board (workExample)', () => {
  it('writes the question, what is given, what is asked, its steps and the model’s answer', () => {
    const worked = workExample(freeFall, model, moon!, 0, ENGLISH);
    // The model's own answer: t = √(2h/g), v = −g·t, up positive (h 2 m, g 1.62 m/s²).
    const t = Math.sqrt((2 * 2) / 1.62);
    expect(worked.title).toBe('Example 1 · Free fall');
    expect(worked.question).toMatch(
      /^On the Moon \(g = 1\.62 m\/s²\) a ball is dropped from 2 m\./,
    );
    expect(worked.given).toBe('Given: h = 2 m; g = 1.62 m/s²');
    expect(worked.find).toBe('Find: t = ?; v = ?');
    expect(worked.steps.map((s) => s.write)).toEqual([
      'h = ½·g·t²',
      `t = √(2h/g) = √(2·2/1.62) ≈ ${figures(t, 3)} s`,
      `v = −g·t = −1.62·${figures(t, 3)} ≈ ${figures(-1.62 * t, 3)} m/s`,
    ]);
    expect(worked.answer).toBe(`Answer: t = ${figures(t, 3)} s; v = ${figures(-1.62 * t, 3)} m/s`);
  });

  it('in Vietnamese: the labels and the words; formulas, symbols and numbers as they are', () => {
    const vi = createTexts({ vi: strings.vi }, () => 'vi');
    const worked = workExample(freeFall, model, earth!, 1, vi);
    expect(worked.title).toBe('Ví dụ 2 · Rơi tự do');
    expect(worked.given).toBe('Cho: h = 3 m; g = 9.81 m/s²');
    expect(worked.find).toBe('Tìm: v = ?; t = ?');
    expect(worked.question).toMatch(/^Trên Trái Đất/);
    expect(worked.steps[1]?.write).toBe('v = −√(2gh) = −√(2·9.81·3) ≈ −7.67 m/s');
    expect(worked.answer).toBe('Đáp số: v = −7.67 m/s; t = 0.782 s');
  });

  it('checks every step against the model, and says what does not agree', () => {
    expect(checkExample(freeFall, model, moon!)).toEqual([]);
    expect(checkExample(freeFall, model, earth!)).toEqual([]);
    const wrong = structuredClone(moon!);
    wrong.steps[1]!.check = { expr: 'sqrt(height/gravity)', equals: 'fallTime' }; // ½ lost
    wrong.set = { height: 50, gravity: 1.62 };
    wrong.find = [{ theory: 'noSuchThing' }];
    wrong.question = 'From {height} m, with {mass} kg';
    const problems = checkExample(freeFall, model, wrong);
    expect(problems.join('\n')).toMatch(/sets "height" to 50, outside 0\.2 … 3/);
    expect(problems.join('\n')).toMatch(/asks for "noSuchThing", not a prediction/);
    expect(problems.join('\n')).toMatch(/"\{mass\}" names no input or prediction/);
    expect(problems.join('\n')).toMatch(
      /step 2: sqrt\(height\/gravity\) = .*the model's "fallTime"/,
    );
  });

  it('shows values to significant figures, very large or small ones with a power of ten', () => {
    expect(figures(1.5713484, 3)).toBe('1.57');
    expect(figures(2, 3)).toBe('2');
    expect(figures(1234567, 3)).toBe('1.23×10⁶');
    expect(figures(0.000012345, 3)).toBe('1.23×10⁻⁵');
    expect(figures(-2.5455, 3)).toBe('−2.55');
    expect(fillExample('{=2*x|2} and {@y|4}', { x: 1.2345 }, { y: Math.PI })).toBe('2.5 and 3.142');
  });
});
