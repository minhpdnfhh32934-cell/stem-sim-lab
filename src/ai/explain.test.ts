import { describe, expect, it } from 'vitest';
import { fromSI, unitLabel } from '@/core/units';
import { MODE as FIELD_MODE } from '@/physics/field/model';
import { loadScene, sceneIds } from '@/physics/registry';
import type { Solution } from '@/physics/types';
import { allowedNumbers, explainSolution, unknownNumbers } from './explain';
import { numberTokens } from './numbers';
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
