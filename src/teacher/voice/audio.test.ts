import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Playback of the voices that are not the operating system's (audio.ts). Nothing here makes a
 * sound: AudioContext is a fake that records which buffers were started.
 */
class FakeSource {
  static started: FakeSource[] = [];
  buffer: { length: number } | null = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  connect() {
    return undefined;
  }
  start() {
    FakeSource.started.push(this);
    queueMicrotask(() => this.onended?.());
  }
  stop() {
    return undefined;
  }
}

class FakeContext {
  static resumeGate: Promise<void> = Promise.resolve();
  state: AudioContextState = 'suspended';
  destination = {};
  resume() {
    return FakeContext.resumeGate.then(() => {
      this.state = 'running';
    });
  }
  createBuffer(_channels: number, length: number) {
    return { length, copyToChannel: () => undefined };
  }
  createBufferSource() {
    return new FakeSource();
  }
}

let audio: typeof import('./audio');

describe('playing a phrase', () => {
  beforeEach(async () => {
    vi.resetModules();
    FakeSource.started = [];
    FakeContext.resumeGate = Promise.resolve();
    vi.stubGlobal('AudioContext', FakeContext);
    audio = await import('./audio');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays samples once the audio context runs', async () => {
    const pcm = { samples: new Float32Array(160), sampleRate: 16000 };
    await audio.playPcm(pcm, new AbortController().signal);
    expect(FakeSource.started).toHaveLength(1);
  });

  it('a phrase stopped while the audio context resumes is never heard', async () => {
    let open: () => void = () => undefined;
    FakeContext.resumeGate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const ctrl = new AbortController();
    const playing = audio.playPcm(
      { samples: new Float32Array(160), sampleRate: 16000 },
      ctrl.signal,
    );
    // The learner left (or a new lesson began) before the browser allowed sound.
    ctrl.abort();
    open();
    await playing;
    expect(FakeSource.started).toHaveLength(0);
  });
});
