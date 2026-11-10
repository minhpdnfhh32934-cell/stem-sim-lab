import { expect, test } from '@playwright/test';
import { openLab } from './nav';

/** Showcase mode (#54 item 13): from Ctrl+K, the first scene with its caption, a click stops it. */
test('showcase: starts from Ctrl+K in presentation mode, a click stops it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const ai: string[] = [];
  page.on('request', (r) => {
    if (/generativelanguage|anthropic|groq/.test(r.url())) ai.push(r.url());
  });
  await openLab(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('.command-palette');
  await expect(palette).toBeVisible({ timeout: 20_000 });
  await palette.getByRole('combobox').fill('trưng bày');
  await palette.getByRole('option', { name: /Chế độ trưng bày/ }).click();
  const caption = page.getByRole('status').filter({ hasText: 'Bấm bất kì đâu' });
  await expect(caption).toContainText('1/8');
  await expect(caption).toContainText('Ném xiên');
  await expect(page.locator('.stage__hud-title')).toHaveText('Ném xiên', { timeout: 20_000 });
  await page.mouse.click(400, 300);
  await expect(caption).toHaveCount(0);
  expect(ai).toEqual([]);
  expect(errors).toEqual([]);
});
