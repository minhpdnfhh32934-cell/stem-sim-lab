declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

const STAGES = ['g1', 'g2', 'prophase', 'metaphase', 'anaphase', 'telophase', 'cytokinesis'];

/**
 * WebGL runs in software (SwiftShader) for every test of this file, never on the GPU: a laptop
 * GPU driver reset (bugcheck 0x119) is not a test result. Each test checks the renderer before
 * the 3D view starts.
 */
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
test.use({
  launchOptions: {
    args: SWIFTSHADER,
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

async function expectSoftwareWebGL(page: Page): Promise<string> {
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no WebGL 2';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  });
  expect(renderer, 'WebGL must run in software (SwiftShader), never on the GPU').toContain(
    'SwiftShader',
  );
  return renderer;
}

/** Opens the mitosis topic with the 3D view (after checking that WebGL is software). */
async function openMitosis(page: Page, quality: 'medium' | 'high' = 'medium'): Promise<string> {
  // A slow test machine may measure as "low" quality, where mitosis uses the 2D picture.
  await page.addInitScript((preference) => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference, benchmark: null }, version: 1 }),
    );
  }, quality);
  await openLab(page);
  const renderer = await expectSoftwareWebGL(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page.getByRole('button', { name: 'Nguyên phân', exact: true }).click();
  await expect(page.locator('.m3d canvas')).toBeVisible({ timeout: 20_000 });
  return renderer;
}

const strip = (page: Page) => page.getByRole('group', { name: 'Các kì' });

const stage = (page: Page) => page.evaluate(() => window.__simlabMitosis3d?.stage() ?? null);
const info = (page: Page) => page.evaluate(() => window.__simlabMitosis3d?.info() ?? null);

