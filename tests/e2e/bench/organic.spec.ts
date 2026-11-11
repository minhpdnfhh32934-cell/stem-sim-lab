import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

// Bench twin of tests/e2e/organic.spec.ts (0.8.1 B8: same titles, the same checks on the bench
// shell; scripts/e2e/title-parity.mjs).

/** Organic molecules in 3D (#54 item 11): filter by functional group, open one in 3D. */
test('Phân tử 3D: "Lọc theo nhóm chức" lists the arenes and opens phenol in 3D', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openLab(page);
  await page.getByRole('radio', { name: 'Hóa học' }).click();
  await page.getByRole('button', { name: 'Phân tử 3D', exact: true }).click();
  const filter = page.getByRole('combobox', { name: 'Lọc theo nhóm chức' });
  await expect(filter).toBeVisible({ timeout: 20_000 });
  await filter.selectOption('arene');
  const list = page.getByRole('group', { name: 'Phân tử có nhóm chức này' });
  await expect(list.getByRole('button', { name: 'C₆H₆', exact: true })).toBeVisible();
  await list.getByRole('button', { name: 'C₆H₅OH', exact: true }).click();
  await expect(page.locator('.el-card__name')).toHaveText('Phenol');
  await expect(page.locator('.mol-viewer__canvas')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
