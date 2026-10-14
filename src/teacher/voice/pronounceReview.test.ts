import { describe, expect, it } from 'vitest';
import { readUnit, toSpeech } from './vietnameseText';

/**
 * Second review of the Vietnamese reading (2026-10-14): each case is a sentence a teacher writes
 * that a rule of the first round read wrongly.
 */
describe('mega-, giga- and kilo- units are never read as a molar concentration', () => {
  it.each([
    [
      'Năng lượng tỏa ra là 17,6 MeV.',
      'Năng lượng tỏa ra là mười bảy phẩy sáu mê-ga e-léc-tron vôn.',
    ],
    ['Hạt có động năng 2 GeV.', 'Hạt có động năng hai gi-ga e-léc-tron vôn.'],
    ['Tia X có năng lượng 30 keV.', 'Tia ích có năng lượng ba mươi ki-lô e-léc-tron vôn.'],
    ['Áp suất 5 MPa.', 'Áp suất năm mê-ga-pát-xcan.'],
    ['Mô-đun Young của thép 200 GPa.', 'Mô-đun Young của thép hai trăm gi-ga-pát-xcan.'],
    ['Điện trở 1 MΩ.', 'Điện trở một mê-ga-ôm.'],
    ['Hiệu điện thế 2 MV.', 'Hiệu điện thế hai mê-ga-vôn.'],
  ])('%s', (text, reading) => {
    expect(toSpeech(text)).toBe(reading);
  });

  it('reads M and mM only as a whole unit, and M only in a chemistry text', () => {
    // A physics mass "2M" (twice the mass M) is a symbol.
    expect(toSpeech('Vật có khối lượng 2M.')).toBe('Vật có khối lượng hai mờ.');
    expect(toSpeech('Hai vật khối lượng M và 2M.')).toBe('Hai vật khối lượng mờ và hai mờ.');
    // Concentrations keep their reading.
    expect(toSpeech('Nồng độ 0,5M và 2 mM')).toBe(
      'Nồng độ không phẩy năm mol trên lít và hai mi-li-mol trên lít',
    );
    expect(toSpeech('Dung dịch HCl 0,1 M.')).toBe(
      'Dung dịch hát xê lờ không phẩy một mol trên lít.',
    );
    // A unit that starts with M is never cut into "M" + the rest.
    expect(readUnit('MeV')).toBe('mê-ga e-léc-tron vôn');
    expect(readUnit('MPa')).toBe('mê-ga-pát-xcan');
    expect(readUnit('MΩ')).toBe('mê-ga-ôm');
    expect(readUnit('Mm')).toBeNull();
    expect(readUnit('M')).toBeNull();
    expect(readUnit('M', { molar: true })).toBe('mol trên lít');
    expect(readUnit('mM')).toBe('mi-li-mol trên lít');
    expect(readUnit('mMs')).toBeNull();
  });
});

describe('"tan" is a function only before an angle', () => {
  it.each([
    'Hòa tan 5,85 g NaCl vào nước.',
    'Hoà tan 2 g đường.',
    'Độ tan S của NaCl ở 20 °C.',
    'Khối lượng chất tan (NaCl) là 5 g.',
    'Cho nước đá tan 200 g.',
    'Muối tan trong nước.',
    'Chất này không tan 1 phần nào.',
  ])('%s', (text) => {
    expect(toSpeech(text)).not.toMatch(/tang/);
  });

  it.each([
    ['tan 45° = 1', 'tang bốn mươi lăm độ bằng một'],
    ['tan α = 0,5', 'tang an-pha bằng không phẩy năm'],
    ['tan(30°)', 'tang (ba mươi độ)'],
    ['y = tan(x)', 'i bằng tang (ích)'],
    ['tan x = 1', 'tang ích bằng một'],
    ['tan²x', 'tang bình phương ích'],
    ['tan(π/4) = 1', 'tang (pi trên bốn) bằng một'],
  ])('%s', (text, reading) => {
    expect(toSpeech(text)).toBe(reading);
  });
});

describe('words that open a numbered step or an option stay words in chemistry', () => {
  it('a step "1." or an option "A." opens the sentence', () => {
    expect(toSpeech('1. Ta có phương trình phản ứng: Fe + S → FeS.')).toMatch(
      /^một, Ta có phương trình phản ứng:/,
    );
    expect(toSpeech('2. Ba kim loại Na, K, Ca.')).toBe('hai, Ba kim loại nờ a, ca, xê a.');
    expect(toSpeech('A. Ba kim loại kiềm thổ.')).toBe('a, Ba kim loại kiềm thổ.');
    expect(toSpeech('Có hai bước: 1. Ta tính số mol nguyên tử Na.')).toBe(
      'Có hai bước: một, Ta tính số mol nguyên tử nờ a.',
    );
  });

  it('"La Mã" and a unit after a number are not element symbols', () => {
    expect(toSpeech('Nhóm của nguyên tố được ghi bằng chữ số La Mã.')).toBe(
      'Nhóm của nguyên tố được ghi bằng chữ số La Mã.',
    );
    expect(toSpeech('Ở 101 325 Pa, phản ứng xảy ra.')).toBe(
      'Ở một trăm linh một nghìn ba trăm hai mươi lăm pát-xcan, phản ứng xảy ra.',
    );
    // Still spelled elsewhere in a chemistry text.
    expect(toSpeech('Cho La vào dung dịch.')).toBe('Cho lờ a vào dung dịch.');
  });
});

