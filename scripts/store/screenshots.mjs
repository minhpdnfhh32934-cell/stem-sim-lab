/**
 * Store screenshots (docs/STORE.md): 1366×768 PNGs of the bench, in the order of the file names.
 *
 *   node scripts/store/screenshots.mjs            # → store/listing/screenshots/*.png
 *   node scripts/store/screenshots.mjs --only 3   # one shot (its number)
 *
 * Uses the Vite dev server on localhost:1420 (starts `npm run dev` when none answers, and stops it
 * at the end). No AI is called: every AI host is refused, so the AI Teacher shot shows the page as a
 * learner without a key sees it. Store shots should show a real answer: take that one from the
 * installed app with a real key (docs/STORE.md).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'store', 'listing', 'screenshots');
const url = 'http://localhost:1420';
const only = process.argv.includes('--only')
  ? Number(process.argv[process.argv.indexOf('--only') + 1])
  : null;

/** The same answers E2E starts from (tests/e2e/storage-state.json), plus High quality. */
const STORAGE = {
  'stemsim.tourDone': '1',
  'stemsim.safety': JSON.stringify({ adultTerms: 1 }),
  'stemsim.whatsnew': JSON.stringify({ lastSeen: '999.0.0' }),
  'stemsim.e2e.noOverload': '1',
  'stemsim.studio': JSON.stringify({
    state: { tab: 'physics', sessions: {}, picked: {}, guideSeen: true },
    version: 2,
  }),
  'stemsim.perf': JSON.stringify({ state: { preference: 'high', benchmark: null }, version: 1 }),
};
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
  throw new Error('the dev server did not start on localhost:1420');
}

function stopServer(child) {
  if (!child) return;
  // npm runs Vite in a child shell: end the whole tree.
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
  else child.kill('SIGTERM');
}

const settle = (page, ms) => page.waitForTimeout(ms);

async function openLab(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Virtual Lab/ }).click();
}

/** `ready`: what the open lesson shows once its lazy module is compiled (up to 20 s on dev). */
async function openTopic(page, subject, topic, ready = page.locator('canvas').first()) {
  await openLab(page);
  await page.getByRole('radio', { name: subject }).click();
  await page.getByRole('main').getByRole('button', { name: topic, exact: true }).click();
  await ready.waitFor({ state: 'visible', timeout: 30_000 });
}

async function run(page) {
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
}

/** [number, file name, what to do before the picture]. */
const SHOTS = [
  [
    1,
    '1-sinh-thai-3d.png',
    async (page) => {
      await openTopic(page, 'Sinh học', 'Con mồi – vật ăn thịt (Lotka–Volterra)');
      await settle(page, 4000);
    },
  ],
  [
    2,
    '2-ai-teacher.png',
    async (page) => {
      await page.goto('/');
      await page.locator('.launch-card--teacher').click();
      await page.getByRole('region', { name: 'Dạy học bằng AI' }).waitFor();
      await page.getByRole('radio', { name: 'Giảng trên bảng' }).click();
      await settle(page, 1500);
    },
  ],
  [
    3,
    '3-vat-ly-giao-thoa.png',
    async (page) => {
      await openTopic(page, 'Vật lý', 'Giao thoa sóng hai nguồn');
      await run(page);
      await settle(page, 2500);
    },
  ],
  [
    4,
    '4-adn-protein-3d.png',
    async (page) => {
      await openTopic(page, 'Sinh học', 'ADN → mARN → Protein');
      await settle(page, 4000);
    },
  ],
  [
    5,
    '5-hoa-hoc-chuan-do.png',
    async (page) => {
      await openTopic(
        page,
        'Hóa học',
        'Chuẩn độ acid – base',
        page.getByRole('group', { name: 'Điều khiển buret' }),
      );
      // Just past the equivalence point (10 mL with the defaults): a learner gets there with the
      // volume slider.
      await page.evaluate(async () => {
        const store = '/src/chemistry/titration/store.ts';
        const { setTitration } = await import(/* @vite-ignore */ store);
        setTitration({ vb: 10.4 });
      });
      // The curve lives in the notebook.
      await page.getByRole('tab', { name: /Đường cong chuẩn độ/ }).click();
      await settle(page, 1500);
    },
  ],
  [
    6,
    '6-nguyen-phan-3d.png',
    async (page) => {
      await openTopic(page, 'Sinh học', 'Nguyên phân');
      await settle(page, 4000);
    },
  ],
  [
    7,
    '7-science-studio.png',
    async (page) => {
      await openLab(page);
      await page
        .getByRole('complementary', { name: 'Thư viện chủ đề' })
        .getByRole('radio', { name: 'Có hướng dẫn' })
        .click();
      await settle(page, 2500);
    },
  ],
  [
    8,
    '8-trang-mo-dau.png',
    async (page) => {
      await page.goto('/');
      await page.locator('.launch-card--lab').waitFor();
      await settle(page, 1500);
    },
  ],
];

mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  // A real graphics card when the machine has one; otherwise Chromium falls back on its own.
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
let failed = 0;
try {
  for (const [n, file, prepare] of SHOTS) {
    if (only !== null && n !== only) continue;
    const context = await browser.newContext({
      baseURL: url,
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'vi-VN',
    });
    await context.route(AI_HOSTS, (route) => route.abort());
    await context.addInitScript((items) => {
      for (const [k, v] of Object.entries(items)) {
        if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
      }
    }, STORAGE);
    const page = await context.newPage();
    try {
      await prepare(page);
      // Hover bubbles and the focus ring are not part of the picture.
      await page.mouse.move(0, 767);
      await page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
      await page.screenshot({ path: join(out, file) });
      const gl = await page.evaluate(() => {
        const c = document.createElement('canvas').getContext('webgl2');
        const ext = c?.getExtension('WEBGL_debug_renderer_info');
        return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no WebGL2';
      });
      console.log(`${file}: ok (${gl})`);
    } catch (error) {
      failed += 1;
      console.error(`${file}: FAILED: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  stopServer(server);
}
process.exit(failed ? 1 : 0);
