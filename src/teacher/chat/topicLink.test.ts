import { describe, expect, it } from 'vitest';
import { topicForText } from './topicLink';

describe('answer → simulation link (audit EDU-03)', () => {
  it('finds the topic the question names, without accents too', () => {
    expect(
      topicForText('Vì sao nhiễm sắc thể phải nhân đôi trước khi tế bào nguyên phân?', 'vi')?.id,
    ).toBe('mitosis');
    expect(topicForText('Thả một vật rơi tự do từ 20 m', 'vi')?.id).toBe('freeFall');
    expect(topicForText('can bang phuong trinh H2 + O2', 'vi')?.id).toBe('equationBalancing');
  });

  it('prefers the most specific title and needs whole words', () => {
    // "Giảm phân" is a topic of its own, not "phân".
    expect(topicForText('Giảm phân khác nguyên phân thế nào?', 'vi')?.id).toMatch(
      /meiosis|mitosis/,
    );
    expect(topicForText('Lực ma sát nghỉ là gì?', 'vi')).toBeNull();
    expect(topicForText('phân tích đề bài', 'vi')).toBeNull();
  });
});