describe('arrows: gas and precipitate only after a formula, "tạo thành" only between species', () => {
  it.each([
    ['Khi tần số ↑ thì động năng electron ↑.', 'Khi tần số tăng thì động năng electron tăng.'],
    ['Nhiệt độ ↑ → tốc độ phản ứng ↑.', 'Nhiệt độ tăng suy ra tốc độ phản ứng tăng.'],
    ['Nồng độ ion H+ ↓ thì pH ↑.', 'Nồng độ ion hát cộng giảm thì pê hát tăng.'],
  ])('%s', (text, reading) => {
    expect(toSpeech(text)).toBe(reading);
  });

  it('reads a gas and a precipitate right after their formula', () => {
    expect(toSpeech('Zn + 2HCl → ZnCl₂ + H₂↑')).toBe(
      'dét nờ cộng hai hát xê lờ tạo thành dét nờ xê lờ hai cộng hát hai bay lên',
    );
    expect(toSpeech('BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl')).toBe(
      'bê a xê lờ hai cộng nờ a hai ét ô bốn tạo thành bê a ét ô bốn kết tủa cộng hai nờ a xê lờ',
    );
    expect(toSpeech('Khí CO2 ↑ thoát ra.')).toBe('Khí xê ô hai bay lên thoát ra.');
  });

  it('a causal arrow is "suy ra", even in a text about ATP or a reaction', () => {
    expect(toSpeech('ATP cung cấp năng lượng. Nhiệt độ cao → enzim biến tính.')).toBe(
      'a tê pê cung cấp năng lượng. Nhiệt độ cao suy ra enzim biến tính.',
    );
    expect(toSpeech('ATP → ADP + Pi')).toBe('a tê pê tạo thành a đê pê cộng pê i');
    expect(toSpeech('Phản ứng 2H2 + O2 → 2H2O tỏa nhiệt, nhiệt độ tăng → áp suất tăng.')).toBe(
      'Phản ứng hai hát hai cộng ô hai tạo thành hai hát hai ô tỏa nhiệt, nhiệt độ tăng suy ra áp suất tăng.',
    );
    expect(toSpeech('Fe + S → FeS')).toBe('ép e cộng ét tạo thành ép e ét');
    expect(toSpeech('Cu²⁺ + 2e → Cu')).toBe('xê u hai cộng cộng hai e tạo thành xê u');
    expect(toSpeech('Glucozơ → 2 pyruvat')).toMatch(/^Glucozơ tạo thành hai pyruvat/);
    expect(toSpeech('Khi T ↑ → V ↑')).toBe('Khi tê tăng suy ra vê tăng');
  });

  it('a lone element among the products of a reaction can be a gas or a precipitate', () => {
    const read = toSpeech('Na2S2O3 + H2SO4 → Na2SO4 + S↓ + SO2↑ + H2O');
    expect(read).toContain('cộng ét kết tủa cộng ét ô hai bay lên');
    expect(toSpeech('Fe³⁺ + 3OH⁻ → Fe(OH)₃↓')).toBe(
      'ép e ba cộng cộng ba ô hát trừ tạo thành ép e ô hát ba kết tủa',
    );
  });
});

describe('Vietnamese words with "y"', () => {
  it.each(['Hy Lạp', 'bạn Vy', 'cô My và cô Ly', 'em Thy'])('%s', (text) => {
    expect(toSpeech(text)).toBe(text);
  });
});

describe('unit names are read as units, not spelled', () => {
  it.each([
    ['[ρ] = kg/m³', 'rô bằng ki-lô-gam trên mét khối'],
    ['Đổi ra mm.', 'Đổi ra mi-li-mét.'],
    ['Diện tích tính bằng mm².', 'Diện tích tính bằng mi-li-mét vuông.'],
    ['Thể tích đo bằng cm³.', 'Thể tích đo bằng xen-ti-mét khối.'],
  ])('%s', (text, reading) => {
    expect(toSpeech(text)).toBe(reading);
  });

  it('formulas and genotypes are still spelled', () => {
    expect(toSpeech('F = mg')).toBe('ép bằng mờ gờ');
    expect(toSpeech('A = Fs')).toBe('a bằng ép ét');
    expect(toSpeech('Kiểu gen mm và Mm.')).toBe('Kiểu gen mờ mờ và mờ mờ.');
  });
});
