/**
 * The on-device voice with the natural-teacher layer: each planned chunk (speechPlan.ts) is
 * spoken by MMS with its role's prosody where the model accepts it (vitsControls.ts), then shaped
 * (stitch.ts: trimmed, same loudness, faded, the role's pace, the planned pause) and played in
 * order with a look-ahead of one (chunkPlayer.ts). A lesson keeps its rendered chunks, so a
 * sentence read again after a pause starts at once instead of being rendered again.
 */
import { playPcm, type Pcm } from './audio';
import { playChunks } from './chunkPlayer';
import { synthesizeLocal, type LocalPcm } from './localVoice';
import type { PlannedChunk } from './speechPlan';
import { shapeChunk } from './stitch';

/** A chunk ready to be heard (its text kept for diagnostics, the benchmark and tests). */
export interface RenderedChunk extends Pcm {
  text: string;
  index: number;
}

/** Rendered chunks of one lesson, by text and prosody (most recent last). */
export type RenderCache = Map<string, Pcm>;

/**
 * A lesson's most recent chunks. A chunk is at most about 6.5 s of audio (100 characters and its
 * pause), so this is up to about 5 minutes of speech: about 20 MB of 16 kHz float samples.
 */
const CACHE_LIMIT = 48;

const keyOf = (c: PlannedChunk) =>
  [c.text, c.rate, c.noiseScale, c.noiseScaleDuration, c.pauseMs].join('|');

/**
 * Chunks the worker was already rendering when their speech stopped (a pause), by lesson and
 * chunk: the render goes on, and "Tiếp tục" waits for it instead of queueing it again behind
 * itself (on the CPU that doubled the wait for the first sound).
 */
const lateRenders = new WeakMap<RenderCache, Map<string, Promise<Pcm | null>>>();

/** `promise`, or a 'cancelled' error as soon as `signal` stops. */
function untilStopped<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('cancelled'));
  return new Promise<T>((resolve, reject) => {
    const stop = () => {
      reject(new Error('cancelled'));
    };
    signal.addEventListener('abort', stop, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', stop);
        resolve(value);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', stop);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

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
  const pending = cache ? lateRenders.get(cache)?.get(key) : undefined;
  if (pending) {
    const done = await untilStopped(pending, signal);
    if (done) return done;
  }
  const shape = (pcm: LocalPcm): Pcm => {
    // The model kept its own pace: the role's pace is set here, without changing the pitch.
    const rate = pcm.applied.includes('speaking_rate') ? 1 : chunk.rate;
    const shaped = shapeChunk(pcm, { rate, pauseMs: chunk.pauseMs });
    if (cache) {
      cache.set(key, shaped);
      const oldest = cache.keys().next();
      if (cache.size > CACHE_LIMIT && !oldest.done) cache.delete(oldest.value);
    }
    return shaped;
  };
  // Stopped while the worker renders it: the lesson keeps the render (see `lateRenders`).
  const keepLate = (lesson: RenderCache) => (audio: Promise<LocalPcm>) => {
    const renders = lateRenders.get(lesson) ?? new Map<string, Promise<Pcm | null>>();
    lateRenders.set(lesson, renders);
    const render = audio.then(shape, () => null);
    renders.set(key, render);
    void render.then(() => {
      if (renders.get(key) === render) renders.delete(key);
    });
  };
  const pcm = await synthesizeLocal(
    chunk.text,
    signal,
    {
      speakingRate: chunk.rate,
      noiseScale: chunk.noiseScale,
      noiseScaleDuration: chunk.noiseScaleDuration,
    },
    cache ? { late: keepLate(cache) } : {},
  );
  return shape(pcm);
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
