import { describe, expect, it } from 'vitest';
import { gradeOf, POST } from './postLook';

describe('gradeOf', () => {
  const out = () => ({ warmth: 9, saturation: 9, contrast: 9 });

  it('a neutral room is drawn as it is, at any hour', () => {
    expect(gradeOf('neutral', 0.3, out())).toEqual({ warmth: 0, saturation: 1, contrast: 1 });
  });

  it("a hall follows the daylight from its night's grade to its day's", () => {
    expect(gradeOf('hall', 1, out())).toEqual(POST.grade.hall);
    expect(gradeOf('hall', 0, out())).toEqual(POST.grade.hallNight);
    const { hall, hallNight } = POST.grade;
    expect(gradeOf('hall', 0.5, out()).warmth).toBeCloseTo((hall.warmth + hallNight.warmth) / 2);
    expect(gradeOf('hall', 7, out())).toEqual(POST.grade.hall); // past day: day
  });
});
