declare const process: { env: Record<string, string | undefined> };
import { expect, test, type Page } from '@playwright/test';

const TOPICS = [
  'Nguyên phân',
  'Giảm phân',
  'ADN → mARN → Protein',
  'Đột biến điểm',
  'Di truyền Mendel',
  'Định luật Hardy–Weinberg',
  'Phiêu bạt di truyền',
  'Tăng trưởng logistic',
  'Con mồi – vật ăn thịt (Lotka–Volterra)',
  'Động học enzyme (Michaelis–Menten)',
  'Khuếch tán & thẩm thấu',
];

async function openBiology(page: Page) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Sinh học' }).click();
}

test('every biology topic opens without errors and publishes a Science Card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openBiology(page);
  for (const [i, name] of TOPICS.entries()) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.science-card')).toBeVisible();
    await page.waitForTimeout(400);
    if (process.env.SHOTS)
      await page.screenshot({ path: `${process.env.SHOTS}/bio-${String(i)}.png` });
  }
  expect(errors).toEqual([]);
});

test('Mendel dihybrid cross shows 9 : 3 : 3 : 1', async ({ page }) => {
  await openBiology(page);
  await page.getByRole('button', { name: 'Di truyền Mendel', exact: true }).click();
  await expect(page.getByText('9 : 3 : 3 : 1', { exact: true })).toBeVisible();
});

test('point mutation: C→T at position 13 is a nonsense mutation', async ({ page }) => {
  await openBiology(page);
  await page.getByRole('button', { name: 'Đột biến điểm', exact: true }).click();
  await expect(page.getByText('Đột biến vô nghĩa')).toBeVisible();
  await expect(page.getByText('Met–Ala–Phe', { exact: true })).toBeVisible();
});

test('osmosis view shows the van ’t Hoff equilibrium', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openBiology(page);
  await page.getByRole('button', { name: 'Khuếch tán & thẩm thấu', exact: true }).click();
  await page.getByRole('radio', { name: 'Thẩm thấu' }).click();
  await expect(page.getByText(/Π₀ = iC₀RT/)).toBeVisible();
  await expect(page.locator('.science-card')).toContainText('Thẩm thấu');
  await page.waitForTimeout(500);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/bio-osmosis.png` });
  expect(errors).toEqual([]);
});
