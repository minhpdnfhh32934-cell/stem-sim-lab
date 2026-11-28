import { describe, expect, it } from 'vitest';
import evalSet from '../../../tests/teaching/teaching-eval.json';
import heldout from '../../../tests/teaching/teaching-heldout.json';
import heldout2 from '../../../tests/teaching/teaching-heldout-2.json';
import retrieval from '../../../tests/teaching/retrieval-heldout.json';
import { continuesGame, isGameQuestion, phrases, searchGameGuide } from './gameGuide';

const { contextPrompt } = await import('./chatService');

const GAME = [
  'Trong game SimLab 3D có những phòng nào?',
  'Game này chơi thế nào ạ?',
  'Thầy Quang ở đâu?',
  'thay quang o dau',
  'Ở phòng chuẩn bị phải làm gì?',
  'Khu ném xiên có thí nghiệm gì?',
  'How do I open SimLab 3D?',
  'Where is Mr. Quang in the game?',
  'Em muốn tạo nhân vật của bạn trong SimLab 3D thì làm sao?',
  'Phòng giáo viên có gì?',
  'How do I join a LAN room in SimLab 3D?',
];

const NOT_GAME = [
  'Lực ma sát nghỉ là gì? Cho một ví dụ.',
  'Một em bé chơi trò chơi đu quay, tính gia tốc hướng tâm.',
  'In a game of billiards, ball A hits ball B at rest. What happens to the momentum?',
  'What does game theory say about cooperation?',
  'Phòng thí nghiệm hóa học cần những dụng cụ nào?',
  'Tầm xa của vật ném xiên phụ thuộc vào gì?',
  'Em thấy quang phổ vạch khó hiểu quá.',
  'What is the projectile range of a ball thrown at 30° with 20 m/s?',
  'Trong trò chơi đu quay, em bé chịu lực hướng tâm bao nhiêu?',
  'Cây phong lan sống bám trên thân cây khác là quan hệ gì?',
  'Thầy ra đề kiểm tra kiến thức động học cho em nhé.',
  'Khi phát hiện cháy thì phải gọi 114 đúng không?',
  'Trong phòng thực hành hóa học cần lưu ý gì về an toàn?',
];

describe('isGameQuestion', () => {
  it.each(GAME)('reads "%s" as a game question', (q) => {
    expect(isGameQuestion(q)).toBe(true);
  });
  it.each(NOT_GAME)('reads "%s" as another question', (q) => {
    expect(isGameQuestion(q)).toBe(false);
  });

  it('finds no game question in the evaluation and held-out sets (their prompts are unchanged)', () => {
    const questions = [
      ...evalSet.items.map((i) => i.question),
      ...heldout.items.map((i) => i.question),
      ...heldout2.items.map((i) => i.question),
      ...retrieval.items.map((i) => i.q),
    ];
    expect(questions.length).toBeGreaterThan(100);
    expect(questions.filter(isGameQuestion)).toEqual([]);
  });

  it('reads the older tone placement as the app writes it, but not "quý"', () => {
    const fire = phrases(['cứu hỏa']);
    expect(fire('Trong game gọi cứu hoả thế nào?')).toBe(true);
    expect(fire('Trong game gọi cứu hỏa thế nào?')).toBe(true);
    expect(phrases(['thủy'])('Thuỷ ngân')).toBe(true);
    expect(phrases(['quý'])('Kim loại quý')).toBe(true);
    expect(phrases(['hoàn'])('bảng tuần hoàn')).toBe(true);
  });

  it('goes on with a game question only for the game’s own things', () => {
    const before = 'Trong game SimLab 3D có những phòng nào?';
    expect(continuesGame('Còn phòng Hóa thì sao?', before)).toBe(true);
    expect(continuesGame('Nhân vật nào cao nhất?', before)).toBe(true);
    // Science after a game question: "của", "phóng", "thầy", "bảng tuần hoàn" name no game thing.
    expect(continuesGame('Công thức của động năng là gì?', before)).toBe(false);
    expect(continuesGame('Phóng xạ alpha là gì?', before)).toBe(false);
    expect(continuesGame('Thầy giải thích giúp em định luật Ôm.', before)).toBe(false);
    expect(continuesGame('Bảng tuần hoàn có bao nhiêu nhóm?', before)).toBe(false);
    expect(continuesGame('Nhân vật nào cao nhất?', 'Lực ma sát là gì?')).toBe(false);
  });
});