test('mitosis 3D: plays through every stage, switches cell type, no leaks on replay', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openMitosis(page);
  await expect(page.locator('.science-card')).toContainText('Nguyên phân 3D');

  // Play the whole division at 2× and record every stage shown.
  await page.getByRole('radio', { name: '2×' }).click();
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  const seen = new Set<string>();
  await expect
    .poll(
      async () => {
        const s = await stage(page);
        if (s) seen.add(s);
        return s;
      },
      { timeout: 40_000, intervals: [100] },
    )
    .toBe('cytokinesis');
  await expect(page.getByRole('button', { name: 'Phát', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  expect([...seen].sort()).toEqual([...STAGES].sort());
  await expect(page.getByText('Sau khi chia: 2 tế bào con · mỗi tế bào 4 NST đơn')).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-animal-end.png` });

  // Plant cell: wall and cell plate instead of centrosomes and furrow.
  await page.getByRole('radio', { name: 'Thực vật' }).click();
  const parts = page.getByRole('group', { name: 'Bộ phận tế bào' });
  await expect(parts.getByRole('button', { name: 'Thành tế bào' })).toBeVisible();
  await expect(parts.getByRole('button', { name: 'Trung thể' })).toHaveCount(0);
  await parts.getByRole('button', { name: 'Vách ngăn (tấm tế bào)' }).click();
  await expect(page.locator('.m3d__info')).toContainText('Golgi');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-plant-end.png` });

  // Replay 10 times (stepping through every stage): GPU resources must not grow. Every
  // measurement is taken at the same moment (end of cytokinesis, after one full pass), so the
  // same geometries and shader programs have been drawn each time.
  const next = page.getByRole('button', { name: 'Bước tiếp theo' });
  const pass = async () => {
    await page.getByRole('button', { name: 'Phát lại từ đầu' }).click();
    await page.getByRole('button', { name: 'Tạm dừng' }).click();
    for (let k = 0; k < STAGES.length - 1; k++) {
      await next.click();
      await page.waitForTimeout(60);
    }
    await expect(next).toBeDisabled();
    expect(await stage(page)).toBe('cytokinesis');
    await page.waitForTimeout(100);
    const now = await info(page);
    return { geometries: now?.geometries, programs: now?.programs };
  };
  const first = await pass();
  expect(first.geometries).toBeGreaterThan(0);
  expect(first.programs).toBeGreaterThan(0);
  for (let r = 0; r < 9; r++) await pass();
  expect(await pass()).toEqual(first);

  // Switching cell type back and forth rebuilds the scene and frees the old one: after the
  // same pass (same part selected) the plant cell uses exactly what it used before.
  for (let r = 0; r < 3; r++) {
    await page.getByRole('radio', { name: 'Động vật' }).click();
    await page.getByRole('radio', { name: 'Thực vật' }).click();
  }
  await parts.getByRole('button', { name: 'Vách ngăn (tấm tế bào)' }).click();
  await expect(page.locator('.m3d__info')).toContainText('Golgi');
  expect(await pass()).toEqual(first);

  // Close-up and metaphase picture for the record.
  await strip(page).getByRole('button', { name: 'Kì giữa' }).click();
  await page.getByRole('radio', { name: 'Cận cảnh NST' }).click();
  await page.waitForTimeout(300);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-plant-meta.png` });
  await page.getByRole('radio', { name: 'Động vật' }).click();
  await page.getByRole('radio', { name: 'Toàn cảnh' }).click();
  await page.waitForTimeout(300);
  if (process.env.SHOTS)
    await page.screenshot({ path: `${process.env.SHOTS}/m3d-animal-meta.png` });

  // 2D view still available; meiosis keeps the 2D picture.
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.m3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.m3d canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Giảm phân', exact: true }).click();
  await expect(page.locator('.m3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();

  expect(errors).toEqual([]);
});

/** Boxes of the overlay parts, the hits of the 40 px rule and the page's horizontal scroll. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const small = [...document.querySelectorAll('.m3d button, .m3d [role="radio"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 39.5 || r.height < 39.5))
      .map(
        ({ el, r }) =>
          `${el.getAttribute('aria-label') ?? el.textContent.trim()}: ${r.width.toFixed(1)}×${r.height.toFixed(1)}`,
      );
    const root = document.documentElement;
    return {
      view: box('.m3d'),
      parts: {
        top: box('.m3d__top'),
        side: box('.m3d__side'),
        info: box('.m3d__info'),
        bottom: box('.m3d__bottom'),
      },
      /** "Hỏi thầy về bộ phận này", inside the part's card. */
      ask: box('.m3d__ask'),
      small,
      scroll: root.scrollWidth - root.clientWidth,
    };
  });
}

test('mitosis 3D at 1366 × 768: with a part picked, the boxes never overlap at any stage', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openMitosis(page);
  const parts = page.getByRole('group', { name: 'Bộ phận tế bào' });
  // The parts with the longest texts, in each cell type.
  for (const [cell, part] of [
    ['Động vật', 'Tâm động'],
    ['Thực vật', 'Vách ngăn (tấm tế bào)'],
  ] as const) {
    await page.getByRole('radio', { name: cell }).click();
    await parts.getByRole('button', { name: part }).click();
    for (const button of await strip(page).getByRole('button').all()) {
      await button.click();
      await expect(page.locator('.m3d__info')).toContainText(part);
      const l = await layout(page);
      const where = `${cell}, ${part}, ${await button.innerText()}`;
      expect(l.view, where).not.toBeNull();
      const view = l.view!;
      const named = Object.entries(l.parts);
      for (const [name, b] of named) {
        expect(b, `${where}: ${name}`).not.toBeNull();
        // Inside the 3D view.
        expect(b!.left, `${where}: ${name} left`).toBeGreaterThanOrEqual(view.left - 0.5);
        expect(b!.top, `${where}: ${name} top`).toBeGreaterThanOrEqual(view.top - 0.5);
        expect(b!.right, `${where}: ${name} right`).toBeLessThanOrEqual(view.right + 0.5);
        expect(b!.bottom, `${where}: ${name} bottom`).toBeLessThanOrEqual(view.bottom + 0.5);
      }
      for (let i = 0; i < named.length; i++)
        for (let j = i + 1; j < named.length; j++) {
          const [an, a] = named[i]!;
          const [bn, b] = named[j]!;
          const w = Math.min(a!.right, b!.right) - Math.max(a!.left, b!.left);
          const h = Math.min(a!.bottom, b!.bottom) - Math.max(a!.top, b!.top);
          expect(w > 0.5 && h > 0.5, `${where}: ${an} overlaps ${bn}`).toBe(false);
        }
      // The ask button is always in view inside the card (only the part's text scrolls).
      const card = l.parts.info!;
      expect(l.ask, `${where}: ask`).not.toBeNull();
      expect(l.ask!.left, `${where}: ask left`).toBeGreaterThanOrEqual(card.left - 0.5);
      expect(l.ask!.top, `${where}: ask top`).toBeGreaterThanOrEqual(card.top - 0.5);
      expect(l.ask!.right, `${where}: ask right`).toBeLessThanOrEqual(card.right + 0.5);
      expect(l.ask!.bottom, `${where}: ask bottom`).toBeLessThanOrEqual(card.bottom + 0.5);
      expect(l.small, `${where}: buttons and radios under 40 px`).toEqual([]);
      expect(l.scroll, `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
    }
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-layout.png` });
});

test('mitosis 3D: "Hỏi thầy về bộ phận này" opens AI Teacher with the question, sends nothing', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Any AI the app could ask (online providers, a runtime on this computer): nothing may be
  // asked before the learner presses send.
  const asked: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (
      /generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.groq\.com/.test(url.hostname) ||
      ['11434', '1234', '8080'].includes(url.port)
    )
      asked.push(r.url());
  });
  await openMitosis(page);
  await strip(page).getByRole('button', { name: 'Kì giữa' }).click();
  await page
    .getByRole('group', { name: 'Bộ phận tế bào' })
    .getByRole('button', { name: 'Tâm động' })
    .click();
  const ask = page.locator('.m3d__info').getByRole('button', { name: 'Hỏi thầy về bộ phận này' });
  // A full-size target inside the part's card.
  const box = await ask.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(39.5);
  await ask.click();

  const question = page.getByRole('textbox', { name: 'Nhập câu hỏi' });
  await expect(question).toHaveValue(
    'Thầy giải thích giúp em: bộ phận “Tâm động” làm gì ở bước “Kì giữa” của nguyên phân (tế bào động vật) ạ?',
  );
  await expect(question).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Trò chuyện' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-ask.png` });

  // Back to the simulation: the part is still picked; nothing was asked on the way.
  await page.locator('.teacher').getByRole('button', { name: 'Về trang chủ' }).click();
  await expect(page.locator('.m3d__info')).toContainText('Tâm động', { timeout: 20_000 });
  expect(asked).toEqual([]);
});

