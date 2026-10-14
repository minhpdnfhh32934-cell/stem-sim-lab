// @vitest-environment node
import { describe, expect, it } from 'vitest';
import bench from '../src/teacher/voice/ttsBenchSet.json';
import { prepareSpeech, type SpeechRole } from '../src/teacher/voice/speechPlan';
import { splitForSpeech } from '../src/teacher/voice/vietnameseText';
import {
  LEGACY_COMMA_PAUSE_MS,
  LONG_GAP_MS,
  abKey,
  benchLayout,
  encodeWav,
  floatsFromBase64,
  heardAudio,
  itemMetrics,
  listeningSheet,
  parsePs,
  parseSamplerLine,
  powershellSampler,
  processTree,
  rmsSpreadDb,
  simulateTimeline,
  summarize,
  syllableCount,
  treeUsage,
  modeJobs,
  wordIntegrity,
  wordsOf,
  type BenchChunk,
} from '../scripts/voice/tts-bench-lib.mjs';

/**
 * Pure helpers of the on-device voice benchmark (scripts/voice/tts-bench.mjs). The benchmark
 * itself needs a browser and the downloaded voice and is run by hand; these parts are not.
 */
const chunk = (over: Partial<BenchChunk>): BenchChunk => ({
  text: 'một hai ba',
  synthMs: 500,
  durationMs: 2000,
  pauseAfterMs: 0,
  embeddedPauseMs: 0,
  leadMs: 30,
  tailMs: 30,
  rmsDb: -20,
  ...over,
});

describe('what each mode says', () => {
  const items = bench as { id: string; text: string; role?: SpeechRole; emphasis?: string[] }[];
  const planOf = (item: (typeof items)[number]) =>
    prepareSpeech(item.text, {
      ...(item.role ? { role: item.role } : {}),
      ...(item.emphasis ? { emphasis: item.emphasis } : {}),
    });

  it.each(items.map((i) => [i.id, i] as const))(
    '%s: both modes say the same prepared words (only the pipeline differs)',
    (_id, item) => {
      const plan = planOf(item);
      const said = (mode: 'legacy' | 'natural') =>
        wordsOf(
          modeJobs(mode, plan, splitForSpeech)
            .map((j) => j.text)
            .join(' '),
        );
      expect(said('legacy')).toEqual(wordsOf(plan.text));
      expect(said('natural')).toEqual(wordsOf(plan.text));
    },
  );

  it('legacy: one call per comma piece, 140 ms after a comma, the phrase’s pause after its last', () => {
    const plan = prepareSpeech('Ta có hai lực, lực kéo và lực ma sát. Xét lực kéo trước.');
    expect(modeJobs('legacy', plan, splitForSpeech)).toEqual([
      { text: 'Ta có hai lực', pauseAfterMs: LEGACY_COMMA_PAUSE_MS },
      { text: 'lực kéo và lực ma sát.', pauseAfterMs: 320 },
      { text: 'Xét lực kéo trước.', pauseAfterMs: 0 },
    ]);
    const natural = modeJobs('natural', plan, splitForSpeech);
    expect(natural.map((j) => [j.text, j.pauseAfterMs, j.chunk?.pauseMs])).toEqual(
      plan.chunks.map((c) => [c.text, 0, c.pauseMs]),
    );
  });
});

