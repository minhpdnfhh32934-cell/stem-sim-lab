import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/** HH11 Bài 15–17 (#255 round 2f): the general formulas and the tables of the textbook. */
test('hydrocarbons: propane burns as C₃H₈ + 5O₂ (tr. 88); benzene boils at 80,1 °C (Bảng 17.1)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Alkane, alkene, alkyne, arene');
  await expect(page.locator('.stage__hud-title')).toHaveText('Hydrocarbon', { timeout: 20_000 });
  // Opens on propane, n = 3.
  await expect(page.locator('.hc-panel__eq')).toHaveText('C₃H₈ + 5O₂ → 3CO₂ + 4H₂O');
  await expect(
    page.getByRole('cell', { name: '-161,5' }).or(page.getByRole('cell', { name: '−161,5' })),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Dãy đồng đẳng của benzene' }).click();
  await expect(page.locator('.hc-panel__eq')).toHaveText('2C₆H₆ + 15O₂ → 12CO₂ + 6H₂O');
  await expect(page.getByRole('cell', { name: '80,1' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
