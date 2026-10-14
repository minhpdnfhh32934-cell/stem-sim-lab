import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pcm } from './audio';

/**
 * The on-device voice with the natural-teacher layer, end to end through `speak()`: a fake MMS
 * worker (no model) and a fake audio output (no sound) that the test can hold. Checks the order,
 * the look-ahead of one, stop / pause / resume / replay, and that an old lesson's audio is never
 * heard once a new one started or the learner left.
 */
vi.mock('@/ai/webGemma', () => ({
  webGPUStatus: () => 'none',
  ortPaths: () => ({ wasm: '/ort/a.wasm', mjs: '/ort/a.mjs' }),
}));
vi.mock('@/ai/modelStore', () => ({
  opfsAvailable: () => false,
  repoStored: () => Promise.resolve(true),
  deleteRepo: () => Promise.resolve(),
}));

const out = vi.hoisted(() => ({
  /** Every call to playPcm, also one that should never have happened. */
  played: [] as { text: string; pcm: Pcm; aborted: boolean }[],
  hold: false,
  waiting: [] as (() => void)[],
}));
vi.mock('./audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio')>()),
  playPcm: (pcm: Pcm & { text?: string }, signal: AbortSignal) => {
    out.played.push({ text: pcm.text ?? '?', pcm, aborted: signal.aborted });
    if (!out.hold || signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      out.waiting.push(resolve);
      signal.addEventListener(
        'abort',
        () => {
          resolve();
        },
        { once: true },
      );
    });
  },
  stopAudio: () => undefined,
  pause: () => Promise.resolve(),
}));

/** A spoken phrase as MMS returns it: silence, a tone, silence (16 kHz). */
function phraseAudio(amplitude: number): Float32Array {
  const lead = 1920; // 120 ms
  const body = 4800; // 300 ms
  const tail = 3200; // 200 ms
  const s = new Float32Array(lead + body + tail);
  for (let i = 0; i < body; i++)
    s[lead + i] = amplitude * Math.sin((2 * Math.PI * 200 * i) / 16000);
  return s;
}

