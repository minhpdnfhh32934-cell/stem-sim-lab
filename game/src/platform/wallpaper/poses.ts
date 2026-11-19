import type { BoneName } from '../render/body/BodyModel';

/*
 * What Linh and Khoa do (Phase W): their actions as clips — a name, how long, how softly it comes
 * and goes (`weightOf`) — and the pose type the cast writes joint angles into (x, y, z and 1 when
 * set this frame). The poses themselves are written in `cast.ts`; `director.ts` picks the clips.
 */

/** x, y, z, and 1 when set this frame (0: left from an earlier frame, ignored). */
export type Angles = [number, number, number, number];
export type Pose = Partial<Record<BoneName, Angles>>;

export type LinhAction =
  'lean' | 'forward' | 'karambit' | 'stretch' | 'knee' | 'hair' | 'chat' | 'startle';
export type KhoaAction = 'card' | 'kick' | 'glance' | 'neck' | 'holo' | 'tired' | 'startle';

export interface Clip<A extends string> {
  readonly name: A;
  /** Seconds. */
  readonly length: number;
  /** Seconds to blend in and out. */
  readonly ease: number;
}

export const LINH_CLIPS: Record<LinhAction, Clip<LinhAction>> = {
  lean: { name: 'lean', length: 7, ease: 1.2 },
  forward: { name: 'forward', length: 7, ease: 1.3 },
  karambit: { name: 'karambit', length: 9.5, ease: 0.9 },
  stretch: { name: 'stretch', length: 4.5, ease: 1 },
  knee: { name: 'knee', length: 10, ease: 1.4 },
  hair: { name: 'hair', length: 3.6, ease: 0.8 },
  // Turned to sit along the ledge, propped on a hand, talking to Khoa (its own ins and outs).
  chat: { name: 'chat', length: 32, ease: 0.2 },
  startle: { name: 'startle', length: 6, ease: 0.35 },
};

export const KHOA_CLIPS: Record<KhoaAction, Clip<KhoaAction>> = {
  card: { name: 'card', length: 8.5, ease: 0.9 },
  kick: { name: 'kick', length: 2.6, ease: 0.45 },
  glance: { name: 'glance', length: 4.5, ease: 1 },
  neck: { name: 'neck', length: 3.4, ease: 0.7 },
  holo: { name: 'holo', length: 9, ease: 0.9 },
  tired: { name: 'tired', length: 4.5, ease: 1.1 },
  startle: { name: 'startle', length: 6, ease: 0.3 },
};

/** How much of a clip shows at progress u: in over its ease, out over its ease (smooth). */
export function weightOf(clip: Clip<string>, u: number): number {
  const t = u * clip.length;
  const e = Math.min(clip.ease, clip.length / 2);
  return smoothstep(Math.min(t / e, (clip.length - t) / e));
}

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
