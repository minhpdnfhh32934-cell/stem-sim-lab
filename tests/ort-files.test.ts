import { describe, expect, it } from 'vitest';
import copyScript from '../scripts/copy-ort-wasm.mjs?raw';
import { ortPaths } from '@/ai/webGemma';

describe('onnxruntime files shipped with the app', () => {
  it('copies exactly the two files the Gemma worker loads (no unused builds in bundles)', () => {
    const listed = [...copyScript.matchAll(/'(ort-wasm[^']+)'/g)].map((m) => m[1]).sort();
    const used = Object.values(ortPaths())
      .map((url) => url.split('/').pop())
      .sort();
    expect(listed).toEqual(used);
    expect(used).toEqual([
      'ort-wasm-simd-threaded.asyncify.mjs',
      'ort-wasm-simd-threaded.asyncify.wasm',
    ]);
  });
});
