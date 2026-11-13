import { expect, test, type Browser, type Page } from '@playwright/test';
import { sceneSave } from './saves';
import {
  Aim,
  captureAt,
  expectDebug,
  openMultiplayer,
  roomIdOf,
  seedRoomSave,
  shot,
  type Vec3,
} from './support';

// One world for a LAN room (Phase F-3, Phú 2026-11-11), two browsers as two computers on one
// network. The other player sees what this one wears (the lab coat) and holds; they cannot walk
// through each other; the teacher one of them talks to is drawn the same for the other, who hears
// him nearby and must wait until he is free; a ball thrown at the other flashes their screen red.

type Save = ReturnType<typeof sceneSave>;

/** Every page opened, closed after each test: an open one keeps its room on the server. */
const opened: Page[] = [];
test.afterEach(async () => {
  for (const page of opened.splice(0)) await page.context().close();
});

async function player(browser: Browser, errors: string[], save: Save): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  opened.push(page);
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRoomSave(page, 'Phòng F3', save);
  await page.goto('/');
  await openMultiplayer(page);
  return page;
}

/**
 * A makes a room, B joins it by its ID: each goes straight in, playing on in its own game of that
 * room (seeded: `seedRoomSave`).
 */
async function room(browser: Browser, errors: string[], saveA: Save, saveB: Save) {
  const a = await player(browser, errors, saveA);
  await a.getByLabel('Your name').fill('An');
  await a.getByLabel('Room name').fill('Phòng F3');
  await a.getByRole('button', { name: 'Create room' }).click();
  await expectDebug(a, 'Scene', saveA.player.sceneId);
  await expectDebug(a, 'Phase', 'playing');
  const id = await roomIdOf(a);
  const b = await player(browser, errors, saveB);
  await b.getByLabel('Your name').fill('Bình');
  await b.getByLabel('Room ID').fill(id);
  await b.locator('.multiplayer-box').getByRole('button', { name: 'Join' }).click();
  await expectDebug(b, 'Scene', saveB.player.sceneId);
  await expectDebug(b, 'Phase', 'playing');
  await expectDebug(b, 'Players', `${id} 2/8`);
  return { a, b, id };
}

const TEACHER: Vec3 = [0, 1.6, -8.4];

/**
 * Looks at `target` (the aim captures the mouse itself, resuming a page the other paused), again
 * until the view settles there: taking the mouse back from the other page can deliver a late move
 * after the aim (seen: +46°, both pages). Never a click while the mouse is captured: that throws.
 */
async function aimAt(page: Page, target: Vec3): Promise<Aim> {
  const aim = new Aim(page);
  for (let i = 0; i < 3; i++) {
    await aim.sync();
    await aim.at(target);
    await page.waitForTimeout(400);
    const wanted = aim.yaw;
    await aim.sync();
    const off = Math.atan2(Math.sin(aim.yaw - wanted), Math.cos(aim.yaw - wanted));
    if (Math.abs(off) < 0.05) break;
  }
  return aim;
}

