import { describe, expect, it } from 'vitest';
import { pickTex } from '@/core/data/dataset';
import { loadScene } from '../registry';
import { SYM, both, plain, sym } from './symbols';

describe('textbook symbols by language (#258)', () => {
  it('keeps the SGK symbols in Vietnamese and uses English ones in English', () => {
    expect(sym('vi').kinetic).toBe('W_{\\text{đ}}');
    expect(sym('en').kinetic).toBe('K');
    expect(SYM.friction).toEqual({ vi: 'F_{ms}', en: 'f' });
    expect(both((s) => `${s.work} = F s`)).toEqual({ vi: 'A = F s', en: 'W = F s' });
  });

  it('turns a KaTeX symbol into a canvas label', () => {
    expect(plain('W_{\\text{đ}}')).toBe('W_đ');
    expect(plain('F_{\\text{đh}}')).toBe('F_đh');
    expect(plain('\\mathscr{P}')).toBe('𝒫');
    expect(plain('\\eta')).toBe('η');
    expect(plain('F_{ms}')).toBe('F_ms');
    expect(plain('F_g')).toBe('F_g');
  });

  it('Vietnamese cards write the formulas as SGK Vật lí 10 KNTT does (user rule 15/11/2026)', async () => {
    const vi = async (id: string) => {
      const s = await loadScene(id);
      const p = s.usesGravity ? { ...s.defaults, g: 9.81 } : s.defaults;
      return s
        .scienceCard(p)
        .equations.map((e) => pickTex(e.tex, 'vi'))
        .join(' ; ');
    };
    // [topic, formula as written in the book, where]
    const BOOK: [string, string, string][] = [
      ['uniformMotion', 'd = v\\, t', 'Bài 7, tr. 35'],
      ['uniformAcceleration', 'v_t = v_0 + a t', '(9.2), tr. 40'],
      ['uniformAcceleration', 'd = v_0 t + \\tfrac{1}{2} a t^2', '(9.4), tr. 42'],
      ['uniformAcceleration', 'v_t^2 - v_0^2 = 2 a d', '(9.5), tr. 42'],
      ['freeFall', 'd = s = \\tfrac{1}{2} g t^2', 'Bài 10, tr. 46'],
      ['horizontalProjectile', 'L = v_0\\sqrt{\\frac{2 h_0}{g}}', '(12.2), tr. 50'],
      ['obliqueProjectile', 'H = \\frac{v_0^2\\sin^2\\alpha}{2g}', 'Bài 12, tr. 52'],
      ['forceComposition', '\\vec{F} = \\vec{F}_1 + \\vec{F}_2', 'Bài 13, tr. 57–58'],
      ['inclinedPlane', 'F_{mst} = \\mu_t N', 'Bài 18, tr. 75'],
      ['energyConservation', 'W_c = W_{\\text{đ}} + W_t', '(26.1), tr. 102'],
      ['workPower', 'H = \\dfrac{W_{ci}}{W_{tp}}', '(27.1), tr. 106'],
      ['workPower', '\\mathscr{P} = \\dfrac{A}{t}', '(24.1), tr. 96'],
      ['hookeSpring', 'F_{\\text{đh}} = k\\left|\\Delta l\\right|', '(33.1), tr. 129'],
      ['liquidPressure', 'p = \\frac{F_N}{S}', '(34.2), tr. 132'],
    ];
    for (const [id, tex, where] of BOOK) expect(await vi(id), `${id}: ${where}`).toContain(tex);
  });
});
