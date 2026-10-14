/**
 * The on-device voice with the natural-teacher layer: each planned chunk (speechPlan.ts) is
 * spoken by MMS with its role's prosody where the model accepts it (vitsControls.ts), then shaped
 * (stitch.ts: trimmed, same loudness, faded, the role's pace, the planned pause) and played in
 * order with a look-ahead of one (chunkPlayer.ts). A lesson keeps its rendered chunks, so a
 * sentence read again after a pause starts at once instead of being rendered again.
 */
import { playPcm, type Pcm } from './audio';
import { playChunks } from './chunkPlayer';
import { synthesizeLocal } from './localVoice';
import type { PlannedChunk } from './speechPlan';
import { shapeChunk } from './stitch';

/** A chunk ready to be heard (its text kept for diagnostics, the benchmark and tests). */
export interface RenderedChunk extends Pcm {
  text: string;
  index: number;
}

/** Rendered chunks of one lesson, by text and prosody (most recent last). */
export type RenderCache = Map<string, Pcm>;

/** About a minute and a half of speech: a lesson's recent sentences, a few MB. */
const CACHE_LIMIT = 48;

const keyOf = (c: PlannedChunk) =>
  [c.text, c.rate, c.noiseScale, c.noiseScaleDuration, c.pauseMs].join('|');

/** Speaks one chunk and shapes it; a chunk this lesson already rendered comes from `cache`. */
export async function renderChunk(
  chunk: PlannedChunk,
  signal: AbortSignal,
  cache?: RenderCache,
): Promise<Pcm> {
  const key = keyOf(chunk);
  const known = cache?.get(key);
  if (known && cache) {
    cache.delete(key);
    cache.set(key, known);
    return known;
  }
  const pcm = await synthesizeLocal(chunk.text, signal, {
    speakingRate: chunk.rate,
    noiseScale: chunk.noiseScale,
    noiseScaleDuration: chunk.noiseScaleDuration,
  });
  // The model kept its own pace: the role's pace is set here, without changing the pitch.
  const rate = pcm.applied.includes('speaking_rate') ? 1 : chunk.rate;
  const shaped = shapeChunk(pcm, { rate, pauseMs: chunk.pauseMs });
  if (cache) {
    cache.set(key, shaped);
    const oldest = cache.keys().next();
    if (cache.size > CACHE_LIMIT && !oldest.done) cache.delete(oldest.value);
  }
  return shaped;
}

export interface NaturalOptions {
  /** Playback speed: the learner's speed times the board's. */
  speed: number;
  /** False once a newer speech started or this one stopped (speak.ts's generation). */
  current: () => boolean;
  cache?: RenderCache;
  /** A chunk was heard to its end. */
  played?: (index: number) => void;
}

/** Speaks a plan's chunks with the on-device voice (see the file comment). */
export function speakNatural(
  chunks: readonly PlannedChunk[],
  signal: AbortSignal,
  opts: NaturalOptions,
): Promise<void> {
  return playChunks<PlannedChunk, RenderedChunk>(chunks, signal, {
    render: async (chunk, index, s) => ({
      ...(await renderChunk(chunk, s, opts.cache)),
      text: chunk.text,
      index,
    }),
    play: (audio, _index, s) => playPcm(audio, s, opts.speed),
    current: opts.current,
    ...(opts.played ? { played: opts.played } : {}),
  });
}
