import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

// Bench twin of tests/e2e/kepler.spec.ts (0.8.1 B8: same titles, the same checks on the bench
// shell; scripts/e2e/title-parity.mjs).

/** Kepler's second law (#54 item 12, an extension): equal areas, the solution, relative units. */
test('Kepler II: the orbit runs, equal-area slices, the speed ratio in the solution', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('button', { name: /^Định luật II Kepler/ }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Định luật II Kepler', {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  await expect(page.getByText('Tỉ số tốc độ cận nhật / viễn nhật')).toBeVisible();
  await expect(page.getByText(/Mở rộng — ngoài 9 cuốn SGK/).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
