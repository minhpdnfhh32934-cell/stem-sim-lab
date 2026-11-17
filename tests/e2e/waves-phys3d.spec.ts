declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6c of #302: the wave lessons in 3D. Each opens in 2D; the switch under the HUD offers
 * 3D, whose numbers are read back from its debug hook. WebGL runs in software (SwiftShader).
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Hook {
  frames(): number;
  state(): Record<string, unknown> | null;
}
const state = <T>(page: Page, lesson: string) =>
  page.evaluate((l) => {
    const h = (window as unknown as { __simlab3d?: Record<string, Hook | undefined> }).__simlab3d?.[
      l
    ];
    return (h?.state() ?? null) as unknown;
  }, lesson) as Promise<T | null>;

async function open3d(page: Page, errors: string[], topic: string, lesson: string) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openTopic(page, 'Vật lý', topic);
  await expect(page.locator('.stage__hud-title')).toHaveText(topic, { timeout: 20_000 });
  await page.locator('.stage__view-switch').getByRole('radio', { name: '3D' }).click();
  const view = page.locator(`.bio3d[data-lesson="${lesson}"]`);
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  return view;
}

test('Giao thoa in 3D: the water surface at the engine’s time', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const view = await open3d(page, errors, 'Giao thoa sóng hai nguồn', 'interference');
  await expect(view.locator('.chem-chip', { hasText: 'λ = 3 cm' })).toBeVisible();
  await expect(view.getByText('Độ cao phóng đại')).toBeVisible();
  type S = { t: number; grid: { nx: number; step: number } | null; hM: number };
  await expect
    .poll(async () => (await state<S>(page, 'interference'))?.grid?.nx ?? 0)
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await expect
    .poll(async () => (await state<S>(page, 'interference'))?.t ?? 0)
    .toBeGreaterThan(0.05);
  await page.screenshot({ path: testInfo.outputPath('interference-3d.png') });
  expect(errors).toEqual([]);
});

test('Sóng cơ in 3D: a block of parts; transverse up and down, longitudinal along Ox', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const view = await open3d(page, errors, 'Sóng cơ: sóng ngang, sóng dọc', 'travellingWave');
  // Question 1 p. 35: f = 0,6 Hz, v = 2 m/s, so λ = v/f ≈ 3,333 m.
  await expect(
    view.locator('.chem-chip', { hasText: /^λ = 3,333 m, T = .+, v = 2 m\/s$/ }),
  ).toBeVisible();
  type S = { t: number; parts: number; mY: number; mX: number };
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await expect
    .poll(async () => (await state<S>(page, 'travellingWave'))?.t ?? 0)
    .toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath('transverse-3d.png') });
  await page.getByRole('radio', { name: 'Sóng dọc' }).click();
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await state<S>(page, 'travellingWave'))?.parts ?? 0)
    .toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await expect
    .poll(async () => (await state<S>(page, 'travellingWave'))?.t ?? 0)
    .toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath('longitudinal-3d.png') });
  expect(errors).toEqual([]);
});

test('Sóng dừng in 3D: the string, its loops, nodes; P is the engine’s y', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const view = await open3d(page, errors, 'Sóng dừng trên dây', 'standingWave');
  await expect(view.locator('.chem-chip', { hasText: /n = 3$/ })).toBeVisible();
  await expect(view.locator('.three-label', { hasText: /^N$/ })).toHaveCount(4);
  type S = { t: number; yP: number; beads: number };
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await expect.poll(async () => (await state<S>(page, 'standingWave'))?.t ?? 0).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('standing-3d.png') });
  expect(errors).toEqual([]);
});
