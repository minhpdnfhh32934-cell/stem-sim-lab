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
