import { describe, expect, it } from 'vitest';
import { checkUltra, experienceOf, gpuClass } from './ultraCheck';

const ANGLE = (card: string) => `ANGLE (NVIDIA, NVIDIA GeForce ${card} (0x00002D58) Direct3D11)`;

describe('Ultra against this computer', () => {
  it('sorts graphics cards against the RTX 4060 class', () => {
    expect(gpuClass(ANGLE('RTX 5070 Laptop GPU'), false)).toBe('strong');
    expect(gpuClass(ANGLE('RTX 4060'), false)).toBe('strong');
    expect(gpuClass(ANGLE('RTX 3060'), false)).toBe('strong');
    expect(gpuClass(ANGLE('RTX 4050 Laptop GPU'), false)).toBe('dedicated');
    expect(gpuClass(ANGLE('GTX 1650'), false)).toBe('dedicated');
    expect(gpuClass('ANGLE (AMD, AMD Radeon RX 7600 Direct3D11)', false)).toBe('strong');
    expect(gpuClass('ANGLE (AMD, AMD Radeon RX 6500 XT Direct3D11)', false)).toBe('dedicated');
    expect(gpuClass('ANGLE (AMD, AMD Radeon 610M Direct3D11)', false)).toBe('integrated');
    expect(gpuClass('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', false)).toBe(
      'integrated',
    );
    expect(gpuClass('ANGLE (Google, SwiftShader Device)', true)).toBe('software');
    expect(gpuClass('', false)).toBe('unknown');
  });

  it('expects a good game on a strong card with the threads and memory, poor without a card', () => {
    const strong = { gpu: ANGLE('RTX 5070 Laptop GPU'), software: false, threads: 16, memoryGb: 8 };
    expect(checkUltra(strong)).toEqual({
      gpu: true,
      threads: true,
      memory: true,
      vram: null,
      expected: 'good',
    });
    expect(checkUltra({ ...strong, threads: 4 }).expected).toBe('ok');
    expect(checkUltra({ ...strong, gpu: ANGLE('GTX 1650') }).expected).toBe('ok');
    expect(checkUltra({ ...strong, gpu: '' })).toMatchObject({ gpu: null, expected: 'ok' });
    expect(checkUltra({ ...strong, memoryGb: null })).toMatchObject({
      memory: null,
      expected: 'good',
    });
    expect(checkUltra({ ...strong, gpu: 'SwiftShader', software: true }).expected).toBe('poor');
  });

  it('rates what was measured, a cap reached counting as the cap', () => {
    expect(experienceOf(118, 0)).toBe('good');
    expect(experienceOf(42, 0)).toBe('ok');
    expect(experienceOf(22, 0)).toBe('poor');
    expect(experienceOf(30, 30)).toBe('ok'); // capped at 30: no more is known
    expect(experienceOf(60, 60)).toBe('good');
    expect(experienceOf(24, 60)).toBe('poor');
  });
});
