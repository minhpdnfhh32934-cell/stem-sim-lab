import { describe, expect, it, vi } from 'vitest';
import { MAX_GAIN, SumPlayer } from './audio';
import { coefficient, harmonics, numericCoefficient, overshoot, partialSum } from './model';
import { setFourier, useFourierStore } from './store';

describe('Fourier series of the square and sawtooth waves (#54 item 10)', () => {
  it('closed-form coefficients agree with integrating the ideal wave', () => {
    for (const wave of ['square', 'sawtooth'] as const)
      for (let n = 1; n <= 9; n++)
        expect(Math.abs(coefficient(wave, n) - numericCoefficient(wave, n))).toBeLessThan(1e-6);
  });

  it('the square wave keeps odd harmonics only; the sum tends to the wave away from the jumps', () => {
    expect(harmonics('square', 8).map((h) => h.n)).toEqual([1, 3, 5, 7]);
    expect(harmonics('sawtooth', 4).map((h) => h.n)).toEqual([1, 2, 3, 4]);
    expect(Math.abs(partialSum('square', 199, 0.25) - 1)).toBeLessThan(0.01);
    expect(Math.abs(partialSum('sawtooth', 400, 0.25) - 0.5)).toBeLessThan(0.01);
  });

  it('the overshoot next to the jump does not vanish as harmonics are added', () => {
    const few = overshoot('square', 9);
    const many = overshoot('square', 99);
    expect(few).toBeGreaterThan(0.15);
    expect(many).toBeGreaterThan(0.15);
    expect(Math.abs(many - few)).toBeLessThan(0.01);
    expect(overshoot('sawtooth', 99)).toBeGreaterThan(0.15);
  });

  it('typed and saved values stay in range', () => {
    setFourier({ N: 500, f1: 5, wave: 'triangle' });
    expect(useFourierStore.getState()).toMatchObject({ N: 50, f1: 55, wave: 'square' });
    setFourier({ N: 3.4, wave: 'sawtooth' });
    expect(useFourierStore.getState()).toMatchObject({ N: 3, wave: 'sawtooth' });
  });
});

describe('"Nghe"', () => {
  function fakeAudio() {
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    });
    const osc = {
      frequency: param(),
      setPeriodicWave: vi.fn(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = { gain: param(), connect: vi.fn() };
    const ctx = {
      currentTime: 0,
      destination: {},
      state: 'running',
      resume: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
      createOscillator: () => osc,
      createGain: () => gain,
      createPeriodicWave: vi.fn((_r: Float32Array, i: Float32Array) => ({ imag: i })),
    };
    return { ctx, osc, gain };
  }

  it('plays exactly the drawn coefficients at f₁, quietly, and stops when asked', () => {
    const { ctx, osc, gain } = fakeAudio();
    const player = new SumPlayer(() => ctx as never);
    const b = [1, 0, 1 / 3];
    expect(player.play(220, b)).toBe(true);
    expect(player.playing).toBe(true);
    const imag = ctx.createPeriodicWave.mock.calls[0]?.[1];
    expect([...(imag ?? [])]).toEqual([0, 1, 0, expect.closeTo(1 / 3, 6)]);
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(220, 0);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(MAX_GAIN, expect.any(Number));
    expect(MAX_GAIN).toBeLessThanOrEqual(0.2);
    player.stop();
    expect(player.playing).toBe(false);
    expect(osc.stop).toHaveBeenCalled();
    player.dispose();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('without Web Audio nothing plays', () => {
    const player = new SumPlayer(() => null);
    expect(player.play(220, [1])).toBe(false);
    expect(player.playing).toBe(false);
  });
});
