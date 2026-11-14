/**
 * Shelf card previews for the topics without a physics engine frame (chemistry, biology, Fourier;
 * docs/BENCH_DESIGN.md §9.3): one picture of each topic's stage at its default values, in the light
 * and the dark look, as small WebP files in public/shelf/<topic>.<light|dark>.webp. Physics scenes
 * draw their own engine frame instead.
 *
 *   node scripts/bench/shelf-previews.mjs                       # every chemistry and biology topic
 *   node scripts/bench/shelf-previews.mjs --only mitosis,vsepr  # some topics
 *   node scripts/bench/shelf-previews.mjs --url http://localhost:1450
 *
 * Uses the Vite dev server (starts `npm run dev` on localhost:1420 when no --url answers, and stops
 * it at the end). No AI is called. The pictures are the app's own output, never edited: run this
 * again when a lesson's stage changes look.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'public', 'shelf');
const arg = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null;
const url = arg('--url') ?? 'http://localhost:1420';
const only = arg('--only')?.split(',') ?? null;

/** Every topic without a physics engine frame; src/app/bench/TopicPicture.test.tsx checks it. */
const TOPICS = [
  'fourierSeries',
  'periodicTable',
  'electronConfiguration',
  'bohrModel',
  'orbitals',
  'molecule3d',
  'vsepr',
  'bondPolarity',
  'reactionLibrary',
  'equationBalancing',
  'acidBaseTitration',
  'collisionTheory',
  'maxwellBoltzmann',
  'chemicalEquilibrium',
  'crystalStructure',
  'mitosis',
  'meiosis',
  'centralDogma',
  'pointMutation',
  'mendel',
  'hardyWeinberg',
  'geneticDrift',
  'logisticGrowth',
  'lotkaVolterra',
  'michaelisMenten',
  'diffusionOsmosis',
  'cellStructure',
  'cellToDna',
];
const THEMES = ['light', 'dark'];
/** 480 px wide: twice a card's 242 px preview, sharp on a 2× screen, about 10–20 KB each. */
const WIDTH = 480;
/** Between a card's preview (242×88) and the "Tiếp tục" thumbnail (160×96): CSS crops the rest. */
const ASPECT = 2.2;
const QUALITY = 0.78;

/** The same answers E2E starts from (tests/e2e/storage-state.json), plus High quality. */
const storage = (theme) => ({
  'stemsim.tourDone': '1',
  'stemsim.safety': JSON.stringify({ adultTerms: 1 }),
  'stemsim.whatsnew': JSON.stringify({ lastSeen: '999.0.0' }),
  'stemsim.e2e.noOverload': '1',
  'stemsim.perf': JSON.stringify({ state: { preference: 'high', benchmark: null }, version: 1 }),
  'stemsim.settings': JSON.stringify({ state: { theme, locale: 'vi' }, version: 2 }),
});
const AI_HOSTS =
  /generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.groq\.com|huggingface\.co|hf\.co/;

async function serverUp() {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await serverUp()) return null;
  const child = spawn('npm', ['run', 'dev'], { cwd: root, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 120; i += 1) {
    if (await serverUp()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`the dev server did not start on ${url}`);
}

function stopServer(child) {
  if (!child) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
  else child.kill('SIGTERM');
}

/** Opens `topic` from the shelf and waits until its stage has drawn (3D views settle too). */
async function openTopic(page, topic) {
  await page.goto('/');
  await page.getByRole('button', { name: /Virtual Lab/ }).click();
  await page.locator('.shelf-card').first().waitFor({ timeout: 30_000 });
  await page.evaluate(async (id) => {
    const { openTopic: open } = await import(/* @vite-ignore */ '/src/app/topics.ts');
    await open(id);
  }, topic);
  const stage = page.locator('main.bench__stage');
  await stage.waitFor({ timeout: 30_000 });
  // A lazy module compiles on its first visit to the dev server (up to 20 s).
  await page.waitForFunction(
    () => {
      const s = document.querySelector('main.bench__stage');
      return !!s && !s.querySelector('.stage__skeleton') && s.childElementCount > 0;
    },
    null,
    { timeout: 30_000 },
  );
  // The pointer left over from the shelf would show a hover tooltip on the stage.
  await page.mouse.move(1365, 767);
  await page.waitForTimeout(4000);
  return stage;
}

/**
 * PNG → WebP `WIDTH` px wide and `ASPECT` wide/high, encoded by the browser itself (no image
 * library needed). The frame is centred on what the stage drew: pixels unlike the stage paper (the
 * bottom-right corner, where no lesson draws), so a lesson that writes at the top is not lost in a
 * card's middle band. Never scaled up: a small drawing keeps a wider frame around it.
 */
async function toWebp(page, png) {
  const dataUrl = await page.evaluate(
    async ({ b64, width, aspect, quality }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const W = img.width;
      const H = img.height;
      const full = document.createElement('canvas');
      full.width = W;
      full.height = H;
      const fctx = full.getContext('2d');
      fctx.drawImage(img, 0, 0);
      const px = fctx.getImageData(0, 0, W, H).data;
      const at = (x, y) => (y * W + x) * 4;
      const bg = px.slice(at(W - 2, H - 2), at(W - 2, H - 2) + 3);
      let x0 = W;
      let y0 = H;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = at(x, y);
          if (Math.max(...[0, 1, 2].map((k) => Math.abs(px[i + k] - bg[k]))) > 24) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) [x0, y0, x1, y1] = [0, 0, W - 1, H - 1];
      // At least half the stage wide, padded, at the card's shape, inside the stage.
      const pad = 0.04 * W;
      let w = Math.max(x1 - x0 + 2 * pad, W / 2);
      let h = Math.max(y1 - y0 + 2 * pad, w / aspect);
      w = Math.max(w, h * aspect);
      if (w > W) [w, h] = [W, W / aspect];
      if (h > H) [w, h] = [H * aspect, H];
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const sx = Math.min(Math.max(cx - w / 2, 0), W - w);
      const sy = Math.min(Math.max(cy - h / 2, 0), H - h);
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.round(width / aspect);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(full, sx, sy, w, h, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', quality);
    },
    { b64: png.toString('base64'), width: WIDTH, aspect: ASPECT, quality: QUALITY },
  );
  if (!dataUrl.startsWith('data:image/webp')) throw new Error('this browser cannot encode WebP');
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  // A real graphics card when the machine has one (the 3D lessons); else Chromium's own fallback.
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
let failed = 0;
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      baseURL: url,
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      colorScheme: theme,
      locale: 'vi-VN',
      reducedMotion: 'reduce',
    });
    await context.route(AI_HOSTS, (route) => route.abort());
    await context.addInitScript((items) => {
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    }, storage(theme));
    const page = await context.newPage();
    for (const topic of TOPICS) {
      if (only && !only.includes(topic)) continue;
      try {
        const stage = await openTopic(page, topic);
        const webp = await toWebp(page, await stage.screenshot({ animations: 'disabled' }));
        writeFileSync(join(out, `${topic}.${theme}.webp`), webp);
        console.log(`${topic}.${theme}.webp  ${(webp.length / 1024).toFixed(1)} KB`);
      } catch (e) {
        failed += 1;
        console.error(`${topic} (${theme}): ${e.message.split('\n')[0]}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  stopServer(server);
}
process.exit(failed ? 1 : 0);
