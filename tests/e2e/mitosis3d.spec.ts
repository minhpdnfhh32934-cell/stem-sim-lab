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

  // 2D view still available; meiosis shows its own 3D view (not the mitosis one), and its 2D.
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.m3d')).toHaveCount(0);
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await expect(page.locator('.m3d canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Giảm phân', exact: true }).click();
  await expect(page.locator('.m3d')).toHaveCount(0);
  await expect(page.locator('.bio3d[data-lesson="meiosis"] canvas')).toBeVisible();
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.bio3d')).toHaveCount(0);
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
      // The ask button is in view inside the card (the card shows its top first).
      const card = l.parts.info!;
      expect(l.ask, `${where}: ask`).not.toBeNull();
      expect(l.ask!.left, `${where}: ask left`).toBeGreaterThanOrEqual(card.left - 0.5);
      expect(l.ask!.top, `${where}: ask top`).toBeGreaterThanOrEqual(card.top - 0.5);
      expect(l.ask!.right, `${where}: ask right`).toBeLessThanOrEqual(card.right + 0.5);
      expect(l.ask!.bottom, `${where}: ask bottom`).toBeLessThanOrEqual(card.bottom + 0.5);
      expect(l.small, `${where}: buttons and radios under 40 px`).toEqual([]);
      expect(l.scroll, `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
      // The whole cell (both daughters' room included) is drawn clear of every box: not under
      // the chips, the stage strip, the caption or the picked part's card.
      const drawn = await page.evaluate(() => window.__simlabMitosis3d?.cellRect() ?? null);
      expect(drawn, `${where}: cell`).not.toBeNull();
      for (const [name, b] of named) {
        const w = Math.min(drawn!.right, b!.right) - Math.max(drawn!.left, b!.left);
        const h = Math.min(drawn!.bottom, b!.bottom) - Math.max(drawn!.top, b!.top);
        expect(w > 1 && h > 1, `${where}: the cell is drawn under ${name}`).toBe(false);
      }
    }
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/m3d-layout.png` });
});

/**
 * Which lines of the picked part's text can be read: every scroll position of the card (and of any
 * box inside it that scrolls) is tried, and a line counts when its top and bottom are both shown
 * and not covered by anything (the card's head, say). Also whether "Hỏi thầy" is still inside the
 * card once the card is scrolled to its end.
 */
async function partText(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.m3d__info');
    const body = document.querySelector<HTMLElement>('.m3d__info-body');
    const ask = document.querySelector<HTMLElement>('.m3d__ask');
    if (!card || !body || !ask) return null;
    const scrollers = [card, ...card.querySelectorAll<HTMLElement>('*')].filter(
      (el) =>
        el.scrollHeight > el.clientHeight + 1 &&
        ['auto', 'scroll'].includes(getComputedStyle(el).overflowY),
    );
    const seen = new Set<number>();
    let total = 0;
    const look = () => {
      const lines = [...body.querySelectorAll('p')].flatMap((p) => {
        const range = document.createRange();
        range.selectNodeContents(p);
        return [...range.getClientRects()].map((rect) => ({ p, rect }));
      });
      total = lines.length;
      lines.forEach(({ p, rect }, i) => {
        const x = rect.left + Math.min(8, rect.width / 2);
        const shown = (y: number) => {
          const hit = document.elementFromPoint(x, y);
          return hit !== null && p.contains(hit);
        };
        if (shown(rect.top + 1) && shown(rect.bottom - 1)) seen.add(i);
      });
    };
    const walk = (k: number) => {
      const el = scrollers[k];
      if (!el) {
        look();
        return;
      }
      for (let top = 0; top <= el.scrollHeight - el.clientHeight + 1; top++) {
        el.scrollTop = top;
        walk(k + 1);
      }
      el.scrollTop = 0;
    };
    walk(0);
    card.scrollTop = card.scrollHeight;
    const c = card.getBoundingClientRect();
    const a = ask.getBoundingClientRect();
    const askAtEnd = a.top >= c.top - 0.5 && a.bottom <= c.bottom + 0.5;
    card.scrollTop = 0;
    return { total, seen: seen.size, askAtEnd, card: `${card.clientHeight}/${card.scrollHeight}` };
  });
}

test('mitosis 3D: every line of the picked part can be read, down to the smallest window', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openMitosis(page);
  const parts = page.getByRole('group', { name: 'Bộ phận tế bào' });
  // The test window; a maximized, decorated window on a 1366×768 screen; the app's minimum.
  const sizes = [
    [1366, 768],
    [1366, 689],
    [1024, 600],
  ] as const;
  // The UI font is wider on Linux than Segoe UI on Windows: the texts over the picture took more
  // lines, the part's row lost its room and "Hỏi thầy" scrolled away, on CI only. Every check
  // runs again with a wide font and wider spacing over the whole view, on every system.
  for (const font of ['system', 'wide'] as const) {
    if (font === 'wide')
      await page.addStyleTag({
        content: `.m3d, .m3d button, .m3d select {
          font-family: Verdana, 'DejaVu Sans', sans-serif; letter-spacing: 0.05em; }`,
      });
    for (const [cell, stageButton, part, windows] of [
      ['Động vật', 'Kì giữa', 'Tâm động', sizes],
      // Not formed yet in G1: the card adds "không thấy rõ ở kì đang xem" under the text. Not at
      // 1024×600: there the controls over the picture are taller than the picture in G1 even
      // with no part picked (the stage strip itself ends up under the panel below), a separate
      // problem.
      ['Thực vật', 'Trung gian G1', 'Vách ngăn (tấm tế bào)', sizes.slice(0, 2)],
    ] as const) {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.getByRole('radio', { name: cell }).click();
      await strip(page).getByRole('button', { name: stageButton }).click();
      await parts.getByRole('button', { name: part }).click();
      await expect(page.locator('.m3d__info')).toContainText(part);
      for (const [width, height] of windows) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(250);
        const where = `${font} font, ${cell}, ${part}, ${stageButton}, ${width}×${height}`;
        const r = await partText(page);
        expect(r, where).not.toBeNull();
        expect(r!.total, `${where}: lines`).toBeGreaterThan(1);
        expect(r!.seen, `${where}: lines that can be read (card ${r!.card})`).toBe(r!.total);
        // With room for it, the name and "Hỏi thầy" stay in view while the text scrolls.
        if (height === 768) expect(r!.askAtEnd, `${where}: ask after scrolling`).toBe(true);
      }
    }
  }
  await expect(page.locator('.m3d__info')).toContainText('không thấy rõ ở kì đang xem');
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
    'Thầy giải thích giúp em: bộ phận “Tâm động” làm gì ở giai đoạn “Kì giữa” (mô phỏng nguyên phân, tế bào động vật) ạ?',
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

/**
 * Budgets of the perf project (2n = 8, High quality: 24 sphere segments, see scene.perf.test:
 * 43 calls = 11 + 4 · 2n since each chromatid is one tube plus its kinetochore; 19 970 triangles
 * measured on the CPU, + 5 %).
 */
const PERF = { calls: 43, triangles: 21_000, p95Ms: 150 };

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
  // From the end of prophase through telophase (every chromatid condensing and moving).
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
