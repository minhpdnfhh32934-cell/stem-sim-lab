/**
 * "Nhắc nghỉ mắt sau ~45 phút liên tục" (PROMPT_PHAN_2 A4.1). Counts continuous use: any
 * activity (key, pointer) keeps a session going; 5 minutes without activity or with the window
 * hidden ends it. One gentle reminder per 45 minutes of a session — never a pop-up that blocks.
 */
export const BREAK_AFTER_MS = 45 * 60_000;
export const IDLE_RESET_MS = 5 * 60_000;

export class BreakTimer {
  private start: number | null = null;
  private last = 0;

  /** The learner did something at `now`. Returns true when a reminder is due. */
  activity(now: number): boolean {
    if (this.start === null || now - this.last >= IDLE_RESET_MS) this.start = now;
    this.last = now;
    return this.check(now);
  }

  /** Periodic check (also while the learner only watches a simulation). */
  check(now: number): boolean {
    if (this.start === null) return false;
    if (now - this.last >= IDLE_RESET_MS) {
      this.start = null;
      return false;
    }
    if (now - this.start >= BREAK_AFTER_MS) {
      // Next reminder after another full period of continuous use.
      this.start = now;
      return true;
    }
    return false;
  }
}
