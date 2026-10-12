import { describe, expect, it } from 'vitest';
import { toLesson } from './lesson';

describe('toLesson (board view of an answer)', () => {
  it('heading → title, numbered items → steps, formula stays with its sentence', () => {
    const lesson = toLesson(
      [
        '# Rơi tự do',
        '',
        '1. Chọn chiều dương hướng xuống.',
        '2. Viết công thức quãng đường:',
        '$$s = \\frac{1}{2} g t^2$$',
        '3. Thay số đã cho trong đề.',
      ].join('\n'),
      'câu hỏi',
    );
    expect(lesson.title).toBe('Rơi tự do');
    expect(lesson.steps).toEqual([
      'Chọn chiều dương hướng xuống.',
      'Viết công thức quãng đường:\n\n$$s = \\frac{1}{2} g t^2$$',
      'Thay số đã cho trong đề.',
    ]);
  });

  it('without a heading the learner’s question is the title; paragraphs are steps', () => {
    const lesson = toLesson(
      'Lực là tác dụng đẩy hoặc kéo.\nĐơn vị là newton.\n\nLực có hướng và độ lớn.',
      '  Lực là gì?  ',
    );
    expect(lesson.title).toBe('Lực là gì?');
    expect(lesson.steps).toEqual([
      'Lực là tác dụng đẩy hoặc kéo. Đơn vị là newton.',
      'Lực có hướng và độ lớn.',
    ]);
  });

  it('sub-headings start a step that keeps their paragraphs and bullet points', () => {
    const lesson = toLesson(
      '# Bài 1\n## Bước 1: Phân tích\nĐề cho m và a.\n\n- m = 2 kg\n- a = 3 m/s²\n## Bước 2: Áp dụng\nF = m·a.',
      'q',
    );
    expect(lesson.steps).toEqual([
      '**Bước 1: Phân tích**\n\nĐề cho m và a.\n- m = 2 kg\n- a = 3 m/s²',
      '**Bước 2: Áp dụng**\n\nF = m·a.',
    ]);
  });

  it('keeps the answer’s own text (nothing added) and handles odd input', () => {
    expect(toLesson('', 'Câu hỏi').steps).toEqual([]);
    const long = 'x'.repeat(200);
    expect(toLesson('Một câu.', long).title.length).toBeLessThanOrEqual(90);
    const text = 'Đoạn **quan trọng** với $v = at$.';
    expect(toLesson(text, 'q').steps).toEqual([text]);
  });
});
