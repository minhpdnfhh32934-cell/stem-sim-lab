// Benchmark of the on-device Vietnamese voice (MMS-TTS) in two modes on the same served build.
// Both modes say the SAME prepared text: prepareSpeech's plan.text (markup removed, pronunciation
// dictionary, the served build's reader), so only the pipeline differs (modeJobs in
// tts-bench-lib.mjs). Neither is "exactly how the app spoke" at 20b19c2: the reader has been fixed
// since then (units, arrows, "tan", MeV) and the dictionary is new, in both modes alike.
//
//   legacy  — 20b19c2's chunking, pauses and playback rate (speak.ts speakLocal) on that text:
//             splitForSpeech(plan.text), one model call per comma piece, 140 ms after a comma,
//             the phrase's own pause (320 / 260 / 520 ms) after its last piece as a timer, raw
//             model audio, playback rate = speed (1 here).
//   natural — the app's pipeline now: the plan's chunks (roles, planned pauses) and renderChunk
//             (role prosody, trim, loudness, fades, pace, pause in the audio).
//
// Per sentence of src/teacher/voice/ttsBenchSet.json and per mode it records: first-audio latency
// (first chunk ready), total synthesis time, real-time factor, audio duration, syllables per
// second, chunk loudness spread (dB) and peak, the longest gap between chunks and how many
// exceed 600 ms (played with a look-ahead of one, as the app does), clipping share, NaN, words
// dropped / added / reordered (chunk texts against the prepared text), and the CPU time and peak
// memory of the browser's whole process tree (sampled from Node). It writes one WAV per sentence
// and mode, a blind A/B listening sheet (index.html; A and B are shuffled per sentence, the key is
// in key/ab-key.json) and results.json.
//
//   npm run dev -- --port 1430        (the origin whose storage already holds the voice; started by
//                                      whoever runs the benchmark, never by this script)
//   node scripts/voice/tts-bench.mjs --profile <Edge profile> [--out <folder>] [--base <url>]
//                                    [--seed <n>] [--only B01,B05] [--sample-ms 1000]
//
// SAFETY (audit GPU-01): CPU only. Edge starts with the GPU and WebGPU disabled, the app's device
// preference is forced to 'wasm' and the script stops unless the voice reports the 'wasm'
// device. The voice must already be downloaded in <profile> (115 MB): the script stops when it
// is not, and every request to the model hosts is refused, so nothing is ever downloaded.
// Run it only when no other benchmark uses the CPU: the timings are the point.
import { createRequire } from 'node:module';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  abKey,
  encodeWav,
  floatsFromBase64,
  itemMetrics,
  listeningSheet,
  parsePs,
  parseSamplerLine,
  powershellSampler,
  summarize,
  treeUsage,
} from './tts-bench-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const MODES = ['legacy', 'natural'];
const SAMPLE_RATE = 16000;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const profileArg = arg('profile');
if (!profileArg) {
  throw new Error('--profile <Edge profile folder that already holds the voice> is required');
}
const profile = resolve(profileArg);
const out = resolve(arg('out', resolve(root, '.agent-logs/tts-bench')));
const base = arg('base', 'http://localhost:1430');
const seed = Number(arg('seed', String(Date.now() % 2 ** 31)));
const sampleMs = Number(arg('sample-ms', '1000'));
const only = arg('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const set = JSON.parse(readFileSync(resolve(root, 'src/teacher/voice/ttsBenchSet.json'), 'utf8'));
const items = only.length ? set.filter((i) => only.includes(i.id)) : set;
for (const dir of ['by-mode', 'blind', 'key']) mkdirSync(resolve(out, dir), { recursive: true });

let commit = 'unknown';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
} catch {
  /* not a git checkout */
}

// ------------------------------------------------------------ process tree sampler

const usage = treeUsage();

