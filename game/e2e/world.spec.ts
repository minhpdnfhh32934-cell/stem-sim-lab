import { expect, type Page, test } from '@playwright/test';
import { pixel, menuNewGame } from './support';

// Phase 4 world building in the real app: the Preparation Room (x −3 … 3, z −3 … 3) and the
// cleanroom corridor (x −1.5 … 1.5, z −11.25 … −3.25) are one scene joined by a 1.2 m × 2.2 m
// doorway in the wall between them, centred on x = 0. State is read from the dev debug panel;
// rendering is checked on screen pixels.

async function expectDebug(page: Page, label: string, value: string) {
  await expect(page.locator('.debug-text')).toContainText(new RegExp(`${label}:\\s+${value}`), {
    timeout: 10_000,
  });
}

async function position(page: Page): Promise<[number, number, number]> {
  const text = await page.locator('.debug-text').innerText();
  const p = /Position:\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
  if (!p) throw new Error(`debug panel not readable:\n${text}`);
  return [Number(p[1]), Number(p[2]), Number(p[3])];
}

const difference = (a: number[], b: number[]) =>
  a.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0);

/**
 * Holds `key` until the position satisfies `done`, then releases it. Closed-loop rather than
 * timed, so a slow (software-rendered, loaded) browser walks as far as a fast one; the debug text
 * refreshes every 0.25 s of game time, so it can overshoot by about 0.6 m.
 */
async function walkUntil(page: Page, key: string, done: (p: [number, number, number]) => boolean) {
  await page.keyboard.down(key);
  await expect
    .poll(async () => done(await position(page)), { timeout: 30_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up(key);
}

test('walk from the Preparation Room through the doorway into the cleanroom corridor', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await menuNewGame(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  await expectDebug(page, 'Room', 'preparation-room');
  // The mouse stays captured (New game took it): freeing it while playing pauses the game.

  // Rendering. The spawn (0, 0, 1) faces north at the doorway. 15 px below the crosshair the view
  // passes through the doorway onto the hub door 12 m away (brown); 200 px either side it meets
  // the room's north wall at x = ±1.56 (pale). A closed wall would give three equal wall pixels.
  const through = await pixel(page, 640, 375);
  const left = await pixel(page, 440, 375);
  const right = await pixel(page, 840, 375);
  test.info().annotations.push({
    type: 'pixels (through, left wall, right wall)',
    description: JSON.stringify([through, left, right]),
  });
  expect(difference(left, right)).toBeLessThan(20);
  expect(difference(through, left)).toBeGreaterThan(60);
  await page.screenshot({ path: 'test-results/world-doorway.png' });

  // Walk straight north through the doorway into the corridor: x stays 0 (no jamb contact).
  await walkUntil(page, 'w', (p) => p[2] < -4);
  await expectDebug(page, 'Room', 'cleanroom-corridor');
  let p = await position(page);
  expect(Math.abs(p[0])).toBeLessThan(0.01);
  await expect(page.locator('.hud-toast').last()).toHaveText('Cleanroom corridor');
  await page.screenshot({ path: 'test-results/world-corridor.png' });

  // And back into the Preparation Room (stopping near z = −2 … −1.4).
  await walkUntil(page, 's', (p) => p[2] > -2);
  await expectDebug(page, 'Room', 'preparation-room');

  // Beside the doorway the wall blocks: step west of it (x −1.1 … −1.7; the opening is
  // x −0.6 … 0.6, the wardrobe starts at x = −2.4) and walk north into the wall at z = −3. The
  // capsule (r = 0.3 m + 0.01 m skin) stops at −2.69 and stays there while still pushing.
  await walkUntil(page, 'a', (p) => p[0] < -1.1);
  await walkUntil(page, 'w', (p) => p[2] < -2.6);
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  p = await position(page);
  expect(p[0]).toBeLessThan(-0.95);
  expect(Math.abs(p[2] + 2.69)).toBeLessThan(0.02);
  await expectDebug(page, 'Room', 'preparation-room');

  // Physics: 2 rooms (8 slabs each with the doorway wall in 3 pieces, + 2 each for the opening
  // behind its walk-through door) + 12 objects + player; UX3.1: the PPE cabinet's carcass is 5
  // colliders, not 1, and its 2 hinged leaves 2 kinematic bodies.
  // Counts are identical every time the scene is entered again.
  await expectDebug(page, 'Physics', 'ready · bodies 17 · colliders 39');
  // The developer panel takes clicks only with the mouse free (that pauses; a scene load resumes).
  await page.evaluate(() => document.exitPointerLock());
  const jump = async (sceneId: string) => {
    await page.getByLabel('Scene to load').selectOption(sceneId);
    await page.getByRole('button', { name: 'Load scene' }).click();
    await expectDebug(page, 'Scene', sceneId);
  };
  for (let i = 0; i < 2; i++) {
    await jump('simlab-hub');
    // + the teacher (Phase Y), then one more since the hub's board and laptop (2026-11-10).
    await expectDebug(page, 'Physics', 'ready · bodies 42 · colliders 55');
    await jump('preparation-room');
    await expectDebug(page, 'Physics', 'ready · bodies 17 · colliders 39');
  }
  await expect(page.locator('.debug-text')).not.toContainText('[failed]');
  expect(errors).toEqual([]);
});
