import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

/** HH10 Chương 1, Bài 1–2 (#255 round 1d): numbers from the data tables, never typed by hand. */
test('Thành phần của nguyên tử: ¹²C, then Cl⁻ with its mass defect', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Thành phần của nguyên tử');
  await expect(
    page.getByRole('img', { name: 'Hình minh họa: 6 proton, 6 neutron, 6 electron' }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Hình minh họa, không theo tỉ lệ', { exact: true })).toBeVisible();
  await expect(page.locator('.science-card')).toBeVisible();
  const panel = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await panel.getByRole('textbox', { name: 'Số proton Z' }).fill('17');
  await panel.getByRole('textbox', { name: 'Số proton Z' }).press('Enter');
  // A new Z takes its most abundant natural isotope (³⁵Cl) and keeps the neutral charge.
  await expect(
    page.getByRole('img', { name: 'Hình minh họa: 17 proton, 18 neutron, 17 electron' }),
  ).toBeVisible();
  await panel.getByRole('textbox', { name: 'Số electron' }).fill('18');
  await panel.getByRole('textbox', { name: 'Số electron' }).press('Enter');
  await expect(panel.getByText(/ion âm \(anion\)/)).toContainText('³⁵₁₇Cl⁻');
  await expect(panel.getByText('≈ 2,6 × 10⁴')).toBeVisible();
  // ³⁵Cl: 17·(mp + me) + 18·mn − 34,968852694 u ≈ 0,3201 u (CODATA 2022, CIAAW).
  await expect(page.getByText(/lớn hơn 0,3201 u/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('Nguyên tố hóa học và đồng vị: Cl average, and the reverse problem', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Nguyên tố hóa học và đồng vị');
  await expect(page.getByText('(35 × 75,8 + 37 × 24,2) / 100 =')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('35,484', { exact: true })).toBeVisible();
  await expect(page.getByText('35,45214', { exact: true })).toBeVisible();
  await expect(page.locator('.science-card')).toBeVisible();
  const box = page.getByRole('textbox', { name: 'Nguyên tử khối trung bình Ā' });
  await box.fill('35,5');
  await expect(page.getByRole('row', { name: '³⁵Cl 75 %' })).toBeVisible();
  await expect(page.getByRole('row', { name: '³⁷Cl 25 %' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Nguyên tố' }).selectOption('29');
  await expect(page.getByText('(63 × 69,15 + 65 × 30,85) / 100 =')).toBeVisible();
  await box.fill('63,54');
  await expect(page.getByRole('row', { name: '⁶³Cu 73 %' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