/** Samples the browser's processes every `intervalMs`; returns a stop function. */
function startSampler(intervalMs) {
  if (process.platform === 'win32') {
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', powershellSampler(profile, intervalMs)],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    );
    let buffer = '';
    ps.stdout.setEncoding('utf8');
    ps.stdout.on('data', (data) => {
      buffer += data;
      for (let i = buffer.indexOf('\n'); i >= 0; i = buffer.indexOf('\n')) {
        const rows = parseSamplerLine(buffer.slice(0, i).trim());
        buffer = buffer.slice(i + 1);
        if (rows) usage.add(rows, Date.now());
      }
    });
    return () => ps.kill();
  }
  const timer = setInterval(() => {
    execFile('ps', ['-axo', 'pid=,ppid=,rss=,time=,args='], { maxBuffer: 1 << 24 }, (e, text) => {
      if (!e) usage.add(parsePs(text, profile), Date.now());
    });
  }, intervalMs);
  return () => clearInterval(timer);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ browser

const context = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
  args: ['--disable-gpu', '--disable-features=WebGPU,Vulkan'],
});
// Never download: the voice must already be stored; any request to the model hosts is refused.
await context.route(/^https:\/\/(?:[a-z0-9-]+\.)*(?:huggingface\.co|hf\.co)\//i, (route) =>
  route.abort(),
);
await context.addInitScript(() => {
  try {
    localStorage.setItem('stemsim.voice-device', 'wasm');
  } catch {
    /* the page will refuse below */
  }
});
const stopSampler = startSampler(sampleMs);
const page = context.pages()[0] ?? (await context.newPage());

async function finish(code) {
  stopSampler();
  await context.close();
  if (code) process.exit(code);
}

await page.goto(base);
await page.waitForLoadState('networkidle');

const setup = await page.evaluate(async () => {
  const v = await import('/src/teacher/voice/localVoice.ts');
  return {
    webgpu: 'gpu' in navigator,
    preference: v.localVoiceDevicePreference(),
    device: await v.localVoiceDevice(),
    status: await v.localVoiceStatus(),
    userAgent: navigator.userAgent,
  };
});
if (setup.preference !== 'wasm' || setup.device !== 'wasm') {
  console.error(
    `Refusing to run: preference "${setup.preference}", device "${setup.device}"; CPU ("wasm") only.`,
  );
  await finish(2);
}
if (setup.status !== 'ready') {
  console.error(`The on-device voice is not downloaded in this profile (${setup.status}).`);
  await finish(3);
}

// The model loads once, outside the measurements.
const loadMs = await page.evaluate(async () => {
  const v = await import('/src/teacher/voice/localVoice.ts');
  const t0 = performance.now();
  await v.synthesizeLocal('xin chào', new AbortController().signal);
  return Math.round(performance.now() - t0);
});
for (let waited = 0; usage.now().processes === 0 && waited < 15_000; waited += 250) {
  await sleep(250);
}
if (usage.now().processes === 0) {
  console.warn('No browser process found by the sampler: CPU time and memory will be 0.');
}

