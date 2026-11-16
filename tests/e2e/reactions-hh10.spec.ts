import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/**
 * HH10 Bài 7, 15, 17, 21, 22 (#255 round 1f): each topic opens from the classic library and shows
 * numbers computed by the app or copied from the book's tables, never typed into the test by hand
 * except where the book prints them.
 */

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('Bài 7: period 3 oxides and hydroxides from the group number', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Oxide và hydroxide trong chu kì 3');
  await expect(page.locator('.p3-card')).toHaveCount(7, { timeout: 20_000 });
  await expect(page.locator('.science-card')).toBeVisible();
  await page.getByRole('button', { name: /^Cl\s?VIIA/ }).click();
  const panel = page.getByRole('complementary', { name: 'Bảng thuộc tính' });
  await expect(panel.getByText('Nhóm VIIA → +7')).toBeVisible();
  await expect(
    panel.getByText('Kiểm tra: với H +1, O −2 thì Cl có số oxi hoá +7 trong HClO₄.'),
  ).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('Bài 15: oxidation numbers, agents and electrons for library reactions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Phản ứng oxi hoá – khử');
  const stage = page.getByRole('region', { name: 'Khung mô phỏng' });
  await expect(stage.getByRole('group', { name: 'Fe₂O₃: Fe +3, O −2' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(stage.getByText(/= 6$/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Phản ứng' }).selectOption('kmno4-hcl');
  await expect(stage.getByRole('group', { name: '2KMnO₄: K +1, Mn +7, O −2' })).toBeVisible();
  await expect(stage.getByText(/= 10$/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Phản ứng' }).selectOption('fe-cuso4');
  await expect(page.getByText(/CuSO₄: còn hai nguyên tố chưa biết \(Cu, S\)/)).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('Bài 17: ΔrH°298 from the book’s enthalpies of formation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Biến thiên enthalpy của phản ứng');
  // SGK tr. 83: CH4 + 2O2 → CO2 + 2H2O(l), about −890 kJ; Bảng 17.1 gives −890,2.
  await expect(page.getByText('ΔrH°298 = −890,2 kJ').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('ΔrH < 0: phản ứng toả nhiệt.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Phản ứng' }).selectOption('h2-o2');
  // SGK tr. 82, Ví dụ 1: −571,6 kJ.
  await expect(page.getByText('ΔrH°298 = −571,6 kJ').first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Phản ứng' }).selectOption('caco3-decomp');
  await expect(page.getByText('ΔrH > 0: phản ứng thu nhiệt.')).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('Bài 21–22: halogen trends, H–X bond energies and the AgCl test', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Nhóm halogen');
  await expect(page.locator('.hal-card')).toHaveCount(4, { timeout: 20_000 });
  await expect(page.locator('.hal-card').first()).toContainText('−219,6 °C');
  await expect(page.locator('.science-card')).toBeVisible();
  await noOverflow(page);

  await openTopic(page, 'Hóa học', 'Hydrogen halide · Muối halide');
  await expect(page.getByText('569 kJ/mol')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Kết tủa trắng AgCl (dùng nhận biết ion Cl⁻).')).toBeVisible();
  await expect(
    page.getByText('Phản ứng của AgNO₃ với NaBr chưa có trong cơ sở dữ liệu đã kiểm chứng.'),
  ).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});
