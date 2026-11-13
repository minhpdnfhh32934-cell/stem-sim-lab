import { expect, type Page, test } from '@playwright/test';
import { holdReach } from '../src/gameplay/interaction/hold';
import { continueInto, sceneSave } from './saves';
import {
  Aim,
  afterFrame,
  approach,
  EYE_HEIGHT,
  expectDebug,
  handsFree,
  lookAngles,
  position,
  shot,
  use,
  type Vec3,
  walkUntil,
} from './support';

// The dilution slice of the physical lab, played by hand in the real app (docs/physical-lab-
// architecture.md §3.3, §4.3): Continue from a save of a player in the Chemistry Lab (no developer
// jump), walk to the reagent cabinet and open it, take the 20 µmol/L stock bottle, the 50 mL flask,
// the 5 mL pipette and the wash bottle out one at a time, set the bottle down on the bench, stand
// the flask on the white tile, fill the pipette from the bottle and deliver it into the flask, hold
// the wash bottle's nozzle over the flask's neck and squeeze until the mark (the driven run), put
// the stopper in, turn the flask over, take the stopper out, tilt a sample into the colorimeter's
// cuvette, read C₂ on the results monitor, and Clear the bench. Volumes are read from the debug
// panel's Containers block (µL, never a concentration); C₂ from the results panel. NOT RUN by its
// author (one e2e at a time, docs/agents/README.md): written against the Game-level test
// src/game/dilutionSlice.test.ts, which plays the same steps with the same aiming arithmetic.
//
// Aiming. The hold point is `holdReach` along the view from the eye (an arm's reach, further as
// the player stoops to look down: src/gameplay/interaction/hold.ts), so a nozzle (or a tipped
// flask's lip) is put over a mouth by the view alone: the horizontal range to the mouth fixes the
// pitch. The player is pressed against the bench front (z −4.09: its edge −4.4 + capsule 0.3 +
// skin 0.01), so the range to the tile (0.59 m) and to the cuvette (0.65 m) is known.
// SwiftShader numbers say nothing about a GPU, and "exact deltas" say nothing about how hard a
// 5 mm mouth is for a person (the capture radius is a provisional AFFORDANCE).

const LAB = 'chemistry-lab';
const at = (id: string) => `${LAB}/${id}`;
const HOLD = 0.45; // config player.holdDistance, m
const HOLD_PITCH = 0.87; // HOLD_PITCH_LIMIT (src/gameplay/interaction/hold.ts): the lowest hold
const STAND: Vec3 = [3.286, 0, -9.5]; // in front of the cabinet, clear of its open doors
const BENCH_Z = -6.869; // pressed against the bench front

// Centres of what the player looks at (item centre: placement base + half its height).
const T = {
  cabinet: [3.286, 1, -10.5], // the doors' face
  stock20: [3.286, 0.611, -10.71],
  flask50: [3.146, 1.039, -10.71],
  pipette5: [3.386, 1.589, -10.71],
  wash: [3.736, 0.636, -10.71],
  monitor: [-0.6, 1.475, -10.955],
  clear: [0.62, 0.925, -7.279],
  benchFront: [0.2, 0.45, -7.179], // a vertical face: nothing to set a glass down on
} satisfies Record<string, Vec3>;
// Where things are set down (on the bench top, y 0.9) and what stands there after.
const SPOT = {
  bottle: [0.15, 0.9, -7.429],
  pipette: [0.4, 0.9, -7.379],
  wash: [-0.1, 0.9, -7.379],
} satisfies Record<string, Vec3>;
const TILE: Vec3 = [-0.6, 0.906, -7.459]; // the seat's centre: the flask's base stands here
const FLASK_AT: Vec3 = [TILE[0], TILE[1] + 0.0563, TILE[2]]; // its centre (the 50 mL flask is 0.1126 m)
const FLASK_MOUTH: Vec3 = [TILE[0], TILE[1] + 0.1126, TILE[2]];
const CUVETTE: Vec3 = [-0.33, 1.029, -7.519]; // the cuvette's mouth
const FLASK_HALF = 0.0563;
const TILT = (115 * Math.PI) / 180; // the flask's full tilt