describe('playback timeline (look-ahead of one)', () => {
  it('a voice faster than real time: the first chunk waits for its render, then no stall', () => {
    const t = simulateTimeline([
      chunk({ synthMs: 500, tailMs: 180 }),
      chunk({ synthMs: 400, durationMs: 1500 }),
    ]);
    expect(t.firstAudioMs).toBe(500);
    expect(t.firstSoundMs).toBe(530);
    expect(t.totalSynthMs).toBe(900);
    expect(t.gaps).toEqual([180 + 30]);
    expect(t.gapsOverLong).toBe(0);
    expect(t.wallMs).toBe(500 + 2000 + 1500);
  });

  it('a voice slower than real time: the learner hears the wait', () => {
    const t = simulateTimeline([chunk({ synthMs: 500 }), chunk({ synthMs: 4000 })]);
    // Chunk 2 is asked for when chunk 1 starts (500 ms) and ready at 4 500 ms; chunk 1 ends at 2 500.
    expect(t.gaps).toEqual([30 + 2000 + 30]);
    expect(t.maxGapMs).toBe(2060);
    expect(t.gapsOverLong).toBe(1);
    expect(LONG_GAP_MS).toBe(600);
  });

  it('the next chunk is asked for only when the current one starts (never further ahead)', () => {
    const t = simulateTimeline([
      chunk({ synthMs: 100, durationMs: 5000 }),
      chunk({ synthMs: 100, durationMs: 100 }),
      chunk({ synthMs: 3000 }),
    ]);
    // Chunk 3 is asked for at 5 100 ms (chunk 2's start), ready at 8 100; chunk 2 ends at 5 200.
    expect(t.gaps[1]).toBe(30 + 2900 + 30);
  });

  it('a timer pause after a chunk (the legacy voice) is part of the gap', () => {
    const t = simulateTimeline([chunk({ pauseAfterMs: 320 }), chunk({ synthMs: 100 })]);
    expect(t.gaps).toEqual([30 + 320 + 30]);
  });

  it('one chunk has no gap', () => {
    expect(simulateTimeline([chunk({})]).gaps).toEqual([]);
    expect(simulateTimeline([]).firstAudioMs).toBe(0);
  });

  it('says when each chunk starts and how long the learner waited beyond the plan', () => {
    const t = simulateTimeline([
      chunk({ synthMs: 500, durationMs: 1000, pauseAfterMs: 140 }),
      chunk({ synthMs: 3000, durationMs: 1000 }),
      chunk({ synthMs: 200, durationMs: 1000 }),
    ]);
    // Chunk 2 is asked for at 500 ms and ready at 3 500; chunk 1 and its pause end at 1 640.
    expect(t.starts).toEqual([500, 3500, 4500]);
    expect(t.stallMs).toBe(3500 - 1640);
  });
});

describe('the A/B recordings are what the app would play', () => {
  it('each chunk where the timeline starts it: a stall is silence, the first wait is left out', () => {
    const rate = 1000; // one sample per millisecond
    const t = simulateTimeline([
      chunk({ synthMs: 500, durationMs: 1000 }),
      chunk({ synthMs: 3000, durationMs: 1000 }),
    ]);
    const heard = heardAudio(
      [new Float32Array(1000).fill(0.5), new Float32Array(1000).fill(0.25)],
      t.starts,
      rate,
    );
    expect(heard).toHaveLength(3000 + 1000);
    expect([heard[999], heard[1000], heard[2999], heard[3000]]).toEqual([0.5, 0, 0, 0.25]);
  });

  it('a timer pause (the legacy voice) is silence in the recording too', () => {
    const t = simulateTimeline([
      chunk({ synthMs: 100, durationMs: 10, pauseAfterMs: 140 }),
      chunk({ synthMs: 100, durationMs: 10 }),
    ]);
    const heard = heardAudio(
      [new Float32Array(10).fill(1), new Float32Array(10).fill(1)],
      t.starts,
      1000,
    );
    expect(heard).toHaveLength(10 + 140 + 10);
    expect(heard.slice(10, 150).every((x) => x === 0)).toBe(true);
  });

  it('the listeners’ folder holds the sheet and the blind recordings only', () => {
    const l = benchLayout('C:\\bench\\run1\\');
    expect(l.sheet).toBe('C:\\bench\\run1/listen/index.html');
    expect(l.blind.startsWith(`${l.listen}/`)).toBe(true);
    for (const p of [l.byMode, l.keyDir, l.key, l.results]) {
      expect(p.startsWith(l.listen)).toBe(false);
    }
  });
});

