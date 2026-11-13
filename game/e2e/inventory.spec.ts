import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  Aim,
  captureAt,
  continueFrom,
  doorsClosed,
  expectDebug,
  labSave,
  lookAngles,
  position,
  PROJECTILE_TARGETS as T,
  shot,
  use,
  type Vec3,
  walkThrough,
  walkToDoor,
  menuContinue,
} from './support';

// The hotbar and the inventory panel in the real app (Z2 §2.7–2.9), no developer jump: saves
// Continued through the menu, real doors. State is read from the dev panel's `Inventory:` line
// (item ids by slot, #1 = hotbar key 1), `Holding:` and the entity count; the views by their roles
// and names. SwiftShader: nothing here is a timing.

const BENCH_STAND: Vec3 = [-2.067, 0, -3.574]; // in front of the teacher's bench (Phase T-1a)
const BALL: Vec3 = [-2.067, 0.94, -4.474]; // the steel ball at rest on the bench (top 0.9 m, r 0.04 m)
const DOOR_STAND: Vec3 = [-3.95, 0, 0]; // the lab's arrival point, 1 m in front of its hub door
const CENTER = { x: 640, y: 360 };

/** The value of one developer-panel line (`Label:   value`), as shown now. */
async function line(page: Page, label: string): Promise<string> {
  const text = await page.locator('.debug-text').innerText();
  return new RegExp(`^${label}:\\s+(.*)$`, 'm').exec(text)?.[1]?.trim() ?? '';
}

/** Waits for a line to read `value` exactly (the panel's text refreshes 4 times a second). */
async function expectLine(page: Page, label: string, value: string) {
  await expect.poll(() => line(page, label), { timeout: 15_000 }).toBe(value);
}

/** Entities in the world now: one fewer for each carried item. */
async function entities(page: Page): Promise<number> {
  return Number(/^\d+/.exec(await line(page, 'Entities'))?.[0]);
}

const captured = (page: Page) => page.evaluate(() => document.pointerLockElement !== null);

/** At least `n` display frames (game frames when no frame cap is set). */
async function frames(page: Page, n: number) {
  for (let i = 0; i < n; i += 2) await afterFrame(page); // afterFrame waits two
}

test('hotbar: Q puts away and takes out, 1–9 and the wheel select; carried through real doors and a reload', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await continueFrom(page, labSave(BENCH_STAND, BALL));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(BENCH_STAND, BALL);
  const hotbar = page.getByRole('list', { name: 'Hotbar' });
  const slot = (name: string) => hotbar.getByRole('listitem', { name, exact: true });
  await expect(hotbar.getByRole('listitem')).toHaveCount(9);
  await expect(slot('Slot 1: empty')).toHaveAttribute('aria-current', 'true');
  await expectLine(page, 'Inventory', '— · selected #1');
  // Small at the bottom centre: 40 px slots at 1280×720, under the first-person hands' inner edge.
  const bar = await hotbar.boundingBox();
  expect(bar).not.toBeNull();
  expect(bar!.height).toBeLessThanOrEqual(60);
  expect(Math.abs(bar!.x + bar!.width / 2 - CENTER.x)).toBeLessThanOrEqual(1);
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(720 - 15);

  // Grab the steel ball (E); the prompt offers Q to put it away; Q does, and it leaves the world.
  await use(page, aim, BALL, 'physics-lab/steel-ball', 'Grab');
  await expectDebug(page, 'Holding', 'physics-lab/steel-ball');
  await expect(page.locator('.hud-prompt')).toContainText(/Q\s*Put away/);
  const all = await entities(page);
  await page.keyboard.press('q');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');
  await expectDebug(page, 'Holding', '—');
  await expect.poll(() => entities(page)).toBe(all - 1);
  await expect(slot('Slot 1: Steel ball')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.hotbar-label')).toHaveText(/^Steel ball\s*Q\s*Take out$/);
  await shot(page, 'inventory-1-hotbar');

  // 1–9 select a slot; the wheel steps (down = next), wrapping around, while the mouse is captured.
  expect(await captured(page)).toBe(true);
  await page.keyboard.press('3');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #3');
  await expect(slot('Slot 3: empty')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.hotbar-label')).toBeHidden(); // nothing selected to name
  await page.mouse.wheel(0, 100);
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #4');
  await page.keyboard.press('1');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');
  await page.mouse.wheel(0, -100);
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #9');
  await page.mouse.wheel(0, 100);
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');

  // Q with free hands takes the selected item out into the hands; Q again puts it back.
  await page.keyboard.press('q');
  await expectDebug(page, 'Holding', 'physics-lab/steel-ball');
  await expectLine(page, 'Inventory', '— · selected #1');
  await expect.poll(() => entities(page)).toBe(all);
  await page.keyboard.press('q');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');
  await expect.poll(() => entities(page)).toBe(all - 1);

  // Through the hub door and back: still carried, and not put back on the bench.
  await aim.at(T.labDoor);
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', 'physics-lab/door-hub');
  await page.keyboard.up('w');
  // Walked through, until the door has closed behind and the lab is gone.
  await walkThrough(page, {
    label: 'Back to SIMLAB Hub',
    to: 'simlab-hub',
    done: (p) => p[0] < 10.5, // 2.45 m past the hub's east door
  });
  await doorsClosed(page, 'simlab-hub');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');
  await expect(slot('Slot 1: Steel ball')).toBeVisible();
  await walkToDoor(page, aim, T.hubDoorPhysics, 'simlab-hub/door-physics');
  await walkThrough(page, {
    label: 'Enter Physics Lab',
    to: 'physics-lab',
    done: (p) => p[0] > -2.6,
  });
  await doorsClosed(page, 'physics-lab');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');
  await expect.poll(() => entities(page)).toBe(all - 1);

  // Saved at the door (autosave); a reload and Continue bring it back, still carried; Q takes it out.
  await page.reload();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectLine(page, 'Inventory', '#1 steel-ball×1 · selected #1');
  await expect(slot('Slot 1: Steel ball')).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => entities(page)).toBe(all - 1);
  await page.keyboard.press('q');
  await expectDebug(page, 'Holding', 'physics-lab/steel-ball');
  await expect.poll(() => entities(page)).toBe(all);
  expect(errors).toEqual([]);
});

