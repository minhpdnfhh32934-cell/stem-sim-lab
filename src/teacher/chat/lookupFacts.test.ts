import { describe, expect, it } from 'vitest';
import { lookupFacts } from './lookupFacts';
import { toolBlock, toolFacts } from './tools';

const vi = (q: string) => lookupFacts(q, 'vi');

describe('facts the app computes itself', () => {
  it('molar mass from the atomic weights table', () => {
    expect(vi('Tính khối lượng mol của H2SO4')[0]).toContain('H2SO4: 98,07');
    expect(vi('Phân tử khối của chất NaCl là bao nhiêu?')[0]).toContain('NaCl: 58,44');
    expect(vi('Nguyên tử khối của Fe?')[0]).toContain('Fe: 55,84');
    expect(lookupFacts('What is the molar mass of CO2?', 'en')[0]).toContain('44.0');
  });

  it('a problem with its own rounded masses keeps them', () => {
    expect(vi('Tính khối lượng mol của NaOH (Na = 23, O = 16, H = 1)')).toEqual([]);
    expect(vi('Khối lượng mol của NaCl là 58,5 g/mol, tính số mol')).toEqual([]);
  });

  it.each(['Khối lượng mol của nước', 'Khối lượng mol của chất X', 'Khối lượng mol của khí B'])(
    'no molar mass for %s',
    (q) => {
      expect(vi(q)).toEqual([]);
    },
  );

  it('electron configuration comes from the table, exceptions included', () => {
    const cr = vi('Viết cấu hình electron của Cr')[0];
    expect(cr).toContain('3d⁵ 4s¹');
    expect(cr).toContain('[Ar]');
    expect(vi('Cấu hình electron của nguyên tử sắt')[0]).toContain('Fe (Z = 26)');
    expect(vi('Cấu hình electron của nguyên tố có Z = 29')[0]).toContain('3d¹⁰ 4s¹');
    expect(vi('Cấu hình e của H')[0]).toContain('1s¹');
  });

  it.each([
    'Cấu hình electron của ion Fe3+',
    'Cấu hình electron của Fe2+',
    'Cấu hình electron của Fe 3+',
    'Cấu hình electron của ion X2+ có Z = 26',
    'Cấu hình electron của nguyên tử X',
    'Cấu hình electron có mấy lớp?',
  ])('no configuration for %s', (q) => {
    expect(vi(q)).toEqual([]);
  });

  it('unit conversions', () => {
    expect(vi('Đổi 72 km/h ra m/s')).toEqual(['72 km/h = 20 m/s.']);
    expect(vi('36 km/h bằng bao nhiêu m/s?')).toEqual(['36 km/h = 10 m/s.']);
    expect(vi('Đổi 1,5 giờ sang phút')[0]).toContain('= 90 min');
    expect(vi('Đổi 25 °C ra K')[0]).toContain('298,15 K');
    expect(lookupFacts('Convert 5 cm to m', 'en')).toEqual(['5 cm = 0.05 m.']);
  });

  it.each([
    'Vật đi được 5 m ra xa bao nhiêu?',
    'Đổi 3 kg ra m',
    'Đổi 1.000 m ra km',
    'Đổi 5 m ra m',
    'Vật có khối lượng 2 kg, tính gia tốc',
  ])('no conversion for %s', (q) => {
    expect(vi(q)).toEqual([]);
  });

  it('codons from the genetic code table', () => {
    expect(vi('Codon GCU mã hóa axit amin gì?')[0]).toContain('Ala');
    expect(vi('Codon AUG có vai trò gì?')[0]).toContain('mở đầu');
    expect(vi('Bộ ba UAA mã hóa gì?')[0]).toContain('kết thúc');
    expect(vi('Bộ ba ATG là gì?')).toEqual([]);
  });

  it('strands: complement, mRNA and protein keep their 5′ and 3′ ends', () => {
    expect(vi("Hãy viết mạch bổ sung của đoạn 5'-ATGCCG-3'")[0]).toContain("3'-TACGGC-5'");
    expect(vi('Viết mạch bổ sung của ATGCCG')[0]).toContain(': TACGGC.');
    expect(vi("Mạch gốc có trình tự 3'-TACGGC-5'. Viết mARN.")[0]).toContain("5'-AUGCCG-3'");
    expect(vi("Mạch bổ sung có trình tự 5'-ATGCCG-3'. Viết mARN.")[0]).toContain("5'-AUGCCG-3'");
    const protein = vi("Dịch mã mARN 5'-AUGGCUUAA-3' cho chuỗi axit amin nào?")[0];
    expect(protein).toContain('Met-Ala');
    expect(protein).toContain('UAA');
    const both = vi("Mạch gốc 3'-TACCGAATT-5'. Viết mARN và chuỗi axit amin.");
    expect(both[0]).toContain("5'-AUGGCUUAA-3'");
    expect(both[1]).toContain('Met-Ala');
  });

  it('reads a strand written 3′ to 5′ in the direction ribosomes read', () => {
    expect(vi("Dịch mã mARN 3'-AAUUCGGUA-5'")[0]).toContain('Met-Ala');
  });

  it.each([
    'mARN của đoạn ATGCCG là gì?',
    'Viết mARN từ gen',
    'GATTACA là gì?',
    "Viết mạch bổ sung của 5'-AT5'GCCG-3'",
    `Viết mạch bổ sung của ${'ATGC'.repeat(30)}`,
  ])('no strand fact for %s', (q) => {
    expect(vi(q)).toEqual([]);
  });

  it('Mendelian crosses, phenotypes only under complete dominance', () => {
    const one = vi('Phép lai Aa × Aa cho tỉ lệ thế nào?')[0];
    expect(one).toContain('1 AA : 2 Aa : 1 aa');
    expect(one).toContain('3 A_ : 1 aa');
    expect(vi('Lai AaBb x AaBb')[0]).toContain('9 A_ B_ : 3 A_ bb : 3 aa B_ : 1 aa bb');
    const incomplete = vi('Phép lai Aa x Aa, trội không hoàn toàn')[0];
    expect(incomplete).toContain('1 AA : 2 Aa : 1 aa');
    expect(incomplete).not.toContain('kiểu hình');
    expect(vi('Lai AaBbDd x AaBbDd')[0]).not.toContain('kiểu gen');
  });

  it.each([
    'Diện tích mm x mm',
    'Phép lai AB x ab',
    'Phép lai Aa x Bb',
    'Lai Aa x Aa, hai gen liên kết',
    'Lai AaBb x AaBb, tương tác bổ sung',
  ])('no cross for %s', (q) => {
    expect(vi(q)).toEqual([]);
  });

  it('Hardy–Weinberg needs the equilibrium and one allele frequency', () => {
    expect(vi('Quần thể cân bằng di truyền có p = 0,6')[0]).toContain(
      'AA = 0,36; Aa = 0,48; aa = 0,16',
    );
    expect(vi('Quần thể cân bằng Hardy-Weinberg, q = 0,3')[0]).toContain('p = 0,7');
    expect(vi('Quần thể cân bằng di truyền, tần số alen B là 0,2')[0]).toContain('BB = 0,04');
    expect(vi('Quần thể cân bằng di truyền, tần số alen b là 0,2')[0]).toContain('BB = 0,64');
    expect(vi('Quần thể có p = 0,6')).toEqual([]);
    expect(vi('Quần thể cân bằng di truyền')).toEqual([]);
    expect(vi('Cân bằng di truyền, p = 0,6 và q = 0,6')).toEqual([]);
  });

  it('physical constants only when their value is asked', () => {
    expect(vi('Hằng số Planck bằng bao nhiêu?')[0]).toContain('6,62607015 × 10⁻³⁴');
    expect(vi('Tốc độ ánh sáng là bao nhiêu?')[0]).toContain('2,99792458 × 10⁸ m/s');
    expect(lookupFacts('What is the value of the gas constant?', 'en')[0]).toContain('8.31446');
    expect(vi('Hằng số Planck có ý nghĩa gì?')).toEqual([]);
  });

  it('reaches the prompt and the card, at most three facts', () => {
    const q = 'Đổi 72 km/h ra m/s';
    expect(toolFacts(q, 'vi')[0]?.shown).toBe('72 km/h = 20 m/s.');
    expect(toolBlock(q, 'vi')).toMatch(/^\n\nKẾT QUẢ DO SIMLAB TÍNH.*\n- 72 km\/h = 20 m\/s\.$/s);
    const many = 'Đổi 1 km ra m, đổi 2 km ra m, đổi 3 km ra m, đổi 4 km ra m';
    expect(toolFacts(many, 'vi')).toHaveLength(3);
  });

  it('keeps the balancer first', () => {
    const facts = toolFacts('Cân bằng H2 + O2 → H2O và đổi 5 km ra m', 'vi');
    expect(facts.map((f) => f.kind)).toEqual(['balanced', 'computed']);
  });
});
