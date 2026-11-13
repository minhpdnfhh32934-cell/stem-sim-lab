import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  continueFrom,
  dial,
  expectDebug,
  labSave,
  shot,
  use,
  type Vec3,
} from './support';

// Phase 6F in the real app: the free-fall station in the Physics Lab's main room, reached the way
// a returning player reaches it — Continue from a save of a player standing in the lab — and
// played with keyboard and mouse: read the board, set h, RUN, watch the drop, read t and v against
// theory and the timer's reading on the monitor, RESET, take g down to the Moon's and run again.
// No developer scene jump. Rendering is software WebGL.

const LAB = 'physics-lab';
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  tower: [1.467, 1.6, -6.85],
  instructions: [0.317, 2.425, -7.03],
  dialHeight: [2.717, 0.875, -5.9],
  dialGravity: [2.467, 0.875, -5.9],
  run: [1.867, 0.875, -5.9],
  reset: [1.367, 0.875, -5.9],
  monitor: [2.467, 1.775, -7.455],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 2.017, z: -5.35 };
const AT_BOARD = { x: 0.567, z: -5.35 };
const AT_MONITOR = { x: 2.467, z: -5.35 };

// Theory written out here, independently of the game: a release from rest at h = 2.5 m.
const fall = (g: number) => ({ t: Math.sqrt((2 * 2.5) / g), v: -Math.sqrt(2 * g * 2.5) });
const EARTH = fall(9.81);
const MOON = fall(1.62);
/** As the HUD shows a value: four significant figures, a true minus sign. */
const hud = (value: number) => Number(value.toPrecision(4)).toString().replace('-', '−');
const panelValue = (value: number) => value.toFixed(3).replace('-', '−');

/** A player in the Physics Lab, north-west of the free-fall desk, facing the tower. */
const SAVE = labSave([2.017, 0, -5.35], T.tower);

async function expectStation(page: Page, pattern: string) {
  await expectDebug(page, 'Station', `${LAB}/tower ${pattern}`);
}

test('free fall: Continue, read, set h, run, read t and v, reset, run on the Moon', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await continueFrom(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  await expectStation(page, 'configured height=1.5 gravity=9.81 resolution=0.01 step 0/5');
  await expect(page.locator('.hud-objective')).toContainText('Free fall');
  await expect(page.locator('.hud-objective')).toContainText('Read the free-fall instructions');
  await aim.at(T.tower);
  await page.waitForTimeout(400);
  await shot(page, 'free-fall-1-tower');

  // 1. Read the board on the south wall.
  await approach(page, aim, AT_BOARD.x, AT_BOARD.z);
  await use(page, aim, T.instructions, `${LAB}/instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Free fall — instructions');
  await expectStation(page, 'configured .* step 1/5');

  // 2. At the desk: h 1.5 → 2.5 m in ten clicks; the clamp and the ball go up with it.
  await approach(page, aim, AT_BOARD.x, AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await dial(page, aim, T.dialHeight, `${LAB}/dial-height`, 'e', 10);
  await expectStation(page, 'configured height=2.5 gravity=9.81 resolution=0.01 step 2/5');
  await aim.at(T.tower);
  await page.waitForTimeout(400);
  await shot(page, 'free-fall-2-setup');

  // 3. RUN: the ball drops from rest; t and v come out as the theory.
  await use(page, aim, T.run, `${LAB}/button-run`, 'RUN');
  await expectStation(
    page,
    `completed .* fall-time=${EARTH.t.toFixed(3)} impact-velocity=${EARTH.v.toFixed(3)} step 3/5`,
  );
  await expect(page.locator('.hud-toast').last()).toHaveText(
    `Free fall — t: ${hud(EARTH.t)} s · v: ${hud(EARTH.v)} m/s`,
  );
  await aim.at(T.tower);
  await page.waitForTimeout(400);
  await shot(page, 'free-fall-3-landed');

  // 4. The results monitor, then the full results (E).
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  await aim.at(T.monitor);
  await expectDebug(page, 'Focus', `${LAB}/monitor`);
  await page.waitForTimeout(400);
  await shot(page, 'free-fall-4-monitor');
  await page.keyboard.press('e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toContainText('Free fall');
  await expect(panel.locator('h2')).toContainText('(completed)');
  for (const [result, value, unit] of [
    ['fall-time', EARTH.t, 's'],
    ['impact-velocity', EARTH.v, 'm/s'],
  ] as const) {
    const row = panel.locator(`tr[data-result="${result}"]`);
    await expect(row.locator('.theory')).toHaveText(`${panelValue(value)} ${unit}`);
    await expect(row.locator('.measured')).toHaveText(`${panelValue(value)} ${unit}`);
    await expect(row.locator('.error')).toHaveText(/^(0\.00 %|< 0\.01 %)$/);
  }
  // The timer reads the run's fall time at d = 0.01 s: 0.71 s, u = d/√12, d/2.
  await expect(panel.locator('.results-main h3')).toHaveText(
    'Fall time t, read with: Timer (light gates)',
  );
  await expect(panel.locator('table.results-reading[data-reading="fall-time"] td')).toHaveText([
    `${EARTH.t.toFixed(2)} s`,
    '0.01 s',
    '0.0029 s',
    '0.005 s',
  ]);
  await expect(panel).toContainText('The mass does not enter');
  await expect(panel.locator('svg[data-graph]')).toHaveCount(3);
  await expect(panel.locator('svg[data-graph="height-time"]')).toContainText('y (m)');
  await expect(panel.locator('svg[data-graph="velocity-time"]')).toContainText('v (m/s)');
  await expect(panel.locator('svg[data-graph="acceleration-time"]')).toContainText('a (m/s²)');
  await expectStation(page, 'completed .* step 4/5');
  await shot(page, 'free-fall-5-results');

  // 5. RESET puts the ball back in the clamp; the Moon's g, RUN: a slower fall, the same law.
  await approach(page, aim, AT_DESK.x, AT_DESK.z); // looking away closes the results
  await expect(panel).toBeHidden();
  await use(page, aim, T.reset, `${LAB}/button-reset`, 'RESET');
  await expectStation(page, 'configured height=2.5 gravity=9.81 resolution=0.01 step 5/5');
  await dial(page, aim, T.dialGravity, `${LAB}/dial-gravity`, 'f', 2); // Earth → Mars → Moon
  await expectStation(page, 'configured height=2.5 gravity=1.62 ');
  await use(page, aim, T.run, `${LAB}/button-run`, 'RUN');
  await expectStation(
    page,
    `completed .* fall-time=${MOON.t.toFixed(3)} impact-velocity=${MOON.v.toFixed(3)} step 5/5`,
  );
  expect(errors).toEqual([]);
});
