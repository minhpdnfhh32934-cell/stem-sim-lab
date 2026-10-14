// Rows of the on-device voice listening pack (scripts/voice/listening-pack.mjs): the automatic
// checks of one synthesised sentence, and a loop that keeps going when a sentence fails. The
// voice throws on silent or NaN audio ("voice-model-silent"); that sentence becomes a failed row
// with its error instead of losing every result measured so far.

/**
 * Automatic checks of one sentence (loudness, clipping, silences, speaking rate, NaN, reading).
 * They do not replace a human listener.
 */
export function rowChecks(metrics, item) {
  return {
    audible: metrics.rms >= 0.02,
    notClipped: metrics.clippedShare < 0.001,
    shortSilences: metrics.leadMs < 300 && metrics.tailMs < 300,
    plausibleRate: metrics.syllablesPerSecond >= 2 && metrics.syllablesPerSecond <= 7,
    finite: !metrics.nan,
    spokenMatchesGolden: metrics.spoken.trim() === item.reading.trim(),
  };
}

/**
 * Measures every item in turn. A sentence whose measurement throws is recorded with its error
 * and a failed `synthesized` check; the next sentences are still measured. `onRow` runs after
 * each row (the pack saves its results as it goes).
 */
export async function collectRows(items, measure, onRow = () => undefined) {
  const rows = [];
  for (const item of items) {
    let row;
    try {
      const metrics = await measure(item);
      row = { ...item, ...metrics, checks: rowChecks(metrics, item) };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      row = { ...item, error, checks: { synthesized: false } };
    }
    rows.push(row);
    await onRow(row, rows);
  }
  return rows;
}

/** The names of the checks a row failed. */
export function failedChecks(row) {
  return Object.entries(row.checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
}
