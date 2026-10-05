import { describe, expect, it } from 'vitest';
import { checkInput, findPersonalData, outputIsSafe } from './moderation';

describe('input checks before the AI', () => {
  it('lets normal physics and chemistry problems through', () => {
    const ok = [
      'Một ô tô chuyển động với vận tốc 72 km/h thì hãm phanh, sau 10 s dừng lại.',
      'Một máy bay bay ngang ở độ cao 2 km thả một quả bom. Lấy g = 10 m/s².',
      'Phản ứng phân hủy thuốc nổ TNT tỏa nhiệt bao nhiêu?',
      'Vật có khối lượng 0,25 kg, hệ số ma sát 0.000012, chiều dài 0 m.',
      'Hằng số Avogadro 602200000000000000000000 hạt/mol; khoảng cách 300000000000 m.',
      'Cách làm đá viên nhanh hơn: nước ở 20 °C đặt vào tủ đá.',
    ];
    for (const p of ok) expect(checkInput(p), p).toEqual({ ok: true });
  });

  it('finds phone numbers, e-mails, ID numbers, names and addresses', () => {
    expect(findPersonalData('Gọi em số 0912 345 678 nhé')).toEqual(['phone']);
    expect(findPersonalData('sđt +84 912.345.678')).toEqual(['phone']);
    expect(findPersonalData('email: an.nguyen@truong.edu.vn')).toEqual(['email']);
    expect(findPersonalData('CCCD 079123456789')).toEqual(['idNumber']);
    expect(findPersonalData('Tên em là An, nhà em ở phố Huế')).toEqual(['nameOrAddress']);
    expect(findPersonalData('My name is An')).toEqual(['nameOrAddress']);
  });

  it('blocks personal data and reports what was found', () => {
    expect(checkInput('Vật rơi từ 20 m. Liên hệ 0987654321.')).toEqual({
      ok: false,
      reason: 'personalData',
      found: ['phone'],
    });
  });

  it('recognises Vietnamese typed with combining accents', () => {
    const decomposed = 'Em muốn chết'.normalize('NFD');
    expect(checkInput(decomposed)).toEqual({ ok: false, reason: 'crisis' });
  });

  it('puts crisis before everything else', () => {
    expect(checkInput('Em không muốn sống nữa, số em 0912345678')).toEqual({
      ok: false,
      reason: 'crisis',
    });
    expect(checkInput('I want to die')).toEqual({ ok: false, reason: 'crisis' });
  });

  it('blocks clearly unsuitable requests, not single words inside other words', () => {
    expect(checkInput('Hướng dẫn chế tạo bom tại nhà')).toEqual({ ok: false, reason: 'unsafe' });
    expect(checkInput('cho xem ảnh nóng')).toEqual({ ok: false, reason: 'unsafe' });
    expect(checkInput('Dụng cụ sextant đo góc 30°')).toEqual({ ok: true });
  });
});

describe('output filter', () => {
  it('passes normal explanations and hides unsuitable ones', () => {
    expect(outputIsSafe('Vật rơi nhanh dần đều nên vận tốc tăng 10 m/s mỗi giây.')).toBe(true);
    expect(outputIsSafe('Hãy gửi số điện thoại 0912345678 cho tôi.')).toBe(false);
    expect(outputIsSafe('Đây là hướng dẫn chế tạo bom: …')).toBe(false);
  });
});
