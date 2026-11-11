import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

// Bench twin of tests/e2e/tooltip.spec.ts (0.8.1 B8: same titles, the same checks on the bench
// shell; scripts/e2e/title-parity.mjs).

/**
 * The shared tooltip (`TooltipLayer`, WCAG 1.4.13) in the bench shell: it never blocks a
 * click, the next control's tooltip still opens, and one Esc closes a dialog even while the
 * keyboard focus shows a tooltip in it.
 */

test('moving from one top-bar button to the next shows the next tooltip, which takes no click', async ({
  page,
}) => {
  await openLab(page);
  const settings = page.getByRole('button', { name: 'Cài đặt', exact: true });
  const file = page.getByRole('button', { name: 'Tệp', exact: true });
  await settings.hover();
  const bubble = page.getByRole('tooltip');
  await expect(bubble).toHaveText('Cài đặt');
  expect(await bubble.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  await file.hover();
  await expect(bubble).toHaveText('Tệp');
});

test('a dialog closes with one Esc while its close button shows a tooltip', async ({ page }) => {
  await openLab(page);
  // The pointer rests in a corner the opening dialog never crosses: a pointerover there (the
  // page changing under a still mouse) would hide a focus tooltip, as it should.
  await page.mouse.move(2, 2);
  const settings = page.getByRole('button', { name: 'Cài đặt', exact: true });
  await settings.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Tabbing back onto its close button shows that button's tooltip; one Esc still closes.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('Đóng');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