describe('words said', () => {
  it('counts syllables (hyphenated names too) and ignores punctuation and case', () => {
    expect(syllableCount('Niu-tơn bằng hai, Hết.')).toBe(5);
    expect(wordIntegrity('Câu một, câu hai.', ['câu một', 'Câu hai']).ok).toBe(true);
  });

  it('finds a dropped, an added and a reordered word', () => {
    expect(wordIntegrity('a b c d', ['a b', 'd'])).toMatchObject({ missing: 1, ok: false });
    expect(wordIntegrity('a b c', ['a b c x'])).toMatchObject({ extra: 1, missing: 0 });
    expect(wordIntegrity('a b c d', ['a c', 'b d'])).toMatchObject({
      missing: 0,
      extra: 0,
      reordered: 1,
    });
  });
});

describe('item metrics', () => {
  it('loudness spread leaves silent chunks out', () => {
    expect(rmsSpreadDb([-20, -23.5, -120, -21])).toBeCloseTo(3.5);
    expect(rmsSpreadDb([])).toBe(0);
  });

  it('puts the timeline, the words and the audio checks together', () => {
    const m = itemMetrics({
      prepared: 'một hai ba bốn',
      chunks: [
        // 1 000 ms voiced: 30 ms trim margin before, 30 ms margin and a 150 ms pause after.
        chunk({
          text: 'một hai',
          synthMs: 600,
          durationMs: 1210,
          tailMs: 180,
          embeddedPauseMs: 150,
        }),
        chunk({ text: 'ba bốn', synthMs: 400, durationMs: 1060, rmsDb: -21 }),
      ],
      audioMs: 2270,
      peak: 0.71234,
      clippingShare: 0,
      nan: false,
    });
    expect(m).toMatchObject({
      chunks: 2,
      firstAudioMs: 600,
      totalSynthMs: 1000,
      rtf: 0.5,
      voicedSeconds: 2,
      audioSeconds: 2.27,
      heardSeconds: 2.27,
      stallMs: 0,
      syllablesPerSecond: 1.76,
      rmsSpreadDb: 1,
      peak: 0.712,
      missingWords: 0,
      reorderedWords: 0,
    });
  });

  it('the real-time factor is over voiced time in both modes (edge silences and pauses out)', () => {
    const one = (c: Partial<BenchChunk>) =>
      itemMetrics({
        prepared: 'một hai',
        chunks: [chunk({ text: 'một hai', synthMs: 1000, ...c })],
        audioMs: c.durationMs ?? 0,
        peak: 0.5,
        clippingShare: 0,
        nan: false,
      });
    // The same 2 s of speech: raw model audio with 200 ms of its own silence at each edge
    // (legacy), and trimmed audio with a 30 ms margin and a planned 150 ms pause (natural).
    const legacy = one({ durationMs: 2400, leadMs: 200, tailMs: 200 });
    const natural = one({ durationMs: 2210, leadMs: 30, tailMs: 180, embeddedPauseMs: 150 });
    expect(legacy.rtf).toBe(0.5);
    expect(natural.rtf).toBe(0.5);
  });

  it('summarizes each mode by medians and counts items with problems', () => {
    const row = (first: number, missing: number) => ({
      firstAudioMs: first,
      missingWords: missing,
      extraWords: 0,
      reorderedWords: 0,
      nan: false,
    });
    const s = summarize(
      [
        { id: 'B01', legacy: row(900, 0), natural: row(500, 0) },
        { id: 'B02', legacy: row(1100, 1), natural: row(700, 0) },
        { id: 'B03', legacy: { error: 'voice-model-silent' }, natural: row(600, 0) },
      ],
      ['legacy', 'natural'],
    );
    expect(s.legacy).toMatchObject({ items: 2, failed: 1, withWordProblems: 1 });
    expect(s.legacy?.median.firstAudioMs).toBe(1000);
    expect(s.natural?.median.firstAudioMs).toBe(600);
  });
});

describe('audio files', () => {
  it('writes a 16-bit WAV, clamping and silencing broken samples', () => {
    const wav = encodeWav(Float32Array.from([0, 1.5, -1, NaN]), 16000);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32767, 0]);
  });

  it('reads float samples sent from the page', () => {
    const f = Float32Array.from([0.25, -0.5]);
    const b64 = Buffer.from(f.buffer).toString('base64');
    expect([...floatsFromBase64(b64)]).toEqual([0.25, -0.5]);
  });
});

