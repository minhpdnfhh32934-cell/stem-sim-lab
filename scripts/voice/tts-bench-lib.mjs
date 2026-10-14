// Pure helpers of the on-device voice benchmark (scripts/voice/tts-bench.mjs): what each mode
// says, the playback timeline with a look-ahead of one, word integrity, per-item metrics, WAV
// encoding, the blind A/B key, the listening sheet and the sampling of the browser's process
// tree. No browser, no model, no audio device: everything here is unit-tested
// (tests/tts-bench.test.ts). The page imports this file too (served by the dev server) for
// `modeJobs`.

/** A pause after a comma piece in the legacy voice (20b19c2 speakLocal). */
export const LEGACY_COMMA_PAUSE_MS = 140;

/**
 * What each mode asks the voice to say, from one speech plan: the same prepared words (markup
 * removed, pronunciation dictionary, the reader), so only the pipeline differs.
 * - legacy: 20b19c2's speakLocal on `plan.text`: `split` (splitForSpeech) phrases, one model call
 *   per comma piece, 140 ms after a comma and the phrase's own pause after its last piece, both
 *   as a timer (`pauseAfterMs`); raw audio, playback rate = speed.
 * - natural: the plan's chunks (role prosody and shaping by renderChunk; the pause is in the audio).
 */
export function modeJobs(mode, plan, split) {
  if (mode === 'legacy') {
    return split(plan.text).flatMap((c) => {
      const pieces = c.text.split(/,\s*/).filter((p) => p.trim());
      return pieces.map((text, i) => ({
        text,
        pauseAfterMs: i === pieces.length - 1 ? c.pauseMs : LEGACY_COMMA_PAUSE_MS,
      }));
    });
  }
  return plan.chunks.map((chunk) => ({ text: chunk.text, pauseAfterMs: 0, chunk }));
}

/** A gap between two chunks longer than this is heard as the teacher stalling. */
export const LONG_GAP_MS = 600;

/**
 * When each chunk is heard, as the app plays them: chunk n+1 is requested once chunk n is ready
 * (look-ahead of one) and the voice works on one chunk at a time. `pauseAfterMs` is a pause the
 * player waits after a chunk (the legacy timer pause); a pause inside the audio is in
 * `durationMs` and `tailMs`. A gap is the silence heard between two chunks' speech:
 * the first one's trailing silence, any wait, and the next one's leading silence.
 */
export function simulateTimeline(chunks) {
  let start = 0;
  let ready = 0;
  const gaps = [];
  let end = 0;
  chunks.forEach((c, i) => {
    if (i === 0) {
      ready = c.synthMs;
      start = ready;
    } else {
      const prev = chunks[i - 1];
      const requested = start; // the previous chunk's start: its render had just finished
      ready = requested + c.synthMs;
      const arrival = start + prev.durationMs + prev.pauseAfterMs;
      const next = Math.max(ready, arrival);
      gaps.push(prev.tailMs + (next - (start + prev.durationMs)) + c.leadMs);
      start = next;
    }
    end = start + c.durationMs;
  });
  const first = chunks[0];
  return {
    firstAudioMs: first ? first.synthMs : 0,
    firstSoundMs: first ? first.synthMs + first.leadMs : 0,
    totalSynthMs: chunks.reduce((s, c) => s + c.synthMs, 0),
    wallMs: end,
    gaps,
    maxGapMs: gaps.length ? Math.max(...gaps) : 0,
    gapsOverLong: gaps.filter((g) => g > LONG_GAP_MS).length,
  };
}

/** Words (Vietnamese syllables), lower case, without punctuation; hyphens split syllables. */
export function wordsOf(text) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function syllableCount(text) {
  return wordsOf(text).length;
}

