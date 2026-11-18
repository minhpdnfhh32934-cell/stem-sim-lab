import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enterLab, openTopic } from './nav';

test.use({ viewport: { width: 1366, height: 768 } });

/**
 * #195 step 7: axe on the main screens, light and dark. No serious or critical violation; a rule
 * is never turned off to get there.
 */
async function serious(page: Page, include?: string): Promise<string[]> {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const result = await builder.analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.nodes
          .slice(0, 5)
          .map((n) => `${n.target.join(' ')}: ${n.any.map((a) => a.message).join(' ')}`)
          .join(' | ')})`,
    );
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`axe, ${theme}`, () => {
    test.use({ colorScheme: theme });

    test('launch page', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Virtual Lab/ })).toBeVisible();
      expect(await serious(page)).toEqual([]);
    });

    test('lab home', async ({ page }) => {
      await page.goto('/');
      await enterLab(page);
      await expect(page.getByRole('complementary', { name: 'Thư viện chủ đề' })).toBeVisible();
      expect(await serious(page)).toEqual([]);
    });

    test('a physics lesson', async ({ page }) => {
      await openTopic(page, 'Vật lý', 'Ném xiên');
      await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
      expect(await serious(page)).toEqual([]);
    });

    test('Settings → Giao diện', async ({ page }) => {
      await page.goto('/');
      await enterLab(page);
      await page.getByRole('button', { name: 'Cài đặt', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Cài đặt' });
      await dialog.getByRole('tab', { name: /Giao diện/ }).click();
      await expect(dialog).toBeVisible();
      expect(await serious(page, 'dialog[open]')).toEqual([]);
    });
  });
}
