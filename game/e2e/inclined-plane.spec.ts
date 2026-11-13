import { expect, type Page, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, dial, expectDebug, openResults, shot, use, type Vec3 } from './support';

// The inclined plane on the Physics Lab's south island (Phase T-1a), in the real app: found in the catalog,
// reached by Continue from a save of a player standing in the range (no developer jump), played
// with keyboard and mouse: read the board, dry steel on steel held at 30° (below arctan μs), then
// RESET and 45°: it slides to the gate; a, t and v on the monitor against Newton's second law
// written out here, the run marked in the catalog.

const ROOM = 'physics-lab';
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  instructions: [11.8, 2.425, 2.612],
  ramp: [10.2, 1.3, 2.632],
  dialAngle: [11, 0.875, 1.682],
  dialSurface: [10.8, 0.875, 1.682],
  run: [10.15, 0.875, 1.682],
  reset: [9.65, 0.875, 1.682],
  monitor: [8.4, 1.725, 2.927], // beside the bench, clear of the ramp (Phase T-1a)
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 10.2, z: 1.132 };
const AT_MONITOR = { x: 8.4, z: 1.132 };

// Dry steel on steel (Serway & Jewett, Table 5.1: μs 0.74, μk 0.57) at 45°, L = 1 m, from rest.
const DEG = Math.PI / 180;
const A = 9.81 * (Math.sin(45 * DEG) - 0.57 * Math.cos(45 * DEG)); // 2.983 m/s²
const TIME = Math.sqrt(2 / A);
const SPEED = Math.sqrt(2 * A);

/** A player in the range in front of the inclined-plane board, looking at it. */
const SAVE = sceneSave('physics-lab', [11.05, 0, 1.132], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${ROOM}/incline ${pattern}`),
    { timeout },
  );
}

test('inclined plane: Continue, read, steel held at 30°, slides at 45°, a, t and v', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="inclined-plane"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Physics Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', ROOM);
  await expectStation(page, 'configured angle=30 surface=3 mass=0.5 length=1 step 0/6');
  await expect(page.locator('.hud-objective')).toContainText('inclined plane');

  // 1. Read the board; round the desk's west end to its front; dry steel on steel.
  await use(page, aim, T.instructions, `${ROOM}/incline-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Inclined plane — instructions');
  await approach(page, aim, 13.7, AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await dial(page, aim, T.dialSurface, `${ROOM}/incline-dial-surface`, 'e', 1);
  await expectStation(page, 'configured angle=30 surface=4 mass=0.5 length=1 step 2/6');

  // 2. At 30°, tan θ = 0.58 < μs: RUN ends at once, the block held at the stop.
  await use(page, aim, T.run, `${ROOM}/incline-run`, 'RUN');
  await expectStation(page, 'completed angle=30 .* slides=0.000 .* distance=0.000 ');
  await use(page, aim, T.reset, `${ROOM}/incline-reset`, 'RESET');

  // 3. At 45° it slides to the gate: a = g(sin θ − μk·cos θ), t = √(2L/a), v = √(2aL).
  await dial(page, aim, T.dialAngle, `${ROOM}/incline-dial-angle`, 'e', 1);
  await expectStation(page, 'configured angle=45 surface=4 mass=0.5 length=1 step 4/6');
  await use(page, aim, T.run, `${ROOM}/incline-run`, 'RUN');
  await expectStation(
    page,
    `completed .* acceleration=${A.toFixed(3)} travelTime=${TIME.toFixed(3)} finalSpeed=${SPEED.toFixed(3)} slides=1.000 `,
    60_000,
  );
  await aim.at(T.ramp);
  await page.waitForTimeout(400);
  await shot(page, 'inclined-plane-1-slid');

  // 4. The monitor, east of the bench: a and t beside the theory, the class beside the number.
  await approach(page, aim, AT_MONITOR.x, AT_DESK.z);
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  const panel = await openResults(page, aim, T.monitor, `${ROOM}/incline-monitor`);
  await expect(panel.locator('h2')).toContainText('inclined plane');
  await expect(panel.locator('h2')).toContainText('run 2 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('slides').locator('.measured')).toContainText('Slides');
  await expect(result('acceleration').locator('.theory')).toHaveText(`${A.toFixed(3)} m/s²`);
  await expect(result('acceleration').locator('.measured')).toHaveText(`${A.toFixed(3)} m/s²`);
  await expect(result('travelTime').locator('.theory')).toHaveText(`${TIME.toFixed(3)} s`);
  await expect(result('travelTime').locator('.measured')).toHaveText(`${TIME.toFixed(3)} s`);
  await expect(panel.locator('svg[data-graph="energy-distance"]')).toBeVisible();
  await expectStation(page, 'completed .* step 6/6');
  await shot(page, 'inclined-plane-2-results');

  // 5. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
