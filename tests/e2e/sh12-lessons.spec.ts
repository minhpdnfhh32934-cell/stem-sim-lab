import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * SH12 Bài 3 (#255 round 5a): the lac operon off without lactose, on with it, and question 2 of
 * tr. 21 (on without lactose when lacI or the operator is damaged).
 */
test('lac operon: lactose, a damaged lacI, a damaged operator', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Điều hòa biểu hiện gene: operon lac');
  await expect(page.locator('.stage__hud-title')).toHaveText(
    'Điều hòa biểu hiện gene: operon lac',
    { timeout: 20_000 },
  );
  const verdict = page.locator('.operon__verdict');
  await expect(verdict).toHaveText('Các gene cấu trúc không được phiên mã');
  await expect(page.locator('.operon__repressor')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('off.png') });

  const lactose = page.getByRole('radiogroup', { name: 'Lactose trong môi trường' });
  await lactose.getByRole('radio', { name: 'Có', exact: true }).click();
  await expect(verdict).toHaveText('Các gene cấu trúc được phiên mã');
  await expect(page.locator('.operon__enzymes li')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('on.png') });

  await lactose.getByRole('radio', { name: 'Không có' }).click();
  await page
    .getByRole('radiogroup', { name: 'Vùng vận hành O' })
    .getByRole('radio', { name: 'Bị hỏng' })
    .click();
  await expect(verdict).toHaveText('Các gene cấu trúc được phiên mã');
  await expect(page.locator('.operon__reason')).toContainText('Vùng O bị hỏng');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
