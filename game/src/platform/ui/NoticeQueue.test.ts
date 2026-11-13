import { describe, expect, it } from 'vitest';
import { MAX_NOTICES, NoticeQueue, noticeMarker, noticeSeconds } from './NoticeQueue';

const texts = (q: NoticeQueue) => q.visible.map((n) => n.text);

describe('NoticeQueue', () => {
  it('keeps one notice per topic: the newest replaces the older one', () => {
    const q = new NoticeQueue();
    q.push('Not yet. Next: read the rules.', 'warn', 'blocked', 0);
    q.push('Preparation Room', 'info', 'room', 0);
    q.push('Open the wardrobe first.', 'warn', 'blocked', 1);
    expect(texts(q)).toEqual(['Preparation Room', 'Open the wardrobe first.']);
  });

  it('shows the same text once and restarts its time', () => {
    const q = new NoticeQueue();
    q.push('Wearing: Lab coat', 'info', null, 0);
    q.push('Wearing: Lab coat', 'info', null, 3);
    expect(q.visible).toHaveLength(1);
    expect(q.visible[0]?.expires).toBe(3 + 4);
  });

  it('never shows more than MAX_NOTICES, dropping the oldest plain notice first', () => {
    const q = new NoticeQueue();
    q.push('Interrupted', 'warn', null, 0);
    q.push('a', 'info', null, 0);
    q.push('b', 'success', null, 0);
    q.push('c', 'info', null, 0);
    q.push('d', 'info', null, 0);
    expect(q.visible).toHaveLength(MAX_NOTICES);
    expect(texts(q)).toEqual(['Interrupted', 'b', 'c', 'd']); // "a" went, the warning stayed
  });

  it('drops a warning only when nothing else is left to drop', () => {
    const q = new NoticeQueue();
    for (const t of ['w1', 'w2', 'w3', 'w4']) q.push(t, 'warn', null, 0);
    q.push('e', 'error', null, 0);
    expect(texts(q)).toEqual(['w2', 'w3', 'w4', 'e']);
    q.push('info', 'info', null, 0); // the plain newcomer yields to four critical notices
    expect(texts(q)).toEqual(['w2', 'w3', 'w4', 'e']);
  });

  it('gives warnings and long texts more time, within limits', () => {
    expect(noticeSeconds('Teacher Room', 'info')).toBe(4);
    expect(noticeSeconds('Open the wardrobe first.', 'warn')).toBe(6);
    expect(noticeSeconds('x'.repeat(200), 'info')).toBe(10);
    expect(noticeSeconds('x'.repeat(900), 'error')).toBe(12);
  });

  it('expires notices on time and withdraws them by topic', () => {
    const q = new NoticeQueue();
    q.push('Ready', 'success', 'procedure-ready', 0);
    q.push('Blocked', 'warn', 'blocked', 0);
    expect(q.expire(3.9)).toBe(false);
    expect(q.expire(4)).toBe(true);
    expect(texts(q)).toEqual(['Blocked']);
    expect(q.remove('procedure-ready')).toBe(false);
    expect(q.remove('blocked')).toBe(true);
    expect(q.visible).toEqual([]);
  });

  it("marks the answer to the player's own action as feedback, other notices by their kind", () => {
    const q = new NoticeQueue();
    q.push('Sink: Nothing unusual.', 'info', 'inspect', 0);
    q.push('Wearing: Lab coat', 'info', 'equipment', 0);
    q.push('Teacher Room', 'info', 'room', 0);
    q.push('Note', 'info', null, 0);
    expect(q.visible.map(noticeMarker)).toEqual(['feedback', 'feedback', 'info', 'info']);
    q.push('Open the wardrobe first.', 'warn', 'blocked', 0);
    q.push('Done: Wash your hands', 'success', 'procedure', 0);
    q.push('Experiment failed', 'error', 'experiment', 0);
    expect(q.visible.slice(-3).map(noticeMarker)).toEqual(['warn', 'success', 'error']);
  });
});