/** Renders one sentence in one mode inside the page (the app's own modules). */
function renderInPage(mode, item) {
  return page.evaluate(
    async ({ mode, item, rate }) => {
      const v = await import('/src/teacher/voice/localVoice.ts');
      const t = await import('/src/teacher/voice/vietnameseText.ts');
      const st = await import('/src/teacher/voice/stitch.ts');
      const sp = await import('/src/teacher/voice/speechPlan.ts');
      const nv = await import('/src/teacher/voice/naturalVoice.ts');
      const lib = await import('/scripts/voice/tts-bench-lib.mjs');
      const signal = new AbortController().signal;
      const toBase64 = (f32) => {
        const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
      };
      const measure = (samples, text, synthMs, pauseAfterMs, embeddedPauseMs) => ({
        text,
        synthMs,
        pauseAfterMs,
        embeddedPauseMs,
        durationMs: (samples.length / rate) * 1000,
        leadMs: st.leadingSilenceMs(samples, rate),
        tailMs: st.trailingSilenceMs(samples, rate),
        rmsDb: st.toDb(st.voicedRms(samples, rate)),
      });
      const chunks = [];
      const parts = [];
      // The same prepared words in both modes: only the pipeline differs.
      const plan = sp.prepareSpeech(item.text, {
        ...(item.role ? { role: item.role } : {}),
        ...(item.emphasis ? { emphasis: item.emphasis } : {}),
      });
      const prepared = plan.text;
      for (const job of lib.modeJobs(mode, plan, t.splitForSpeech)) {
        const t0 = performance.now();
        let samples;
        let ms;
        if (mode === 'legacy') {
          // 20b19c2 speakLocal: one model call per comma piece, raw audio, the pause a timer.
          const pcm = await v.synthesizeLocal(job.text, signal);
          ms = performance.now() - t0;
          samples = st.resample(pcm.samples, pcm.sampleRate, rate);
        } else {
          samples = (await nv.renderChunk(job.chunk, signal)).samples;
          ms = performance.now() - t0;
        }
        const embedded = job.chunk ? job.chunk.pauseMs : 0;
        chunks.push(measure(samples, job.text, ms, job.pauseAfterMs, embedded));
        parts.push(samples, st.silence(job.pauseAfterMs, rate));
      }
      const audio = st.concat(parts);
      return {
        prepared,
        chunks,
        audioMs: (audio.length / rate) * 1000,
        peak: st.peakOf(audio),
        clippingShare: st.clippingShare(audio),
        nan: st.hasNonFinite(audio),
        audio: toBase64(audio),
      };
    },
    { mode, item, rate: SAMPLE_RATE },
  );
}

const key = abKey(
  items.map((i) => i.id),
  MODES,
  seed,
);
writeFileSync(resolve(out, 'key/ab-key.json'), JSON.stringify({ seed, key }, null, 2));
writeFileSync(resolve(out, 'index.html'), listeningSheet(items, 'blind'));

const rows = [];
const save = () =>
  writeFileSync(
    resolve(out, 'results.json'),
    JSON.stringify(
      {
        when: new Date().toISOString(),
        commit,
        base,
        device: 'wasm',
        userAgent: setup.userAgent,
        loadMs,
        seed,
        sampleMs,
        rows,
        summary: summarize(rows, MODES),
      },
      null,
      2,
    ),
  );

for (const [index, item] of items.entries()) {
  const row = { id: item.id, kind: item.kind, text: item.text };
  // Alternate which mode goes first, so a warm cache or a busy moment favours neither.
  const order = index % 2 === 0 ? MODES : [...MODES].reverse();
  for (const mode of order) {
    const from = Date.now();
    try {
      const r = await renderInPage(mode, item);
      await sleep(sampleMs + 250);
      const used = usage.between(from, Date.now());
      const samples = floatsFromBase64(r.audio);
      const wav = encodeWav(samples, SAMPLE_RATE);
      writeFileSync(resolve(out, `by-mode/${item.id}-${mode}.wav`), wav);
      const side = key[item.id]?.A === mode ? 'A' : 'B';
      writeFileSync(resolve(out, `blind/${item.id}-${side}.wav`), wav);
      row[mode] = {
        ...itemMetrics(r),
        edgeCpuMs: Math.round(used.cpuMs),
        edgePeakRssMb: Number((used.peakRssBytes / 2 ** 20).toFixed(1)),
        prepared: r.prepared,
        chunkTexts: r.chunks.map((c) => c.text),
      };
    } catch (e) {
      row[mode] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  rows.push(row);
  save();
  const line = (m) =>
    row[m].error
      ? `${m}: ERROR ${row[m].error}`
      : `${m}: first ${row[m].firstAudioMs} ms, rtf ${row[m].rtf}, gap ${row[m].maxGapMs} ms (${row[m].gapsOver600} > 600), spread ${row[m].rmsSpreadDb} dB, cpu ${row[m].edgeCpuMs} ms`;
  console.log(`${item.id} | ${line('legacy')} | ${line('natural')}`);
}

await finish(0);
save();
const summary = summarize(rows, MODES);
for (const mode of MODES) {
  console.log(`${mode}: ${JSON.stringify(summary[mode])}`);
}
console.log(
  `Results, WAVs and the blind listening sheet: ${out} (load ${loadMs} ms, seed ${seed})`,
);
