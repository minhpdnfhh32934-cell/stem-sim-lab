declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6e of #302: a nucleus of Bảng 21.1 and a decaying sample of 200 nuclei in 3D. Both
 * modules open in 2D; the switch over the picture offers 3D. WebGL runs in software (SwiftShader).
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

interface Hook {
  state(): Record<string, unknown> | null;
}
const state = <T>(page: Page, lesson: string) =>
  page.evaluate((l) => {
    const h = (window as unknown as { __simlab3d?: Record<string, Hook | undefined> }).__simlab3d?.[
      l
    ];
    return (h?.state() ?? null) as unknown;
  }, lesson) as Promise<T | null>;

async function open(page: Page, errors: string[], topic: string) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openTopic(page, 'Vật lý', topic);
  await expect(page.locator('.stage__hud-title').first()).toHaveText(topic, { timeout: 20_000 });
}

test('Hạt nhân in 3D: gold has 79 protons and 118 neutrons', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Hạt nhân và năng lượng liên kết');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="nucleus"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(view.locator('.three-label', { hasText: '79 proton, 118 neutron' })).toBeVisible();
  await expect
    .poll(async () => await state<{ protons: number; neutrons: number }>(page, 'nucleus'))
    .toMatchObject({ protons: 79, neutrons: 118 });
  await page.screenshot({ path: testInfo.outputPath('nucleus-3d.png') });
  await page.getByRole('radio', { name: 'Phản ứng hạt nhân' }).click();
  await expect(view).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Phóng xạ in 3D: the law at t = 2T leaves 50 of 200; the random run steps', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, errors, 'Hiện tượng phóng xạ');
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="radioactivity"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  // Rn-220, T = 55 s, t = 110 s: a quarter left.
  await expect(view.locator('.three-label', { hasText: 'Còn 50/200 hạt nhân' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('decay-law-3d.png') });
  await page.getByRole('radio', { name: 'Tính ngẫu nhiên' }).click();
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await state<{ step: number }>(page, 'radioactivity'))?.step ?? 0)
    .toBeGreaterThan(3);
  await page.screenshot({ path: testInfo.outputPath('decay-random-3d.png') });
  expect(errors).toEqual([]);
});
