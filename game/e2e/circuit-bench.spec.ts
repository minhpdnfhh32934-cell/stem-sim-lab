import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  Aim,
  approach,
  continueFrom,
  expectDebug,
  labSave,
  lookAngles,
  shot,
  use,
  type Vec3,
  walkUntil,
} from './support';

// The circuit bench (Phase E-1) in the real app, by its own keys: from the open parts cabinet a
// lamp is taken (E), plugged into the board (E), led to the supply's posts (E, E twice), the
// supply turned up to its rated voltage on its panel (E a press per 0.5 V); the supply then shows
// the lamp's current (debug `Circuit:`), and a click on the lamp takes it off the board into the
// hands. Once from the cabinet's front row, once from its back row (Phase E audit: the cabinet's
// open box used to hide the back row from the aim).

const BOARD = 'physics-lab/circuit-trainer';
/** The board's placement: its centre on the bench top, turned π; its top face 4 cm up. */
const [BX, BY, BZ] = [0.98, 0.9 + 0.04, 6.98];
/** A point of the board's top face, from its frame (x, z) to the world. */
const board = (x: number, z: number): Vec3 => [BX - x, BY, BZ - z];
/** Hole n of its 7 × 4 grid, 12 cm apart, centred at (0.14, 0.02). */
const hole = (n: number) =>
  board(0.14 + ((n % 7) - 3) * 0.12, 0.02 + (Math.floor(n / 7) - 1.5) * 0.12);
const PLUS = board(-0.47, 0.2);
const MINUS = board(-0.36, 0.2);
const PANEL = board(-0.41, -0.065);
const STAND_BENCH: Vec3 = [1.05, 0, 6.3];

/** Where a part stands in the cabinet: its placement's centre. */
function centreOf(id: string): Vec3 {
  const rooms = JSON.parse(readFileSync('src/content/lab-placements.json', 'utf8')) as {
    room: string;
    placements: { id: string; position: Vec3 }[];
  }[];
  const p = rooms
    .find((r) => r.room === 'physics-lab')
    ?.placements.find((q) => `physics-lab/${q.id}` === id);
  if (!p) throw new Error(`no placement ${id}`);
  return [p.position[0], p.position[1] + 0.045, p.position[2]];
}

/** Aims at a point of the board and checks what E offers there, then presses it. */
async function on(page: Page, aim: Aim, point: Vec3, label: string) {
  await aim.at(point);
  await expectDebug(page, 'Focus', BOARD);
  await expect(page.locator('.hud-prompt')).toContainText(label);
  await page.keyboard.press('e');
  await afterFrame(page);
}

/**
 * From `stand` before the open cabinet, the lamp `lamp` taken, plugged in, led to the supply,
 * the supply raised to `volts`; then the supply's reading must match `reading`; the lamp taken off.
 */
async function lampOnBoard(
  page: Page,
  stand: Vec3,
  lamp: string,
  volts: number,
  reading: string,
  picture: string,
) {
  const errors = await continueFrom(
    page,
    labSave(stand, centreOf(lamp), { 'physics-lab/circuit-cabinet': { open: true } }),
  );
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(stand, centreOf(lamp));

  await use(page, aim, centreOf(lamp), lamp, 'Grab');
  await expectDebug(page, 'Holding', lamp);
  // A step back first: turned at once, the lamp held out would swing into the open door.
  await walkUntil(page, 's', (p) => p[2] < 5.95);
  await approach(page, aim, STAND_BENCH[0], STAND_BENCH[2], 0.15);
  await expectDebug(page, 'Holding', lamp);

  // Holding it, between holes 21 and 22 (the front row's first edge).
  const [a, b] = [hole(21), hole(22)];
  await on(page, aim, [(a[0] + b[0]) / 2, BY, (a[2] + b[2]) / 2], 'Plug it in here');
  await expectDebug(page, 'Holding', '—');
  await expectDebug(page, 'Circuit', '1 parts 0 leads');

  // + post → hole 21, hole 22 → − post.
  await on(page, aim, PLUS, 'Start a lead here');
  await on(page, aim, a, 'Connect the lead here');
  await on(page, aim, b, 'Start a lead here');
  await on(page, aim, MINUS, 'Connect the lead here');
  await expectDebug(page, 'Circuit', '1 parts 2 leads');

  // The supply up, one 0.5 V step a press, each read in its own frame.
  await on(page, aim, PANEL, 'Raise the supply voltage');
  for (let i = 1; i < volts / 0.5; i++) {
    await page.keyboard.press('e');
    await afterFrame(page);
  }
  await expectDebug(page, 'Circuit', `1 parts 2 leads · ${reading}`);
  await shot(page, picture);

  // A click on it takes it off, into the hands; the circuit is open again.
  await aim.at([(a[0] + b[0]) / 2, BY + 0.03, (a[2] + b[2]) / 2]); // its body
  await expect(page.locator('.hud-prompt')).toContainText('Take it off the board');
  await page.mouse.down();
  await page.mouse.up();
  await expectDebug(page, 'Holding', lamp);
  await expectDebug(page, 'Circuit', '0 parts 2 leads · \\d+\\.\\d\\d V 0\\.000 A');
  expect(errors).toEqual([]);
}

test('circuit bench: a lamp from the cabinet, plugged in, led to the supply at 6 V, taken off', async ({
  page,
}) => {
  test.setTimeout(240_000);
  // 6 V behind 10 mΩ of supply and two 20 mΩ leads on a 6 V 3 W lamp: about 0.498 A.
  await lampOnBoard(
    page,
    [-0.2, 0, 6.35],
    'physics-lab/part-lamp-6-1',
    6,
    '(5\\.99|6\\.00) V 0\\.49\\d A',
    'circuit-bench-lamp',
  );
});

test('circuit bench: a lamp from the cabinet back row, at 12 V', async ({ page }) => {
  test.setTimeout(240_000);
  // Back row, third shelf: seen past the front row from a step back. 12 V on the 12 V 6 W lamp
  // (24 Ω hot) behind 0.05 Ω: I = 12 / 24.05 ≈ 0.499 A.
  await lampOnBoard(
    page,
    [-0.1, 0, 6.2],
    'physics-lab/part-lamp-12-1',
    12,
    '(11\\.9\\d|12\\.00) V 0\\.49\\d A',
    'circuit-bench-back-row',
  );
});
