import { expect, test } from '@playwright/test';
import { menuNewGame } from './support';

// Runs once before the dev project (playwright.config.ts `dependencies`): the dev server compiles
// each module on its first request, and the first specs of a run used to pay that for the menu,
// the renderer, Rapier and the lab pack all at once, three browsers at a time, at a few frames per
// second. Their 15 s waits for the first scene then failed although nothing was wrong with the
// game (canvas, analysis and draw-calls each failed that way in full runs and passed alone). One
// browser asks for every lazy module here first, so no spec times the compiler. It asserts nothing
// about the game.
test('warm up the dev server: the menu, the world and every lazy chunk compiled once', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await page.evaluate(() =>
    Promise.all(
      [
        '/src/platform/render/WorldRenderer.ts',
        '/src/game/labPack.ts',
        '/src/platform/ui/ResultsPanel.ts',
        '/src/platform/ui/workspace/WorkspaceHost.ts',
      ].map((path) => import(/* @vite-ignore */ path)),
    ),
  );
  // Rapier and the first world as the game loads them (its pre-bundled dependency, its WASM).
  await menuNewGame(page);
  await expect(page.locator('.debug-text')).toContainText(/Phase:\s+playing/, { timeout: 120_000 });
});
