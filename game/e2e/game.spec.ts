import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  captureAt,
  doorsClosed,
  newGame,
  shot,
  use,
  type Vec3,
  walkThrough,
  walkUntil,
  menuNewGame,
  openSolo,
  closePlay,
} from './support';

// End-to-end smoke test of the real app in a real browser (WebGL renderer, DOM input,
// localStorage saves). The debug panel (dev build) exposes the state being asserted.

const debugLine = (page: Page, label: string) =>
  page.locator('.debug-text').filter({ hasText: new RegExp(`${label}:\\s+`) });

async function expectDebug(page: Page, label: string, value: string) {
  await expect(page.locator('.debug-text')).toContainText(new RegExp(`${label}:\\s+${value}`), {
    timeout: 10_000,
  });
}

test('boot → new game → walk → interact with a door → save → continue', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SIMLAB' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await openSolo(page);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await closePlay(page);
  await expectDebug(page, 'Phase', 'menu');
  // The menu runs without the physics engine: Rapier is only fetched for the first world scene.
  await expectDebug(page, 'Physics', String.raw`idle \(Rapier not loaded\)`);

  // The character page: the menu's row opens it, '›' calls the next of the cast (Lan), Choose.
  await page.getByRole('button', { name: /Choose your character/ }).click();
  await expect(page.locator('.char-page[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Next character' }).click();
  await expect(page.locator('.char-name')).toHaveText('Lan');
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
  await expect(page.locator('.menu-character-name')).toHaveText('Lan');
  await expect(page.locator('canvas')).toHaveCount(1); // the page's own canvas freed
  await menuNewGame(page);
  await expectDebug(page, 'Scene', 'preparation-room');
  await expectDebug(page, 'Phase', 'playing');
  await expectDebug(page, 'Character', 'researcher-female');
  await expectDebug(page, 'Physics', 'ready · bodies ');
  await expect(page.locator('.hud-toast').first()).toHaveText('Preparation Room');
  await page.screenshot({ path: 'test-results/preparation-room.png' });

  // Turn right 90° to face the Teacher Room door in the east wall (0.0025 rad per pixel), walk
  // until it is under the crosshair, then use it. (The door to the hub is held shut by the
  // cleanroom entry procedure; preparation.spec.ts covers it.) New game captured the mouse
  // already: free it first, so moving to the click point turns nothing, wherever the button was.
  await page.evaluate(() => document.exitPointerLock());
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await captureAt(page, { x: 640, y: 360 });
  await page.mouse.move(640, 360);
  await page.mouse.move(640 + 628, 360, { steps: 20 });
  await expectDebug(page, 'Look', 'yaw -(89|90|91)°');
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', 'preparation-room/door-teacher');
  await page.keyboard.up('w');
  await expect(page.locator('.hud-prompt')).toContainText('Go to Teacher Room');
  await page.screenshot({ path: 'test-results/door-focused.png' });
  // It slides open; the player walks through into the Teacher Room, and the door closes behind.
  const to = { label: 'Go to Teacher Room', to: 'teacher-room', done: (p: Vec3) => p[0] > -0.3 };
  await walkThrough(page, to);
  await doorsClosed(page, 'teacher-room');
  await expectDebug(page, 'Entities', '35');
  await page.screenshot({ path: 'test-results/teacher-room.png' });

  // Developer scene jump tool. The game holds pointer lock while playing; release it like a
  // player pressing Esc before clicking UI.
  const locked = await page.evaluate(() => document.pointerLockElement !== null);
  test.info().annotations.push({ type: 'pointer-lock', description: String(locked) });
  await page.evaluate(() => document.exitPointerLock());
  await page.getByLabel('Scene to load').selectOption('physics-lab');
  await page.getByRole('button', { name: 'Load scene' }).click();
  await expectDebug(page, 'Scene', 'physics-lab');
  await page.screenshot({ path: 'test-results/physics-lab.png' });

  // The autosave survives a reload and Continue restores it.
  await page.reload();
  await openSolo(page);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectDebug(page, 'Character', 'researcher-female');

  await expect(debugLine(page, 'Systems')).not.toContainText('[failed]');
  expect(errors).toEqual([]);
});

