// Makes a listening pack for the on-device Vietnamese voice (MMS-TTS): one WAV per sentence of the
// golden pronunciation set (src/teacher/voice/pronounceGolden.json), synthesised through the
// app's own code, plus an index.html where a teacher or learner rates each sentence. The numbers
// it prints (loudness, clipping, silence, speaking rate) are automatic checks only: whether the
// voice is natural and every tone is right needs a human listener.
//
//   npm run dev -- --port 1430                       (the origin that holds the downloaded voice)
//   node scripts/voice/listening-pack.mjs --profile <Edge profile> --out <folder> [--base <url>]
//
// SAFETY (audit GPU-01): the voice runs on the CPU only. Edge starts with the GPU and WebGPU
// disabled, the app's device preference is forced to 'wasm', and the script stops unless the
// voice reports the 'wasm' device. The voice must already be downloaded in <profile> (115 MB);
// the script never starts a download.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('@playwright/test');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const profile = arg('profile');
const out = arg('out', resolve(root, '.agent-logs/listening-pack'));
const base = arg('base', 'http://localhost:1430');
if (!profile)
  throw new Error('--profile <Edge profile folder that already holds the voice> is required');
mkdirSync(out, { recursive: true });

// The golden set (also checked by src/teacher/voice/pronounceGolden.test.ts).
const golden = JSON.parse(
  readFileSync(resolve(root, 'src/teacher/voice/pronounceGolden.json'), 'utf8'),
);