function lcsLength(a, b) {
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Did the chunks say the prepared text, every word once and in order? `missing` words are not
 * said, `extra` ones were not in the text, `reordered` ones are said but out of place.
 */
export function wordIntegrity(prepared, chunkTexts) {
  const want = wordsOf(prepared);
  const said = wordsOf(chunkTexts.join(' '));
  const count = (list) => list.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map());
  const a = count(want);
  const b = count(said);
  let missing = 0;
  let extra = 0;
  for (const [w, n] of a) missing += Math.max(0, n - (b.get(w) ?? 0));
  for (const [w, n] of b) extra += Math.max(0, n - (a.get(w) ?? 0));
  const lcs = lcsLength(want, said);
  const reordered = want.length - lcs - missing;
  return {
    preparedWords: want.length,
    saidWords: said.length,
    missing,
    extra,
    reordered,
    ok: missing === 0 && extra === 0 && reordered === 0,
  };
}

/** Largest difference between the chunks' voiced loudness (dB); silent chunks are left out. */
export function rmsSpreadDb(chunkDbs) {
  const heard = chunkDbs.filter((d) => Number.isFinite(d) && d > -100);
  return heard.length ? Math.max(...heard) - Math.min(...heard) : 0;
}

/**
 * The metrics of one item in one mode, from what the page measured. `rtf` is synthesis time over
 * the speech produced (planned pauses left out); syllables per second are over the whole audio
 * as heard (pauses in).
 */
export function itemMetrics({ prepared, chunks, audioMs, peak, clippingShare, nan }) {
  const timeline = simulateTimeline(chunks);
  const speechMs = chunks.reduce((s, c) => s + c.durationMs - c.embeddedPauseMs, 0);
  const integrity = wordIntegrity(
    prepared,
    chunks.map((c) => c.text),
  );
  const round = (x, d = 0) => Number(x.toFixed(d));
  return {
    chunks: chunks.length,
    firstAudioMs: round(timeline.firstAudioMs),
    firstSoundMs: round(timeline.firstSoundMs),
    totalSynthMs: round(timeline.totalSynthMs),
    rtf: round(timeline.totalSynthMs / Math.max(1, speechMs), 3),
    audioSeconds: round(audioMs / 1000, 2),
    syllablesPerSecond: round(syllableCount(prepared) / Math.max(0.01, audioMs / 1000), 2),
    rmsSpreadDb: round(rmsSpreadDb(chunks.map((c) => c.rmsDb)), 2),
    peak: round(peak, 3),
    maxGapMs: round(timeline.maxGapMs),
    gapsOver600: timeline.gapsOverLong,
    clippingShare: round(clippingShare, 5),
    nan,
    missingWords: integrity.missing,
    extraWords: integrity.extra,
    reorderedWords: integrity.reordered,
  };
}

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Median of every numeric metric per mode, plus counts of items with a problem. */
export function summarize(rows, modes) {
  const out = {};
  for (const mode of modes) {
    const metrics = rows.map((r) => r[mode]).filter((m) => m && !m.error);
    const keys = metrics[0]
      ? Object.keys(metrics[0]).filter((k) => typeof metrics[0][k] === 'number')
      : [];
    out[mode] = {
      items: metrics.length,
      failed: rows.filter((r) => r[mode]?.error).length,
      withNaN: metrics.filter((m) => m.nan).length,
      withWordProblems: metrics.filter((m) => m.missingWords + m.extraWords + m.reorderedWords > 0)
        .length,
      median: Object.fromEntries(keys.map((k) => [k, median(metrics.map((m) => m[k]))])),
    };
  }
  return out;
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples, sampleRate) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((x, i) => {
    const v = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    view.setInt16(44 + i * 2, Math.round(v * 0x7fff), true);
  });
  return bytes;
}

/** Float samples sent from the page as base64 of their bytes. */
export function floatsFromBase64(b64) {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)).slice();
}

/** Small seeded generator (mulberry32): the same seed gives the same A/B key. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which mode each sentence plays as A and as B, decided per sentence by the seed. */
export function abKey(ids, modes, seed) {
  const next = random(seed);
  return Object.fromEntries(
    ids.map((id) => {
      const flip = next() < 0.5;
      return [id, { A: flip ? modes[1] : modes[0], B: flip ? modes[0] : modes[1] }];
    }),
  );
}

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

