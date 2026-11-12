import { afterEach, describe, expect, it } from 'vitest';
import {
  WORD_PULSE_MS,
  levelInput,
  markWord,
  resetVoiceLevel,
  soundEnded,
  soundStarted,
  voiceLevel,
} from './voiceLevel';

/** A fake analyser filled with a sine of the given amplitude (whole periods in the window). */
function fakeContext(amplitude: number) {
  const ctx = {
    destination: {},
    made: 0,
    createAnalyser() {
      ctx.made += 1;
      const node = {
        fftSize: 0,
        context: ctx,
        target: null as unknown,
        connect(to: unknown) {
          node.target = to;
        },
        getFloatTimeDomainData(out: Float32Array) {
          for (let i = 0; i < out.length; i++) {
            out[i] = amplitude * Math.sin((2 * Math.PI * 8 * i) / out.length);
          }
        },
      };
      return node;
    },
  };
  return ctx;
}
type Ctx = ReturnType<typeof fakeContext>;
const input = (ctx: Ctx) => levelInput(ctx as unknown as BaseAudioContext);

afterEach(() => {
  resetVoiceLevel();
});

describe('the voice level of a played sound', () => {
  it('is the RMS of the window times the gain: a sine of amplitude A has RMS A/√2', () => {
    input(fakeContext(0.1));
    soundStarted();
    expect(voiceLevel()).toBeCloseTo((4 * 0.1) / Math.SQRT2, 6);
  });

  it('is 0 for silence and never above 1 for a loud sound', () => {
    input(fakeContext(0));
    soundStarted();
    expect(voiceLevel()).toBe(0);
    resetVoiceLevel();
    input(fakeContext(1));
    soundStarted();
    expect(voiceLevel()).toBe(1);
  });

  it('is 0 once every sound has ended (two at once: the level waits for both)', () => {
    input(fakeContext(0.2));
    soundStarted();
    soundStarted();
    soundEnded();
    expect(voiceLevel()).toBeGreaterThan(0);
    soundEnded();
    expect(voiceLevel()).toBe(0);
    soundEnded();
    soundStarted();
    expect(voiceLevel()).toBeGreaterThan(0);
  });

  it('one meter per audio context, connected to its speakers', () => {
    const ctx = fakeContext(0);
    const node = input(ctx) as unknown as { target: unknown };
    expect(input(ctx)).toBe(node);
    expect(ctx.made).toBe(1);
    expect(node.target).toBe(ctx.destination);
    const other = fakeContext(0);
    expect(input(other)).not.toBe(node);
    expect(other.made).toBe(1);
  });
});

describe('the system voice: a pulse per word', () => {
  it('starts at 1 on the word and fades linearly to 0', () => {
    markWord(1000);
    expect(voiceLevel(1000)).toBe(1);
    expect(voiceLevel(1000 + WORD_PULSE_MS / 2)).toBeCloseTo(0.5, 9);
    expect(voiceLevel(1000 + WORD_PULSE_MS)).toBe(0);
    expect(voiceLevel(999)).toBe(0);
  });

  it('no word yet: 0', () => {
    expect(voiceLevel(0)).toBe(0);
  });
});
