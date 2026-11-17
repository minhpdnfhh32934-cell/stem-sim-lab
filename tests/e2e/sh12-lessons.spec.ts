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

/**
 * SH12 Bài 10–12 (#255 round 5b): Morgan's reciprocal cross (Hình 10.2b), the female testcross
 * (41,5 % : 8,5 %, Hình 11.2), question 2 of tr. 59, a translocation, Down syndrome in humans.
 */
test('heredity: X-linked cross, linkage, chromosome mutations', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Sinh học', 'Di truyền giới tính và liên kết với giới tính');
  await expect(page.locator('.heredity__cross')).toHaveText('♀ XᴬXᴬ × ♂ XᵃY', {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Lai nghịch: F1 × F1' }).click();
  await expect(page.locator('.heredity__result li')).toHaveCount(4);
  await expect(page.locator('.heredity__note')).toContainText('1 : 1');
  await page.screenshot({ path: testInfo.outputPath('sexlinked.png') });

  await openTopic(page, 'Sinh học', 'Liên kết gene và hoán vị gene');
  await expect(page.locator('.bar-list__row')).toHaveCount(4, { timeout: 20_000 });
  await expect(page.locator('.heredity__verdict')).toContainText('17 %');
  await page.screenshot({ path: testInfo.outputPath('linkage.png') });
  await page.getByRole('radio', { name: 'Câu 2 tr. 59' }).click();
  await expect(page.locator('.heredity__verdict')).toContainText('94');
  await expect(page.locator('.heredity__verdict')).toContainText('1.566');

  await openTopic(page, 'Sinh học', 'Đột biến nhiễm sắc thể');
  await page.getByRole('radio', { name: 'Chuyển đoạn' }).click();
  await expect(page.locator('.heredity__row--after .heredity__chromosome')).toHaveCount(2, {
    timeout: 20_000,
  });
  await page.screenshot({ path: testInfo.outputPath('translocation.png') });
  await page.getByRole('radio', { name: 'Đột biến số lượng' }).click();
  await expect(page.locator('.heredity__cross').first()).toContainText('2n = 46 → 47');
  await page.getByRole('radio', { name: 'Hội chứng Down' }).click();
  await expect(page.locator('.bar-list__row')).toHaveCount(7);
  await page.screenshot({ path: testInfo.outputPath('down.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
