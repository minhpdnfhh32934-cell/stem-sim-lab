import { describe, expect, it } from 'vitest';
import { parseTeachScript } from './teachscript';

/**
 * Audit G5: a sentence of the lesson is one voice request and one subtitle, so a "." that does
 * not end a sentence ("tr. 45", "v.v." mid-sentence, a step "1." or an option "A.") must not cut
 * it into fragments read on their own.
 */
const speech = (script: string) => parseTeachScript(script).sentences.map((s) => s.speech);

describe('TeachScript sentence ends', () => {
  it('keeps a page number and "v.v." inside their sentence', () => {
    expect(
      speech(
        'Theo SGK tr. 45, các lực ma sát, lực cản v.v. đều ngược chiều chuyển động. Vậy F = 10 N.',
      ),
    ).toEqual([
      'Theo SGK tr. 45, các lực ma sát, lực cản v.v. đều ngược chiều chuyển động.',
      'Vậy F = 10 N.',
    ]);
    // "v.v." that ends a sentence still ends it.
    expect(speech('Có nhiều lực: ma sát, lực cản v.v. Vậy ta xét ma sát.')).toEqual([
      'Có nhiều lực: ma sát, lực cản v.v.',
      'Vậy ta xét ma sát.',
    ]);
  });

  it('keeps numbered steps whole', () => {
    expect(speech('1. Tính gia tốc a = F/m. 2. Tính quãng đường s = 9.81 m.')).toEqual([
      '1. Tính gia tốc a = F/m.',
      '2. Tính quãng đường s = 9.81 m.',
    ]);
    // A number that ends a sentence still ends it.
    expect(speech('Kết quả là 5. Vậy xong.')).toEqual(['Kết quả là 5.', 'Vậy xong.']);
  });

  it('reads each answer option as one sentence', () => {
    expect(speech('A. 10 m/s B. 20 m/s C. 30 m/s')).toEqual([
      'A. 10 m/s',
      'B. 20 m/s',
      'C. 30 m/s',
    ]);
    expect(speech('A. Lực ma sát. B. Trọng lực.')).toEqual(['A. Lực ma sát.', 'B. Trọng lực.']);
    // "Chọn A." is an answer that ends its sentence, not an option list.
    expect(speech('Chọn A. Vì lực ma sát nhỏ.')).toEqual(['Chọn A.', 'Vì lực ma sát nhỏ.']);
  });

  it('starts the options after a colon on their own: each value stays with its letter', () => {
    expect(speech('Câu hỏi: A. 10 m/s B. 20 m/s')).toEqual(['Câu hỏi:', 'A. 10 m/s', 'B. 20 m/s']);
    expect(speech('Chọn đáp án đúng: A. Lực ma sát. B. Trọng lực. C. Lực đàn hồi.')).toEqual([
      'Chọn đáp án đúng:',
      'A. Lực ma sát.',
      'B. Trọng lực.',
      'C. Lực đàn hồi.',
    ]);
    // A colon before a single answer is not an option list.
    expect(speech('Đáp án: A. Vì lực ma sát nhỏ.')).toEqual(['Đáp án: A.', 'Vì lực ma sát nhỏ.']);
  });

  it('keeps every action in the sentence where its tag stood', () => {
    const r = parseTeachScript(
      '1. Ta có <write id="f1" zone="steps" math="true">a = \\frac{F}{m}</write> nhé. 2. Thay số <write id="r1" zone="steps">a = 5</write> ta được.',
    );
    expect(r.sentences.map((s) => s.speech)).toEqual(['1. Ta có nhé.', '2. Thay số ta được.']);
    expect(
      r.sentences.map((s) =>
        s.actions.map((a) => (a.action.kind === 'write' ? a.action.id : a.action.kind)),
      ),
    ).toEqual([['f1'], ['r1']]);
  });
});
