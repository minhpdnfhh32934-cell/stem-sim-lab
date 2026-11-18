import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** HH11 Bài 19–21 (#255 round 2g): boiling points compared, and Zaitsev's rule. */
test('halogen derivatives, alcohols, phenol: ethanol 78,3 °C (tr. 122); pentan-2-ol gives pent-2-ene (tr. 124)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Dẫn xuất halogen, alcohol, phenol');
  await expect(page.locator('.stage__hud-title')).toHaveText('Dẫn xuất halogen, alcohol, phenol', {
    timeout: 20_000,
  });
  await expect(page.getByRole('img', { name: /ethanol: 78,3 °C/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Phản ứng tách' }).click();
  await page.getByRole('radio', { name: 'pentan-2-ol' }).click();
  await expect(page.locator('.der-option--main')).toContainText('pent-2-ene');
  await expect(
    page.getByText('Ví dụ của sách (tr. 124): sản phẩm chính là pent-2-ene.'),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: '117,7' })).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

/** HH11 Bài 23–24: acetic acid 0,1 M is 1,33 % dissociated, beside Bảng 24.3's 1,3 %. */
test('carbonyl compounds, carboxylic acids: acetic acid 0,1 M gives 1,33 % and pH 2,88 (Bảng 24.3)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Hợp chất carbonyl, carboxylic acid');
  await expect(page.locator('.stage__hud-title')).toHaveText('Hợp chất carbonyl, carboxylic acid', {
    timeout: 20_000,
  });
  await expect(page.getByRole('img', { name: /acetic acid: 118 °C/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Tính acid' }).click();
  await expect(
    page.getByText('Bảng 24.3 ghi 1,3 % ở 0,1 M; SimLab tính từ Kₐ được 1,33 %.'),
  ).toBeVisible();
  await expect(page.locator('.der-facts')).toContainText('2,88');
  await noOverflow(page);
  expect(errors).toEqual([]);
});
