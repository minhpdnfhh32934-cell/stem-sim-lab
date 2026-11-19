import { describe, expect, it } from 'vitest';
import { downloadTotals } from './downloadProgress';

describe("a model's download as one number", () => {
  it('a finished file keeps its size even when its "done" event has none (E2B, 19/11)', () => {
    const update = downloadTotals();
    update({ status: 'progress', file: 'decoder.onnx_data', loaded: 1_000, total: 2_070 });
    update({ status: 'progress', file: 'vision.onnx_data', loaded: 500, total: 1_860 });
    // Transformers.js may send "done" with no size: the file must not drop out of the total.
    const done = update({ status: 'done', file: 'decoder.onnx_data' });
    expect(done).toEqual({ loaded: 2_570, total: 3_930 });
    const last = update({
      status: 'progress',
      file: 'vision.onnx_data',
      loaded: 1_860,
      total: 1_860,
    });
    expect(last).toEqual({ loaded: 3_930, total: 3_930 });
  });

  it('ignores events of no file and other statuses; an unknown size is null', () => {
    const update = downloadTotals();
    expect(update({ status: 'progress' })).toBeNull();
    expect(update({ status: 'initiate', file: 'a' })).toBeNull();
    expect(update({ status: 'progress', file: 'a', loaded: 10 })).toEqual({
      loaded: 10,
      total: null,
    });
  });
});
