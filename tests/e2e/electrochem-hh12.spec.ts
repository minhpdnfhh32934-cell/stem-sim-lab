import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * HH12 Bài 15 (#255 round 4c): reaction (2) and question 5c (tr. 72), the Zn – Cu cell (tr. 74)
 * and the Cu – Ag cell of Hình 15.10 (tr. 75), Bảng 15.1.
 */
test('electrode potentials: the α rule, the Zn – Cu and Cu – Ag cells', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Thế điện cực và nguồn điện hóa học');
  await expect(page.locator('.stage__hud-title')).toHaveText('Thế điện cực và nguồn điện hóa học', {
    timeout: 20_000,
  });
  await expect(page.locator('.ec-table tbody tr')).toHaveCount(24);
  await expect(page.locator('.ec-result__eq')).toHaveText('Cu + 2Ag⁺ → Cu²⁺ + 2Ag');
  await page.getByRole('button', { name: 'Câu 5c' }).click();
  await expect(page.locator('.ec-result__eq')).toHaveText('3Zn + 2Au³⁺ → 3Zn²⁺ + 2Au');
  await page.screenshot({ path: testInfo.outputPath('series.png') });

  await page.getByRole('radio', { name: 'Pin Galvani' }).click();
  await expect(page.locator('.ec-panel__emf')).toHaveText('1,102 V');
  await expect(page.locator('.ec-panel__anode')).toHaveText('Zn');
  await expect(page.locator('.ec-result__eq')).toHaveText('Zn + Cu²⁺ → Zn²⁺ + Cu');
  await page.screenshot({ path: testInfo.outputPath('cell-zn-cu.png') });
  await page.getByRole('button', { name: 'Pin Cu – Ag (tr. 75)' }).click();
  await expect(page.locator('.ec-panel__emf')).toHaveText('0,459 V');
  await expect(page.locator('.ec-panel__cathode')).toHaveText('Ag');
  await page.screenshot({ path: testInfo.outputPath('cell-cu-ag.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
