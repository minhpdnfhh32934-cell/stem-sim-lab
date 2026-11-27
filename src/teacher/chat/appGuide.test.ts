import { describe, expect, it } from 'vitest';
import evalSet from '../../../tests/teaching/teaching-eval.json';
import heldout from '../../../tests/teaching/teaching-heldout.json';
import heldout2 from '../../../tests/teaching/teaching-heldout-2.json';
import retrieval from '../../../tests/teaching/retrieval-heldout.json';
import { isAppQuestion, searchAppGuide } from './appGuide';

const { contextPrompt } = await import('./chatService');

const APP = [
  'SimLab có những chế độ AI nào?',
  'Làm sao cài Ollama cho SimLab?',
  'Deepthink là gì?',
  'Khoanh để hỏi hoạt động thế nào?',
  'Hộp "Tôi hiểu đề như sau" dùng để làm gì?',
  'What is the Science Card in SimLab?',
  'How do I install SimLab from the Microsoft Store?',
  'Phím tắt của SimLab là gì?',
  'Quét tham số nằm ở đâu?',
];

const NOT_APP = [
  'Lực ma sát nghỉ là gì? Cho một ví dụ.',
  'Trong game SimLab 3D có những phòng nào?',
  'Thầy Quang ở đâu?',
  'Phản ứng oxi hóa khử là gì?',
  'Nguyên phân gồm mấy kì?',
  'Tính thế năng của vật 2 kg ở độ cao 5 m.',
  // "Ứng dụng" is also "an application of" a law; these are asked of AI Teacher, not about the app.
  'Ứng dụng của định luật Ôm là gì?',
  'Nêu ứng dụng của hiện tượng cảm ứng điện từ trong đời sống.',
  'Phân tích đề bài này giúp em.',
  'Thầy suy nghĩ kĩ rồi trả lời giúp em nhé.',
  'Giúp em soạn bài về quang hợp.',
];

describe('isAppQuestion', () => {
  it.each(APP)('reads "%s" as an app question', (q) => {
    expect(isAppQuestion(q)).toBe(true);
  });
  it.each(NOT_APP)('reads "%s" as another question', (q) => {
    expect(isAppQuestion(q)).toBe(false);
  });

  it('finds no app question in the evaluation and held-out sets (their prompts are unchanged)', () => {
    const questions = [
      ...evalSet.items.map((i) => i.question),
      ...heldout.items.map((i) => i.question),
      ...heldout2.items.map((i) => i.question),
      ...retrieval.items.map((i) => i.q),
    ];
    expect(questions.length).toBeGreaterThan(100);
    expect(questions.filter(isAppQuestion)).toEqual([]);
  });
});

describe('searchAppGuide', () => {
  it.each([
    ['Làm sao cài Ollama hoặc LM Studio cho SimLab?', 'vi', 'app-ai-engines'],
    ['Deepthink là gì?', 'vi', 'app-ai-engines'],
    ['Khoanh để hỏi hoạt động thế nào?', 'vi', 'app-whiteboard'],
    ['Hộp "Tôi hiểu đề như sau" dùng để làm gì?', 'vi', 'app-problem-reading'],
    ['Science Studio có mấy bước?', 'vi', 'app-science-studio'],
    ['What do the Science Card confidence labels mean?', 'en', 'app-science-card'],
    ['SimLab có bao nhiêu bài Kết nối tri thức lớp 10?', 'vi', 'app-curriculum-kntt'],
    ['Phím tắt Ctrl+K của SimLab làm gì?', 'vi', 'app-files-shortcuts-settings'],
    ['SimLab cập nhật qua Microsoft Store thế nào?', 'vi', 'app-safety-updates'],
  ] as const)('answers "%s" with its section first', async (q, locale, id) => {
    const [best] = await searchAppGuide(q, locale, 1);
    expect(best?.id).toBe(`builtin:app:${id}`);
  });

  it('gives a cloud prompt the overview first', async () => {
    const notes = await searchAppGuide('Deepthink là gì?', 'vi', 4);
    expect(notes[0]?.id).toBe('builtin:app:app-overview');
    expect(notes.map((n) => n.id)).toContain('builtin:app:app-ai-engines');
    expect(notes[0]?.text).toContain('Trạng thái:');
  });
});

describe('contextPrompt for the app', () => {
  it('adds the app rule and guide sections to the cloud prompt', async () => {
    const prompt = await contextPrompt('Deepthink là gì?', 'vi', false, false, false);
    expect(prompt.system).toContain('Hướng dẫn SimLab');
    expect(prompt.references.some((r) => r.startsWith('Hướng dẫn SimLab'))).toBe(true);
  });

  it('gives an on-device prompt one guide section', async () => {
    const prompt = await contextPrompt('Deepthink là gì?', 'vi', false, false, 'compact');
    expect(prompt.references).toHaveLength(1);
    expect(prompt.references[0]).toContain('Hướng dẫn SimLab');
  });

  it('leaves other prompts without the guide', async () => {
    const prompt = await contextPrompt('Rơi tự do là gì?', 'vi', false, false, false);
    expect(prompt.references.some((r) => r.startsWith('Hướng dẫn SimLab'))).toBe(false);
  });
});
