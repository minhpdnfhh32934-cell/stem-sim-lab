import { describe, expect, it } from 'vitest';
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
});
