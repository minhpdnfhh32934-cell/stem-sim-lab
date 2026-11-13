import { expect, type Page, test } from '@playwright/test';
import { captureAt, menuNewGame } from './support';

// Runs against `vite preview` of a fresh production build (project "production" in
// playwright.config.ts). Production has no debug panel, so the game is observed through the HUD,
// the console log and the browser's Resource Timing API — sizes, never chunk file names.

const scriptBytes = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith('.js'))
      .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).decodedBodySize, 0),
  );

test('production: menu without the physics engine, Rapier fetched on New game and working', async ({
  page,
}) => {
  const errors: string[] = [];
  const physicsReady: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.text().includes('Physics ready')) physicsReady.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIMLAB' })).toBeVisible();
  // Dev tools are not shipped; the F3 frame-rate overlay (PerfOverlay, Phase V) is, hidden.
  await expect(page.locator('.debug:not(.perf)')).toHaveCount(0);
  const menuBytes = await scriptBytes(page);
  expect(menuBytes).toBeLessThan(1_000_000); // three.js + game code only
  expect(physicsReady).toEqual([]);

  await menuNewGame(page);
  await expect(page.locator('.hud-toast').first()).toHaveText('Preparation Room');
  const playingBytes = await scriptBytes(page);
  expect(playingBytes - menuBytes).toBeGreaterThan(3_000_000); // the Rapier chunk, on demand
  expect(physicsReady).toHaveLength(1);

  // Movement goes through the physics character controller: turn right to face the Teacher Room
  // door (east wall; the hub door is held shut by the cleanroom entry procedure), walk to it and
  // use it.
  await page.evaluate(() => document.exitPointerLock());
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await captureAt(page, { x: 640, y: 360 });
  await page.mouse.move(640, 360);
  await page.mouse.move(640 + 628, 360, { steps: 20 });
  await page.keyboard.down('w');
  await expect(page.locator('.hud-prompt')).toContainText('Go to Teacher Room', {
    timeout: 10_000,
  });
  await page.keyboard.up('w');
  await page.keyboard.press('e');
  // The door slides open (it then offers to close); walk through it into the Teacher Room.
  await expect(page.locator('.hud-prompt')).toContainText('Close the door');
  await page.waitForTimeout(1000);
  await page.keyboard.down('w');
  await expect(page.locator('.hud-toast').last()).toHaveText('Teacher Room', { timeout: 10_000 });
  await page.keyboard.up('w');
  expect(physicsReady).toHaveLength(1); // the second world scene did not load Rapier again

  test
    .info()
    .annotations.push(
      { type: 'js-at-menu-bytes', description: String(menuBytes) },
      { type: 'js-after-start-bytes', description: String(playingBytes) },
      { type: 'physics-ready', description: physicsReady.join(' | ') },
    );
  expect(errors).toEqual([]);
});
