import type { ChatMessageRecord } from '@/teacher/chat/chatStore';
import type { LessonInput } from '@/teacher/board/lesson';

/**
 * The answer the board teaches: the latest one that is not about part of the board (an `aside`
 * is read in the chat and aloud; the board keeps its lesson, paused, to resume where it stopped),
 * with the learner's question it answers (its numbers are given). A question about part of the
 * board is never that question.
 */
export function latestLesson(messages: readonly ChatMessageRecord[]): LessonInput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant' || m.mode === 'aside') continue;
    const question = messages
      .slice(0, i)
      .reverse()
      .find((q) => q.role === 'user' && q.boardRef === undefined);
    return {
      id: m.id,
      content: m.content,
      question: question?.content ?? '',
      ...(m.model ? { model: m.model } : {}),
      ...(m.fallback ? { fallback: true } : {}),
      // A Think answer (reviewed): an older one may still start with the reviewer's notes.
      ...(m.checkedBy ? { reviewed: true } : {}),
    };
  }
  return null;
}
