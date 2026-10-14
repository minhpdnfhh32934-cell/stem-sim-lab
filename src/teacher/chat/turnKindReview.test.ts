import { describe, expect, it } from 'vitest';
import teachingEval from '../../../tests/teaching/teaching-eval.json';
import teachingHeldout from '../../../tests/teaching/teaching-heldout.json';
import { turnKind } from './chatService';

/**
 * Second review of turnKind (2026-10-14): both error directions, with the reviewers' sentences.
 * A real answer read as a request loses "do not praise at once" (Gemma 1B then opens with
 * "Đúng!" on a wrong answer); a request read as an answer is judged instead of answered.
 */
const asked = [
  { role: 'user', content: 'Định luật II Newton nói gì?' },
  {
    role: 'assistant',
    content: 'a = F/m. Nếu khối lượng tăng gấp đôi mà lực giữ nguyên thì gia tốc thế nào?',
  },
];
const askedEn = [
  { role: 'user', content: "What does Newton's second law say?" },
  {
    role: 'assistant',
    content: 'a = F/m. If the mass doubles and the force stays the same, what happens to a?',
  },
];

const replies = [
  'Dạ, vật tiếp tục đi chậm dần rồi dừng lại ạ.',
  'Dạ, vật nhẹ rơi chậm hơn thầy ạ.',
  'Em nghĩ vật nặng rơi nhanh hơn, vật nhẹ chậm hơn cô ạ',
  'Vật tiếp tục đi thẳng đều ạ.',
  'Nó sẽ tiếp tục đi với vận tốc cũ ạ',
  'Chậm hơn thầy ạ',
  'Xe A chạy chậm hơn cô ạ',
  'Vật chậm lại thầy ạ.',
  'Xe sẽ chậm lại nha thầy',
  'Em cần biết khối lượng của vật ạ.',
  'Mình cần thêm lực kéo lớn hơn ạ',
  'Em cần một lực lớn hơn ma sát nghỉ cực đại ạ.',
  'Con cần biết thêm gia tốc trọng trường ạ',
  'Em lấy ví dụ cái tủ đứng yên khi đẩy nhẹ ạ.',
  'Lấy ví dụ: quyển sách nằm yên trên bàn ạ.',
  'Ví dụ khác nữa là cái xe đỗ trên dốc ạ.',
  'Ví dụ khác, quyển sách nằm yên trên bàn ạ.',
  'Enzyme không hiệu quả nữa ạ.',
  'Ở 80 độ enzyme không hiệu quả vì bị biến tính ạ',
  'Dạ, không hiệu quả bằng ạ',
  'Quả bóng chìm xuống rồi nổi lại ạ.',
  'Nối lại mạch thì đèn sáng ạ',
  'Tính a = 2,5 m/s² ạ.',
  'Tính a = F/m, ra 2,5 ạ',
  'Tính a = 10/4 ra 2,5 ạ',
  'Tính hợp lực: 10 - 4 = 6 N ạ',
  'Tính tổng lực: 3 + 4 = 7 N',
  'Tìm hợp lực: 5 - 3 = 2 N ạ',
  'Tính: 10 : 4 = 2,5 ạ',
  'Dạ, tính 46 : 2 = 23 ạ',
  'Tính: 2 x 5 = 10 N ạ',
  'Tính lại ra 2,5 ạ',
  'Tìm a = 2,5 m/s²',
  'Tính gia tốc trước ạ.',
  'Tính gia tốc bằng 10 chia 4 được 2,5 ạ',
  'Vẽ giản đồ lực trước ạ.',
  'Xác định các lực tác dụng lên vật trước ạ.',
  'Xác định được gia tốc là 2,5 ạ',
  'Phân tích lực F thành hai thành phần ạ.',
  'So sánh hai lực thấy bằng nhau ạ.',
  'Cân bằng phương trình được 2H2 + O2 → 2H2O ạ.',
  'Viết phương trình: Fe + 2HCl → FeCl2 + H2 ạ',
  'Giải phương trình được x = 2 ạ',
  'Kể tên: ti thể và lục lạp ạ',
  'Giải thích: vì lực ma sát cân bằng lực kéo ạ.',
  'Gia tốc thế nào? Gia tốc giảm một nửa ạ.',
  'Vì sao? Vì a tỉ lệ nghịch với m ạ.',
  'Cho em trả lời: gia tốc giảm một nửa ạ.',
  'Dạ cho em xin trả lời là gia tốc giảm một nửa ạ.',
  'Gợi ý của thầy giúp em ra 2,5 ạ',
  'Ví dụ đi bộ, chân không trượt nhờ ma sát nghỉ ạ.',
];
const repliesEn = [
  'Calculate a = 2.5 m/s²',
  'Find a = 2.5',
  'Calculate: 10 - 4 = 6 N',
  'Solve for a: 2.5',
  'Find a first, then v.',
  'Calculate the net force first.',
  'Work out the acceleration first.',
  'Determine the forces first.',
  'Compare: A falls faster.',
  'Explain: friction balances the pull.',
  'It halves? Because a = F/m.',
  'Another way is to use a = F/m.',
  'State changes from liquid to gas.',
  'More slowly than before.',
];
const requests = [
  'Một vật khối lượng 2 kg chịu lực 10 N. Hãy tính gia tốc của vật.',
  'Cho m = 2 kg, F = 10 N, tính gia tốc.',
  'Một vật 2 kg chịu lực 10 N, tính gia tốc của vật.',
  'Vật 2 kg chịu lực kéo 10 N tính gia tốc',
  'Bài tiếp theo: một vật 3 kg chịu lực 12 N, tính gia tốc',
  'Tính gia tốc khi m=4kg F=10N',
  'Tính gia tốc khi m=4kg,F=10N',
  'Tính gia tốc nếu m = 4 kg thì F = 10 N',
  'cho m=2kg, F=10N, tinh a',
  'Tại sao lại giảm một nửa ạ',
  'Lực ma sát nghỉ là gì',
  'Gia tốc của vật bằng bao nhiêu',
  'Vật 2 kg chịu lực 10 N. Gia tốc là bao nhiêu',
  'Còn nếu m = 8 kg thì gia tốc bằng bao nhiêu',
  'Vậy nếu lực tăng gấp đôi thì sao',
  'Làm sao để tính gia tốc',
  'Thầy ơi, công thức tính gia tốc là gì',
  'Là sao ạ',
  'Sao lại vậy thầy',
  'Ý thầy là sao',
  'tai sao lai giam mot nua',
  'Em k hiểu',
  'Em ko hỉu',
  'Em khum hiểu',
  'Em không theo kịp',
  'Nhanh quá em không theo kịp',
  'Em vẫn chưa nắm được',
  'Em bí rồi',
  'Khó quá thầy ơi',
  'Chỉ em cách làm với',
  'Chỉ giúp em bước này',
  'Ví dụ đi thầy',
  'Ví dụ cụ thể đi cô',
  'Thầy giáo ơi cho em ví dụ',
  'À cho em hỏi cái này',
  'Ủa thầy chỉ em lại đi',
  'Em cần giúp đỡ',
  'Gợi ý đi thầy',
  'Gợi ý cho em với',
  'Em xin gợi ý',
  'Xin gợi ý ạ',
  'Đáp án đi thầy',
  'Lời giải đi thầy',
  'Giải đi thầy',
  'Làm đi thầy',
  'Tiếp đi thầy',
  'Đọc chậm lại',
  'tinh gia toc cua vat 2kg chiu luc 10N',
  'tim gia toc',
  'thay cho em vi du di',
  'giai lai giup em',
  'lam lai di thay',
  'huong dan em voi',
  'chi em cach lam',
  'e ko hiu',
  'em k hieu',
  'giai thich ky hon',
  'thay noi cham lai',
];
const requestsEn = [
  'Given m = 4 kg and F = 10 N, find a.',
  'A 2 kg mass is pulled by 10 N, find the acceleration.',
  'Find a if m=4kg,F=10N',
  'Calculate a for m=4kg F=10N',
  'Now solve it with m = 8 kg.',
  'What do you mean',
  'Why does it halve',
  'If m = 4 kg and F = 10 N, what is a',
  'What is the acceleration if m = 4 kg',
  'How do I find the acceleration',
  'What is the answer',
  'Can u explain again',
  'pls explain again',
  'I dont understand',
  "I really don't understand",
  "I don't really get it",
  'Im lost',
  "Didn't get that",
  'Confused',
  'Can I get another example',
  'I need another example',
  'Example please',
  'Slow down please',
  'Teacher, explain again',
  'Sir, can you explain again',
  'Sorry, can you repeat that',
  'Wait, explain again',
  'Yes, give me another example',
  'I am not following',
  "I can't follow",
  'Not sure I follow',
  'Hint please',
  'Give a hint',
  'Just tell me the answer',
  'Just give me the answer',
];

