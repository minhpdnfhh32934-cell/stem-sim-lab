import { describe, expect, it } from 'vitest';
import { missingNumericData } from './missingData';

describe('a calculation request with no numbers at all', () => {
  it.each([
    ['Tính quãng đường ô tô đi được.', 'quãng đường'],
    ['Tính nồng độ mol của dung dịch.', 'nồng độ'],
    ['Tính số nhiễm sắc thể trong mỗi tế bào con sau nguyên phân.', 'số nhiễm sắc thể'],
    ['Hãy tính giúp em thời gian rơi của vật.', 'thời gian'],
    ['Tìm vận tốc của xe lúc về đích.', 'vận tốc'],
    ['Xác định thể tích khí thu được.', 'thể tích'],
    ['Tính pH của dung dịch axit này.', 'pH'],
    ['Tính số liên kết hiđro của gen.', 'số liên kết'],
    ['tinh quang duong xe di duoc', 'quang duong'],
    ['Calculate the speed of the car.', 'speed'],
    ['Find the current through the lamp.', 'current'],
  ])('%s → asks for the data (%s)', (question, quantity) => {
    expect(missingNumericData(question)).toEqual({ quantity });
  });

  it.each([
    // Standard constants or tables, not the learner's data.
    'Tính gia tốc rơi tự do ở mặt đất',
    'Tính khối lượng mol của nước',
    'Tính số nhiễm sắc thể trong tế bào sinh dưỡng của người',
    // How to compute, a formula, a definition.
    'Công thức tính động năng là gì?',
    'Tính như thế nào?',
    'Cách tính nồng độ mol?',
    'Vận tốc là gì?',
    'Động năng phụ thuộc vào những đại lượng nào?',
    'How do I calculate kinetic energy?',
    'What is the speed of light?',
    // Not a calculation.
    'Tìm hiểu về động lượng',
    'Tính chất hóa học của kim loại là gì?',
    'Xác định các kì của nguyên phân',
    'Lực ma sát nghỉ là gì? Cho một ví dụ.',
    'Gia tốc tăng gấp đôi ạ.',
    'Tinh bột gặp iot chuyển màu gì?',
  ])('%s → not a request for missing data', (question) => {
    expect(missingNumericData(question)).toBeNull();
  });

  it.each([
    // Numbers (some data given: P11-style problems are left to the teaching prompt).
    'Một ô tô đang chạy với vận tốc 20 m/s thì hãm phanh. Tính quãng đường ô tô đi được.',
    'Một bóng đèn mắc vào hiệu điện thế 220 V. Tính cường độ dòng điện.',
    'Hòa tan NaOH vào nước, thu được 250 ml dung dịch. Tính nồng độ mol.',
    'Tính thời gian rơi từ độ cao h = 20 m',
    // Numbers written in words, symbols, formulas.
    'Xe chạy hai giờ với tốc độ không đổi. Tính quãng đường.',
    'Tính quãng đường theo v và t.',
    'Tính số mol của NaOH.',
    'Tính thể tích khí CO₂ thu được.',
    'A car moves for ten seconds. Find the distance.',
  ])('%s → data may be there: no notice', (question) => {
    expect(missingNumericData(question)).toBeNull();
  });

  it('reads "sau" (after) and "sáu" (six) apart', () => {
    expect(missingNumericData('Tính số tế bào con sau nguyên phân.')).not.toBeNull();
    expect(missingNumericData('Tính số tế bào con sau sáu lần nguyên phân.')).toBeNull();
  });

  it('data given earlier in the conversation or on the shared screen counts', () => {
    const history = [
      { role: 'user', content: 'Một ô tô chạy đều với vận tốc 15 m/s trong 4 phút.' },
      { role: 'assistant', content: 'Em muốn tính gì từ các số này?' },
    ];
    expect(missingNumericData('Tính quãng đường ô tô đi được.', history)).toBeNull();
    expect(missingNumericData('Tính quãng đường ô tô đi được.', [], true)).toBeNull();
    // An old turn far back does not hide a new problem without numbers.
    const old = [
      { role: 'user', content: 'Cho m = 2 kg' },
      ...Array.from({ length: 6 }, () => ({ role: 'user', content: 'Lực là gì?' })),
    ];
    expect(missingNumericData('Tính quãng đường ô tô đi được.', old)).not.toBeNull();
  });
});

describe('well-posed questions that only look like they have no numbers (review 2)', () => {
  it.each([
    // "một" with a unit or a measure word is a value.
    'Tính chu kì con lắc dài một mét',
    'Tính vận tốc của vật rơi tự do sau một giây',
    'Tính số tế bào con sau một lần nguyên phân.',
    'tinh chu ki con lac dai mot met',
    // A symbolic answer: how one quantity depends on others.
    'Tính gia tốc theo lực và khối lượng',
    'Tìm vận tốc dưới dạng biểu thức.',
    'Find the acceleration in terms of the force and the mass.',
    // Values from tables (elements, materials).
    'Xác định số electron của nguyên tử natri',
    'Tìm khối lượng riêng của sắt',
    'Tính số proton trong hạt nhân nguyên tử lưu huỳnh',
    'Calculate the number of electrons in a sodium atom',
    'Find the density of copper.',
    // "Xác định lực": which forces act (a free-body question), not a value.
    'Xác định lực tác dụng lên vật đặt trên mặt bàn',
  ])('%s → no notice', (question) => {
    expect(missingNumericData(question)).toBeNull();
  });

  it.each([
    // "Một" in front of a thing is not a value.
    ['Một ô tô chạy trên đường. Tính quãng đường ô tô đi được.', 'quãng đường'],
    ['Một vật rơi tự do. Tính vận tốc của vật khi chạm đất.', 'vận tốc'],
    // A table quantity without the element or material is still missing.
    ['Tính khối lượng riêng của vật.', 'khối lượng riêng'],
    ['Tính số electron của nguyên tử.', 'số electron'],
    // "Xác định" a value of the force (its size) still needs numbers.
    ['Xác định độ lớn lực tác dụng lên vật.', 'độ lớn'],
    // "sát" (ma sát) is not "sắt" (iron), and lực is not a table value.
    ['Tính lực ma sát tác dụng lên vật.', 'lực'],
    ['tinh luc ma sat tac dung len vat', 'luc'],
  ])('%s → still asks for the data (%s)', (question, quantity) => {
    expect(missingNumericData(question)).toEqual({ quantity });
  });
});