test('physics: bench blocks the player, the steel ball rests on it, scene changes do not leak', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await menuNewGame(page);
  await expectDebug(page, 'Phase', 'playing');
  await page.evaluate(() => document.exitPointerLock());
  const jump = async (sceneId: string) => {
    await page.getByLabel('Scene to load').selectOption(sceneId);
    await page.getByRole('button', { name: 'Load scene' }).click();
    await expectDebug(page, 'Scene', sceneId);
  };
  await jump('physics-lab');

  // The steel ball is placed 0.5 m above the teacher's bench top (centre 1.44 m). It must fall,
  // land on the bench (centre at 0.90 + 0.04 = 0.94 m, not the floor at 0.04 m) and go to sleep.
  await expect(page.locator('.debug-text')).toContainText(
    /physics-lab\/steel-ball\s+-2\.(06|07)\d, 0\.9(3[89]|4[0-2]), -4\.(47|48)\d m\s+0\.00 m\/s\s+asleep/,
    { timeout: 10_000 },
  );

  // Spawn (x = −4, z = 0) faces +X; the teacher's bench (Phase U-2) stands at x −2.667 … −0.667,
  // z −4.874 … −4.074. Walk east past x −2.6 (closed loop: a timed hold fell short of the bench's
  // end at the lab's software frame rate), then strafe left (−Z) into the bench, whose front face
  // is at z = −4.074: the capsule (r = 0.3 m + 0.01 m skin) must stop at z ≈ −3.76.
  await walkUntil(page, 'w', ([x]) => x >= -2.6);
  const atBench = String.raw`-[123]\.\d\d, -?0\.00, -3\.(75|76|77) m`; // y may print as −0.00
  await page.keyboard.down('a');
  await page.waitForTimeout(3000);
  await expectDebug(page, 'Position', atBench);
  await page.waitForTimeout(1500); // still holding: no creeping through
  await page.keyboard.up('a');
  await expectDebug(page, 'Position', atBench);
  await expectDebug(page, 'Room', 'physics-lab  grounded');
  // Turn to face the bench (−Z) and look down a little, for a visual record of ball and bench.
  await captureAt(page, { x: 640, y: 360 });
  await page.mouse.move(640, 360);
  await page.mouse.move(640 - 628, 360 + 120, { steps: 20 });
  await expectDebug(page, 'Look', 'yaw -?[0-3]°');
  await page.screenshot({ path: 'test-results/physics-bench.png' });
  await page.evaluate(() => document.exitPointerLock());

  // The Physics wing of Phase T-1a (layoutSweep.test.ts counts it the same): its four rooms, the
  // stations on their benches, the planned benches, the teacher's furniture; + player.
  await expectDebug(page, 'Physics', 'ready · bodies 126 · colliders 160');
  for (let i = 0; i < 2; i++) {
    await jump('simlab-hub'); // room (14 slabs: its 4 doorways) + 4 doors + 34 fittings + player
    // + the teacher's capsule (Phase Y: a body and a collider for each person living in the hub).
    await expectDebug(page, 'Physics', 'ready · bodies 41 · colliders 54');
    await jump('physics-lab');
    await expectDebug(page, 'Physics', 'ready · bodies 126 · colliders 160');
  }
  await expect(debugLine(page, 'Systems')).not.toContainText('[failed]');
  expect(errors).toEqual([]);
});

// The Teacher Room (x −2.5 … 2.5, z −2.5 … 2.5) and its bathroom (x −2.5 … −0.5, z 2.75 … 4.75)
// are one scene joined by a 1 m × 2.1 m doorway in the wall between them, centred on x = −1.5.
test('teacher room: through the doorway to the bathroom, its fixtures, and back', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await newGame(page);
  const aim = new Aim(page);
  const toast = page.locator('.hud-toast');
  const wc: Vec3 = [-2.1, 0.5, 4.1]; // the toilet's front (north) face
  const sink: Vec3 = [-0.85, 0.6, 3.9]; // the sink's front (west) face

  // Into the Teacher Room through its door, as a player does.
  await aim.at([2.95, 1.05, 1]);
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', 'preparation-room/door-teacher');
  await page.keyboard.up('w');
  await walkThrough(page, {
    label: 'Go to Teacher Room',
    to: 'teacher-room',
    done: (p) => p[0] > -0.3,
  });
  await doorsClosed(page, 'teacher-room');
  await expectDebug(page, 'Entities', String.raw`35\s+interactables: 9`);
  await expectDebug(page, 'Room', 'teacher-room  grounded');

  // UX3.1: the washroom has a door, hinged on the west jamb, opening out into the Teacher Room.
  // Opened from beside it (clear of its swing), then aimed at where its leaf now stands.
  await aim.sync();
  await approach(page, aim, -0.6, 1.6, 0.2);
  await use(page, aim, [-1.3, 1.05, 2.45], 'teacher-room/door', 'Open');
  await page.waitForTimeout(1200); // its 1 s swing
  await aim.at([-2.02, 1.1, 1.92]); // the open leaf, along the west jamb
  await expectDebug(page, 'Focus', 'teacher-room/door');
  await expect(page.locator('.hud-prompt')).toContainText('Close');

  // Line up in front of the doorway, look through it, then walk in.
  await approach(page, aim, -1.5, 1.9, 0.2);
  await aim.at([-1.5, 1.2, 4.75]); // the bathroom's far wall, through the doorway
  await shot(page, 'teacher-bathroom-doorway');
  await approach(page, aim, -1.5, 3.1, 0.2);
  await expectDebug(page, 'Room', 'teacher-bathroom  grounded');
  await expect(toast.last()).toHaveText("Teacher's bathroom");
  await aim.at([-1.4, 0.6, 4.4]); // between the toilet (south-west) and the sink (east)
  await shot(page, 'teacher-bathroom');

  await use(page, aim, wc, 'teacher-bathroom/wc', 'Inspect');
  await expect(toast.last()).toHaveText("Toilet: The teacher's toilet. It cannot be used yet.");
  await use(page, aim, sink, 'teacher-bathroom/sink', 'Inspect');
  await expect(toast.last()).toHaveText(
    "Sink: The teacher's hand-wash sink. It cannot be used yet.",
  );

  // Back through the doorway; the Teacher Room's furniture still answers Inspect.
  await approach(page, aim, -1.5, 1.8, 0.2);
  await expectDebug(page, 'Room', 'teacher-room  grounded');
  await expect(toast.last()).toHaveText('Teacher Room');
  await approach(page, aim, 0, -1.2);
  await use(page, aim, [0, 0.93, -2.25], 'teacher-room/pc', 'Inspect');
  await expect(toast.last()).toHaveText(
    "Desktop computer: The teacher's desktop computer. It cannot be used yet.",
  );
  await approach(page, aim, 1, -1.4);
  await use(page, aim, [2.03, 1, -1.4], 'teacher-room/cabinet', 'Inspect');
  await expect(toast.last()).toContainText('Cabinet: A steel cabinet');
  await approach(page, aim, 1.2, -0.2);
  await use(page, aim, [1.95, 0.4, 0.8], 'teacher-room/bed', 'Inspect');
  await expect(toast.last()).toContainText('Bed: A simple single bed.');
  expect(errors).toEqual([]);
});