const C1 = 20e-6; // mol/L, the 20 µmol/L stock
const V1 = 5; // mL, the 5 mL pipette
const V2 = 50; // mL, the 50 mL flask
const C2 = (C1 * V1) / V2;
const D = 1e-7; // mol/L, the colorimeter's default resolution (the dial is left alone)

// ---- state, read from the debug panel ---------------------------------------------------------

/** Every container's volume (µL) listed in the Containers block (the held and focused first). */
async function containers(page: Page): Promise<Record<string, number>> {
  const text = await page.locator('.debug-text').innerText();
  return Object.fromEntries(
    [...text.matchAll(/^\s+(chemistry-lab\/\S+)\s+(\d+) µL/gm)].map((m) => [m[1]!, Number(m[2])]),
  );
}

async function ul(page: Page, id: string): Promise<number | undefined> {
  return (await containers(page))[at(id)];
}

async function expectUl(page: Page, id: string, volume: number) {
  await expect.poll(() => ul(page, id), { timeout: 20_000 }).toBe(volume);
}

/** The flask's line in Containers, flags included (`closed`, `mixed`). */
async function flaskLine(page: Page): Promise<string> {
  const text = await page.locator('.debug-text').innerText();
  return /^\s+chemistry-lab\/flask-50\s.*$/m.exec(text)?.[0] ?? '';
}

const hold = (page: Page, id: string | null) =>
  expectDebug(page, 'Holding', id === null ? '—' : at(id));

/** Presses a key and waits for the game to read it (a pause drops a press no frame has read). */
async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await afterFrame(page);
}

// ---- walking ----------------------------------------------------------------------------------

/** Stands in front of the cabinet (behind the bench, on the north wall: round the bench's east end). */
async function atCabinet(page: Page, aim: Aim) {
  await approach(page, aim, 1.6, -6.579);
  await approach(page, aim, STAND[0], STAND[2]);
}

/** Moves along the bench front, facing north, until within `within` of x (short closed-loop taps). */
async function strafeTo(page: Page, aim: Aim, x: number, within = 0.12) {
  await aim.to(0, 0);
  for (let i = 0; i < 30; i++) {
    const error = x - (await position(page))[0];
    if (Math.abs(error) < within) return;
    const key = error > 0 ? 'd' : 'a';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(110, Math.max(40, Math.abs(error) * 250)));
    await page.keyboard.up(key);
    await page.waitForTimeout(350); // the 4 Hz panel
  }
}

/**
 * Turns from the cabinet to face south with the glass held low and close, a step back first: the
 * open doors stand 0.6 m out from the cabinet, and a held glass swung through a leaf is let go there.
 */
async function leaveCabinet(page: Page, aim: Aim) {
  await aim.to(aim.yaw, -HOLD_PITCH);
  await walkUntil(page, 's', (p) => p[2] >= STAND[2] + 0.4);
  await aim.to(Math.PI, -HOLD_PITCH);
  await page.waitForTimeout(800); // the glass follows
}

/** Walks to the bench front near x and stands pressed against it, facing north. */
async function atBench(page: Page, aim: Aim, x: number, within?: number) {
  // From the cabinet (behind the bench), round its east end; from the bench front, straight along it.
  if ((await position(page))[2] < -8.079) {
    await leaveCabinet(page, aim);
    await approach(page, aim, 1.6, -6.579);
  }
  await approach(page, aim, x, -6.579);
  await aim.to(0, 0);
  await walkUntil(page, 'w', (p) => p[2] <= BENCH_Z + 0.005);
  await strafeTo(page, aim, x, within);
  await page.waitForTimeout(400);
}

/** Takes an item out of the open cabinet: walk to it, look at it, E. */
async function take(page: Page, aim: Aim, target: Vec3, id: string) {
  await atCabinet(page, aim);
  await use(page, aim, target, at(id), 'Grab');
  await hold(page, id);
}

/** Aims at a bench spot and sets the held glass down there (E). */
async function setDown(page: Page, aim: Aim, spot: Vec3) {
  await handsFree(page); // after an action acted out (a delivery, drops)
  await aim.at(spot);
  await expect(page.locator('.hud-prompt')).toContainText('Set down');
  await press(page, 'e');
  await hold(page, null);
  await page.waitForTimeout(1500); // physics drives it to rest
}

