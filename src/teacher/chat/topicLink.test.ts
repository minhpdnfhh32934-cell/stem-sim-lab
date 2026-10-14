import { describe, expect, it } from 'vitest';
import { latestTopic, topicForText } from './topicLink';

const user = (content: string, prompt?: string) => ({
  role: 'user',
  content,
  ...(prompt ? { prompt } : {}),
});
const teacher = (content: string) => ({ role: 'assistant', content });

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

  it('keeps the accents the learner typed ("giảm phần" is not "giảm phân")', () => {
    expect(topicForText('Sau va chạm, cơ năng bị giảm phần lớn do ma sát?', 'vi')).toBeNull();
    expect(topicForText('Giảm phân tạo ra mấy tế bào con?', 'vi')?.id).toBe('meiosis');
    // Typed without any accent: folded, so the topic is still found.
    expect(topicForText('giam phan tao ra may te bao con?', 'vi')?.id).toBe('meiosis');
    // Composed or decomposed accents are the same text.
    expect(topicForText('Giảm phân là gì?'.normalize('NFD'), 'vi')?.id).toBe('meiosis');
  });

  it('accepts the old tone position and words typed without accents in an accented question', () => {
    // "hoá" (old style) is the title's "hóa".
    expect(topicForText('Giải thích cân bằng hoá học & Le Chatelier', 'vi')?.id).toBe(
      topicForText('Giải thích cân bằng hóa học & Le Chatelier', 'vi')?.id,
    );
    expect(topicForText('Giải thích cân bằng hoá học & Le Chatelier', 'vi')).not.toBeNull();
    expect(topicForText('Em chưa hiểu giam phan', 'vi')?.id).toBe('meiosis');
    // One accented word that differs still blocks the match.
    expect(topicForText('Em chưa hiểu giảm phần này', 'vi')).toBeNull();
  });
});

describe('which question the link follows', () => {
  it('a new question without a topic drops the old link', () => {
    const messages = [
      user('Vì sao NST nhân đôi trước nguyên phân?'),
      teacher('Để mỗi tế bào con nhận đủ bộ NST.'),
      user('Lực ma sát nghỉ là gì?'),
      teacher('Là lực giữ vật đứng yên trên mặt tiếp xúc.'),
    ];
    expect(latestTopic(messages, 'vi')).toBeNull();
  });

  it('a short new question of its own also drops the old link', () => {
    const messages = [
      user('Vì sao NST nhân đôi trước nguyên phân?'),
      teacher('Để mỗi tế bào con nhận đủ bộ NST.'),
      user('Ma sát là gì?'),
      teacher('Là lực cản chuyển động giữa hai mặt tiếp xúc.'),
    ];
    expect(latestTopic(messages, 'vi')).toBeNull();
  });

  it('a short reply to the teacher keeps the topic of the question before it', () => {
    const messages = [
      user('Vì sao NST nhân đôi trước nguyên phân?'),
      teacher('Để mỗi tế bào con nhận đủ bộ NST. Em thử nói xem NST xếp hàng ở kì nào?'),
      user('Ở kì giữa ạ.'),
      teacher('Đúng rồi!'),
    ];
    expect(latestTopic(messages, 'vi')?.id).toBe('mitosis');
    // A hesitant answer with "?" still answers the teacher's question.
    const hesitant = [...messages.slice(0, 2), user('Kì giữa ạ?'), teacher('Đúng rồi!')];
    expect(latestTopic(hesitant, 'vi')?.id).toBe('mitosis');
  });

  it('quick buttons ("Chậm hơn") rework the same question, even several in a row', () => {
    const messages = [
      user('Thả một vật rơi tự do từ 20 m'),
      teacher('Vật chạm đất sau khoảng 2 s.'),
      user('Chậm hơn', 'Giải thích lại chậm hơn, chia thành nhiều bước nhỏ.'),
      teacher('Bước 1…'),
      user('Cho ví dụ', 'Cho một ví dụ đời thường.'),
      teacher('Ví dụ…'),
    ];
    expect(latestTopic(messages, 'vi')?.id).toBe('freeFall');
  });

  it('the newest question that names a topic wins', () => {
    const messages = [
      user('Thả một vật rơi tự do từ 20 m'),
      teacher('…'),
      user('Vì sao NST nhân đôi trước nguyên phân?'),
      teacher('…'),
    ];
    expect(latestTopic(messages, 'vi')?.id).toBe('mitosis');
  });
});
