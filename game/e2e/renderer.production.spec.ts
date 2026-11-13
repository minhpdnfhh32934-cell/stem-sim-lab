import { expect, type Page, test } from '@playwright/test';
import { menuNewGame, menuContinue } from './support';

// Runs against `vite preview` of a fresh production build (project "production"). three.js and
// the world renderer are a chunk of their own: not loaded with the menu, downloaded with Rapier
// for the first world scene, once; a failed download keeps the menu, says why, and the next
// world entry tries again without reloading the page. Sizes from the Resource Timing API.

const scripts = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.endsWith('.js'))
      .map((entry) => (entry as PerformanceResourceTiming).decodedBodySize),
  );
const total = (sizes: number[]) => sizes.reduce((sum, size) => sum + size, 0);

test('production: the menu without the renderer; the first world brings it with Rapier, once', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
  const menuBytes = total(await scripts(page));
  // A three.js regression guard, not a product limit (three.js adds ~470 KB): raised 500,000 →
  // 600,000 by Phú, 2026-11-05 ("the size is not limited"), when the menu reached 502 KB.
  expect(menuBytes).toBeLessThan(600_000); // the game without three.js (971,540 bytes with it)
  await expect(page.locator('canvas')).toHaveCount(1);

  await menuNewGame(page);
  await expect(page.locator('.hud-toast').first()).toHaveText('Preparation Room');
  const playing = await scripts(page);
  // Rapier (4.3 MB) and the renderer with three.js (0.6 MB) arrived for the first world.
  expect(total(playing) - menuBytes).toBeGreaterThan(4_800_000);

  // Back to the menu and into the world again: nothing is downloaded a second time.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to the main menu' }).click();
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeVisible();
  await menuContinue(page);
  await expect(page.getByRole('heading', { name: 'SIMLAB', exact: true })).toBeHidden();
  expect(await scripts(page)).toEqual(playing);
  await expect(page.locator('canvas')).toHaveCount(1);

  test
    .info()
    .annotations.push(
      { type: 'js-at-menu-bytes', description: String(menuBytes) },
      { type: 'js-after-start-bytes', description: String(total(playing)) },
    );
  expect(errors).toEqual([]);
});

test('production: a failed renderer download keeps the menu, says why, and New game tries again', async ({
  page,
}) => {
  // The renderer's chunk is named after its module. Every download of it fails until the menu has
  // said why: the import first preloads the chunk (Vite's modulepreload), then fetches it itself.
  let failing = true;
  let failed = 0;
  let served = 0;
  await page.route(/\/assets\/WorldRenderer-[^/]+\.js$/, async (route) => {
    if (failing) {
      failed++;
      await route.abort('failed');
    } else {
      served++;
      await route.continue();
    }
  });

  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'SIMLAB', exact: true });
  await expect(heading).toBeVisible();
  await page.evaluate(() => Object.assign(window, { samePage: true })); // lost if the page reloads

  await menuNewGame(page);
  await expect(page.locator('.menu-message')).toContainText('3D view could not be loaded:');
  await expect(heading).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  failing = false;

  await menuNewGame(page);
  await expect(page.locator('.hud-toast').first()).toHaveText('Preparation Room');
  expect(failed).toBeGreaterThan(0);
  expect(served).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { samePage?: boolean }).samePage)).toBe(
    true,
  );
});
