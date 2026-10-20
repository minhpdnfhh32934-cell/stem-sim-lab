import { describe, expect, it } from 'vitest';
import type { ChatMessageRecord } from '@/teacher/chat/chatStore';
import { latestLesson } from './latestLesson';

describe('the answer the board teaches', () => {
  const lesson: ChatMessageRecord[] = [
    { id: 'q1', role: 'user', content: 'Một vật rơi từ 20 m. Tính thời gian rơi.' },
    { id: 'a1', role: 'assistant', content: '# Rơi tự do\n1. t = 2 s', mode: 'board' },
  ];
  const aside: ChatMessageRecord[] = [
    {
      id: 'q2',
      role: 'user',
      content: 'Chỗ này là gì ạ?',
      boardRef: { face: 0, ids: ['f1'], excerpt: 't = 2 s' },
    },
    { id: 'a2', role: 'assistant', content: 'Đây là thời gian rơi.', mode: 'aside' },
  ];

  it('is the newest answer', () => {
    expect(latestLesson(lesson)).toMatchObject({
      id: 'a1',
      question: 'Một vật rơi từ 20 m. Tính thời gian rơi.',
    });
    expect(latestLesson([])).toBeNull();
  });

  it('skips answers about part of the board: the board keeps its lesson to resume it', () => {
    expect(latestLesson([...lesson, ...aside])).toMatchObject({
      id: 'a1',
      content: '# Rơi tự do\n1. t = 2 s',
      question: 'Một vật rơi từ 20 m. Tính thời gian rơi.',
    });
    // Asked again and again about the board: still the same lesson.
    expect(latestLesson([...lesson, ...aside, ...aside])?.id).toBe('a1');
  });

  it('never takes a question about the board as the question a lesson answers', () => {
    // An answer saved before the mode field, after a question about the board.
    const older: ChatMessageRecord[] = [
      lesson[0] as ChatMessageRecord,
      aside[0] as ChatMessageRecord,
      { id: 'a3', role: 'assistant', content: 'Bài giảng' },
    ];
    expect(latestLesson(older)).toMatchObject({
      id: 'a3',
      question: 'Một vật rơi từ 20 m. Tính thời gian rơi.',
    });
  });

  it('a new ordinary question after an aside makes a new lesson', () => {
    const next: ChatMessageRecord[] = [
      ...lesson,
      ...aside,
      { id: 'q4', role: 'user', content: 'Động năng là gì?' },
      { id: 'a4', role: 'assistant', content: '# Động năng', mode: 'board' },
    ];
    expect(latestLesson(next)).toMatchObject({ id: 'a4', question: 'Động năng là gì?' });
  });
});
