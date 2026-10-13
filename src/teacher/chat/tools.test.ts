import { describe, expect, it } from 'vitest';
import { translate } from '@/app/i18n';
import { toolBlock, toolFacts } from './tools';

describe('facts computed by the app for the AI Teacher', () => {
  it('balances the equation of the question exactly', () => {
    const [fact] = toolFacts('Cân bằng phương trình: H2 + O2 → H2O', 'vi');
    expect(fact?.kind).toBe('balanced');
    expect(fact?.text).toContain('2H2 + O2 → 2H2O');
    expect(fact?.text).toContain('2, 1, 2');
  });

  it('reads subscripts, "->" and given coefficients', () => {
    expect(toolFacts('Cân bằng: Fe + O₂ -> Fe₂O₃', 'vi')[0]?.text).toContain('4Fe + 3O2 → 2Fe2O3');
    expect(toolFacts('Hãy cân bằng 2KClO3 → KCl + O2', 'vi')[0]?.text).toContain(
      '2KClO3 → 2KCl + 3O2',
    );
    expect(toolFacts('Balance C3H8 + O2 -> CO2 + H2O', 'en')[0]?.text).toContain(
      'C3H8 + 5O2 → 3CO2 + 4H2O',
    );
  });

  it('says when an equation cannot be balanced instead of guessing', () => {
    const [fact] = toolFacts('Cân bằng phương trình H2 → O2', 'vi');
    expect(fact?.kind).toBe('unbalanceable');
    expect(fact?.text).toContain('Không tự đoán hệ số');
  });

  it('ignores physics formulas and questions without equations', () => {
    expect(toolFacts('Định luật II: F = m·a, tính gia tốc', 'vi')).toEqual([]);
    expect(toolFacts('Nguyên phân gồm mấy kì?', 'vi')).toEqual([]);
    expect(toolBlock('Lực ma sát là gì?', 'vi')).toBe('');
  });

  it('labels the block as computed by the app', () => {
    expect(toolBlock('Cân bằng H2 + O2 → H2O', 'vi')).toMatch(/^\n\nKẾT QUẢ DO SIMLAB TÍNH/);
  });

  // Audit G3: "hệ số", "coefficient", "reaction" or any arrow used to turn units into formulas
  // ("10N" → N) and the result was shown as exact and sent to the AI.
  it.each([
    ['vi', 'Vật m = 2kg chịu lực kéo F = 10N, hệ số ma sát 0,1. Tính gia tốc.'],
    ['vi', 'U = 220V, P = 100W, hệ số công suất 0,8'],
    ['en', 'F = 10N, coefficient of friction 0.2'],
    ['en', 'action and reaction, F = 5N'],
    ['vi', 'DNA → RNA → Protein'],
    ['en', 'ATP -> ADP + P'],
  ] as const)('reports nothing for a question that is not about a reaction (%s: %s)', (l, q) => {
    expect(toolFacts(q, l)).toEqual([]);
    expect(toolBlock(q, l)).toBe('');
  });

  it('does not read physics as chemistry even when "cân bằng" means equilibrium', () => {
    expect(toolFacts('Vật cân bằng khi chịu lực F = 10N', 'vi')).toEqual([]);
    expect(toolFacts('Vật nằm cân bằng trên sàn: P = N', 'vi')).toEqual([]);
    expect(toolFacts('Điều kiện cân bằng: F1 = F2', 'vi')).toEqual([]);
    expect(toolFacts('Cân bằng lực: F1 + F2 = F3', 'vi')).toEqual([]);
    expect(toolFacts('Mạch cầu cân bằng khi R1/R2 = R3/R4', 'vi')).toEqual([]);
    expect(toolFacts('The beam balances when F = 20N', 'en')).toEqual([]);
    // Two-letter names parse as formulas ("NB": nitrogen + boron): with "=" never "cannot balance".
    expect(toolFacts('Thanh AB cân bằng nằm ngang: NB + NC = P', 'vi')).toEqual([]);
    expect(toolFacts('Điều kiện cân bằng: PB + PC = P', 'vi')).toEqual([]);
  });

  it('accepts "=" only with an explicit balancing request', () => {
    expect(toolFacts('Cân bằng: Fe + O2 = Fe2O3', 'vi')[0]?.text).toContain('4Fe + 3O2 → 2Fe2O3');
    expect(toolFacts('Phản ứng Fe + O2 = Fe2O3 cần điều kiện gì?', 'vi')).toEqual([]);
  });

  it('needs a reaction word with an arrow when there is no balancing request', () => {
    expect(toolFacts('Phản ứng H2 + O2 → H2O tỏa nhiệt hay thu nhiệt?', 'vi')[0]?.kind).toBe(
      'balanced',
    );
    expect(toolFacts('Viết PTHH: Al + O2 → Al2O3', 'vi')[0]?.text).toContain('4Al + 3O2 → 2Al2O3');
    // Without a balancing request, a reaction the balancer rejects is not reported as a result.
    expect(toolFacts('Phản ứng H2 → O2 xảy ra không?', 'vi')).toEqual([]);
  });

  it('skips reaction chains instead of reporting each step as wrong', () => {
    expect(toolFacts('Cân bằng chuỗi phản ứng: Fe → FeCl2 → Fe(OH)2 → Fe2O3', 'vi')).toEqual([]);
  });

  it('reads precipitate and gas marks', () => {
    const [caco3] = toolFacts('Cân bằng phương trình: Ca(OH)2 + CO2 → CaCO3↓ + H2O', 'vi');
    expect(caco3?.kind).toBe('balanced');
    expect(caco3?.text).toContain('Ca(OH)2 + CO2 → CaCO3 + H2O');
    expect(caco3?.text).toContain('1, 1, 1, 1');
    const [baso4] = toolFacts('Cân bằng: BaCl2 + Na2SO4 → BaSO4↓ + NaCl', 'vi');
    expect(baso4?.text).toContain('BaCl2 + Na2SO4 → BaSO4 + 2NaCl');
    expect(baso4?.text).toContain('1, 1, 1, 2');
    expect(toolFacts('Cân bằng: Zn + HCl → ZnCl2 + H2 ↑', 'vi')[0]?.text).toContain('1, 2, 1, 1');
  });

  it('reads hydrates and keeps their water count', () => {
    for (const q of [
      'Cân bằng: CuSO4·5H2O → CuSO4 + H2O',
      'Cân bằng: CuSO4.5H2O → CuSO4 + H2O',
      'Cân bằng: CuSO4 • 5H2O → CuSO4 + H2O',
    ]) {
      const [fact] = toolFacts(q, 'vi');
      expect(fact?.kind, q).toBe('balanced');
      expect(fact?.text, q).toContain('1, 1, 5');
    }
    expect(toolFacts('Cân bằng: CuSO4 · 5H2O → CuSO4 + H2O', 'vi')[0]?.shown).toContain(
      'CuSO4·5H2O → CuSO4 + 5H2O',
    );
    // A full stop ends the sentence, it is not a hydrate dot.
    expect(toolFacts('Cân bằng: Al + O2 → Al2O3.Tính số mol', 'vi')[0]?.text).toContain(
      '4Al + 3O2 → 2Al2O3',
    );
  });

  it('keeps a reversible arrow reversible', () => {
    const [fact] = toolFacts('Cân bằng: N2 + H2 ⇌ NH3', 'vi');
    expect(fact?.text).toContain('N2 + 3H2 ⇌ 2NH3');
    expect(fact?.shown).toContain('N2 + 3H2 ⇌ 2NH3');
    expect(toolFacts('Balance N2 + H2 <=> NH3', 'en')[0]?.shown).toContain('N2 + 3H2 ⇌ 2NH3');
  });

  it('shows the learner text from the locale files', () => {
    expect(toolFacts('Balance H2 + O2 -> H2O', 'en')[0]?.shown).toBe(
      translate('en', 'chat.facts.balanced', { equation: '2H2 + O2 → 2H2O' }),
    );
    expect(toolFacts('Cân bằng H2 → O2', 'vi')[0]?.shown).toBe(
      translate('vi', 'chat.facts.unbalanced', { input: 'H2 → O2' }),
    );
  });
});
