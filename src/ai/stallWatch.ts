/**
 * Notices an on-device answer that stopped coming (audit AI-01): no first piece after
 * `firstMs` (the prompt is still being read), or no new piece for `gapMs` after that. A lost GPU
 * or a stuck driver would otherwise leave the learner waiting until they press Stop.
 */

/** First piece of a Gemma answer: generous, a long prompt on an integrated GPU is slow to read. */
export const GEMMA_FIRST_PIECE_MS = 120_000;
/** Between two pieces once the answer is flowing (each piece is a word or a few). */
export const GEMMA_PIECE_GAP_MS = 45_000;

export interface StallWatch {
  /** A new piece arrived. */
  touch: () => void;
  stop: () => void;
}

export function watchStall(opts: {
  firstMs: number;
  gapMs: number;
  onStall: () => void;
  /** How often the clock is checked (ms). */
  every?: number;
  now?: () => number;
}): StallWatch {
  const now = opts.now ?? (() => Date.now());
  const started = now();
  let last: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = setInterval(check, opts.every ?? 1000);
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  function check() {
    const since = now() - (last ?? started);
    if (since > (last === null ? opts.firstMs : opts.gapMs)) {
      stop();
      opts.onStall();
    }
  }
  return {
    touch: () => {
      last = now();
    },
    stop,
  };
}
