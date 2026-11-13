import { expect, type Page, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import {
  afterFrame,
  Aim,
  approach,
  expectDebug,
  handsFree,
  lookAngles,
  shot,
  use,
  type Vec3,
} from './support';

// Phase B (docs/phase-b-chemistry-contract.md): the acid–base titration by hand in the real app,
// at the Chemistry Lab's west island. The burette stood on the floor and NaOH poured into its mouth
// from above (Phú, 2026-11-03), the burette into the stand's clamp, 25 mL of HCl pipetted into the
// conical flask, phenolphthalein's drops, the flask on the tile under the tip;
// the tap opened at the stand (E), closed (E) when the run has reached the endpoint, the reading
// recorded (F). The numbers come from the debug panel: the burette's µL and the station's result.

const LAB = 'chemistry-lab';
const at = (id: string) => `${LAB}/${id}`;
const START: Vec3 = [-5.714, 0, -1.003]; // between the island's front stools
const STAND: Vec3 = [-5.714, 1.2, -1.903]; // the retort stand, at the clamped burette
const TILE: Vec3 = [-5.714, 0.918, -1.903];
/** Where the burette stands on the floor to be filled: behind the player at START, in the open. */
const FLOOR: Vec3 = [-5.714, 0, 0.147];
const MOUTH: Vec3 = [FLOOR[0], 0.6, FLOOR[2]]; // the 0.6 m burette's mouth, standing there
const T = {
  burette: [-5.014, 1.2, -1.703],
  naoh: [-6.564, 0.97, -2.373],
  pipette: [-6.274, 1.095, -1.703],
  hcl: [-6.714, 0.97, -1.853],
  flask: [-5.264, 0.97, -1.703],
  phenolphthalein: [-6.064, 0.937, -2.333],
} as const satisfies Record<string, Vec3>;
const SPOT = {
  naoh: [-5.464, 0.9, -2.153], // to the right: a bottle set down to the left sweeps the pipette rack
  pipette: [-5.264, 0.9, -2.203],
  dropper: [-6.214, 0.9, -2.103],
} as const satisfies Record<string, Vec3>;

/** The endpoint (mL) for 25 mL of the HCl, 0.1 mol/L NaOH and phenolphthalein: the model's formula. */
function endpoint(): number {
  const ca = 0.085; // the hidden c_a: the test knows it, the game shows it nowhere
  const h = 10 ** -8.2;
  const excess = h - 1e-14 / h;
  return (25 * (ca - excess)) / (0.1 + excess);
}

async function ul(page: Page, id: string): Promise<number | undefined> {
  const text = await page.locator('.debug-text').innerText();
  const m = new RegExp(`^\\s+${at(id).replace('/', '\\/')}\\s+(\\d+) µL`, 'm').exec(text);
  return m ? Number(m[1]) : undefined;
}

/** Where the player stands, to the millimetre (debug `Position mm:`). */
async function positionMm(page: Page): Promise<Vec3> {
  const text = await page.locator('.debug-text').innerText();
  const p = /Position mm:\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
  if (!p) throw new Error(`debug panel not readable:\n${text}`);
  return [Number(p[1]), Number(p[2]), Number(p[3])];
}

const hold = (page: Page, id: string | null) =>
  expectDebug(page, 'Holding', id === null ? '—' : at(id));

async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await afterFrame(page);
}

/**
 * Turns round to `yaw` with the held glass raised first (up, round, then level): low, it would sweep
 * the island's glassware.
 */
async function turnHigh(page: Page, aim: Aim, yaw: number) {
  await aim.to(aim.yaw, 0.45);
  await page.waitForTimeout(600);
  await aim.to(yaw, 0.45);
  await page.waitForTimeout(600);
}

/** Aims at `target`, E to grab, then looks a little up: the held glass clear of the bench. */
async function take(page: Page, aim: Aim, target: Vec3, id: string) {
  await use(page, aim, target, at(id), 'Grab');
  await hold(page, id);
  await aim.to(aim.yaw, -0.2);
  await page.waitForTimeout(800);
}

async function setDown(page: Page, aim: Aim, spot: Vec3) {
  await handsFree(page); // after an action acted out (a delivery, drops)
  await aim.at(spot);
  await expect(page.locator('.hud-prompt')).toContainText('Set down');
  await press(page, 'e');
  await hold(page, null);
  await page.waitForTimeout(1500);
}

