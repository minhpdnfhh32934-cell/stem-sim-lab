import { describe, expect, it } from 'vitest';
import { numberWordValues } from './numberWords';

describe('numbers written in words', () => {
  it.each([
    ['hai giờ', 2],
    ['mười lăm phút', 15],
    ['hai mươi lăm giây', 25],
    ['hai mươi mốt ngày', 21],
    ['một trăm hai mươi mét', 120],
    ['hai trăm linh năm', 205],
    ['hai nghìn năm trăm', 2500],
    ['ba triệu', 3_000_000],
    ['hai giờ rưỡi', 2.5],
    ['nửa giờ', 0.5],
    ['tăng gấp đôi', 2],
    ['hai muoi lam giay', 25],
    ['twenty five seconds', 25],
    ['one hundred and twenty', 120],
    ['two thousand', 2000],
    ['half an hour', 0.5],
    ['twice as fast', 2],
  ])('%s gives %d', (text, value) => {
    expect(numberWordValues(text)).toContain(value);
  });

  it('reads accents: "sau" (after) is not "sáu" (six), "bốn" is four', () => {
    expect(numberWordValues('Vật dừng sau khi trượt.')).toEqual([]);
    expect(numberWordValues('sáu giây')).toEqual([6]);
    expect(numberWordValues('Có bốn lực')).toEqual([4]);
  });

  it('gives nothing for text without number words', () => {
    expect(numberWordValues('Tính quãng đường ô tô đi được.')).toEqual([]);
    expect(numberWordValues('')).toEqual([]);
  });
});