describe('turnKind: answers stay answers, requests and questions do not', () => {
  it.each(replies)('a reply: %s', (text) => {
    expect(turnKind(text, asked)).toBe('learnerReply');
  });
  it.each(repliesEn)('a reply: %s', (text) => {
    expect(turnKind(text, askedEn)).toBe('learnerReply');
  });
  it.each(requests)('not a reply: %s', (text) => {
    expect(turnKind(text, asked)).not.toBe('learnerReply');
  });
  it.each(requestsEn)('not a reply: %s', (text) => {
    expect(turnKind(text, askedEn)).not.toBe('learnerReply');
  });

  it('keeps every evaluation item in its kind (replies with history, the rest after a check question)', () => {
    for (const item of [...teachingEval.items, ...teachingHeldout.items] as {
      id: string;
      question: string;
      history?: { role: string; content: string }[];
    }[]) {
      const kind = turnKind(item.question, item.history?.length ? item.history : asked);
      expect(kind === 'learnerReply', item.id).toBe((item.history?.length ?? 0) > 0);
    }
  });

  it('stays fast on a long message (no runaway regular expression)', () => {
    const long = 'Tính a = F/m, m = 4 kg, F = 10 N, '.repeat(60) + 'ra 2,5 ạ';
    const started = performance.now();
    turnKind(long, asked);
    turnKind('a'.repeat(2000), asked);
    turnKind('Thầy ơi, '.repeat(250), asked);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
