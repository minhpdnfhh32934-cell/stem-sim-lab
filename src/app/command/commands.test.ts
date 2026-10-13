import { Atom } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { matchScore, rankCommands, type Command } from './commands';

const cmd = (id: string, group: Command['group'], label: string, keywords = ''): Command => ({
  id,
  group,
  label,
  keywords,
  icon: Atom,
  run: () => undefined,
});

const all = [
  cmd('settings.voice', 'settings', 'Giọng nói', 'tts doc to'),
  cmd('topic.obliqueProjectile', 'topics', 'Ném xiên'),
  cmd('topic.horizontalProjectile', 'topics', 'Ném ngang'),
  cmd('go.teacher', 'go', 'AI Teacher'),
  cmd('action.theme', 'actions', 'Đổi giao diện sáng / tối', 'dark light'),
];

describe('command palette ranking', () => {
  it('matches without accents and by any word', () => {
    expect(matchScore(all[1]!, 'nem xien')).toBeGreaterThan(0);
    expect(matchScore(all[1]!, 'xien')).toBe(2);
    expect(matchScore(all[1]!, 'Ném')).toBe(3);
    expect(matchScore(all[0]!, 'tts')).toBe(1);
    expect(matchScore(all[0]!, 'pendulum')).toBe(0);
  });

  it('puts the best match first, then keeps the group order', () => {
    expect(rankCommands(all, 'ne').map((c) => c.id)).toEqual([
      'topic.obliqueProjectile',
      'topic.horizontalProjectile',
    ]);
    expect(rankCommands(all, 'dark').map((c) => c.id)).toEqual(['action.theme']);
  });

  it('with no query lists everything by group: go, topics, settings, actions', () => {
    expect(rankCommands(all, '').map((c) => c.group)).toEqual([
      'go',
      'topics',
      'topics',
      'settings',
      'actions',
    ]);
  });
});
