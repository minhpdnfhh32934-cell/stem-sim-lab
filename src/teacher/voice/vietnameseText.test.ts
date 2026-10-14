import { describe, expect, it } from 'vitest';
import {
  readInteger,
  readLatex,
  readNumber,
  readUnit,
  splitForSpeech,
  toSpeech,
} from './vietnameseText';

describe('Vietnamese numbers', () => {
  it.each([
    ['0', 'không'],
    ['5', 'năm'],
    ['10', 'mười'],
    ['11', 'mười một'],
    ['14', 'mười bốn'],
    ['15', 'mười lăm'],
    ['21', 'hai mươi mốt'],
    ['24', 'hai mươi tư'],
    ['25', 'hai mươi lăm'],
    ['30', 'ba mươi'],
    ['105', 'một trăm linh năm'],
    ['110', 'một trăm mười'],
    ['1000', 'một nghìn'],
    ['1005', 'một nghìn không trăm linh năm'],
    ['2026', 'hai nghìn không trăm hai mươi sáu'],
    ['15000', 'mười lăm nghìn'],
    ['1000000', 'một triệu'],
    ['2500000000', 'hai tỷ năm trăm triệu'],
  ])('%s → %s', (n, words) => {
    expect(readInteger(n)).toBe(words);
  });

  it('reads the decimal comma like a teacher', () => {
    expect(readNumber('9,81')).toBe('chín phẩy tám mốt');
    expect(readNumber('3,14')).toBe('ba phẩy mười bốn');
    expect(readNumber('0,5')).toBe('không phẩy năm');
    expect(readNumber('0,05')).toBe('không phẩy không năm');
    expect(readNumber('9,8')).toBe('chín phẩy tám');
    expect(readNumber('1,4142')).toBe('một phẩy bốn một bốn hai');
    expect(readNumber('-5')).toBe('âm năm');
  });

  it('understands both Vietnamese and English digit grouping', () => {
    expect(readNumber('1.250.000')).toBe('một triệu hai trăm năm mươi nghìn');
    expect(readNumber('1.000')).toBe('một nghìn');
    expect(readNumber('2,5')).toBe('hai phẩy năm');
    expect(readNumber('3.5')).toBe('ba phẩy năm');
    expect(readNumber('1,000,000')).toBe('một triệu');
  });
});

describe('units', () => {
  it.each([
    ['m/s', 'mét trên giây'],
    ['m/s²', 'mét trên giây bình phương'],
    ['m/s^2', 'mét trên giây bình phương'],
    ['km/h', 'ki-lô-mét trên giờ'],
    ['m²', 'mét vuông'],
    ['cm³', 'xen-ti-mét khối'],
    ['kg', 'ki-lô-gam'],
    ['N', 'niu-tơn'],
    ['J/(kg·K)', 'jun trên ki-lô-gam ken-vin'],
    ['g/mol', 'gam trên mol'],
    ['kWh', 'ki-lô-oát giờ'],
    ['°C', 'độ xê'],
    ['Ω', 'ôm'],
    ['s⁻¹', 'giây mũ trừ một'],
  ])('%s → %s', (u, words) => {
    expect(readUnit(u)).toBe(words);
  });

  it('refuses words that are not units', () => {
    expect(readUnit('con')).toBeNull();
    expect(readUnit('xyz')).toBeNull();
  });
});

