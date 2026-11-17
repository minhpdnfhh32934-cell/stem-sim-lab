declare const process: { env: Record<string, string | undefined> };
import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6i of #302: the hydrocarbon lesson's member in 3D, from the app's own molecule data; a
 * member without coordinates gets a note, never a made-up shape. WebGL runs in software.
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
});

test('Hydrocarbon in 3D: propane from molecules.json; heptane has no coordinates', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Alkane, alkene, alkyne, arene');
  await page.getByRole('radio', { name: '3D' }).first().click();
  // Opens on alkanes, n = 3: propane.
  await expect(page.getByText('propane · C₃H₈', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('img', { name: 'propane — C3H8' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('propane-3d.png') });
  const n = page.getByRole('slider').first();
  await n.focus();
  for (let i = 0; i < 4; i++) await n.press('ArrowRight');
  await expect(page.getByText('không tự tạo tọa độ', { exact: false })).toBeVisible();
  await page.getByRole('radio', { name: '2D' }).first().click();
  await expect(page.locator('canvas.chem-canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
