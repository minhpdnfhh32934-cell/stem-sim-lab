import { expect, test, type Browser, type Page } from '@playwright/test';
import { captureAt, expectDebug, openMultiplayer, position, roomIdOf, shot } from './support';

// LAN rooms (Phase M; the menu's Play, Phú 2026-11-12) on the dev server's room server: two
// browsers, as two computers on one network would be. One makes a room and goes straight in; the
// other finds it in the list (a wrong ID typed first is refused), chooses it and presses Play,
// going straight in too; each sees the other in the world; one leaves and the other is told.

async function player(browser: Browser, errors: string[]): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await openMultiplayer(page);
  return page;
}

test('multiplayer: a room made, listed, chosen and played, the players seen in the world, left', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const a = await player(browser, errors);
  // The room server answers: no "needs the room server" message, the form enabled.
  await expect(a.locator('.multiplayer-status')).toBeHidden();
  await a.getByLabel('Your name').fill('An');
  await a.getByLabel('Room name').fill('Lớp 11A');
  await a.getByRole('button', { name: 'Create room' }).click();
  // Straight in: the entering transition, then a new game in the room's own save.
  await expect(a.locator('.enter-transition')).toBeVisible();
  await expectDebug(a, 'Scene', 'preparation-room');
  await expectDebug(a, 'Phase', 'playing');
  const id = await roomIdOf(a);
  expect(id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await expect(a.locator('.enter-transition')).toHaveCount(0);

  const b = await player(browser, errors);
  // The open room in the list: its name, ID, host and players.
  const row = b.locator('.multiplayer-room', { hasText: 'Lớp 11A' });
  await expect(row).toContainText(`ID ${id} · host An · 1/8`);
  await b.getByLabel('Your name').fill('Bình');
  // A wrong ID first: refused with a reason, nothing joined, still on the page.
  await b.getByLabel('Room ID').fill('ZZZZZZ');
  await b.locator('.multiplayer-box').getByRole('button', { name: 'Join' }).click();
  await expect(b.locator('.multiplayer-status')).toHaveText('No open room has that ID.');
  await expect(b.locator('.enter-transition')).toHaveCount(0);
  await expectDebug(b, 'Phase', 'menu');
  // Chosen in the list: shown large with Play.
  await row.locator('.multiplayer-room-pick').click();
  const chosen = b.locator('.multiplayer-selected');
  await expect(chosen.locator('.multiplayer-selected-name')).toHaveText('Lớp 11A');
  await expect(chosen).toContainText(`ID ${id} · host An · 1/8`);
  await b.screenshot({ path: 'test-results/multiplayer-1-chosen.png' });
  await chosen.getByRole('button', { name: 'Play' }).click();
  await expectDebug(b, 'Scene', 'preparation-room');
  await expectDebug(b, 'Phase', 'playing');

  // Each sees the other in the preparation room (their pose, 15 a second).
  await expectDebug(a, 'Players', `${id} 2/8 · Bình preparation-room`);
  await expectDebug(b, 'Players', `${id} 2/8 · An preparation-room`);
  // Bình walks ahead; An sees them walk there, their name over their head.
  const seenAt = async () =>
    /Players:.*Bình preparation-room (\S+), (\S+)/
      .exec(await a.locator('.debug-text').innerText())
      ?.slice(1)
      .join(',');
  const before = await seenAt();
  expect(before).toMatch(/^-?[\d.]+,-?[\d.]+$/);
  const start = await position(b);
  await captureAt(b, { x: 640, y: 360 });
  await b.keyboard.down('w');
  await b.waitForTimeout(1200);
  await b.keyboard.up('w');
  const end = await position(b);
  expect(Math.hypot(end[0] - start[0], end[2] - start[2])).toBeGreaterThan(0.5);
  await expect.poll(async () => (await seenAt()) !== before, { timeout: 10_000 }).toBe(true);
  await a.waitForTimeout(1000); // eased in
  await shot(a, 'multiplayer-3-seen');

  // Bình closes the game: An is told, the room counts one.
  await b.context().close();
  await expect(a.getByText('Bình left the room.')).toBeVisible({ timeout: 15_000 });
  await expectDebug(a, 'Players', `${id} 1/8`);
  expect(errors).toEqual([]);
});