/** Where the player stands, to the millimetre (debug `Position mm:`): the capture radius is 15 mm. */
async function positionMm(page: Page): Promise<Vec3> {
  const text = await page.locator('.debug-text').innerText();
  const p = /Position mm:\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
  if (!p) throw new Error(`debug panel not readable:\n${text}`);
  return [Number(p[1]), Number(p[2]), Number(p[3])];
}

/**
 * Puts the held item's spout over `target` by the view alone, where the player stands: `reach` is
 * how far the spout is in front of the held centre, `up` its height above it (both after any tilt).
 * Looking down (0.3–0.78 rad) the hold's horizontal range grows with the pitch, so the range to
 * the target fixes it (bisection). Returns the spout's height above the target (m).
 */
async function aimOver(page: Page, aim: Aim, target: Vec3, reach: number, up: number) {
  await page.waitForTimeout(400); // the 4 Hz panel shows where he stands
  const [px, , pz] = await positionMm(page);
  const range = Math.hypot(target[0] - px, target[2] - pz) - reach;
  const ahead = (p: number) => holdReach(p, HOLD) * Math.cos(p);
  let [steep, level] = [-0.78, -0.3];
  if (range < ahead(level) || range > ahead(steep)) throw new Error(`out of the hold: ${range} m`);
  for (let i = 0; i < 40; i++) {
    const mid = (steep + level) / 2;
    if (ahead(mid) > range) steep = mid;
    else level = mid;
  }
  const pitch = (steep + level) / 2;
  await aim.to(Math.atan2(-(target[0] - px), -(target[2] - pz)), pitch);
  await page.waitForTimeout(1500); // the held glass follows to its new hold point
  return EYE_HEIGHT + holdReach(pitch, HOLD) * Math.sin(pitch) + up - target[1];
}

// ---- the dilution -----------------------------------------------------------------------------