test('one world: the coat seen, the teacher shared and overheard, no walking through', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  // A and B side by side before the teacher (he stays at the counter ~55 s, then walks on), A in
  // the lab coat. The mouse is locked by one page at a time (the other pauses): each page
  // captures it to act, then aims again (capturing can turn the view).
  const saveA = sceneSave('simlab-hub', [-0.3, 0, -6.5], TEACHER);
  saveA.player.equipment = ['lab-coat'];
  const saveB = sceneSave('simlab-hub', [0.6, 0, -6.3], TEACHER);
  const { a, b, id } = await room(browser, errors, saveA, saveB);

  // B sees A where A stands, in the lab coat A wears (the pose carries it, F-3).
  await expectDebug(b, 'Players', `${id} 2/8 · An simlab-hub -0.30, -6.50 wears lab-coat`);
  await expectDebug(a, 'Players', `${id} 2/8 · Bình simlab-hub 0.60, -6.30`);

  // A talks to the teacher: B sees him talking to A, hears his greeting, and must wait.
  await aimAt(a, TEACHER);
  await expectDebug(a, 'Focus', 'simlab-hub/teacher');
  await a.keyboard.press('e');
  await expect(a.locator('.dialogue-box')).toBeVisible();
  // B sees A listening to him, not standing idle (the pose's `doing`, 2026-11-12).
  await expectDebug(b, 'Players', `${id} 2/8 · An simlab-hub .* doing talk`);
  const overheard = b.locator('.overheard');
  await expect(overheard).toBeVisible({ timeout: 10_000 });
  await expect(overheard.locator('.overheard-who')).toHaveText('Mr. Quang, to An');
  await expect(overheard.locator('.overheard-text')).toContainText("Hello! I'm Mr. Quang");
  await aimAt(b, TEACHER);
  await expectDebug(b, 'Focus', 'simlab-hub/teacher');
  await shot(b, 'mpw-1-coat-seen');
  await b.keyboard.press('e');
  await expect(b.getByText('Mr. Quang is helping An now: wait until he is done.')).toBeVisible();
  await expect(b.locator('.dialogue-box')).toBeHidden();
  await shot(b, 'mpw-2-teacher-busy');

  // A says goodbye: he is free, and B can talk to him.
  await captureAt(a, { x: 640, y: 360 });
  await a.keyboard.press('e'); // on to the choices
  await expectDebug(a, 'Talk', 'teacher menu #0');
  await a.keyboard.press('4'); // Goodbye
  await expectDebug(a, 'Talk', 'teacher farewell #0');
  // E on: the first may only finish writing the line out.
  await expect
    .poll(
      async () => {
        await a.keyboard.press('e');
        await a.waitForTimeout(400);
        return a.locator('.dialogue').isHidden();
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  // A takes the phone out: B sees A dialling at the chest; away again, nothing.
  await a.keyboard.press('p');
  await expectDebug(b, 'Players', `${id} 2/8 · An simlab-hub .* holds phone doing dial`);
  await shot(b, 'mpw-3b-dialling');
  await a.keyboard.press('p');
  await expectDebug(
    b,
    'Players',
    `${id} 2/8 · An simlab-hub -?[\\d.]+, -?[\\d.]+ wears lab-coat\\s`,
  );
  await aimAt(b, TEACHER);
  await expectDebug(b, 'Focus', 'simlab-hub/teacher');
  await expect
    .poll(
      async () => {
        await b.keyboard.press('e');
        await b.waitForTimeout(400);
        return b.locator('.dialogue-box').isVisible();
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await shot(b, 'mpw-3-teacher-free');
  await b.keyboard.press('Escape');
  await expect(b.locator('.dialogue')).toBeHidden();

  // B steps sideways into A: stopped by A's body (or slid round it), never through it. Every
  // refresh of B's debug panel (4 Hz) is kept: B's distance to A at each.
  await b.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { apart: number[] }).apart = seen;
    const panel = document.querySelector('.debug-text');
    if (!panel) return;
    new MutationObserver(() => {
      const m = /Position:\s+(-?[\d.]+), -?[\d.]+, (-?[\d.]+) m/.exec(panel.textContent);
      if (m) seen.push(Math.hypot(Number(m[1]) + 0.3, Number(m[2]) + 6.5));
    }).observe(panel, { childList: true, characterData: true, subtree: true });
  });
  await b.keyboard.down('a');
  await b.waitForTimeout(2000);
  await b.keyboard.up('a');
  const apart = await b.evaluate(() => (window as unknown as { apart: number[] }).apart);
  expect(apart.length).toBeGreaterThan(4);
  expect(Math.min(...apart)).toBeGreaterThan(0.45); // two capsules of 0.28 and 0.3 m
  expect(Math.min(...apart)).toBeLessThan(0.8); // it did walk up to them
  await shot(b, 'mpw-1b-walked-into');
  expect(errors).toEqual([]);
});

test('one world: a ball in the hand seen, thrown at the other player, their screen flashes', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const saveA = sceneSave('physics-lab', [-1, 0, 0], [-1, 1.25, -3]);
  saveA.player.inventory = {
    stacks: [{ slot: 0, item: 'steel-ball', placements: ['physics-lab/steel-ball'] }],
    selected: 0,
  };
  const saveB = sceneSave('physics-lab', [-1, 0, -3], [-1, 1.6, 0]);
  const { a, b, id } = await room(browser, errors, saveA, saveB);
  const CHEST: Vec3 = [-1, 1.25, -3]; // B's chest, 3 m ahead
  await aimAt(a, CHEST);
  await a.keyboard.press('q'); // the ball out of the bag, into the hand
  await expectDebug(a, 'Holding', 'physics-lab/steel-ball');
  await expectDebug(b, 'Players', `${id} 2/8 · An physics-lab -1.00, -?0.00 holds steel-ball`);
  await captureAt(b, { x: 640, y: 360 });
  await b.waitForTimeout(600);
  await shot(b, 'mpw-4-ball-held');

  await expect(b.locator('.hud-hurt.flash')).toHaveCount(0);
  await aimAt(a, CHEST); // the mouse back from B's page: on B again
  await a.mouse.down();
  await a.mouse.up();
  await expectDebug(a, 'Holding', '—');
  await expect(b.locator('.hud-hurt.flash')).toHaveCount(1, { timeout: 10_000 });
  await shot(b, 'mpw-5-hit');
  expect(errors).toEqual([]);
});
