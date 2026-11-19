/**
 * The game inside SimLab (VITE_SIMLAB_EMBED, docs/GAME.md; LAN rooms #339, user decision
 * 19/11/2026): SimLab runs the room server itself (Rust, src-tauri/src/rooms) on the loopback at
 * a fixed port its CSP allows, and checks every chat line with its own safety checks, which it
 * puts on the frame's parent window (src/app/game/gameBridge.ts). Outside SimLab nothing here
 * changes the game.
 */
export const EMBEDDED = import.meta.env.VITE_SIMLAB_EMBED === '1';

/** SimLab's room server: loopback only, the one address its CSP lets the page reach. */
export const SIMLAB_ROOMS_ORIGIN = 'http://127.0.0.1:5189';

/** What SimLab puts on its window for the game (`window.simlabRooms`). */
export interface SimlabRooms {
  /** A line the learner wrote may be sent (no personal data, crisis or unsuitable words). */
  check(text: string): boolean;
  /** A line another player wrote may be shown. */
  safe(text: string): boolean;
  /** The learner reports a line (the incident log keeps the kind and the time, no content). */
  report(): void;
}

function host(): SimlabRooms | null {
  try {
    return (window.parent as unknown as { simlabRooms?: SimlabRooms }).simlabRooms ?? null;
  } catch {
    return null;
  }
}

/** Inside SimLab without its checks, nothing is sent or shown (closed, never open). */
export function chatAllowed(text: string): boolean {
  if (!EMBEDDED) return true;
  return host()?.check(text) ?? false;
}

export function chatShown(text: string): boolean {
  if (!EMBEDDED) return true;
  return host()?.safe(text) ?? false;
}

export function reportChat(): void {
  host()?.report();
}