const SCALES = [
  ['naturalness', 'Tự nhiên'],
  ['clarity', 'Rõ ràng'],
  ['intonation', 'Ngữ điệu'],
  ['pronunciation', 'Phát âm đúng'],
];

/**
 * The blind listening sheet: each sentence with its A and B recordings (the file names never say
 * which mode is which), four 1–5 ratings for each, a preference and notes. "Lưu kết quả" saves
 * the ratings as a JSON file; the key that unblinds them is a separate file.
 */
export function listeningSheet(items, audioDir = 'blind') {
  const options = ['', '1', '2', '3', '4', '5']
    .map((v) => `<option value="${v}">${v || '–'}</option>`)
    .join('');
  const scale = (id, side) =>
    SCALES.map(
      ([key, label]) =>
        `<label>${label} <select data-id="${esc(id)}" data-side="${side}" data-key="${key}">${options}</select></label>`,
    ).join(' ');
  const rows = items
    .map(
      (item) => `<section><h2>${esc(item.id)}</h2><p class="t">${esc(item.text)}</p>
${['A', 'B']
  .map(
    (side) =>
      `<div class="s"><b>${side}</b> <audio controls preload="none" src="${audioDir}/${esc(item.id)}-${side}.wav"></audio> ${scale(item.id, side)}</div>`,
  )
  .join('\n')}
<div class="s">Nghe tự nhiên hơn: <select data-id="${esc(item.id)}" data-key="prefer"><option value="">–</option><option>A</option><option>B</option><option value="same">Như nhau</option></select>
<input size="40" data-id="${esc(item.id)}" data-key="notes" placeholder="Từ đọc sai, chỗ ngắt lạ…" aria-label="Ghi chú ${esc(item.id)}"></div></section>`,
    )
    .join('\n');
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nghe so sánh giọng đọc</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:980px}
section{border-top:1px solid #ccc;padding:8px 0}.t{font-size:16px}.s{margin:6px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
audio{width:240px}select,input{font:inherit}</style>
<h1>Nghe so sánh giọng đọc tiếng Việt (A/B)</h1>
<p>Mỗi câu có hai bản A và B, thứ tự được xáo ngẫu nhiên cho từng câu. Nghe cả hai rồi chấm từ <b>1</b> (rất kém) đến <b>5</b> (rất tốt)
theo bốn tiêu chí, chọn bản nghe tự nhiên hơn và ghi lại từ đọc sai. Bấm "Lưu kết quả" khi xong và gửi tệp JSON cho nhóm.</p>
${rows}
<p><button id="save" type="button">Lưu kết quả</button></p>
<script>
const KEY='tts-bench-ratings';
const fields=[...document.querySelectorAll('[data-id]')];
const name=(el)=>[el.dataset.id,el.dataset.side||'',el.dataset.key].join('|');
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');fields.forEach((el)=>{if(saved[name(el)]!==undefined)el.value=saved[name(el)];});}catch(e){}
const collect=()=>Object.fromEntries(fields.map((el)=>[name(el),el.value]));
fields.forEach((el)=>el.addEventListener('change',()=>{try{localStorage.setItem(KEY,JSON.stringify(collect()));}catch(e){}}));
document.getElementById('save').addEventListener('click',()=>{
const out={};for(const [k,v] of Object.entries(collect())){const [id,side,key]=k.split('|');out[id]??={};if(side){out[id][side]??={};out[id][side][key]=v;}else out[id][key]=v;}
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='ratings.json';a.click();});
</script></html>`;
}

// ------------------------------------------------------------ process tree sampling

/**
 * One sample of the browser's processes: the PowerShell sampler prints one JSON line per
 * sample, prefixed with "@@" (pid, parent pid, CPU time in ms, working set in bytes, and whether
 * it is the browser's main process: its command line has the profile and no "--type=").
 */
export function parseSamplerLine(line) {
  if (!line.startsWith('@@')) return null;
  let data;
  try {
    data = JSON.parse(line.slice(2));
  } catch {
    return null;
  }
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return list
    .filter((r) => Number.isFinite(Number(r.pid)))
    .map((r) => ({
      pid: Number(r.pid),
      ppid: Number(r.ppid),
      cpuMs: Number(r.cpu) || 0,
      rssBytes: Number(r.rss) || 0,
      root: Boolean(r.root),
    }));
}

/** `ps -axo pid=,ppid=,rss=,time=,args=` (macOS, Linux): the same rows. */
export function parsePs(text, profile) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const [, pid, ppid, rss, time, args] = m;
    const parts = time.split(/[-:]/).map(Number);
    const [s = 0, min = 0, h = 0, d = 0] = parts.reverse();
    rows.push({
      pid: Number(pid),
      ppid: Number(ppid),
      cpuMs: ((d * 24 + h) * 60 * 60 + min * 60 + s) * 1000,
      rssBytes: Number(rss) * 1024,
      root: args.includes(profile) && !args.includes('--type=') && /edge|chrom/i.test(args),
    });
  }
  return rows;
}

/** The browser's main process and all its descendants. */
export function processTree(rows) {
  const root = rows.find((r) => r.root);
  if (!root) return [];
  const pids = new Set([root.pid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of rows) {
      if (!pids.has(r.pid) && pids.has(r.ppid)) {
        pids.add(r.pid);
        grew = true;
      }
    }
  }
  return rows.filter((r) => pids.has(r.pid));
}

/**
 * CPU time and memory of the browser's process tree over time. A process's CPU time only grows,
 * so its largest value is kept even after it exits; the tree's memory is summed per sample.
 */
export function treeUsage() {
  const cpuByPid = new Map();
  const samples = [];
  return {
    add(rows, at) {
      const tree = processTree(rows);
      for (const r of tree) cpuByPid.set(r.pid, Math.max(cpuByPid.get(r.pid) ?? 0, r.cpuMs));
      const cpuMs = [...cpuByPid.values()].reduce((s, v) => s + v, 0);
      const rssBytes = tree.reduce((s, r) => s + r.rssBytes, 0);
      samples.push({ at, cpuMs, rssBytes, processes: tree.length });
    },
    /** The latest totals (CPU so far, memory now). */
    now() {
      return samples.at(-1) ?? { at: 0, cpuMs: 0, rssBytes: 0, processes: 0 };
    },
    /** CPU used and the highest memory between two times. */
    between(from, to) {
      const inside = samples.filter((s) => s.at >= from && s.at <= to);
      const before = [...samples].reverse().find((s) => s.at <= from) ?? samples[0];
      const last = inside.at(-1) ?? before;
      return {
        cpuMs: last && before ? Math.max(0, last.cpuMs - before.cpuMs) : 0,
        peakRssBytes: Math.max(0, ...inside.map((s) => s.rssBytes)),
        samples: inside.length,
      };
    },
  };
}

/** PowerShell loop that prints the browser processes every `intervalMs` (Windows). */
export function powershellSampler(profile, intervalMs) {
  const pattern = `*${profile.replace(/'/g, "''")}*`;
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    'while ($true) {',
    '  $rows = Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\'" | ForEach-Object {',
    '    [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId;',
    '      cpu = [double]($_.KernelModeTime + $_.UserModeTime) / 10000; rss = [double]$_.WorkingSetSize;',
    `      root = ($_.CommandLine -like '${pattern}' -and $_.CommandLine -notlike '*--type=*') } }`,
    "  Write-Output ('@@' + (ConvertTo-Json -Compress -InputObject @($rows)))",
    `  Start-Sleep -Milliseconds ${String(intervalMs)}`,
    '}',
  ].join('\n');
}
