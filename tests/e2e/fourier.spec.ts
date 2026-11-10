import { expect, test } from '@playwright/test';
import { openLab } from './nav';

/** Harmonics and Fourier series (#54 item 10): the sum, its harmonics, "Nghe" only on a press. */
test('Fourier: the sum follows N, the harmonics table, "Nghe" starts and stops on a press', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLab(page);
  await page.getByRole('radio', { name: 'Vật lý' }).click();
  await page.getByRole('button', { name: 'Hoạ âm và chuỗi Fourier', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Sóng vuông: tổng 5 hoạ âm' })).toBeVisible({
    timeout: 20_000,
  });
  // Nothing plays before the learner asks.
  const listen = page.getByRole('button', { name: 'Nghe', exact: true });
  await expect(listen).toHaveAttribute('aria-pressed', 'false');
  // Square wave: odd harmonics only, 1, 3, 5 for N = 5 (the bottom panel's table).
  const rows = page.locator('.fourier-table tbody tr');
  await expect(rows).toHaveCount(3);
  await page.getByRole('radio', { name: 'Sóng răng cưa' }).click();
  await expect(rows).toHaveCount(5);
  await expect(page.getByRole('img', { name: 'Sóng răng cưa: tổng 5 hoạ âm' })).toBeVisible();
  await listen.click();
  await expect(page.getByRole('button', { name: 'Dừng nghe' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Dừng nghe' }).click();
  await expect(listen).toHaveAttribute('aria-pressed', 'false');
  // The link to the standing-wave lesson.
  await page.getByRole('button', { name: 'Hoạ âm của dây đàn: mở bài Sóng dừng trên dây' }).click();
  await expect(page.locator('.stage__hud-title')).toHaveText('Sóng dừng trên dây', {
    timeout: 20_000,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
