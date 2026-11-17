import { expect, test } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * HH12 Bài 8–9 (#255 round 4b): the isomers of C3H9N and C4H11N (question 2, tr. 36), Bảng 8.1,
 * glycine electrophoresis (tr. 43) and the peptides of Hình 9.2 and question 4 (tr. 45).
 */
test('amines: names and isomers, Bảng 8.1', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Amine');
  await expect(page.locator('.stage__hud-title')).toHaveText('Amine', { timeout: 20_000 });
  await expect(
    page.getByRole('heading', { name: 'Các amine có công thức C₃H₉N: 4' }),
  ).toBeVisible();
  await expect(page.locator('.amine-panel__radico')).toHaveText('propylamine');
  await expect(page.locator('.amine-panel__subst')).toHaveText('propan-1-amine');
  await page.getByRole('radio', { name: 'C₄H₁₁N' }).click();
  await expect(
    page.getByRole('heading', { name: 'Các amine có công thức C₄H₁₁N: 8' }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('names.png') });

  await page.getByRole('radio', { name: 'Tính chất' }).click();
  await expect(page.locator('.amine-table tbody tr')).toHaveCount(7);
  await page.screenshot({ path: testInfo.outputPath('properties.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('amino acids and peptides: glycine electrophoresis, Val-Gly-Ala', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTopic(page, 'Hóa học', 'Amino acid và peptide');
  await expect(page.locator('.stage__hud-title')).toHaveText('Amino acid và peptide', {
    timeout: 20_000,
  });
  await expect(page.locator('.amine-table tbody tr')).toHaveCount(5);
  await expect(page.locator('.amine-panel__migration')).toHaveText(
    'Ion lưỡng cực, hầu như không di chuyển',
  );
  const pH = page.getByRole('textbox', { name: /pH của môi trường/ });
  await pH.fill('2');
  await pH.press('Enter');
  await expect(page.locator('.amine-panel__migration')).toHaveText(
    'Dạng cation, di chuyển về cực âm (−)',
  );
  await page.screenshot({ path: testInfo.outputPath('amino-acids.png') });

  await page.getByRole('radio', { name: 'Peptide' }).click();
  await expect(page.locator('.amine-panel__peptide')).toHaveText('Val-Gly-Ala');
  await expect(page.locator('.amine-panel__formula')).toHaveText('C₁₀H₁₉N₃O₄');
  await expect(page.locator('.amine-panel__biuret')).toHaveText('Có (màu tím)');
  await page.getByRole('button', { name: 'Bỏ đơn vị cuối' }).click();
  await expect(page.locator('.amine-panel__peptide')).toHaveText('Val-Gly');
  await expect(page.locator('.amine-panel__biuret')).toHaveText('Không');
  await page.getByRole('button', { name: 'Gly-Tyr-Val-Ala', exact: true }).click();
  await expect(page.locator('.amine-fragments li')).not.toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('peptide.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
