import { describe, expect, it } from 'vitest';
import { fromSI, unitLabel } from '@/core/units';
import { MODE as FIELD_MODE } from '@/physics/field/model';
import { loadScene, sceneIds } from '@/physics/registry';
import type { Solution } from '@/physics/types';
import { allowedNumbers, explainSolution, explanationTokens, unknownNumbers } from './explain';
import { formatNumber } from '@/app/i18n';
import { texNum, texNumbers, texTokens } from '@/physics/common/tex';
import { numberTokens, numbersIn } from './numbers';
import type { LlmTransport } from './transport';

/** The answer lines exactly as the explain prompt writes them, in either decimal style. */
function faithful(solution: Solution, decimal: ',' | '.', lang: 'vi' | 'en'): string {
  return solution.answers
    .map((a) => {
      const shown = String(Number(fromSI(a.value, a.unit).toPrecision(4)));
      const written = decimal === ',' ? shown.replace('.', ',') : shown;
      return `${a.label[lang]} = ${written} ${unitLabel(a.unit)}.`;
    })
    .join(' ');
}

async function defaultSolution(id: string): Promise<Solution> {
  const scene = await loadScene(id);
  const params = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : scene.defaults;
  return scene.solve(params, 'vi');
}

describe('numbers written in an explanation', () => {
  it('keeps every reading of one written token together', () => {
    expect(numberTokens('v = 2,5 m/s, t = 2.038 s, 1.200 N')).toEqual([
      [2.5, 25],
      [2038, 2.038],
      [1200, 1.2],
    ]);
    expect(numberTokens('G = 6,67.10^-11 N')).toHaveLength(1);
    // A decimal that looks like "a.10^b" without the caret keeps its plain readings too.
    expect(numberTokens('t = 1.106 s')).toEqual([[1e6, 1106, 1.106]]);
  });

  it('accepts every engine answer of every physics scene, with a decimal comma or a dot', async () => {
    for (const id of sceneIds()) {
      const solution = await defaultSolution(id);
      const allowed = allowedNumbers(solution, '');
      for (const decimal of [',', '.'] as const) {
        for (const lang of ['vi', 'en'] as const) {
          const text = faithful(solution, decimal, lang);
          expect(unknownNumbers(text, allowed), `${id} ${decimal} ${lang}: ${text}`).toEqual([]);
        }
      }
    }
  });

  const solved = async (id: string, locale: 'vi' | 'en') => {
    const scene = await loadScene(id);
    const params = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : scene.defaults;
    return allowedNumbers(scene.solve(params, locale), '');
  };

  it('reads step numbers as the screen shows them ("9{,}81" is 9,81; "35{.}950" is 35.950)', async () => {
    for (const locale of ['vi', 'en'] as const) {
      const fall = await solved('freeFall', locale);
      expect(unknownNumbers('Với g = 9,81 m/s², vật rơi nhanh dần.', fall), locale).toEqual([]);
      const field = await solved('electricField', locale);
      const text = 'Mỗi điện tích gây ra tại M điện trường 35.950 V/m.';
      expect(unknownNumbers(text, field), locale).toEqual([]);
    }
  });

  it('a step number is read with one meaning only: ×10, ×100, ÷1000 of it are flagged', async () => {
    // The readings the #97 review found let through ("9,81" read as 981, "35.950" as 35,95…).
    const cases: [string, string][] = [
      ['freeFall', 'Với g = 981 m/s², vật rơi nhanh dần.'],
      ['freeFall', 'Với g = 98,1 m/s², vật rơi nhanh dần.'],
      ['freeFall', 'Với g = 0,00981 m/s², vật rơi nhanh dần.'],
      ['freeFall', 'Vật chạm đất sau 3029 s.'],
      ['electricField', 'Điện trường tại M là E = 72 V/m.'],
      ['electricField', 'Mỗi điện tích gây ra E = 35,95 V/m.'],
      ['simplePendulum', 'Chu kì T0 = 2006 s.'],
    ];
    for (const locale of ['vi', 'en'] as const) {
      for (const [id, text] of cases) {
        expect(
          unknownNumbers(text, await solved(id, locale)),
          `${locale} ${id}: ${text}`,
        ).not.toEqual([]);
      }
    }
  });

  it('an explanation that copies the TeX of every step verbatim verifies (vi and en)', async () => {
    // "$g = 9{,}81\,\text{m/s}^{2}$" was split into 9 and 81 and hidden (#97 round 2).
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      const p = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : scene.defaults;
      for (const locale of ['vi', 'en'] as const) {
        const sol = scene.solve(p, locale);
        const allowed = allowedNumbers(sol, '');
        for (const s of sol.steps) {
          const text = `Ta có $${s.tex ?? ''}$.`;
          expect(unknownNumbers(text, allowed), `${id} ${locale}: ${text}`).toEqual([]);
        }
      }
    }
    // A long decimal has one reading: "0.003762" is not 0.003 and 762.
    expect(explanationTokens('h = 0.003762 m')).toEqual([[0.003762]]);
    expect(explanationTokens('h = 0,003762 m')).toEqual([[0.003762]]);
  });

  it('accepts nothing main refuses, except numbers the steps really print (every scene)', async () => {
    const mods = [1, 10, 100, 1000, 0.1, 0.01, 0.001];
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      const p = scene.usesGravity ? { ...scene.defaults, g: 9.81 } : scene.defaults;
      for (const locale of ['vi', 'en'] as const) {
        const sol = scene.solve(p, locale);
        const now = allowedNumbers(sol, '');
        // main: free-text readings of the TeX, which main's texNum never grouped.
        const main = [
          ...allowedNumbers({ answers: sol.answers, steps: [] }, ''),
          ...sol.steps.flatMap((s) => [
            ...numbersIn(s.text.vi),
            ...numbersIn((s.tex ?? '').replace(/\{\.\}/g, '')),
          ]),
        ];
        // Oracle from the writer, not the reader: a whole token of a step is texNum's print of
        // this value (never a substring: "9{,}81" does not print 81).
        const tokens = new Set(sol.steps.flatMap((s) => texTokens(s.tex ?? '')));
        const printed = (a: number) =>
          [1, 2, 3, 4, 5, 6].some((sig) => tokens.has(texNum(locale, a, sig)));
        const values = sol.steps.flatMap((s) => texNumbers(s.tex ?? ''));
        for (const v of values) {
          for (const k of mods) {
            const c = Number((v * k).toPrecision(6));
            const text = `Số ${formatNumber('vi', c, { maximumSignificantDigits: 6 })}.`;
            if (unknownNumbers(text, main).length === 0) continue;
            if (unknownNumbers(text, now).length > 0) continue;
            // Any reading of the written token ("9.810" is also 9,81, main's reader rule).
            const reads = explanationTokens(text)[0] ?? [];
            const by = now.filter((a) => reads.some((r) => Math.abs(a - r) <= 0.01 * Math.abs(a)));
            expect(by.some(printed), `${id} ${locale}: "${text}"`).toBe(true);
          }
        }
      }
    }
  });

  it('still flags a number the engine did not produce', async () => {
    const solution = await defaultSolution('freeFall');
    const allowed = allowedNumbers(solution, '');
    expect(unknownNumbers('Vật chạm đất sau 7,77 s.', allowed)).toEqual([7.77]);
  });

  it("an explanation copying the prompt's result lines verbatim verifies (tiny forces too)", async () => {
    const field = await loadScene('electricField');
    const cases: [string, Solution][] = [];
    for (const id of sceneIds()) cases.push([id, await defaultSolution(id)]);
    // 5·10⁻⁷ and 9,437·10⁻⁷ N (0,1–1 µN) and an electron's 8,01·10⁻¹⁶ N between the plates.
    for (const q0 of [1e-10, 1.8874e-10, -1.602176634e-19])
      cases.push([
        `plates q0 = ${q0}`,
        field.solve({ ...field.defaults, mode: FIELD_MODE.plates, q0 }, 'vi'),
      ]);
    for (const [name, solution] of cases) {
      let prompt = '';
      const transport = {
        chat: (req: { messages: { content: string }[] }) => {
          prompt = req.messages[0]?.content ?? '';
          const lines = prompt.split('\n').filter((l) => l.startsWith('- '));
          return Promise.resolve({ content: lines.join('\n'), model: 'm', durationMs: 1 });
        },
      } as unknown as LlmTransport;
      const result = await explainSolution('Chủ đề', '', solution, {
        transport,
        provider: 'gemini',
        model: 'm',
        timeoutSecs: 30,
      });
      expect(prompt, name).not.toMatch(/\de[-+]?\d/);
      expect(result.unknownNumbers, name).toEqual([]);
    }
  });

  it('shows a faithful explanation as verified', async () => {
    const solution = await defaultSolution('uniformMotion');
    const content = faithful(solution, ',', 'vi');
    const transport = {
      chat: () => Promise.resolve({ content, model: 'm', durationMs: 1 }),
    } as unknown as LlmTransport;
    const result = await explainSolution('Chuyển động thẳng đều', '', solution, {
      transport,
      provider: 'gemini',
      model: 'm',
      timeoutSecs: 30,
    });
    expect(result.unknownNumbers).toEqual([]);
    expect(result.verified).toBe(true);
  });
});
