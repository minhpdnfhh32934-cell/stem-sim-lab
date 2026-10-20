/**
 * Plays a speech's chunks in strict order while the next one is being rendered (a look-ahead of
 * one: chunk n+1 renders while chunk n plays, never further, so a stop wastes at most one chunk
 * of work). Nothing is heard once the speech is no longer the current one — a new lesson began,
 * the learner paused or left — even if a render finishes afterwards (`current()` is checked
 * before every chunk, besides the abort signal).
 */
export interface ChunkPlayer<C, A> {
  render: (chunk: C, index: number, signal: AbortSignal) => Promise<A>;
  play: (audio: A, index: number, signal: AbortSignal) => Promise<void>;
  /** False once a newer speech started or this one was stopped. */
  current: () => boolean;
  /** Chunk `index` was heard to its end (a fallback voice goes on after it). */
  played?: (index: number) => void;
}

/**
 * Renders and plays `chunks`. Resolves when all were heard or the speech stopped; rejects with
 * the first render or play error once the chunks before it were heard.
 */
export async function playChunks<C, A>(
  chunks: readonly C[],
  signal: AbortSignal,
  player: ChunkPlayer<C, A>,
): Promise<void> {
  const live = () => !signal.aborted && player.current();
  const first = chunks[0];
  if (first === undefined || !live()) return;
  let next: Promise<A> | null = player.render(first, 0, signal);
  for (let i = 0; i < chunks.length && next; i++) {
    const audio: A = await next;
    const after = chunks[i + 1];
    next = after !== undefined && live() ? player.render(after, i + 1, signal) : null;
    // Awaited at the next turn; a speech stopped before then never reads it.
    next?.catch(() => undefined);
    if (!live()) return;
    await player.play(audio, i, signal);
    if (!live()) return;
    player.played?.(i);
  }
}
