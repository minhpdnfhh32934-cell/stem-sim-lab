import { describe, expect, it } from 'vitest';
import {
  compareWithWebGpu,
  suggestedAdapter,
  vendorKey,
  vramTooSmall,
  webGpuName,
  type GpuAdapter,
} from './gpu';

// The two cards of the hybrid laptop the feature was measured on (2026-10-12).
const AMD: GpuAdapter = {
  id: '1002:164e:10741043',
  name: 'AMD Radeon(TM) 610M',
  vendorId: 0x1002,
  deviceId: 0x164e,
  kind: 'integrated',
  dedicatedMb: 483,
  sharedMb: 7788,
};
const NVIDIA: GpuAdapter = {
  id: '10de:2d58:10741043',
  name: 'NVIDIA GeForce RTX 5070 Laptop GPU',
  vendorId: 0x10de,
  deviceId: 0x2d58,
  kind: 'discrete',
  dedicatedMb: 7891,
  sharedMb: 7788,
};

describe('GPU helpers', () => {
  it('maps PCI vendor ids to the vendor names WebGPU reports', () => {
    expect(vendorKey(0x10de)).toBe('nvidia');
    expect(vendorKey(0x1002)).toBe('amd');
    expect(vendorKey(0x8086)).toBe('intel');
    expect(vendorKey(0x1234)).toBeNull();
  });

  it('suggests the discrete card with the most video memory', () => {
    expect(suggestedAdapter([AMD, NVIDIA])?.id).toBe(NVIDIA.id);
    expect(suggestedAdapter([AMD])).toBeUndefined();
    const small = { ...NVIDIA, id: '10de:0001:00000000', dedicatedMb: 2048 };
    expect(suggestedAdapter([small, NVIDIA, AMD])?.id).toBe(NVIDIA.id);
  });

  it('compares the requested card with what WebGPU really uses', () => {
    const list = [AMD, NVIDIA];
    expect(compareWithWebGpu(NVIDIA, { vendor: 'nvidia', architecture: 'blackwell' }, list)).toBe(
      'match',
    );
    expect(compareWithWebGpu(NVIDIA, { vendor: 'amd', architecture: 'rdna-2' }, list)).toBe(
      'mismatch',
    );
    expect(compareWithWebGpu(NVIDIA, null, list)).toBe('unknown');
    expect(compareWithWebGpu(undefined, { vendor: 'amd', architecture: '' }, list)).toBe('unknown');
    // Two cards of the same vendor: WebGPU's vendor string cannot tell them apart.
    const twin = { ...NVIDIA, id: '10de:2d59:00000000' };
    expect(
      compareWithWebGpu(NVIDIA, { vendor: 'nvidia', architecture: '' }, [AMD, NVIDIA, twin]),
    ).toBe('unknown');
  });

  it('names the WebGPU card with the listed adapter when it is unambiguous', () => {
    expect(webGpuName({ vendor: 'nvidia', architecture: 'blackwell' }, [AMD, NVIDIA])).toBe(
      NVIDIA.name,
    );
    expect(webGpuName({ vendor: 'amd', architecture: 'rdna-2' }, [])).toBe('AMD · rdna-2');
    expect(webGpuName({ vendor: '', architecture: '' }, [AMD])).toBe('?');
  });

  it('warns only when a discrete card clearly lacks memory for the model', () => {
    expect(vramTooSmall(NVIDIA, 3_760_000_000)).toBe(false); // E2B on 8 GB
    expect(vramTooSmall({ ...NVIDIA, dedicatedMb: 2048 }, 3_760_000_000)).toBe(true);
    expect(vramTooSmall(AMD, 3_760_000_000)).toBe(false); // integrated: shared RAM
    expect(vramTooSmall(undefined, 3_760_000_000)).toBe(false);
  });
});
