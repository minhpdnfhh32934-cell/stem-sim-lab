import { expect, test } from '@playwright/test';
import { Aim, continueFrom, expectDebug, labSave, shot, type Vec3 } from './support';

// The Explain view (Phase X, Phú 2026-11-08): by a station, H glides the camera close to its
// apparatus, names its parts and shows its principle step by step; H or Esc closes it, without
// pausing. Only while the apparatus (or its bench) is looked at is H offered. The hub's teacher
// will drive the same view.

const PENDULUM: Vec3 = [0, 1.6, -12.1];
const STAND: Vec3 = [1.2, 0, -10.2];

test('by the pendulum, H explains it: close view, its parts named, steps, closed by H and Esc', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await continueFrom(page, labSave(STAND, PENDULUM));
  await expectDebug(page, 'Room', 'pendulum-bay');
  const hint = page.locator('.explain-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Explain this experiment');

  await page.keyboard.press('h');
  const panel = page.locator('.explain-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.explain-title')).toHaveText('Simple pendulum');
  await expect(panel.locator('.explain-count')).toHaveText('Step 1 of 6');
  // The parts of step 1 are lit, and every part's label is on the screen.
  await expect(page.locator('.explain-tag:not(.hidden)')).toHaveCount(5);
  await expect(page.locator('.explain-tag.lit')).toHaveCount(3);
  await expect(page.locator('.explain-tag.lit', { hasText: 'Bob (0.5 kg)' })).toBeVisible();
  await page.waitForTimeout(800); // the camera's glide
  await shot(page, 'explain-pendulum');

  await page.keyboard.press('ArrowRight');
  await expect(panel.locator('.explain-count')).toHaveText('Step 2 of 6');
  await panel.getByRole('button', { name: 'Next →' }).click();
  await expect(panel.locator('.explain-count')).toHaveText('Step 3 of 6');

  // Esc closes it, and does not pause.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expectDebug(page, 'Phase', 'playing');
  await page.keyboard.press('h');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.explain-count')).toHaveText('Step 1 of 6');
  await page.keyboard.press('h');
  await expect(panel).toBeHidden();

  // Looking away from it: no hint, and H opens nothing (Phú, 2026-11-09: only when looked at).
  const aim = new Aim(page);
  await aim.sync();
  await aim.to(aim.yaw + Math.PI, 0);
  await expect(hint).toBeHidden();
  await page.keyboard.press('h');
  await expect(page.locator('.hud-toast', { hasText: 'Look at an experiment' })).toBeVisible();
  await expect(panel).toBeHidden();
  // Back on it: the hint again.
  await aim.at(PENDULUM);
  await expect(hint).toBeVisible();
  expect(errors).toEqual([]);
});