/** A save at the lab door: three projectile balls, the steel ball and the microscope carried, two PPE items worn. */
function carryingSave() {
  const save = labSave(DOOR_STAND, [0, 1.4, 0]);
  return {
    ...save,
    player: {
      ...save.player,
      equipment: ['lab-coat', 'nitrile-gloves'],
      inventory: {
        stacks: [
          {
            slot: 0,
            item: 'projectile-ball',
            placements: [
              'projectile-range/ball-1',
              'projectile-range/ball-2',
              'projectile-range/ball-3',
            ],
          },
          { slot: 4, item: 'steel-ball', placements: ['physics-lab/steel-ball'] },
          { slot: 26, item: 'microscope', placements: ['biology-lab/microscope'] },
        ],
        selected: 0,
      },
    },
  };
}

test('inventory panel: I opens it without pausing, keys and mouse move stacks, Esc, I and a click close it', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await continueFrom(page, carryingSave());
  await expectLine(
    page,
    'Inventory',
    '#1 projectile-ball×3 · #5 steel-ball×1 · #27 microscope×1 · selected #1',
  );
  const hotbar = page.getByRole('list', { name: 'Hotbar' });
  await expect(
    hotbar.getByRole('listitem', { name: 'Slot 1: Projectile ball × 3', exact: true }),
  ).toHaveAttribute('aria-current', 'true');
  await captureAt(page, CENTER);

  // I: the panel opens and frees the mouse; the game is not paused; the camera and the player stay
  // where they are while the mouse moves and W is held.
  await page.keyboard.press('i');
  const panel = page.getByRole('dialog', { name: 'Inventory' });
  await expect(panel).toBeVisible();
  await expect.poll(() => captured(page)).toBe(false);
  await expect(page.locator('.pause')).toBeHidden();
  await expect(hotbar).toBeHidden(); // the panel has its own hotbar row
  const cell = (name: string) => panel.getByRole('gridcell', { name, exact: true });
  await expect(cell('Slot 1: Projectile ball × 3')).toBeFocused();
  await frames(page, 20); // the panel's text is new since the panel opened
  const look = await line(page, 'Look');
  const where = await position(page);
  await page.mouse.move(200, 200, { steps: 5 });
  await page.mouse.move(1000, 500, { steps: 5 });
  await page.keyboard.down('w');
  await frames(page, 60); // a second or more: walking would have moved the player over 1 m
  await page.keyboard.up('w');
  await frames(page, 20);
  await expectLine(page, 'Phase', 'playing');
  expect(await line(page, 'Look')).toBe(look);
  const now = await position(page);
  expect(Math.hypot(now[0] - where[0], now[2] - where[2])).toBeLessThan(0.02);
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(16);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720 - 16);
  // All of it shows at 1280×720, without scrolling.
  expect(await panel.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0);

  // Keyboard: Shift+Enter picks the larger half (2 of 3), → and Enter put it in slot 2: a split.
  await page.keyboard.press('Shift+Enter');
  await expect(cell('Slot 1: Projectile ball × 3')).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('.inventory-picked')).toHaveText(
    'Picked: Projectile ball × 2. Choose the slot it goes to.',
  );
  await page.keyboard.press('ArrowRight');
  await expect(cell('Slot 2: empty')).toBeFocused();
  expect(await cell('Slot 2: empty').evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
    'solid', // the focus ring
  );
  await page.keyboard.press('Enter');
  await expectLine(
    page,
    'Inventory',
    '#1 projectile-ball×1 · #2 projectile-ball×2 · #5 steel-ball×1 · #27 microscope×1 · selected #1',
  );
  // Enter picks those two, ← and Enter put them onto the one left: merged again.
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expectLine(
    page,
    'Inventory',
    '#1 projectile-ball×3 · #5 steel-ball×1 · #27 microscope×1 · selected #1',
  );

  // Mouse: a right click picks half, a click on slot 10 (the bag's first) puts it there; a click
  // picks the steel ball and a click on slot 1 swaps the two stacks.
  await cell('Slot 1: Projectile ball × 3').click({ button: 'right' });
  await cell('Slot 10: empty').click();
  await expectLine(
    page,
    'Inventory',
    '#1 projectile-ball×1 · #5 steel-ball×1 · #10 projectile-ball×2 · #27 microscope×1 · selected #1',
  );
  await cell('Slot 5: Steel ball').click();
  await cell('Slot 1: Projectile ball').click();
  await expectLine(
    page,
    'Inventory',
    '#1 steel-ball×1 · #5 projectile-ball×1 · #10 projectile-ball×2 · #27 microscope×1 · selected #1',
  );

  // Arrows move as the rows are drawn (the bag's two rows above the hotbar's), stopping at the
  // edges: from slot 1 up to the bag's lower row, right to its end (the microscope), up, down.
  await expect(cell('Slot 1: Steel ball')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(cell('Slot 19: empty')).toBeFocused();
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
  const microscope = cell('Slot 27: Microscope (decorative)');
  await expect(microscope).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(cell('Slot 18: empty')).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(cell('Slot 9: Phone')).toBeFocused(); // always carried (E-2b)
  await page.keyboard.press('ArrowUp');

  // The microscope is marked decorative, on its slot and in its details (they follow the focus).
  await expect(microscope).toBeFocused();
  await expect(microscope).toHaveAttribute('data-decorative', '');
  const details = panel.locator('.inventory-details');
  await expect(details.locator('strong')).toHaveText('Microscope');
  await expect(details).toContainText('1 in this slot, up to 1 · mass 4 kg');
  await expect(details.locator('.inventory-decorative')).toHaveText(
    'Decorative: nothing in the lab uses it.',
  );
  // Worn PPE is shown, read-only: no control to take it off or store it here.
  const worn = panel.locator('.inventory-worn');
  await expect(worn.locator('li')).toHaveText(['Lab coat', 'Nitrile gloves']);
  await expect(worn.locator('button, input')).toHaveCount(0);
  await shot(page, 'inventory-2-panel');

  // Esc closes it and does not pause; the mouse is captured again.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(hotbar).toBeVisible();
  await frames(page, 4);
  await expect(page.locator('.pause')).toBeHidden();
  await expectLine(page, 'Phase', 'playing');
  await expect.poll(() => captured(page)).toBe(true);

  // I opens it, I closes it and captures the mouse.
  await page.keyboard.press('i');
  await expect(panel).toBeVisible();
  await expect.poll(() => captured(page)).toBe(false);
  await page.keyboard.press('i');
  await expect(panel).toBeHidden();
  await expect.poll(() => captured(page)).toBe(true);

  // A click on the scene beside the panel closes it and captures the mouse.
  await page.keyboard.press('i');
  await expect(panel).toBeVisible();
  await expect.poll(() => captured(page)).toBe(false);
  await page.mouse.click(1180, 360);
  await expect(panel).toBeHidden();
  await expect.poll(() => captured(page)).toBe(true);
  await expectLine(page, 'Phase', 'playing');

  // Take out (the button) puts the focused slot's last ball in the hands and closes the panel.
  await page.keyboard.press('i');
  await expect(panel).toBeVisible();
  await cell('Slot 5: Projectile ball').focus();
  await panel.getByRole('button', { name: 'Take out' }).click();
  await expect(panel).toBeHidden();
  await expectDebug(page, 'Holding', 'projectile-range/ball-1');
  await expectLine(
    page,
    'Inventory',
    '#1 steel-ball×1 · #10 projectile-ball×2 · #27 microscope×1 · selected #1',
  );
  await expect.poll(() => captured(page)).toBe(true);
  await expect(page.locator('.hud-prompt')).toContainText(/Q\s*Put away/);
  await expect(page.locator('.hotbar-label')).toHaveText('Steel ball'); // hands full: no Take out
  expect(errors).toEqual([]);
});
