import { describe, expect, it } from 'vitest';
import { INTEGRATED_GPU, lowerQuality, QualityWatch, SETTLE_S, WINDOW_S } from './qualityWatch';

const run = (watch: QualityWatch, seconds: number, dt: number) => {
  let said = 0;
  for (let t = 0; t < seconds; t += dt) if (watch.frame(dt)) said++;
  return said;
};

describe('the graphics preset fitted to the machine', () => {
  it('knows graphics built into the processor from a graphics card', () => {
    for (const name of [
      'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0)',
      'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Mali-G78',
    ]) {
      expect(INTEGRATED_GPU.test(name), name).toBe(true);
    }
    for (const name of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 7600 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon 780M Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ]) {
      expect(INTEGRATED_GPU.test(name), name).toBe(false);
    }
  });

  it('steps down one preset at a time, never below Low', () => {
    expect(['ultra', 'high', 'medium', 'low'].map((q) => lowerQuality(q as 'low'))).toEqual([
      'high',
      'medium',
      'low',
      null,
    ]);
  });

  it('says so once a window whose median is under 40 fps, after settling', () => {
    const watch = new QualityWatch();
    expect(run(watch, SETTLE_S + WINDOW_S - 0.2, 1 / 30)).toBe(0); // not a whole window yet
    expect(run(watch, 0.4, 1 / 30)).toBe(1);
    expect(run(watch, WINDOW_S + 0.1, 1 / 30)).toBe(1); // still slow: once more a window
  });

  it('never for a smooth game, nor for hitches alone', () => {
    const watch = new QualityWatch();
    expect(run(watch, 30, 1 / 60)).toBe(0);
    // A door's hitch now and then: the median stays at 60 fps.
    let said = 0;
    for (let i = 0; i < 3000; i++) if (watch.frame(i % 50 === 0 ? 0.3 : 1 / 60)) said++;
    expect(said).toBe(0);
  });

  it('starts over, settling again, when reset', () => {
    const watch = new QualityWatch();
    run(watch, SETTLE_S + WINDOW_S - 1, 1 / 30);
    watch.reset();
    expect(run(watch, SETTLE_S + WINDOW_S - 0.2, 1 / 30)).toBe(0);
  });
});
