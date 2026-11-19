// The still behind the game's live menu while its scene is built (liveMenu.ts): `npm run live-still`.
// The wallpaper's page on its own dev server, at the scene's first moment (the clock 0.3 s in,
// the framing, the mouse at rest), drawn on this computer's graphics card in Microsoft Edge and
// saved as public/menu/live-still.jpg. Run it again when the wallpaper's look changes.
// 3200 × 1350 (2.37:1): the menu shows it as tall as the window, centred, so it matches the scene
// on any window from 16:10 to 21:9.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const W = 3200;
const H = 1350;
const server = await createServer({
  configFile: 'vite.wallpaper.config.ts',
  server: { port: 5199, strictPort: false },
  logLevel: 'warn',
});
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5199/';
const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`${url}wallpaper.html?w=${W}&h=${H}&t=0.3&mx=0&my=0`);
  await page.waitForSelector('#wallpaper[data-ready="1"]', { timeout: 180_000 });
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas')?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  mkdirSync('public/menu', { recursive: true });
  await page.screenshot({ path: 'public/menu/live-still.jpg', type: 'jpeg', quality: 82 });
  console.log(`public/menu/live-still.jpg (${W}×${H}), drawn by ${renderer}`);
} finally {
  await browser.close();
  await server.close();
}
