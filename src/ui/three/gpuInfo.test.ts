import { afterEach, describe, expect, it } from 'vitest';
import {
  POSTFX_OVERRIDE_KEY,
  detectGpuClass,
  gpuClass,
  resetGpuClassCache,
  type GpuClass,
} from './gpuInfo';

describe('gpuClass', () => {
  const cases: [string, GpuClass][] = [
    // Software rasterisers (CI, remote desktops, the E2E runs).
    [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'software',
    ],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', 'software'],
    [
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'software',
    ],
    // Integrated GPUs: Intel, AMD APUs (the owner's Radeon 780M), Apple, phones.
    [
      'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'integrated',
    ],
    [
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'integrated',
    ],
    [
      'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'integrated',
    ],
    [
      'ANGLE (AMD, AMD Radeon(TM) 780M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'integrated',
    ],
    [
      'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'integrated',
    ],
    ['AMD Radeon 760M', 'integrated'],
    ['Apple GPU', 'integrated'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 'integrated'],
    ['Mali-G78', 'integrated'],
    // Discrete GPUs.
    [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D19) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'discrete',
    ],
    ['ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'discrete'],
    [
      'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'discrete',
    ],
    ['NVIDIA Quadro P2000/PCIe/SSE2', 'discrete'],
    // Hidden or unknown: treated like an integrated GPU by the quality table.
    ['WebKit WebGL', 'unknown'],
    ['', 'unknown'],
  ];
  for (const [s, want] of cases) {
    it(`${want}: ${s || '(empty)'}`, () => {
      expect(gpuClass(s)).toBe(want);
    });
  }
  it('null and undefined are unknown', () => {
    expect(gpuClass(null)).toBe('unknown');
    expect(gpuClass(undefined)).toBe('unknown');
  });
});

describe('detectGpuClass', () => {
  afterEach(() => {
    resetGpuClassCache();
  });

  it('jsdom has no WebGL: unknown, without touching a canvas', () => {
    expect(detectGpuClass()).toBe('unknown');
  });

  it('the development override forces the post-processing on or off', () => {
    localStorage.setItem(POSTFX_OVERRIDE_KEY, 'on');
    expect(detectGpuClass()).toBe('discrete');
    localStorage.setItem(POSTFX_OVERRIDE_KEY, 'off');
    expect(detectGpuClass()).toBe('integrated');
    localStorage.setItem(POSTFX_OVERRIDE_KEY, 'something else');
    expect(detectGpuClass()).toBe('unknown');
  });
});
