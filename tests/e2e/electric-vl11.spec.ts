import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

async function openAndRun(page: Page, name: string) {
  await openTopic(page, 'Vật lý', name);
  await expect(page.locator('.stage__hud-title')).toHaveText(name, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Chạy (Space)' }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: 'Lời giải' }).click();
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** VL11 Bài 19–22 (#255 round 2b): each lesson opens on the textbook's own example. */
test('potential: the example of tr. 81, V_M = 18 V; the broken path gives the same work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openAndRun(page, 'Thế năng điện. Điện thế');
  await expect(page.getByText('Điện thế tại M', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/18\s*V/).first()).toBeVisible();
  await page.getByRole('radio', { name: 'Gấp khúc M → P → N' }).click();
  await expect(page.getByText(/Chọn đường "Gấp khúc M → P → N"/)).toBeVisible();
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('capacitors: 2, 3, 4 µF in series (tr. 86) is 12/13 µF; parallel is 9 µF', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openAndRun(page, 'Tụ điện');
  await expect(page.getByText(/0,9231\s*µF/).first()).toBeVisible();
  await page.getByRole('radio', { name: 'Song song' }).click();
  await expect(page.getByText(/9\s*µF/).first()).toBeVisible();
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('current: the copper wire of tr. 93 drifts at about 0,12 mm/s', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openAndRun(page, 'Cường độ dòng điện');
  await expect(page.getByText(/0,117\d?\s*mm\/s/).first()).toBeVisible();
  await noSideScroll(page);
  expect(errors).toEqual([]);
});
