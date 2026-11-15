import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

/** Hoá học 10 chương 3 "Liên kết hoá học", Bài 10–13 (#255): opened from the classic library. */

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('Bài 10 octet rule: the count flags BF₃ and NO, H₂O keeps its octet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Quy tắc octet');
  await expect(page.getByRole('img', { name: /^Công thức Lewis H₂O/ })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.science-card')).toBeVisible();
  await expect(page.getByText('Mọi nguyên tử đạt octet (H: 2 electron)')).toBeVisible();
  await page.getByRole('button', { name: 'BF₃', exact: true }).click();
  await expect(page.getByText('Ngoại lệ — B: 6 electron (ít hơn 8)')).toBeVisible();
  await page.getByRole('button', { name: 'NO', exact: true }).click();
  await expect(page.getByText('Ngoại lệ — N: 7 electron (số lẻ)')).toBeVisible();
  await page.getByRole('button', { name: 'SF₆', exact: true }).click();
  await expect(page.getByText('Ngoại lệ — S: 12 electron (nhiều hơn 8)')).toBeVisible();
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('Bài 11 ionic bond: Al + O → Al₂O₃ from the charges, ions like Ne', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Liên kết ion');
  await expect(page.getByText('1 × (+1) + 1 × (−1) = 0 → NaCl')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Kim loại').selectOption('Al');
  await page.getByLabel('Phi kim').selectOption('O');
  await expect(page.getByText('2 × (+3) + 3 × (−2) = 0 → Al₂O₃')).toBeVisible();
  await expect(page.getByText('Al³⁺: 1s² 2s² 2p⁶', { exact: true })).toBeVisible();
  await expect(page.getByText('Al³⁺ (giống khí hiếm Ne)')).toBeVisible();
  await noHorizontalScroll(page);
  // The NaCl lattice is the crystal topic's.
  await page.getByRole('button', { name: 'Xem tinh thể NaCl' }).click();
  await expect(page.getByRole('img', { name: /^Tinh thể NaCl:/ })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('Bài 12 covalent bond: σ/π of C₂H₄ and N₂, HF marked as the textbook exception', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Liên kết cộng hoá trị');
  await expect(page.getByText('Liên kết σ: 5 · liên kết π: 1')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'N₂', exact: true }).click();
  await expect(page.getByText('Liên kết σ: 1 · liên kết π: 2')).toBeVisible();
  await page.getByRole('button', { name: 'HCl', exact: true }).click();
  const bottom = page.getByRole('region', { name: 'Bảng đồ thị và lời giải' });
  await expect(bottom.getByText('cộng hóa trị phân cực')).toBeVisible();
  await page.getByRole('button', { name: 'HF', exact: true }).click();
  await expect(bottom.getByText('ion (ngoại lệ)')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('ngoại lệ của Bảng 12.1');
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('Bài 13 hydrogen bonds: hydride boiling points, the period-2 anomaly from the data', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Liên kết hydrogen và tương tác van der Waals');
  await expect(page.getByText('Sôi cao bất thường ở chu kì 2: NH₃, H₂O, HF')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Chưa có số liệu có nguồn: SnH₄, H₂Te')).toBeVisible();
  await expect(page.locator('.chart canvas').first()).toBeVisible();
  const nh3 = page.getByRole('row', { name: /^NH₃/ });
  await expect(nh3).toContainText('-33,35');
  // The textbook's value where SGK gives one (Bảng 13.1), NIST named as the second source.
  const h2s = page.getByRole('row', { name: /^H₂S\s/ });
  await expect(h2s).toContainText('−60,75 °C');
  await expect(h2s).toContainText('Bảng 13.1, tr. 65');
  await expect(h2s).toContainText('Nguồn thứ hai: 212.87 K');
  await page.getByRole('radio', { name: 'K', exact: true }).click();
  await expect(nh3).toContainText('239,8');
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});
