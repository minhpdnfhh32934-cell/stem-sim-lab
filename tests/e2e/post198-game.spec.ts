import { expect, test } from '@playwright/test';
import { openLab } from './nav';

declare const process: { env: Record<string, string | undefined> };

/**
 * SimLab 3D (docs/GAME.md), carried over from the bench spec written after PR #198: the library's
 * "SimLab 3D" button (under "Science Studio") opens the game over the app, in Vietnamese, with
 * single player and LAN rooms (chat only, no voice: #339); "Về SimLab" closes it.
 * WebGL runs in software (SwiftShader) so the game's menu comes up on a runner without a GPU.
 */
test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
});

test('SimLab 3D opens over the lab, rooms without voice, and closes back to the lab', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openLab(page);
  await page
    .getByRole('complementary', { name: 'Thư viện chủ đề' })
    .getByRole('button', { name: /^SimLab 3D/ })
    .click();
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
  // LAN rooms inside SimLab (#339): the Multiplayer card is back, chat only (no voice). In a
  // plain browser there is no SimLab room server, and the card says so (never a fake room).
  await expect(game.getByRole('button', { name: /Chơi đơn/ })).toBeVisible();
  const multi = game.getByRole('button', { name: /Chơi nhiều người/ });
  await expect(multi).toBeVisible();
  await expect(multi).toContainText('Chat bằng Enter');
  await expect(multi).not.toContainText('giữ V để nói');
  await expect(multi).toContainText('Máy chủ phòng chưa chạy');
  await dialog.getByRole('button', { name: 'Về SimLab' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('iframe[title="Trò chơi SimLab 3D"]')).toHaveCount(0);
  // Back in the lab: its home page is still there under the closed game.
  await expect(page.getByRole('heading', { name: 'Hôm nay học gì?' })).toBeVisible();
  expect(errors).toEqual([]);
});
