import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/** VL11 Bài 8–9 (#255 round 2a): one source, transverse or longitudinal, the textbook's boat. */
test('mechanical waves: the boat of tr. 35, transverse then longitudinal, the solution', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Sóng cơ: sóng ngang, sóng dọc');
  await expect(page.locator('.stage__hud-title')).toHaveText('Sóng cơ: sóng ngang, sóng dọc', {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Sóng dọc' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: 'Lời giải' }).click();
  // f = 0,6 Hz, v = 2 m/s: λ = 3,333 m; the bank (10 m) is reached after 5 s.
  await expect(page.getByText('Bước sóng', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/3,333\s*m/).first()).toBeVisible();
  await expect(page.getByText(/Sóng dọc: các phần tử dao động theo phương trùng/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

/** VL11 Bài 11: λ ↔ f with c = 3.10⁸ m/s, the band from the textbook's Bảng 11.1. */
test('electromagnetic waves: 3 cm is radio and microwave, 5.10¹⁴ Hz is visible light', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Vật lý', 'Sóng điện từ');
  await expect(page.locator('.stage__hud-title')).toHaveText('Sóng điện từ', { timeout: 20_000 });
  // Opens on green light, 500 nm.
  await expect(page.getByRole('img', { name: /λ = 500 nm: Ánh sáng nhìn thấy/ })).toBeVisible();
  const box = page.getByRole('textbox', { name: 'Bước sóng' });
  await page.getByRole('combobox', { name: 'Đơn vị' }).selectOption('cm');
  await box.fill('3');
  await expect(
    page.getByRole('img', { name: /λ = 3 cm: Sóng vô tuyến, Sóng vi ba/ }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Cho tần số f' }).click();
  await page.getByRole('combobox', { name: 'Đơn vị' }).selectOption('Hz');
  await page.getByRole('textbox', { name: 'Tần số' }).fill('5e14');
  await expect(page.getByRole('img', { name: /λ = 600 nm: Ánh sáng nhìn thấy/ })).toBeVisible();
  // The bottom table: Bảng 11.1 with the frequency ranges, the current band marked.
  await expect(page.locator('.emwave-table tbody tr')).toHaveCount(7);
  await expect(page.locator('.emwave-table tr[aria-current]')).toHaveCount(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