describe('toSpeech', () => {
  it('reads a physics sentence with numbers, units and a symbol', () => {
    expect(toSpeech('Gia tốc rơi tự do g = 9,81 m/s².')).toBe(
      'Gia tốc rơi tự do gờ bằng chín phẩy tám mốt mét trên giây bình phương.',
    );
    expect(toSpeech('Vận tốc v0 = 20 m/s, sau 2 s.')).toBe(
      'Vận tốc vê không bằng hai mươi mét trên giây, sau hai giây.',
    );
  });

  it('keeps Vietnamese words that only look like units', () => {
    expect(toSpeech('Sau 2 giờ, xe đi được 3 con dốc.')).toBe(
      'Sau hai giờ, xe đi được ba con dốc.',
    );
    expect(toSpeech('Ta có: Ba vật cùng rơi.')).toBe('Ta có: Ba vật cùng rơi.');
  });

  it('reads plain formulas and LaTeX', () => {
    expect(toSpeech('F = m·a')).toBe('ép bằng mờ nhân a');
    expect(toSpeech('$W_d = \\frac{1}{2}mv^2$')).toBe(
      'vê kép đê bằng một phần hai mờ vê bình phương',
    );
    expect(toSpeech('$v = \\sqrt{2gh}$')).toBe('vê bằng căn bậc hai của hai gờ hát');
    expect(toSpeech('$\\Delta t = 0{,}5\\,\\text{s}$')).toBe('đen-ta tê bằng không phẩy năm giây');
    expect(toSpeech('$g = 9{,}81\\,\\text{m/s}^2$')).toBe(
      'gờ bằng chín phẩy tám mốt mét trên giây bình phương',
    );
    expect(toSpeech('$\\vec{F}$')).toBe('véc-tơ ép');
  });

  it('reads powers of ten and scientific notation', () => {
    expect(toSpeech('c = 3 × 10^8 m/s')).toBe('xê bằng ba nhân mười mũ tám mét trên giây');
    // The Vietnamese dot before a power of ten is a multiplication, never a decimal point.
    expect(toSpeech('N_A = 6,02.10²³')).toBe(
      'nờ a bằng sáu phẩy không hai nhân mười mũ hai mươi ba',
    );
    expect(toSpeech('q = 1,6 × 10⁻¹⁹ C')).toBe(
      'quy bằng một phẩy sáu nhân mười mũ trừ mười chín cu-lông',
    );
  });

  it('reads chemistry formulas, coefficients, charges and reactions', () => {
    expect(toSpeech('H₂O')).toBe('hát hai ô');
    expect(toSpeech('2H2 + O2 → 2H2O')).toBe('hai hát hai cộng ô hai tạo thành hai hát hai ô');
    expect(toSpeech('NaCl tan trong nước')).toBe('nờ a xê lờ tan trong nước');
    expect(toSpeech('ion SO₄²⁻')).toBe('ion ét ô bốn hai trừ');
    expect(toSpeech('Fe³⁺')).toBe('ép e ba cộng');
  });

  it('reads Greek letters, percents, angles and dates', () => {
    expect(toSpeech('góc α = 30°')).toBe('góc an-pha bằng ba mươi độ');
    expect(toSpeech('hiệu suất 85%')).toBe('hiệu suất tám mươi lăm phần trăm');
    expect(toSpeech('ngày 12/10/2026')).toBe(
      'ngày mười hai tháng mười năm hai nghìn không trăm hai mươi sáu',
    );
    expect(toSpeech('lấy 1/2 cốc')).toBe('lấy một phần hai cốc');
  });

  it('cleans markdown and keeps headings as sentences', () => {
    expect(toSpeech('### Bước 1:\n**Đậm** và *nghiêng*\n- ý một')).toBe(
      'Bước một.\nĐậm và nghiêng\ný một',
    );
    expect(toSpeech('```python\nprint(1)\n```')).toBe('(đoạn mã trong tin nhắn)');
    expect(toSpeech('Xem [hình](http://x) và SGK')).toBe('Xem hình và sách giáo khoa');
  });

  it('removes known tags only: a comparison without spaces is read, not dropped', () => {
    expect(toSpeech('Ta có x<y khi y>0.')).toBe('Ta có ích nhỏ hơn i khi i lớn hơn không.');
    expect(toSpeech('a<b and c>d')).toBe('a nhỏ hơn bê and xê lớn hơn đê');
    expect(toSpeech('<b>Gia tốc</b> của nước H<sub>2</sub>O<br/>là gì')).toBe(
      'Gia tốc của nước hát hai ô là gì',
    );
  });

  it('never leaves raw digits or LaTeX for the voice', () => {
    const out = toSpeech(
      'Ta có $a = \\frac{F}{m} = \\frac{10}{2} = 5\\,\\text{m/s}^2$, tức là 5 m/s² (theo SGK).',
    );
    expect(out).not.toMatch(/[\d\\{}$^]/);
  });
});

describe('splitForSpeech', () => {
  it('cuts into phrases with longer pauses between paragraphs than sentences', () => {
    const chunks = splitForSpeech('Câu một. Câu hai!\nĐoạn mới: ý đầu; ý sau');
    expect(chunks.map((c) => c.text)).toEqual([
      'Câu một.',
      'Câu hai!',
      'Đoạn mới:',
      'ý đầu;',
      'ý sau',
    ]);
    const [a, b, c, d, e] = chunks;
    expect(b?.pauseMs).toBeGreaterThan(a?.pauseMs ?? 0);
    expect(c?.pauseMs).toBeLessThan(a?.pauseMs ?? 0);
    expect(d?.pauseMs).toBeGreaterThan(0);
    expect(e?.pauseMs).toBe(0);
  });

  it('splits very long sentences at commas, never over the limit', () => {
    const long = Array.from({ length: 30 }, (_, i) => `phần ${String(i)}`).join(', ');
    const chunks = splitForSpeech(long, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 60)).toBe(true);
  });
});

describe('readLatex', () => {
  it('separates products of single letters but keeps words', () => {
    expect(readLatex('mv').trim()).toBe('mờ vê');
    expect(readLatex('v_{max}').replace(/\s+/g, ' ').trim()).toBe('vê cực đại');
  });
});