const context = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
  args: ['--disable-gpu', '--disable-features=WebGPU,Vulkan'],
});
await context.addInitScript(() => {
  try {
    localStorage.setItem('stemsim.voice-device', 'wasm');
  } catch {
    /* the page will refuse below */
  }
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(base);
await page.waitForLoadState('networkidle');

const setup = await page.evaluate(async () => {
  const v = await import('/src/teacher/voice/localVoice.ts');
  return {
    webgpu: 'gpu' in navigator,
    device: await v.localVoiceDevice(),
    status: await v.localVoiceStatus(),
  };
});
if (setup.device !== 'wasm') {
  console.error(`Refusing to run: the voice would use "${setup.device}", CPU ("wasm") only.`);
  await context.close();
  process.exit(2);
}
if (setup.status !== 'ready') {
  console.error(`The on-device voice is not downloaded in this profile (${setup.status}).`);
  await context.close();
  process.exit(3);
}

const rows = [];
for (const item of golden) {
  const r = await page.evaluate(async (text) => {
    const v = await import('/src/teacher/voice/localVoice.ts');
    const t = await import('/src/teacher/voice/vietnameseText.ts');
    const spoken = t.toSpeech(text);
    const t0 = performance.now();
    const pcm = await v.synthesizeLocal(v.textForModel(spoken), new AbortController().signal);
    const ms = performance.now() - t0;
    const { samples, sampleRate } = pcm;
    let sum = 0;
    let peak = 0;
    let clipped = 0;
    for (const x of samples) {
      sum += x * x;
      const a = Math.abs(x);
      if (a > peak) peak = a;
      if (a >= 0.99) clipped += 1;
    }
    // Leading/trailing silence: 10 ms frames below 2 % of the peak.
    const frame = Math.round(sampleRate / 100);
    const loud = (i) => {
      let m = 0;
      for (let k = i; k < Math.min(i + frame, samples.length); k++)
        m = Math.max(m, Math.abs(samples[k]));
      return m > peak * 0.02;
    };
    let lead = 0;
    while (lead < samples.length && !loud(lead)) lead += frame;
    let tail = samples.length;
    while (tail > 0 && !loud(tail - frame)) tail -= frame;
    // 16-bit PCM WAV, base64.
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
    samples.forEach((x, i) =>
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 0x7fff, true),
    );
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const seconds = samples.length / sampleRate;
    const syllables = spoken.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
    return {
      spoken,
      wav: btoa(bin),
      sampleRate,
      seconds: Number(seconds.toFixed(2)),
      synthMs: Math.round(ms),
      rms: Number(Math.sqrt(sum / Math.max(1, samples.length)).toFixed(4)),
      peak: Number(peak.toFixed(3)),
      clippedShare: Number((clipped / Math.max(1, samples.length)).toFixed(5)),
      leadMs: Math.round((lead / sampleRate) * 1000),
      tailMs: Math.round(((samples.length - tail) / sampleRate) * 1000),
      syllablesPerSecond: Number((syllables / Math.max(0.01, seconds)).toFixed(2)),
      nan: samples.some((x) => !Number.isFinite(x)),
    };
  }, item.text);
  writeFileSync(resolve(out, `${item.id}.wav`), Buffer.from(r.wav, 'base64'));
  const { wav, ...metrics } = r;
  const checks = {
    audible: metrics.rms >= 0.02,
    notClipped: metrics.clippedShare < 0.001,
    shortSilences: metrics.leadMs < 300 && metrics.tailMs < 300,
    plausibleRate: metrics.syllablesPerSecond >= 2 && metrics.syllablesPerSecond <= 7,
    finite: !metrics.nan,
    spokenMatchesGolden: metrics.spoken.trim() === item.reading.trim(),
  };
  rows.push({ ...item, ...metrics, checks });
  console.log(
    `${item.id}: ${metrics.seconds}s rms ${metrics.rms} peak ${metrics.peak} rate ${metrics.syllablesPerSecond}/s ${Object.entries(
      checks,
    )
      .filter(([, ok]) => !ok)
      .map(([k]) => `FAIL:${k}`)
      .join(' ')}`,
  );
}
await context.close();

writeFileSync(resolve(out, 'results.json'), JSON.stringify({ device: 'wasm', rows }, null, 2));
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
const html = `<!doctype html><meta charset="utf-8"><title>Nghe thử giọng đọc SimLab</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;max-width:1100px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;vertical-align:top}
th{background:#f3f4f6;text-align:left}.p{color:#a16207}audio{width:220px}</style>
<h1>Nghe thử giọng đọc tiếng Việt (MMS, chạy trên CPU)</h1>
<p>Nghe từng câu và chấm: <b>1</b> nghe không hiểu · <b>3</b> hiểu nhưng sai dấu/ngắt nghỉ · <b>5</b> tự nhiên, đúng hết.
Ghi lại từ đọc sai. Dòng có chữ <span class="p">chờ GV xác nhận</span> là cách đọc theo quy ước cần giáo viên duyệt.
Các số đo bên phải chỉ là kiểm tra tự động (âm lượng, vỡ tiếng, khoảng lặng, tốc độ), không thay được người nghe.</p>
<table><tr><th>#</th><th>Câu viết</th><th>Cách đọc chuẩn</th><th>Nghe</th><th>Điểm (1–5) / từ sai</th><th>Đo tự động</th></tr>
${rows
  .map(
    (
      r,
    ) => `<tr><td>${esc(r.id)}${r.pending ? '<br><span class="p">chờ GV xác nhận</span>' : ''}</td><td>${esc(r.text)}</td><td>${esc(r.reading)}</td>
<td><audio controls preload="none" src="${esc(r.id)}.wav"></audio></td><td><input size="3" aria-label="Điểm ${esc(r.id)}"> <input size="18" aria-label="Từ sai ${esc(r.id)}"></td>
<td>${r.seconds}s · ${r.syllablesPerSecond} âm tiết/s · rms ${r.rms}${Object.entries(r.checks)
      .filter(([, ok]) => !ok)
      .map(([k]) => ` · <b>${esc(k)}</b>`)
      .join('')}</td></tr>`,
  )
  .join('\n')}</table>`;
writeFileSync(resolve(out, 'index.html'), html);
const failed = rows.filter((r) => Object.values(r.checks).some((ok) => !ok));
console.log(
  `${rows.length} sentences, ${failed.length} with a failed automatic check. Pack: ${out}`,
);
