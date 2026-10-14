import { describe, expect, it } from 'vitest';
import { playChunks, type ChunkPlayer } from './chunkPlayer';

/**
 * Order, look-ahead and stopping of the chunk player (chunkPlayer.ts), with a fake renderer and a
 * fake audio output that the test drives step by step.
 */
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** A player whose renders and plays finish when the test says so. */
function harness(count: number) {
  const renders = Array.from({ length: count }, () => deferred<string>());
  const plays: Deferred<undefined>[] = [];
  const log = { rendered: [] as number[], played: [] as string[], heard: [] as number[] };
  let live = true;
  const player: ChunkPlayer<number, string> = {
    render: (chunk) => {
      log.rendered.push(chunk);
      return renders[chunk]?.promise ?? Promise.reject(new Error('no chunk'));
    },
    play: (audio) => {
      log.played.push(audio);
      const d = deferred<undefined>();
      plays.push(d);
      return d.promise;
    },
    current: () => live,
    played: (i) => {
      log.heard.push(i);
    },
  };
  return {
    renders,
    plays,
    log,
    player,
    stop: () => {
      live = false;
    },
  };
}

const chunks = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('playing chunks', () => {
  it('renders one chunk ahead while the current one plays, never further', async () => {
    const h = harness(4);
    const done = playChunks(chunks(4), new AbortController().signal, h.player);
    await flush();
    expect(h.log.rendered).toEqual([0]);
    h.renders[0]?.resolve('a0');
    await flush();
    // Chunk 0 plays; chunk 1 renders meanwhile; chunk 2 waits.
    expect(h.log.played).toEqual(['a0']);
    expect(h.log.rendered).toEqual([0, 1]);
    h.renders[1]?.resolve('a1');
    await flush();
    expect(h.log.rendered).toEqual([0, 1]);
    h.plays[0]?.resolve(undefined);
    await flush();
    expect(h.log.played).toEqual(['a0', 'a1']);
    expect(h.log.rendered).toEqual([0, 1, 2]);
    h.renders[2]?.resolve('a2');
    h.renders[3]?.resolve('a3');
    for (let i = 1; i < 4; i++) {
      h.plays[i]?.resolve(undefined);
      await flush();
    }
    await done;
    expect(h.log.played).toEqual(['a0', 'a1', 'a2', 'a3']);
    expect(h.log.heard).toEqual([0, 1, 2, 3]);
  });

  it('plays in strict order even when a later render finishes first', async () => {
    const h = harness(2);
    const done = playChunks(chunks(2), new AbortController().signal, h.player);
    h.renders[1]?.resolve('a1');
    await flush();
    expect(h.log.played).toEqual([]);
    h.renders[0]?.resolve('a0');
    await flush();
    h.plays[0]?.resolve(undefined);
    await flush();
    h.plays[1]?.resolve(undefined);
    await done;
    expect(h.log.played).toEqual(['a0', 'a1']);
  });

  it('a speech that is no longer current plays nothing more, even when a render finishes later', async () => {
    const h = harness(3);
    const done = playChunks(chunks(3), new AbortController().signal, h.player);
    h.renders[0]?.resolve('a0');
    await flush();
    // A new lesson starts (or the learner leaves) while chunk 0 plays.
    h.stop();
    h.plays[0]?.resolve(undefined);
    h.renders[1]?.resolve('a1');
    await done;
    expect(h.log.played).toEqual(['a0']);
    expect(h.log.heard).toEqual([]);
    expect(h.log.rendered).toEqual([0, 1]);
  });

  it('an aborted speech never plays the chunk it was waiting for', async () => {
    const h = harness(2);
    const ctrl = new AbortController();
    const done = playChunks(chunks(2), ctrl.signal, h.player);
    await flush();
    ctrl.abort();
    h.renders[0]?.resolve('late');
    await done;
    expect(h.log.played).toEqual([]);
  });

  it('a failing render stops after the chunks before it were heard', async () => {
    const h = harness(3);
    const done = playChunks(chunks(3), new AbortController().signal, h.player);
    h.renders[0]?.resolve('a0');
    h.renders[1]?.reject(new Error('voice-model-silent'));
    await flush();
    h.plays[0]?.resolve(undefined);
    await expect(done).rejects.toThrow('voice-model-silent');
    expect(h.log.heard).toEqual([0]);
    expect(h.log.rendered).toEqual([0, 1]);
  });

  it('nothing to say, nothing rendered', async () => {
    const h = harness(0);
    await playChunks([], new AbortController().signal, h.player);
    expect(h.log.rendered).toEqual([]);
  });
});
