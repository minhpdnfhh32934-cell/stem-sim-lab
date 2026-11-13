import { expect, type Page, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, dial, expectDebug, openResults, shot, use, type Vec3 } from './support';

// The Ohm's law station on the Physics Lab's south wall (Phase T-1a), in the real app: found in the
// catalog, reached by Continue from a save of a player standing in the range (no developer jump),
// played with keyboard and mouse: read the board, 100 Ω ∥ 220 Ω at 12 V, RUN, U, I and U/I on the
// monitor against Ohm's and Kirchhoff's laws written out here, the run marked in the catalog.

const ROOM = 'physics-lab';
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  instructions: [3.583, 2.425, 7.03],
  board: [2.733, 1, 7.1],
  dialConfiguration: [3.533, 0.875, 6.15],
  dialVoltage: [2.933, 0.875, 6.15],
  run: [2.683, 0.875, 6.15],
  monitor: [2.283, 1.775, 7.45],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 2.733, z: 5.6 };

// R1 ∥ R2 and I = U/R, written out here: 12 V across 100 Ω and 220 Ω in parallel.
const R = 1 / (1 / 100 + 1 / 220); // 68.75 Ω
const I = 12 / R;

/** A player in the range in front of the Ohm's law board, looking at it. */
const SAVE = sceneSave('physics-lab', [3.583, 0, 5.6], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${ROOM}/circuit ${pattern}`),
    { timeout },
  );
}

test("ohm's law: Continue, read, parallel at 12 V, RUN, U/I against R1·R2/(R1 + R2)", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="ohms-law"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Physics Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', ROOM);
  await expectStation(
    page,
    'configured voltage=6 resistance1=100 resistance2=220 configuration=1 step 0/6',
  );
  await expect(page.locator('.hud-objective')).toContainText("Ohm's law");

  // 1. Read the board, then at the desk: the circuit to parallel, U 6 → 12 V.
  await use(page, aim, T.instructions, `${ROOM}/ohm-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText("Ohm's law — instructions");
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await dial(page, aim, T.dialConfiguration, `${ROOM}/ohm-dial-configuration`, 'e', 1);
  await dial(page, aim, T.dialVoltage, `${ROOM}/ohm-dial-voltage`, 'e', 1);
  await expectStation(
    page,
    'configured voltage=12 resistance1=100 resistance2=220 configuration=2 step 3/6',
  );

  // 2. RUN: the switch closes at 0.5 s, the run ends at 3 s with I = U/R.
  await use(page, aim, T.run, `${ROOM}/ohm-run`, 'RUN');
  await expectStation(
    page,
    `completed .* networkVoltage=12.000 current=${I.toFixed(3)} resistance=${R.toFixed(3)} .* step 4/6`,
    60_000,
  );
  await aim.at(T.board);
  await page.waitForTimeout(400);
  await shot(page, 'ohms-law-1-closed');

  // 3. The monitor: U, I and U/I, theory beside the run.
  const panel = await openResults(page, aim, T.monitor, `${ROOM}/ohm-monitor`);
  await expect(panel.locator('h2')).toContainText("Ohm's law");
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('networkVoltage').locator('.measured')).toHaveText('12.000 V');
  await expect(result('current').locator('.theory')).toHaveText(`${I.toFixed(3)} A`);
  await expect(result('current').locator('.measured')).toHaveText(`${I.toFixed(3)} A`);
  await expect(result('resistance').locator('.theory')).toHaveText(`${R.toFixed(3)} Ω`);
  await expect(result('resistance').locator('.measured')).toHaveText(`${R.toFixed(3)} Ω`);
  await expect(panel.locator('svg[data-graph="current-time"]')).toBeVisible();
  await expectStation(page, 'completed .* step 5/6');
  await shot(page, 'ohms-law-2-results');

  // 4. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
