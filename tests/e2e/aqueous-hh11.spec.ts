import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/** HH11 Bài 2 (#255 round 2c): pH, Kw = 10⁻¹⁴ and the indicator colours of Bảng 2.1. */
test('aqueous equilibria: HCl 0,1 M is pH 1 (litmus red), NaOH 0,01 M is pH 12 (phenolphthalein pink)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Cân bằng trong dung dịch nước');
  await expect(page.locator('.stage__hud-title')).toHaveText('Cân bằng trong dung dịch nước', {
    timeout: 20_000,
  });
  // Pure water: neutral, litmus violet.
  await expect(page.getByText('Quỳ tím', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Acid, base mạnh' }).click();
  await page.getByRole('radio', { name: 'HCl' }).click();
  await page.getByRole('textbox', { name: 'Nồng độ' }).fill('0,1');
  await expect(page.getByRole('img', { name: /pH 1$/ })).toBeVisible();
  await expect(page.getByText('Quỳ đỏ', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'NaOH' }).click();
  await page.getByRole('textbox', { name: 'Nồng độ' }).fill('0,01');
  await expect(page.getByRole('img', { name: /pH 12$/ })).toBeVisible();
  await expect(page.getByText('Phenolphthalein màu hồng', { exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