test('dilution by hand: cabinet, bottle, flask on the tile, pipette, water to the mark, stopper, turn over, sample, C₂, Clear the bench', async ({
  page,
}) => {
  test.setTimeout(480_000);
  const errors = await continueInto(page, sceneSave(LAB, STAND, T.cabinet));
  // The save's view is exact: track it from there, not from the panel's whole degrees.
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(STAND, T.cabinet);
  await expectDebug(page, 'Room', LAB);
  await expect(page.locator('.hud-objective')).toContainText('Dilution');
  await expectUl(page, 'stock-20', 150_000); // polled: the 4 Hz panel may not show it yet
  await expectUl(page, 'wash-bottle', 500_000);

  // 1. The cabinet: E opens it; the doors swing (0.5 s) and the glass behind them can be aimed at.
  await use(page, aim, T.cabinet, at('reagent-cabinet'), 'Open');
  await aim.at(T.stock20);
  await expectDebug(page, 'Focus', at('stock-20'));
  await expect(page.locator('.hud-prompt')).toContainText('Grab');
  await shot(page, 'physical-lab-1-cabinet-open');

  // 2. The stock bottle onto the bench.
  await press(page, 'e');
  await hold(page, 'stock-20');
  await atBench(page, aim, -0.45);
  // One wrong set-down first: the bench's front face is not a surface to stand a bottle on.
  await aim.at(T.benchFront);
  await press(page, 'e');
  await expect(
    page.locator('.hud-toast', { hasText: 'That surface is not level.' }).first(),
  ).toBeVisible();
  await hold(page, 'stock-20');
  await setDown(page, aim, SPOT.bottle);

  // 3. The flask onto the white tile.
  await take(page, aim, T.flask50, 'flask-50');
  await atBench(page, aim, -0.45);
  await hold(page, 'flask-50');
  await aim.at(TILE);
  await expect(page.locator('.hud-prompt')).toContainText('Set down');
  await press(page, 'e');
  await hold(page, null);
  await aim.at(FLASK_AT);
  await expectDebug(page, 'Focus', at('flask-50'));
  await expect
    .poll(async () => {
      const text = await page.locator('.debug-text').innerText();
      const m = /chemistry-lab\/flask-50\s+(-?[\d.]+), (-?[\d.]+), (-?[\d.]+) m/.exec(text);
      return m ? Math.hypot(Number(m[1]) - TILE[0], Number(m[3]) - TILE[2]) : Infinity;
    })
    .toBeLessThan(0.01); // on the tile, within a centimetre of its centre

  // 4. The pipette: fill it to its mark from the bottle (-5 mL), deliver it into the flask (+5 mL).
  await take(page, aim, T.pipette5, 'pipette-5');
  await atBench(page, aim, -0.45);
  await aim.at([SPOT.bottle[0], 0.97, SPOT.bottle[2]]);
  await expectDebug(page, 'Focus', at('stock-20'));
  await expect(page.locator('.hud-prompt')).toContainText('to the mark');
  await press(page, 'e');
  await expectUl(page, 'stock-20', 145_000);
  await expectUl(page, 'pipette-5', 5000);
  await aim.at(FLASK_AT);
  await expectDebug(page, 'Focus', at('flask-50'));
  await expect(page.locator('.hud-prompt')).toContainText('Deliver into');
  await press(page, 'e');
  await expectUl(page, 'pipette-5', 0);
  await expectUl(page, 'flask-50', 5000);
  await setDown(page, aim, SPOT.pipette);

  // 5. The wash bottle: the nozzle over the flask's neck, squeeze (R held). The first drop starts
  // the run; letting go pauses it, however long; at the mark it stops and the run completes.
  await take(page, aim, T.wash, 'wash-bottle');
  await atBench(page, aim, TILE[0]);
  // The nozzle's tip (items.json `pour.spout` [0, 0.075, −0.034]): held ahead of the view.
  const gap = await aimOver(page, aim, FLASK_MOUTH, 0.034, 0.075);
  expect(gap, 'nozzle above the lip').toBeGreaterThan(0.2);
  expect(gap).toBeLessThan(0.5);
  await shot(page, 'physical-lab-2-nozzle');
  await page.keyboard.down('r');
  await expect
    .poll(async () => (await ul(page, 'flask-50')) ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(12_000);
  await page.keyboard.up('r');
  await page.waitForTimeout(800); // the game reads the key-up, and the panel catches up
  await expectDebug(page, 'Experiment', String.raw`\S+ dilution running`);
  const midway = (await ul(page, 'flask-50'))!;
  expect((await ul(page, 'wash-bottle'))! + midway).toBe(505_000); // every µL accounted for
  await page.waitForTimeout(2500); // a pause neither ends the run nor moves a drop
  expect(await ul(page, 'flask-50')).toBe(midway);
  await expectDebug(page, 'Experiment', String.raw`\S+ dilution running`);
  await page.keyboard.down('r');
  await expectUl(page, 'flask-50', 50_000);
  await expect(
    page.locator('.hud-toast', { hasText: 'It is full to the mark.' }).first(),
  ).toBeVisible();
  await page.keyboard.up('r');
  await expectUl(page, 'wash-bottle', 455_000);
  await expectDebug(page, 'Experiment', String.raw`\S+ dilution completed \(model\)`);
  await shot(page, 'physical-lab-3-mark');
  await setDown(page, aim, SPOT.wash);

  // 6. Stopper (F), turn it over (R held while it is stoppered), set it down, stopper out (F).
  await aim.at(FLASK_AT);
  await expectDebug(page, 'Focus', at('flask-50'));
  await expect(page.locator('.hud-prompt')).toContainText('Put the stopper in');
  await press(page, 'f');
  await expect.poll(() => flaskLine(page)).toContain('closed');
  await handsFree(page); // the stopper put in (acted out)
  await press(page, 'e'); // pick it up
  await hold(page, 'flask-50');
  for (let attempt = 0; attempt < 6 && !(await flaskLine(page)).includes('mixed'); attempt++) {
    await page.keyboard.down('r'); // closed, it turns over (to 165°) instead of pouring
    await page.waitForTimeout(1600);
    await page.keyboard.up('r');
    await page.waitForTimeout(1600); // and comes back upright: one inversion
  }
  expect(await flaskLine(page)).toContain('mixed');
  expect(await ul(page, 'flask-50')).toBe(50_000);
  await atBench(page, aim, TILE[0]);
  await aim.at(TILE);
  await press(page, 'e');
  await hold(page, null);
  await page.waitForTimeout(1500);
  await aim.at(FLASK_AT);
  await expectDebug(page, 'Focus', at('flask-50'));
  await expect(page.locator('.hud-prompt')).toContainText('Take the stopper out');
  await press(page, 'f');
  await expect.poll(() => flaskLine(page)).not.toContain('closed');

  // 7. A sample into the cuvette: the unstoppered flask in hand, tilted over it (R held), its lip
  // (the spout) put over the cuvette's mouth by the view.
  await handsFree(page); // the stopper taken out (acted out)
  await press(page, 'e');
  await hold(page, 'flask-50');
  // Straight in front of it (as src/game/dilutionSlice.test.ts pours it), pressed against the
  // bench: 0.65 m away, in the hold's range looking down. The 15 mm capture radius is provisional.
  await strafeTo(page, aim, CUVETTE[0], 0.05); // along the bench from the tile, facing it
  await hold(page, 'flask-50'); // carried along the bench
  const lip = await aimOver(
    page,
    aim,
    CUVETTE,
    FLASK_HALF * Math.sin(TILT),
    FLASK_HALF * Math.cos(TILT),
  );
  expect(lip, 'lip above the cuvette').toBeGreaterThan(0.08);
  await hold(page, 'flask-50'); // still in hand, over the cuvette
  await shot(page, 'physical-lab-4-over-cuvette');
  expect(lip).toBeLessThan(0.5);
  await page.keyboard.down('r');
  await expect
    .poll(async () => (await ul(page, 'dilution')) ?? 0, { timeout: 60_000 })
    .toBeGreaterThan(0);
  await page.keyboard.up('r');
  await page.waitForTimeout(1500);
  const sample = (await ul(page, 'dilution'))!;
  expect(sample).toBeLessThanOrEqual(2700);
  expect((await ul(page, 'flask-50'))! + sample).toBe(50_000);
  await shot(page, 'physical-lab-4-sample');
  await aim.to(0, 0);
  await aim.at(TILE);
  await press(page, 'e');
  await hold(page, null);
  await page.waitForTimeout(1500);

  // 8. The reading: C₂ on the results monitor, behind the bench (round its west end).
  await approach(page, aim, -1.5, -6.679);
  await approach(page, aim, -1.5, -8.579);
  await approach(page, aim, -0.6, -9.184);
  await aim.at(T.monitor);
  await expectDebug(page, 'Focus', at('dilution-monitor'));
  await press(page, 'e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  // C₂ = C₁·V₁/V₂ = 2.0 µmol/L: the run's value and the theory as the panel prints them, and the
  // colorimeter's reading at d = 0.1 µmol/L within d/2 of it.
  const shown = C2.toFixed(7); // 0.0000020
  const row = panel.locator('tr[data-result="finalConcentration"]');
  await expect(row.locator('.measured')).toHaveText(`${shown} mol/L`);
  await expect(row.locator('.theory')).toHaveText(`${shown} mol/L`);
  const reading = panel
    .locator('table.results-reading[data-reading="finalConcentration"] td')
    .first();
  await expect(reading).toHaveText(`${shown} mol/L`);
  const read = Number((await reading.innerText()).split(' ')[0]);
  expect(Math.abs(read - C2)).toBeLessThanOrEqual(D / 2 + 1e-12);
  await shot(page, 'physical-lab-5-reading');

  // 9. Clear the bench: everything back in its place, full again, the run and the setup gone.
  await approach(page, aim, -1.5, -8.579); // back round the bench's west end
  await approach(page, aim, -1.5, -6.679);
  await atBench(page, aim, 0.5); // walking away closes the results
  await expect(panel).toBeHidden();
  await aim.at(T.clear);
  await expectDebug(page, 'Focus', at('dilution-clear'));
  await expect(page.locator('.hud-prompt')).toContainText('Clear the bench');
  await press(page, 'e');
  await expectUl(page, 'stock-20', 150_000);
  await expectUl(page, 'wash-bottle', 500_000);
  await expectUl(page, 'flask-50', 0);
  await expectUl(page, 'pipette-5', 0);
  await expectUl(page, 'dilution', 0);
  await hold(page, null);

  expect(errors).toEqual([]);
});
