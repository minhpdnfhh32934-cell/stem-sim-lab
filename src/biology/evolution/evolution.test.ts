import { describe, expect, it } from 'vitest';
import {
  CYTOCHROME_C,
  EARTH_FORMED_MYA,
  GEOLOGIC,
  closest,
  duration,
  geoName,
  periodAt,
} from './model';

describe('evidence and macroevolution (SH12 Bài 19, 22)', () => {
  it('Bảng 19.1: the chimpanzee is closest, yeast farthest', () => {
    expect(CYTOCHROME_C.map((s) => s.cytochrome_c_diff)).toEqual([0, 1, 9, 10, 12, 18, 25, 40]);
    expect(closest(CYTOCHROME_C)?.id).toBe('chimp');
    expect(CYTOCHROME_C.at(-1)?.id).toBe('yeast');
  });

  it('Bảng 22.1: thirteen periods from the Archean to the Quaternary, no gaps', () => {
    expect(GEOLOGIC).toHaveLength(13);
    expect(GEOLOGIC[0]?.id).toBe('quaternary');
    expect(GEOLOGIC.at(-1)?.from_mya).toBe(3800);
    expect(EARTH_FORMED_MYA).toBe(4600);
  });

  it('finds the period of a time: the dinosaurs’ end, the Cambrian explosion', () => {
    expect(periodAt(66)?.id).toBe('cretaceous');
    expect(periodAt(500)?.id).toBe('cambrian');
    expect(periodAt(1)?.id).toBe('quaternary');
    expect(periodAt(3000)?.id).toBe('archean');
    expect(periodAt(5000)).toBeUndefined();
    const cretaceous = GEOLOGIC.find((p) => p.id === 'cretaceous');
    if (!cretaceous) throw new Error('no cretaceous');
    expect(duration(cretaceous)).toBe(79);
    expect(geoName('Mesozoic')?.vi).toBe('Mesozoic (Trung sinh)');
  });
});
