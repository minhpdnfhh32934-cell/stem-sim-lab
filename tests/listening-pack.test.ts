import { describe, expect, it } from 'vitest';
import {
  collectRows,
  failedChecks,
  rowChecks,
  type ListeningMetrics,
} from '../scripts/voice/listening-rows.mjs';

/**
 * The listening pack for the on-device voice (scripts/voice/listening-pack.mjs): the voice
 * throws on silent or NaN audio, and one such sentence must not lose every result before it.
 */
const items = [
  { id: 'P01', text: 'Một.', reading: 'một.' },
  { id: 'P02', text: 'Hai.', reading: 'hai.' },
  { id: 'P03', text: 'Ba.', reading: 'ba.' },
];

const good = (spoken: string): ListeningMetrics => ({
  spoken,
  sampleRate: 16000,
  seconds: 1,
  synthMs: 800,
  rms: 0.1,
  peak: 0.6,
  clippedShare: 0,
  leadMs: 50,
  tailMs: 80,
  syllablesPerSecond: 4,
  nan: false,
});

describe('listening pack rows', () => {
  it('records a sentence that fails and still measures the next ones', async () => {
    const saved: number[] = [];
    const rows = await collectRows(
      items,
      (item) =>
        item.id === 'P02'
          ? Promise.reject(new Error('voice-model-silent'))
          : Promise.resolve(good(item.reading)),
      (_row, all) => {
        saved.push(all.length);
      },
    );
    expect(rows.map((r) => r.id)).toEqual(['P01', 'P02', 'P03']);
    expect(rows[1]).toMatchObject({ id: 'P02', error: 'voice-model-silent' });
    expect(failedChecks(rows[1]!)).toEqual(['synthesized']);
    expect(failedChecks(rows[0]!)).toEqual([]);
    expect(failedChecks(rows[2]!)).toEqual([]);
    // The results are saved after every sentence, not only at the end.
    expect(saved).toEqual([1, 2, 3]);
  });

  it('flags quiet, clipped, slow or NaN audio and a reading that differs from the golden one', () => {
    const checks = rowChecks(
      { ...good('khác'), rms: 0.001, clippedShare: 0.01, syllablesPerSecond: 1, nan: true },
      items[0]!,
    );
    expect(checks).toMatchObject({
      audible: false,
      notClipped: false,
      plausibleRate: false,
      finite: false,
      spokenMatchesGolden: false,
      shortSilences: true,
    });
  });
});
