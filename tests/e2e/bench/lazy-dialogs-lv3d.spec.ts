declare const process: { env: Record<string, string | undefined> };
import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

/**
 * Dialogs whose code loads on first use open while a lesson runs without end (#205 C5: the
 * predator–prey habitat updates every frame). With React's `lazy()` their retry was starved and
 * Ctrl+K or "Nguồn & Giả định" opened nothing (every time on the desktop machine). The habitat
 * must play, so WebGL runs in software (SwiftShader) at medium quality, in the chromium-3d project
 * ("lv3d" in the name): at Low quality the lesson shows its still 2D chart.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

test('Ctrl+K and "Nguồn & Giả định" open while a lesson runs without end', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'stemsim.perf',
      JSON.stringify({ state: { preference: 'medium', benchmark: null }, version: 1 }),
    );
  });
  await openLab(page);
  await page.getByRole('radio', { name: 'Sinh học' }).click();
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Con mồi – vật ăn thịt (Lotka–Volterra)', exact: true })
    .click();
  await expect(page.locator('.science-card__summary-title')).toBeVisible({ timeout: 20_000 });
  // Running: the edge's main action pauses.
  await expect(page.getByRole('button', { name: /^Tạm dừng/ }).first()).toBeVisible();
  await page.waitForTimeout(2000);

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Tìm nhanh' })).toBeHidden();

  await page.locator('.bench-header').getByRole('button', { name: 'Tệp' }).click();
  await page.getByRole('menuitem', { name: 'Nguồn & Giả định' }).click();
  await expect(page.getByRole('dialog', { name: 'Nguồn & Giả định' })).toBeVisible();
});
