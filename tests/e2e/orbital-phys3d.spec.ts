declare const process: { env: Record<string, string | undefined> };
import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

/**
 * Round 6f of #302: the hydrogen orbitals as a 3D probability cloud (|ψ|² of the lesson's exact
 * orbital). Opens on the 2D slice; the switch offers 3D. WebGL runs in software (SwiftShader).
 */
test.use({
  viewport: { width: 1366, height: 768 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

// Every test starts at Medium quality (on a slow runner the start-up benchmark picks Low: 2D).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
});

test('Orbital in 3D: a |ψ|² cloud of 4 000 points (medium), back to the slice', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Hình dạng orbital');
  await expect(page.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true', {
    timeout: 20_000,
  });
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="orbitals"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = (
          window as unknown as {
            __simlab3d?: Record<string, { state(): { points: number } | null } | undefined>;
          }
        ).__simlab3d?.orbitals;
        return h?.state()?.points ?? 0;
      }),
    )
    .toBe(4000);
  await expect(view.getByText('đám mây xác suất |ψ|²', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('orbital-3d.png') });
  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('canvas[aria-label="Lát cắt orbital"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Atom composition in 3D: exactly Z protons, N neutrons and the electrons (C-12)', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Thành phần của nguyên tử');
  await expect(page.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true', {
    timeout: 20_000,
  });
  await page.getByRole('radio', { name: '3D' }).click();
  const view = page.locator('.bio3d[data-lesson="atomComposition"]');
  await expect(view.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = (
          window as unknown as {
            __simlab3d?: Record<
              string,
              | { state(): { protons: number; neutrons: number; electrons: number } | null }
              | undefined
            >;
          }
        ).__simlab3d?.atomComposition;
        return h?.state() ?? null;
      }),
    )
    .toEqual({ protons: 6, neutrons: 6, electrons: 6 });
  await expect(view.getByText('chỉ số hạt là đúng', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('atom-3d.png') });
  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('svg.atom-pic')).toBeVisible();
  expect(errors).toEqual([]);
});
