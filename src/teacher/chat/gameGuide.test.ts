import { describe, expect, it } from 'vitest';
import evalSet from '../../../tests/teaching/teaching-eval.json';
import heldout from '../../../tests/teaching/teaching-heldout.json';
import heldout2 from '../../../tests/teaching/teaching-heldout-2.json';
import retrieval from '../../../tests/teaching/retrieval-heldout.json';
import { isGameQuestion, searchGameGuide } from './gameGuide';

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
];

const NOT_GAME = [
  'Lực ma sát nghỉ là gì? Cho một ví dụ.',
  'Một em bé chơi trò chơi đu quay, tính gia tốc hướng tâm.',
  'In a game of billiards, ball A hits ball B at rest. What happens to the momentum?',
  'What does game theory say about cooperation?',
  'Phòng thí nghiệm hóa học cần những dụng cụ nào?',
  'Tầm xa của vật ném xiên phụ thuộc vào gì?',
  'Em thấy quang phổ vạch khó hiểu quá.',
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
});

describe('searchGameGuide', () => {
  it.each([
    ['Trong game, thí nghiệm rơi tự do làm thế nào?', 'vi', 'experiment:free-fall'],
    ['Thầy Quang trong game giúp được gì?', 'vi', 'npc:teacher'],
    ['Trong game chơi nhiều người qua LAN thế nào?', 'vi', 'lan'],
    ['Trong game bấm phím nào để nhảy?', 'vi', 'controls'],
    ['Phòng chuẩn bị: vào phòng sạch gồm những bước nào?', 'vi', 'procedure:cleanroom-entry'],
    ['In the game, how do I run the pendulum experiment?', 'en', 'experiment:pendulum'],
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