/** Behaves like localVoiceWorker.ts: one job at a time; `hold` keeps jobs until released. */
class FakeWorker {
  static all: FakeWorker[] = [];
  static hold = false;
  static amplitude = 0.05;
  spoken: string[] = [];
  cancelled: number[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private queue: { id: number; text: string }[] = [];
  private started = new Set<number>();
  private terminated = false;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(msg: { kind: string; id?: number; text?: string }) {
    if (msg.kind === 'load')
      queueMicrotask(() => {
        this.reply({ kind: 'loaded' });
      });
    if (msg.kind === 'cancel' && msg.id !== undefined) this.cancelled.push(msg.id);
    if (msg.kind === 'speak' && msg.id !== undefined) {
      this.spoken.push(msg.text ?? '');
      this.queue.push({ id: msg.id, text: msg.text ?? '' });
      if (!FakeWorker.hold)
        queueMicrotask(() => {
          this.release();
        });
    }
  }
  /** Starts the oldest job (the page hears "started") without answering it yet. */
  start() {
    const job = this.queue[0];
    if (!job || this.terminated || this.started.has(job.id)) return;
    this.started.add(job.id);
    this.reply({ kind: 'started', id: job.id });
  }
  /** Answers the oldest job (a dropped one too: the page ignores it). */
  release() {
    const job = this.queue.shift();
    if (!job || this.terminated) return;
    if (!this.started.has(job.id)) this.reply({ kind: 'started', id: job.id });
    this.reply({
      kind: 'audio',
      id: job.id,
      samples: phraseAudio(FakeWorker.amplitude),
      sampleRate: 16000,
      applied: [],
    });
  }
  terminate() {
    this.terminated = true;
  }
  private reply(data: unknown) {
    if (!this.terminated) this.onmessage?.({ data } as MessageEvent);
  }
}

const { newVoiceSession, speak, stopSpeaking } = await import('./speak');
const { prepareSpeech, PAUSE_MS } = await import('./speechPlan');
const { unloadLocalVoice } = await import('./localVoice');
const { leadingSilenceMs, toDb, trailingSilenceMs, voicedRms, TARGET_RMS_DB, TRIM_MARGIN_MS } =
  await import('./stitch');
const { useVoiceStore } = await import('./voiceStore');

const flush = async (ms = 0) => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  if (ms) await new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const until = async (ok: () => boolean) => {
  for (let i = 0; i < 200 && !ok(); i++) await flush(5);
  expect(ok()).toBe(true);
};
const worker = () => FakeWorker.all.at(-1);
const requests = () => FakeWorker.all.flatMap((w) => w.spoken);
const heard = () => out.played.map((p) => p.text);

const SENTENCE = 'Ta có hai lực tác dụng, lực kéo và lực ma sát; chúng ngược chiều nhau.';
const PLAN = prepareSpeech(SENTENCE);

describe('the on-device voice speaks like a teacher', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('speechSynthesis', undefined);
    FakeWorker.all = [];
    FakeWorker.hold = false;
    FakeWorker.amplitude = 0.05;
    out.played = [];
    out.hold = false;
    out.waiting = [];
    localStorage.setItem('stemsim.voice-model', 'Xenova/mms-tts-vie');
    useVoiceStore.setState({ enabled: true, engine: 'local', speed: 1, lastError: null });
  });
  afterEach(() => {
    stopSpeaking();
    unloadLocalVoice();
    vi.unstubAllGlobals();
  });

  it('says the plan’s chunks in order: same loudness, own silence trimmed, the planned pause after', async () => {
    expect(PLAN.chunks.map((c) => c.pauseMs)).toEqual([PAUSE_MS.comma, PAUSE_MS.clause, 0]);
    await speak(SENTENCE);
    expect(heard()).toEqual(PLAN.chunks.map((c) => c.text));
    out.played.forEach(({ pcm }, i) => {
      const { samples, sampleRate } = pcm;
      expect(toDb(voicedRms(samples, sampleRate))).toBeCloseTo(TARGET_RMS_DB, 0);
      expect(leadingSilenceMs(samples, sampleRate)).toBeLessThanOrEqual(TRIM_MARGIN_MS + 10);
      const pause = PLAN.chunks[i]?.pauseMs ?? 0;
      expect(trailingSilenceMs(samples, sampleRate)).toBeGreaterThanOrEqual(pause);
      expect(trailingSilenceMs(samples, sampleRate)).toBeLessThanOrEqual(
        pause + TRIM_MARGIN_MS + 10,
      );
    });
    expect(requests()).toEqual(PLAN.chunks.map((c) => c.text.toLowerCase().replace(/[,;.]/g, '')));
  });

  it('renders the next chunk while one plays, never further ahead', async () => {
    out.hold = true;
    const done = speak(SENTENCE);
    await until(() => out.played.length === 1);
    expect(requests()).toHaveLength(2);
    out.waiting.shift()?.();
    await until(() => out.played.length === 2);
    expect(requests()).toHaveLength(3);
    out.hold = false;
    out.waiting.shift()?.();
    await done;
    expect(heard()).toEqual(PLAN.chunks.map((c) => c.text));
  });

  it('a stop (the learner leaves) silences it: no later chunk is heard', async () => {
    out.hold = true;
    const done = speak(SENTENCE);
    await until(() => out.played.length === 1);
    stopSpeaking();
    await done;
    await flush(20);
    expect(heard()).toEqual([PLAN.chunks[0]?.text]);
    expect(out.played.every((p) => !p.aborted)).toBe(true);
    expect(useVoiceStore.getState().speaking).toBe(false);
  });

  it('an old lesson’s audio never plays after a new lesson started', async () => {
    FakeWorker.hold = true;
    const old = speak('Bài cũ có một câu khá dài, thầy đọc chưa xong thì em đã chuyển bài.', {
      session: newVoiceSession(),
    });
    await until(() => requests().length === 1);
    // A new lesson starts while the old lesson's first chunk is still being rendered.
    FakeWorker.hold = false;
    const next = speak('Bài mới bắt đầu.', { session: newVoiceSession() });
    // The old job finishes late: its audio reaches the page after the new lesson began.
    worker()?.release();
    await Promise.all([old, next]);
    await flush(20);
    expect(heard()).toEqual(['Bài mới bắt đầu.']);
    expect(useVoiceStore.getState().lastError).toBeNull();
  });

  it('pause then resume: the sentence is heard again from its start, nothing rendered twice', async () => {
    const session = newVoiceSession();
    out.hold = true;
    const first = speak(SENTENCE, { session });
    await until(() => out.played.length === 1 && requests().length === 2);
    await flush(10);
    // "Tạm dừng": the board stops the voice and reads the sentence again on "Tiếp tục".
    stopSpeaking();
    await first;
    out.hold = false;
    out.played = [];
    await speak(SENTENCE, { session });
    expect(heard()).toEqual(PLAN.chunks.map((c) => c.text));
    // Chunks 1 and 2 were rendered before the pause: only chunk 3 is new.
    expect(requests()).toHaveLength(3);
  });

  it('pause while the worker renders a chunk, then resume: that render is used, not queued again', async () => {
    const session = newVoiceSession();
    FakeWorker.hold = true;
    const first = speak(SENTENCE, { session });
    await until(() => requests().length === 1);
    // The worker is rendering chunk 1 when the learner presses "Tạm dừng".
    worker()?.start();
    await flush();
    stopSpeaking();
    await first;
    // "Tiếp tục" while chunk 1 is still being rendered; it finishes after the pause.
    const resumed = speak(SENTENCE, { session });
    await flush(10);
    FakeWorker.hold = false;
    worker()?.release();
    await until(() => out.played.length === PLAN.chunks.length);
    await resumed;
    expect(heard()).toEqual(PLAN.chunks.map((c) => c.text));
    // Chunk 1 was rendered once: the resumed speech waited for the render already running.
    expect(requests()).toEqual(PLAN.chunks.map((c) => c.text.toLowerCase().replace(/[,;.]/g, '')));
  });

  it('replay (a new lesson session) renders again and keeps the order', async () => {
    await speak(SENTENCE, { session: newVoiceSession() });
    out.played = [];
    await speak(SENTENCE, { session: newVoiceSession() });
    expect(heard()).toEqual(PLAN.chunks.map((c) => c.text));
    expect(requests()).toHaveLength(2 * PLAN.chunks.length);
  });

  it('quiet and loud phrases come out at the same loudness', async () => {
    FakeWorker.amplitude = 0.02;
    await speak('Một câu đọc nhỏ.');
    FakeWorker.amplitude = 0.5;
    await speak('Một câu đọc to.');
    const [quiet, loud] = out.played.map((p) => toDb(voicedRms(p.pcm.samples, 16000)));
    expect(Math.abs((quiet ?? 0) - (loud ?? 99))).toBeLessThan(0.5);
  });
});
