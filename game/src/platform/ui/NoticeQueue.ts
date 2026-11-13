export type NoticeKind = 'info' | 'success' | 'warn' | 'error';

export interface Notice {
  readonly text: string;
  readonly kind: NoticeKind;
  /** Topic: a newer notice with the same key replaces this one. */
  readonly key: string | null;
  /** Clock time (s) when it disappears. */
  readonly expires: number;
}

/** A notice's status marker: its kind, or `feedback` for the answer to the player's own action. */
export type NoticeMarker = NoticeKind | 'feedback';

/** Topics that answer what the player just did: Inspect, putting PPE on and taking it off. */
const FEEDBACK_KEYS: ReadonlySet<string> = new Set(['inspect', 'equipment']);

/** ✓ success, i info, ↳ feedback, ! warning, × error: warnings stay warnings, whatever caused them. */
export const noticeMarker = (notice: Notice): NoticeMarker =>
  notice.kind === 'info' && FEEDBACK_KEYS.has(notice.key ?? '') ? 'feedback' : notice.kind;

/** At most this many notices are shown at once. */
export const MAX_NOTICES = 4;

const critical = (kind: NoticeKind) => kind === 'warn' || kind === 'error';

/** Seconds on screen: 4 s, 6 s for warnings and errors, longer for long texts (20 chars/s, ≤ 12 s). */
export function noticeSeconds(text: string, kind: NoticeKind): number {
  return Math.min(12, Math.max(critical(kind) ? 6 : 4, text.length / 20));
}

/**
 * What the HUD's short messages do, without the DOM (so it is unit-tested):
 * - one notice per topic: a new notice replaces the one with the same `key` (the latest refusal,
 *   the latest procedure step, results replacing "Running…"), so topics never pile up;
 * - the same text again restarts its time instead of showing twice;
 * - at most MAX_NOTICES: when full, the oldest info/success notice goes first; warnings and
 *   errors only go when nothing else is left (the oldest of them);
 * - `remove(key)` withdraws a notice that the game state has made untrue.
 */
export class NoticeQueue {
  private notices: Notice[] = [];

  get visible(): readonly Notice[] {
    return this.notices;
  }

  push(text: string, kind: NoticeKind, key: string | null, now: number): void {
    this.notices = this.notices.filter((n) => n.text !== text && (key === null || n.key !== key));
    this.notices.push({ text, kind, key, expires: now + noticeSeconds(text, kind) });
    while (this.notices.length > MAX_NOTICES) {
      const plain = this.notices.findIndex((n) => !critical(n.kind));
      this.notices.splice(plain >= 0 ? plain : 0, 1);
    }
  }

  /** Withdraws the notice with this key; true if there was one. */
  remove(key: string): boolean {
    const before = this.notices.length;
    this.notices = this.notices.filter((n) => n.key !== key);
    return this.notices.length !== before;
  }

  /** Drops notices whose time is up; true if any went. Allocation-free when none did. */
  expire(now: number): boolean {
    let due = false;
    for (let i = 0; i < this.notices.length; i++) due ||= (this.notices[i]?.expires ?? 0) <= now;
    if (!due) return false;
    this.notices = this.notices.filter((n) => n.expires > now);
    return true;
  }
}
