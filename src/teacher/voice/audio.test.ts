import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Playback of the voices that are not the operating system's (audio.ts). Nothing here makes a
 * sound: AudioContext is a fake that records which buffers were started.
 */
class FakeSource {
  static started: FakeSource[] = [];
  /** Called as a sound starts (before it ends): lets a test look while it plays. */
  static onStart: (() => void) | null = null;
  buffer: { length: number } | null = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  target: unknown = null;
  connect(node: unknown) {
    this.target = node;
  }
  start() {
    FakeSource.started.push(this);
    FakeSource.onStart?.();
    queueMicrotask(() => this.onended?.());
  }
  stop() {
    return undefined;
  }
}

class FakeContext {
  static resumeGate: Promise<void> = Promise.resolve();
  /** Every sample the level meter reads (a constant signal: its RMS is this value). */
  static loudness = 0;
  analysers: { target: unknown }[] = [];
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
  // The level meter between the sound and the speakers (voiceLevel.ts).
  createAnalyser() {
    const node = {
      fftSize: 0,
      context: this,
      target: null as unknown,
      connect(to: unknown) {
        node.target = to;
      },
      getFloatTimeDomainData: (out: Float32Array) => out.fill(FakeContext.loudness),
    };
    this.analysers.push(node);
    return node;
  }
}

let audio: typeof import('./audio');
let level: typeof import('./voiceLevel');

describe('playing a phrase', () => {
  beforeEach(async () => {
    vi.resetModules();
    FakeSource.started = [];
    FakeSource.onStart = null;
    FakeContext.resumeGate = Promise.resolve();
    FakeContext.loudness = 0;
    vi.stubGlobal('AudioContext', FakeContext);
    audio = await import('./audio');
    level = await import('./voiceLevel');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the voice reaches the speakers through the level meter, read only while it plays', async () => {
    FakeContext.loudness = 0.1;
    const during: number[] = [];
    FakeSource.onStart = () => during.push(level.voiceLevel());
    await audio.playPcm(
      { samples: new Float32Array(160), sampleRate: 16000 },
      new AbortController().signal,
    );
    const source = FakeSource.started[0];
    const meter = (source?.target ?? null) as { target: unknown; context: FakeContext } | null;
    expect(meter?.context.analysers).toContain(meter);
    expect(meter?.target).toBe(meter?.context.destination);
    // A constant 0.1 has RMS 0.1; the meter's gain is 4.
    expect(during[0]).toBeCloseTo(0.4, 6);
    // Ended: the meter is no longer read, even though it still holds the last window.
    expect(level.voiceLevel()).toBe(0);
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
