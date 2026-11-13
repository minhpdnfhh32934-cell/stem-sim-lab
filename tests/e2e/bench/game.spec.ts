import { expect, test } from '@playwright/test';
import { openLab } from '../nav';

declare const process: { env: Record<string, string | undefined> };

/**
 * SimLab 3D (docs/GAME.md): the lab's "SimLab 3D" button opens the game over the app, in
 * Vietnamese, with single player only (no LAN rooms or voice inside SimLab); "Về SimLab" closes it.
 * WebGL runs in software (SwiftShader) so the game's menu comes up on a runner without a GPU.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

test('SimLab 3D opens over the lab, single player only, and closes back to the lab', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openLab(page);
  await page.getByRole('button', { name: 'SimLab 3D', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'SimLab 3D' });
  await expect(dialog).toBeVisible();
  // The released game: no "Bản thử nghiệm" label or note in its bar (user decision 13/11/2026).
  await expect(dialog.getByText('Bản thử nghiệm')).toHaveCount(0);
  await expect(dialog.getByText(/đang chờ giáo viên duyệt/)).toHaveCount(0);
  const game = page.frameLocator('iframe[title="Trò chơi SimLab 3D"]');
  // The game's own menu, in the app's language (its first visit).
  await expect(game.getByRole('button', { name: 'Chơi', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await game.getByRole('button', { name: 'Chơi', exact: true }).click();
  await expect(game.getByText('Chơi đơn').first()).toBeVisible();
  // No LAN rooms or voice chat inside SimLab: the play page offers single player only (the
  // game still builds its hidden Multiplayer page, never reachable from here).
  await expect(game.getByRole('button', { name: /Chơi đơn/ })).toBeVisible();
  await expect(game.getByRole('button', { name: /Chơi nhiều người/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Về SimLab' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('iframe[title="Trò chơi SimLab 3D"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
