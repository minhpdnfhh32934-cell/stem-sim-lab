import { expect, test, type Page } from '@playwright/test';
import { openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

async function open(page: Page, name: string) {
  await openTopic(page, 'Hóa học', name);
  await expect(page.locator('.stage__hud-title')).toHaveText(name, { timeout: 20_000 });
}

/**
 * HH12 Bài 28–29 (#255 round 4f): [Cu(H₂O)₆]²⁺ as an octahedron, [CoF₆]³⁻'s charge (question 1),
 * [Fe(CO)₅] without a drawn geometry, the Cu²⁺ signs and a ligand substitution (tr. 140).
 */
test('complexes: charge, ligands, geometry, substitutions', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, 'Sơ lược về phức chất');
  await expect(page.locator('.cx-formula')).toHaveText('[Cu(H₂O)₆]²⁺');
  await expect(page.locator('.cx-facts__cn')).toHaveText('6');
  await expect(page.locator('.cx-facts__geometry')).toContainText('bát diện');
  await expect(page.locator('.cx-3d .mol-viewer')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cu-aqua.png') });

  const select = page.getByRole('combobox', { name: 'Phức chất trong sách' });
  await select.selectOption({ label: '[CoF₆]³⁻ (tr. 134)' });
  await expect(page.locator('.cx-facts__charge')).toHaveText('(+3) + 6 × (−1) = −3');
  await select.selectOption({ label: '[Fe(CO)₅] (tr. 134)' });
  await expect(page.locator('.cx-3d')).toHaveCount(0);
  await expect(page.locator('.cx-facts__geometry')).toContainText('5 phối tử');

  await open(page, 'Một số tính chất và ứng dụng của phức chất');
  await expect(page.locator('.cx-step')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('signs.png') });
  await page.getByRole('radio', { name: 'Thế phối tử' }).click();
  await expect(page.locator('.cx-eq')).toHaveText('[Cu(H₂O)₆]²⁺ + 4Cl⁻ → [CuCl₄]²⁻ + 6H₂O');
  await expect(page.locator('.cx-balance')).toHaveText('Có');
  await page.screenshot({ path: testInfo.outputPath('substitution.png') });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
