import { describe, expect, it } from 'vitest';
import { BREAK_AFTER_MS, BreakTimer, IDLE_RESET_MS } from './breakReminder';

const MIN = 60_000;

describe('break reminder (~45 min of continuous use)', () => {
  it('reminds once after 45 minutes of activity, then again after another 45', () => {
    const b = new BreakTimer();
    let reminders = 0;
    for (let t = 0; t <= 100 * MIN; t += MIN) if (b.activity(t)) reminders++;
    expect(reminders).toBe(2);
  });

  it('a pause of 5 minutes starts a new session', () => {
    const b = new BreakTimer();
    for (let t = 0; t <= 40 * MIN; t += MIN) expect(b.activity(t)).toBe(false);
    const back = 40 * MIN + IDLE_RESET_MS;
    expect(b.check(back)).toBe(false);
    for (let t = back; t < back + BREAK_AFTER_MS; t += MIN) expect(b.activity(t)).toBe(false);
    expect(b.activity(back + BREAK_AFTER_MS)).toBe(true);
  });

  it('nothing happens without activity', () => {
    const b = new BreakTimer();
    expect(b.check(10 * BREAK_AFTER_MS)).toBe(false);
  });
});
