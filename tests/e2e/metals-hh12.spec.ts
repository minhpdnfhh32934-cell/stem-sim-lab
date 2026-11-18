import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * HH12 Bài 19 (#255 round 4d): the book's examples with dilute acid, water and salts (tr. 92–93),
 * question 7 (Cu to Au do not react with dilute acids) and the physical facts (tr. 89–91).
 */
test('properties of metals: water, dilute acid, salts, physical facts', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Tính chất vật lí và tính chất hóa học của kim loại');
  await expect(page.locator('.stage__hud-title')).toHaveText(
    'Tính chất vật lí và tính chất hóa học của kim loại',
    { timeout: 20_000 },
  );
  await expect(page.locator('.metal-verdict')).toHaveText('Có phản ứng');
  await expect(page.locator('.ec-result__eq')).toHaveText('Fe + 2H⁺ → Fe²⁺ + H₂');
  await page.screenshot({ path: testInfo.outputPath('fe-acid.png') });

  await page.getByRole('button', { name: 'Na + nước (tr. 92)' }).click();
  await expect(page.locator('.ec-result__eq')).toHaveText('2Na + 2H₂O → 2Na⁺ + H₂ + 2OH⁻');
  await page.getByRole('button', { name: 'Cu + AgNO₃ (tr. 93)' }).click();
  await expect(page.locator('.ec-result__eq')).toHaveText('Cu + 2Ag⁺ → Cu²⁺ + 2Ag');
  await page.getByRole('radio', { name: 'Dung dịch HCl, H₂SO₄ loãng' }).click();
  await expect(page.locator('.metal-verdict')).toHaveText('Không phản ứng');
  await page.screenshot({ path: testInfo.outputPath('cu-acid.png') });

  await page.getByRole('radio', { name: 'Tính chất vật lí' }).click();
  await expect(page.locator('.metal-fact')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('physical.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
