declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openLab } from './nav';

/**
 * The 3D views of the biology lessons (every lesson besides mitosis, meiosis, DNA → mRNA →
 * protein, point mutations, Mendelian genetics, enzyme kinetics and diffusion & osmosis, which
 * have their own specs).
 * WebGL runs in software (SwiftShader), never on the GPU (see mitosis3d.spec.ts).
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

const LESSONS: [string, string][] = [
  ['Định luật Hardy–Weinberg', 'hardyWeinberg'],
  ['Phiêu bạt di truyền', 'drift'],
  ['Tăng trưởng logistic', 'logistic'],
  ['Con mồi – vật ăn thịt (Lotka–Volterra)', 'lotkaVolterra'],
];

async function openBiology(page: Page) {
  // A slow test machine may measure as "low" quality, where the lessons use their 2D pictures.
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
}

test('every biology lesson opens in 3D, draws, keeps its subject clear of the controls, and has a 2D picture', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openBiology(page);
  for (const [name, lesson] of LESSONS) {
    await page.getByRole('button', { name, exact: true }).click();
    const view = page.locator(`.bio3d[data-lesson="${lesson}"]`);
    await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => window.__simlabBio3d?.frames() ?? 0), { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__simlabBio3d?.lesson)).toBe(lesson);
    // The subject is drawn inside the picture, clear of the chips and the controls over it.
    const layout = await page.evaluate((l) => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const v = document.querySelector(`.bio3d[data-lesson="${l}"]`);
      return {
        view: box(v),
        controls: [...(v?.querySelectorAll('[data-inset]') ?? [])].map(box),
        subject: window.__simlabBio3d?.subjectRect() ?? null,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, lesson);
    expect(layout.view, name).not.toBeNull();
    expect(layout.subject, name).not.toBeNull();
    const v = layout.view!;
    const s = layout.subject!;
    // The subject's bounding sphere may be generous; its centre must be in the view.
    expect((s.left + s.right) / 2, name).toBeGreaterThan(v.left);
    expect((s.left + s.right) / 2, name).toBeLessThan(v.right);
    expect((s.top + s.bottom) / 2, name).toBeGreaterThan(v.top);
    expect((s.top + s.bottom) / 2, name).toBeLessThan(v.bottom);
    expect(layout.scroll, `${name}: horizontal scroll`).toBeLessThanOrEqual(0);
    if (process.env.SHOTS)
      await page.screenshot({ path: `${process.env.SHOTS}/bio3d-${lesson}.png` });

    // 2D and back (the switch is in the stage, over the picture or above the figure).
    const stage = page.locator('.shell__center');
    await stage.getByRole('radio', { name: '2D', exact: true }).first().click();
    await expect(page.locator(`.bio3d[data-lesson="${lesson}"]`)).toHaveCount(0);
    await stage.getByRole('radio', { name: '3D', exact: true }).first().click();
    await expect(page.locator(`.bio3d[data-lesson="${lesson}"] canvas`)).toBeVisible({
      timeout: 15_000,
    });
  }
  expect(errors).toEqual([]);
});

test('logistic 3D: the habitat follows the model; rebuilding for new inputs frees the old scene', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openBiology(page);
  await page.getByRole('button', { name: 'Tăng trưởng logistic', exact: true }).click();
  await expect(page.locator('.bio3d[data-lesson="logistic"] canvas')).toBeVisible({
    timeout: 30_000,
  });
  // The chips are the 2D view's (same text).
  await expect(page.getByText('Sức chứa K = 1.000')).toBeVisible();
  // Pause, go to the end: N(t = 30) of the exact solution.
  const player = page.locator('.bio3d__player');
  await player
    .getByRole('button', { name: /Tạm dừng|Phát/ })
    .first()
    .click();
  await player.getByRole('slider').fill('30');
  // N(t) of the exact solution (N₀ = 10, r = 0,5, K = 1 000), as the view formats it.
  const vi = new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 4 });
  const N = (t: number) => 1000 / (1 + (1000 / 10 - 1) * Math.exp(-0.5 * t));
  await expect(player.locator('output')).toContainText(`t = 30 · N = ${vi.format(N(30))}`);
  await player.getByRole('slider').fill('9');
  await expect(player.locator('output')).toContainText(`t = 9 · N = ${vi.format(N(9))}`);
  const before = await page.evaluate(() => window.__simlabBio3d?.info() ?? null);
  const slider = page.locator('label', { hasText: /Sức chứa K/ }).locator('input[type="range"]');
  for (const k of ['1500', '800', '1000']) {
    await slider.fill(k);
    await page.waitForTimeout(300);
  }
  await expect(page.getByText('Sức chứa K = 1.000')).toBeVisible();
  // The scene is rebuilt for the new inputs; on a slow runner the rebuild can still be running
  // a fixed wait later, so wait until it holds as many geometries as before (none leaked).
  await expect
    .poll(async () => (await page.evaluate(() => window.__simlabBio3d?.info() ?? null))?.geometries)
    .toBe(before?.geometries);
  const after = await page.evaluate(() => window.__simlabBio3d?.info() ?? null);
  expect(after?.geometries).toBe(before?.geometries);
  expect(after?.textures).toBe(before?.textures);
});
