import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

/** Metal crystals and NaCl (#54 item 8): counts from geometry, a 3D cell, never "to scale". */
test('metal crystals and NaCl: counts from the cell, coordination 6 : 6, not to scale', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await page.getByRole('button', { name: 'Tinh thể kim loại và NaCl', exact: true }).click();
  const cell = page.getByRole('img', { name: /^Lập phương tâm khối: 8 × 1\/8 \+ 1 = 2/ });
  await expect(cell).toBeVisible({ timeout: 20_000 });
  await expect(cell.locator('canvas')).toBeVisible();
  // The 3D cell fills the stage (it once shrank to the 28 px chip row: the picture was a speck).
  const stage = await page.locator('main.bench__stage').boundingBox();
  const view = await cell.boundingBox();
  expect(view && stage && view.height / stage.height).toBeGreaterThan(0.8);
  expect(view && stage && view.width / stage.width).toBeGreaterThan(0.8);
  await expect(page.getByText('Hình minh họa — không theo tỉ lệ')).toBeVisible();
  await page.getByRole('radio', { name: 'NaCl' }).click();
  await expect(page.getByRole('img', { name: /^Tinh thể NaCl:/ })).toBeVisible();
  await expect(page.getByText('12 × 1/4 + 1 = 4', { exact: true })).toBeVisible();
  await expect(page.getByText('6 : 6', { exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