test('titration by hand: fill on the floor, clamp, pipette, indicator, tile, tap to the endpoint, record', async ({
  page,
}) => {
  test.setTimeout(480_000);
  const errors = await continueInto(page, sceneSave(LAB, START, T.burette));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(START, T.burette);

  // 1. The burette stood upright on the floor behind the player (turning round with it held clear
  // of the stools: they stand lower than the hold).
  await take(page, aim, T.burette, 'burette');
  await turnHigh(page, aim, Math.PI);
  await setDown(page, aim, FLOOR);

  // 2. NaOH into its mouth, as a player pours (Phú, 2026-11-04): from about half a metre, looking
  // at the mouth, R held — the hand reaches the lip over it (the pour assist) and the player leans
  // in; no aiming to the centimetre. The stream falls into the mouth.
  await take(page, aim, T.naoh, 'naoh-01');
  await turnHigh(page, aim, Math.PI);
  await aim.at(MOUTH);
  await page.waitForTimeout(600);
  // Facing the burette, short taps forward or back until it is 0.4–0.65 m away (feet to mouth).
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(350);
    const [x, , z] = await positionMm(page);
    const d = Math.hypot(MOUTH[0] - x, MOUTH[2] - z);
    if (d >= 0.4 && d <= 0.65) break;
    const key = d > 0.65 ? 'w' : 's';
    await page.keyboard.down(key);
    await page.waitForTimeout(45);
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(400);
  await aim.at(MOUTH);
  await page.waitForTimeout(800);
  // R held. A press that lands as the mouse is captured again after the aim can be missed (seen:
  // the bottle held upright over the mouth, nothing poured): pressed again if nothing flows.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.down('r');
    const flowing = await expect
      .poll(() => ul(page, 'burette'), { timeout: 5_000 })
      .toBeGreaterThan(0)
      .then(() => true)
      .catch(() => false);
    if (flowing) break;
    await page.keyboard.up('r');
    await afterFrame(page);
  }
  await expect.poll(() => ul(page, 'burette'), { timeout: 40_000 }).toBe(50_000);
  await page.keyboard.up('r');
  await afterFrame(page);
  await shot(page, 'titration-1-burette-filled');
  await turnHigh(page, aim, 0);
  await approach(page, aim, START[0], START[2], 0.3);
  await setDown(page, aim, SPOT.naoh);

  // The filled burette up again and into the clamp (the clamp's one height: the tip over the tile).
  await take(page, aim, [FLOOR[0], 0.3, FLOOR[2]], 'burette');
  await turnHigh(page, aim, 0);
  await aim.at(STAND);
  await expectDebug(page, 'Focus', at('titration'));
  await expect(page.locator('.hud-prompt')).toContainText('Clamp the');
  await press(page, 'e');
  await hold(page, null);

  // 3. 25 mL of HCl into the flask; the indicator's drops.
  await take(page, aim, T.pipette, 'titration-pipette-25');
  await use(page, aim, T.hcl, at('hcl'), 'Fill the');
  await use(page, aim, T.flask, at('conical-flask'), 'Deliver into');
  await expect.poll(() => ul(page, 'conical-flask')).toBe(25_000);
  await setDown(page, aim, SPOT.pipette);
  await take(page, aim, T.phenolphthalein, 'phenolphthalein');
  await use(page, aim, T.flask, at('conical-flask'), 'Add 3 drops');
  await expect.poll(() => ul(page, 'conical-flask')).toBe(25_150);
  await setDown(page, aim, SPOT.dropper);

  // 4. The flask on the tile under the tip.
  await take(page, aim, T.flask, 'conical-flask');
  await setDown(page, aim, TILE);
  await shot(page, 'titration-2-ready');

  // 5. The tap: open at the stand, closed once the run has reached the endpoint, F records.
  const end = endpoint();
  await use(page, aim, STAND, at('titration'), 'Open the tap');
  await expect
    .poll(async () => 50_000 - ((await ul(page, 'burette')) ?? 50_000), {
      timeout: 200_000,
      intervals: [100],
    })
    .toBeGreaterThanOrEqual(Math.ceil(end * 1000));
  await press(page, 'e'); // close the tap
  await expect(page.locator('.hud-prompt')).toContainText('Record the reading');
  await shot(page, 'titration-3-endpoint');
  await press(page, 'f');
  await expectDebug(page, 'Station', `${at('titration')} completed`);
  const text = await page.locator('.debug-text').innerText();
  const vEnd = Number(/endpoint-volume=([\d.]+)/.exec(text)?.[1]);
  expect(vEnd).toBeGreaterThanOrEqual(end - 1e-3);
  expect(vEnd - end).toBeLessThan(0.15); // closed within a few tenths of a second, as a player does
  await shot(page, 'titration-4-recorded');
  expect(errors).toEqual([]);
});
