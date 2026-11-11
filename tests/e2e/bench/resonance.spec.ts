import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

/** Forced oscillation and resonance (#54 item 9): the A(Ω) curve and the amplitude settling on it. */
test('resonance: the A(Ω) graph shows the steady-amplitude curve, no horizontal scroll', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('button', { name: /^Dao động cưỡng bức và cộng hưởng/ }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Dao động cưỡng bức và cộng hưởng', {
    timeout: 20_000,
  });
  await page.getByRole('tab', { name: 'Đồ thị' }).click();
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('radio', { name: 'Biên độ theo tần số góc của ngoại lực' }).click();
  await expect(
    page.getByRole('img', {
      name: 'Biên độ theo tần số góc của ngoại lực: Biên độ (m) theo Ω (rad/s)',
    }),
  ).toBeVisible();
  await expect(page.getByText('Biên độ ổn định A(Ω)')).toBeVisible();
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  await expect(page.getByText('Tần số góc cộng hưởng').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