declare global {
  interface Window {
    __m3dPerf?: { frames: number[]; calls: number; triangles: number; running: boolean };
  }
}

/** Budgets of the perf project (2n = 8, High quality: 24 sphere segments, see scene.perf.test). */
const PERF = { calls: 74, triangles: 46_000, p95Ms: 150 };

test('mitosis 3D performance: 2n = 8 at High quality within the draw and frame budgets @perf', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const renderer = await openMitosis(page, 'high');
  await page.getByLabel('Bộ NST lưỡng bội 2n').selectOption('4');
  await expect(page.getByText('1 tế bào · 8 NST đơn')).toBeVisible();
  expect(await page.evaluate(() => window.__simlabMitosis3d?.quality() ?? null)).toEqual({
    tier: 'high',
    degraded: false,
  });
  // From the end of prophase through telophase (the most triangles: the rod → thread fade).
  await page.getByRole('radio', { name: '2×' }).click();
  await strip(page).getByRole('button', { name: 'Kì đầu' }).click();
  await page.getByRole('button', { name: 'Phát', exact: true }).click();
  await page.evaluate(() => {
    const s = { frames: [] as number[], calls: 0, triangles: 0, running: true };
    window.__m3dPerf = s;
    let prev = performance.now();
    const tick = (now: number) => {
      if (!s.running) return;
      s.frames.push(now - prev);
      prev = now;
      const i = window.__simlabMitosis3d?.info();
      if (i) {
        s.calls = Math.max(s.calls, i.calls);
        s.triangles = Math.max(s.triangles, i.triangles);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(8000);
  const run = await page.evaluate(() => {
    const s = window.__m3dPerf;
    if (!s) return null;
    s.running = false;
    return { frames: s.frames.slice(1), calls: s.calls, triangles: s.triangles };
  });
  expect(run).not.toBeNull();
  const frames = [...run!.frames].sort((a, b) => a - b);
  const pct = (q: number) =>
    frames[Math.min(frames.length - 1, Math.floor(q * frames.length))] ?? 0;
  const result = {
    renderer,
    frames: frames.length,
    p50Ms: Number(pct(0.5).toFixed(1)),
    p95Ms: Number(pct(0.95).toFixed(1)),
    maxCalls: run!.calls,
    maxTriangles: run!.triangles,
    stageAtEnd: await page.evaluate(() => window.__simlabMitosis3d?.stage() ?? null),
    quality: await page.evaluate(() => window.__simlabMitosis3d?.quality() ?? null),
  };
  await testInfo.attach('mitosis3d-perf.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(result.frames).toBeGreaterThan(20);
  expect(result.stageAtEnd).not.toBe('prophase');
  expect(result.maxCalls).toBeGreaterThan(0);
  expect(result.maxCalls).toBeLessThanOrEqual(PERF.calls);
  expect(result.maxTriangles).toBeLessThanOrEqual(PERF.triangles);
  expect(result.p95Ms).toBeLessThanOrEqual(PERF.p95Ms);
  // The app did not have to lower the quality while playing.
  expect(result.quality).toEqual({ tier: 'high', degraded: false });
});