describe('blind A/B listening', () => {
  const ids = Array.from({ length: 19 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`);

  it('decides A and B per sentence from the seed, both orders occurring', () => {
    const key = abKey(ids, ['legacy', 'natural'], 42);
    expect(abKey(ids, ['legacy', 'natural'], 42)).toEqual(key);
    for (const id of ids)
      expect(new Set([key[id]?.A, key[id]?.B])).toEqual(new Set(['legacy', 'natural']));
    const naturalFirst = ids.filter((id) => key[id]?.A === 'natural').length;
    expect(naturalFirst).toBeGreaterThan(0);
    expect(naturalFirst).toBeLessThan(ids.length);
  });

  it('the sheet never names the modes and asks four ratings for each recording', () => {
    const html = listeningSheet([{ id: 'B01', text: 'F = m·a <b>' }]);
    expect(html).toContain('blind/B01-A.wav');
    expect(html).toContain('blind/B01-B.wav');
    expect(html).not.toMatch(/legacy|natural\b/);
    expect(html.match(/data-key="(?:naturalness|clarity|intonation|pronunciation)"/g)).toHaveLength(
      8,
    );
    expect(html).toContain('F = m·a &lt;b&gt;');
  });
});

describe('the browser’s process tree', () => {
  const rows = [
    { pid: 10, ppid: 1, cpuMs: 1000, rssBytes: 100, root: true },
    { pid: 11, ppid: 10, cpuMs: 500, rssBytes: 50, root: false },
    { pid: 12, ppid: 11, cpuMs: 200, rssBytes: 20, root: false },
    { pid: 99, ppid: 1, cpuMs: 9999, rssBytes: 999, root: false },
  ];

  it('parses the sampler’s lines (an array or a single process)', () => {
    expect(parseSamplerLine('@@[{"pid":10,"ppid":1,"cpu":12.5,"rss":2048,"root":true}]')).toEqual([
      { pid: 10, ppid: 1, cpuMs: 12.5, rssBytes: 2048, root: true },
    ]);
    expect(parseSamplerLine('@@{"pid":3,"ppid":1,"cpu":1,"rss":2,"root":false}')).toHaveLength(1);
    expect(parseSamplerLine('@@not json')).toBeNull();
    expect(parseSamplerLine('WARNING: x')).toBeNull();
  });

  it('parses ps output (macOS and Linux)', () => {
    const out = parsePs(
      '  10     1  2048 01:02:03 /opt/msedge --user-data-dir=/p/prof\n  11    10  1024 0:01.50 /opt/msedge --type=renderer --user-data-dir=/p/prof\n',
      '/p/prof',
    );
    expect(out).toEqual([
      { pid: 10, ppid: 1, cpuMs: 3_723_000, rssBytes: 2_097_152, root: true },
      { pid: 11, ppid: 10, cpuMs: 1500, rssBytes: 1_048_576, root: false },
    ]);
  });

  it('keeps the main process and its descendants only', () => {
    expect(processTree(rows).map((r) => r.pid)).toEqual([10, 11, 12]);
    expect(processTree(rows.map((r) => ({ ...r, root: false })))).toEqual([]);
  });

  it('adds up CPU time (also of a process that exited) and the highest memory', () => {
    const usage = treeUsage();
    usage.add(rows, 0);
    usage.add(
      rows
        .filter((r) => r.pid !== 12)
        .map((r) => (r.pid === 10 ? { ...r, cpuMs: 1600, rssBytes: 300 } : r)),
      1000,
    );
    expect(usage.now()).toMatchObject({ cpuMs: 1600 + 500 + 200, rssBytes: 350, processes: 2 });
    expect(usage.between(0, 1000)).toMatchObject({ cpuMs: 600, peakRssBytes: 350 });
  });

  it('the PowerShell sampler looks for this profile and quotes it safely', () => {
    const script = powershellSampler("C:\\Users\\O'Neil\\edge", 750);
    expect(script).toContain("'*C:\\Users\\O''Neil\\edge*'");
    expect(script).toContain('Start-Sleep -Milliseconds 750');
    expect(script).toContain("Name='msedge.exe'");
  });
});
