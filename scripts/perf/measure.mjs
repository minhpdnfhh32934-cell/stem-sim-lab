// Measures cold start, JS heap and frame rate of the production build in Chromium.
// Usage: npm run build && npx vite preview --port 4173 &  node scripts/perf/measure.mjs
// (PW_CHROMIUM=/path/to/chromium to use an installed browser.)
import { chromium } from '@playwright/test';

const URL = process.env.PERF_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--enable-precise-memory-info'],
});
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  locale: 'vi-VN',
  storageState: {
    cookies: [],
    origins: [
      { origin: URL.replace(/\/$/, ''), localStorage: [{ name: 'stemsim.tourDone', value: '1' }] },
    ],
  },
});
const page = await ctx.newPage();
const heap = () => page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 2 ** 20));

const results = {};
const t0 = Date.now();
await page.goto(URL);
await page.waitForSelector('.statusbar');
results.coldStartMs = Date.now() - t0;
results.navTiming = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0];
  return {
    domContentLoaded: Math.round(n.domContentLoadedEventEnd),
    load: Math.round(n.loadEventEnd),
  };
});
await page.waitForTimeout(3000); // startup benchmark
results.heapIdleMB = await heap();

async function fps(ms = 3000) {
  return page.evaluate(
    (dur) =>
      new Promise((resolve) => {
        let n = 0;
        const start = performance.now();
        const f = (now) => {
          n++;
          if (now - start < dur) requestAnimationFrame(f);
          else resolve(Math.round((n * 1000) / (now - start)));
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
}

// Physics: oblique projectile running.
await page.getByRole('button', { name: 'Ném xiên', exact: true }).click();
await page.waitForTimeout(800);
await page.keyboard.press(' ');
results.physicsFps = await fps();
results.heapPhysicsMB = await heap();

// Chemistry: 3D molecule and a mechanism.
await page.getByRole('radio', { name: 'Hóa học' }).click();
await page.getByRole('button', { name: 'Phân tử 3D', exact: true }).click();
await page.waitForTimeout(1500);
results.heapMolecule3dMB = await heap();
await page.getByRole('button', { name: 'Thư viện phản ứng đã kiểm chứng', exact: true }).click();
await page.waitForTimeout(1500);
results.heapMechanismMB = await heap();
await page.getByRole('button', { name: 'Thuyết va chạm', exact: true }).click();
await page.waitForTimeout(800);
results.collisionFps = await fps();

// Biology: diffusion particles.
await page.getByRole('radio', { name: 'Sinh học' }).click();
await page.getByRole('button', { name: 'Khuếch tán & thẩm thấu', exact: true }).click();
await page.waitForTimeout(800);
results.diffusionFps = await fps();
results.heapEndMB = await heap();
results.degraded = await page.evaluate(() => document.body.innerText.includes('Đã hạ chất lượng'));

console.log(JSON.stringify(results, null, 2));
await browser.close();