describe('searchGameGuide', () => {
  it.each([
    ['Trong game, thí nghiệm rơi tự do làm thế nào?', 'vi', 'experiment:free-fall'],
    ['Thầy Quang trong game giúp được gì?', 'vi', 'npc:teacher'],
    ['Trong game chơi nhiều người qua LAN thế nào?', 'vi', 'lan'],
    ['Trong game bấm phím nào để nhảy?', 'vi', 'controls'],
    // "mình", "tuần hoàn": no character (Minh, Tuấn) is read into them.
    ['Trong game mình bấm phím gì để nhảy?', 'vi', 'controls'],
    ['Trong game, bảng tuần hoàn ở đâu?', 'vi', 'hub-boards'],
    ['Trong game làm sao để chạy nhanh?', 'vi', 'controls'],
    ['Phòng chuẩn bị: vào phòng sạch gồm những bước nào?', 'vi', 'procedure:cleanroom-entry'],
    ['In the game, how do I run the pendulum experiment?', 'en', 'experiment:pendulum'],
    ['Trong game có những nhân vật nào, tạo nhân vật thế nào?', 'vi', 'characters'],
    [
      'Thầy Quang chấm bài kiểm tra trong game thế nào, ngân hàng có bao nhiêu câu?',
      'vi',
      'test-papers',
    ],
    ['Laptop ở sảnh trong game có những cuốn sách nào?', 'vi', 'laptop-books'],
    ['Bảng tuần hoàn và bảng tiến độ học tập ở sảnh SimLab 3D ở đâu?', 'vi', 'hub-boards'],
    ['Trong game, bàn làm việc có mấy bước và sai số tính thế nào?', 'vi', 'how-experiments-work'],
    ['Trong game, cháy mạch điện thì gọi 114 thế nào?', 'vi', 'emergency'],
    ['Màn mở đầu tên lửa của SimLab 3D có gì?', 'vi', 'menu-and-saves'],
  ] as const)('answers "%s" with its section first', async (q, locale, id) => {
    const [best] = await searchGameGuide(q, locale, 1);
    expect(best?.id).toBe(`builtin:game:${id}`);
  });

  it('gives a cloud prompt the overview first, then the best matches', async () => {
    const notes = await searchGameGuide('Trong game, thí nghiệm rơi tự do làm thế nào?', 'vi', 4);
    expect(notes[0]?.id).toBe('builtin:game:overview');
    expect(notes.map((n) => n.id)).toContain('builtin:game:experiment:free-fall');
    expect(notes.length).toBeLessThanOrEqual(4);
    expect(notes[0]?.name).toBe('Hướng dẫn SimLab 3D · SimLab 3D là gì, mở ở đâu');
    expect(notes[0]?.text).toContain('Trạng thái:');
  });

  it('falls back to the overview when nothing matches', async () => {
    const [only] = await searchGameGuide('game xyz', 'vi', 1);
    expect(only?.id).toBe('builtin:game:overview');
  });
});

describe('contextPrompt for the game', () => {
  const question = 'Trong game SimLab 3D, thí nghiệm rơi tự do ở phòng nào?';

  it('adds the game rule and guide sections to the cloud prompt', async () => {
    const prompt = await contextPrompt(question, 'vi', false, false, false);
    expect(prompt.system).toContain('Hướng dẫn SimLab 3D');
    expect(prompt.system).toContain('nói thật là mình chưa biết');
    expect(prompt.references[0]).toBe('Hướng dẫn SimLab 3D · SimLab 3D là gì, mở ở đâu');
    expect(prompt.references).toContain('Hướng dẫn SimLab 3D · Rơi tự do');
  });

  it('gives an on-device prompt one guide section', async () => {
    const prompt = await contextPrompt(question, 'vi', false, false, 'compact');
    expect(prompt.references).toEqual(['Hướng dẫn SimLab 3D · Rơi tự do']);
    expect(prompt.note).toContain('Phòng thí nghiệm Vật lý');
  });

  it('reads a follow-up with the game question before it', async () => {
    const history = [
      { role: 'user', content: question },
      { role: 'assistant', content: 'Ở Phòng thí nghiệm Vật lý.' },
    ];
    const prompt = await contextPrompt(
      'Còn con lắc đơn thì sao?',
      'vi',
      false,
      false,
      false,
      history,
    );
    expect(prompt.system).toContain('nói thật là mình chưa biết');
  });

  it('leaves other prompts without the guide', async () => {
    const prompt = await contextPrompt('Rơi tự do là gì?', 'vi', false, false, false);
    expect(prompt.system).not.toContain('SimLab 3D');
    expect(prompt.references.some((r) => r.startsWith('Hướng dẫn SimLab 3D'))).toBe(false);
  });
});
