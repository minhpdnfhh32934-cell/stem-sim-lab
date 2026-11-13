import { expect, type Page, test } from '@playwright/test';
import { openNotebookResults, pick, piece } from './bio-workspace';
import { bar, exitWorkspace, openWorkspace, workspace } from './chem-workspace';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, position, shot, use, type Vec3 } from './support';

// The photosynthesis station on the Biology Lab's lab bench, in the real app: found in the catalog,
// reached by Continue from a save of a player standing in the lab (no developer jump), played with
// keyboard and mouse: read the board, walk up to the pondweed, E opens the workspace, the lamp at
// 0.2 m and the bath at 30 °C are picked on the bench, "Start" collects for a minute, the gas
// column in the capillary grows, the oxygen collected and the limiting factor against the
// light-response curve written out here, Exit puts the player where they stood, the run marked in
// the catalog.

const LAB = 'biology-lab';
const PLANT = `${LAB}/photosynthesis`;
// Interaction targets (centres of the faces the player looks at) and where the player stands. The
// board hangs on the north wall behind the bench; the desk and the wall monitor are gone.
const T = {
  instructions: [-9.286, 1.375, -7.45],
  plant: [-8.726, 1.13, -3.421],
} satisfies Record<string, Vec3>;
const AT_BOARD = { x: -9.386, z: -5.521 };
// Round the bench's west end to the front of the apparatus (the bench is between the two).
const NORTH_WEST_OF_BENCH = { x: -10.786, z: -5.521 };
const WEST_OF_BENCH = { x: -10.786, z: -2.321 };
const AT_PLANT = { x: -8.786, z: -2.321 };

// I = 10 000 lux·(0.1 m/d)², P = 1/(1/(α·I) + 1/P_c), P_c = P_max·C/(C + K_C)·f(T), written out
// here with the model's teaching constants: α 2·10⁻⁶ mL/(s·lux), P_max 0.01 mL/s, K_C 0.005 mol/L,
// f(30 °C) = 1; 0.05 mol/L NaHCO₃, a 60 s collection, bubbles of 0.01 mL.
const LIGHT = 2e-6 * 10_000 * (0.1 / 0.2) ** 2; // α·I = 0.005 mL/s
const PLATEAU = (0.01 * 0.05) / 0.055; // P_c = 0.0091 mL/s: light limits (α·I < P_c)
const VOLUME = 60 / (1 / LIGHT + 1 / PLATEAU); // 0.194 mL
const BUBBLES = Math.floor(VOLUME / 0.01 + 1e-9); // 19

/** A player in the lab in front of the photosynthesis board, looking at it. */
const SAVE = sceneSave(LAB, [AT_BOARD.x, 0, AT_BOARD.z], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${PLANT} ${pattern}`),
    { timeout },
  );
}

test('photosynthesis: Continue, read, walk up, E, the lamp at 0.2 m at 30 °C, Start, O₂, Exit', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="photosynthesis"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Biology Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  await expectStation(
    page,
    'configured distance=0.1 carbonate=0.05 temperature=25 resolution=0.01 step 0/6',
  );
  await expect(page.locator('.hud-objective')).toContainText('Rate of photosynthesis');

  // 1. Read the board, then walk up to the pondweed: it offers to work at the bench (E).
  await use(page, aim, T.instructions, `${LAB}/photosynthesis-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText(
    'Rate of photosynthesis — instructions',
  );
  await approach(page, aim, NORTH_WEST_OF_BENCH.x, NORTH_WEST_OF_BENCH.z);
  await approach(page, aim, WEST_OF_BENCH.x, WEST_OF_BENCH.z);
  await approach(page, aim, AT_PLANT.x, AT_PLANT.z);
  const stoodAt = await position(page);
  const ws = await openWorkspace(page, aim, T.plant, PLANT, 'observation');
  await expectStation(page, 'configured .* step 2/6'); // the board read, the pondweed looked at
  // The bench is a workspace, not a desk: the lamp on its rule, the filter, the bottles, the bath,
  // the pondweed, the capillary and the stopwatch, each owning its own control.
  await expect(ws.locator('.ws-piece')).toHaveCount(7);
  await expect(bar(page, 'run')).toHaveText('Start');
  const column = piece(page, 'capillary').locator('rect.bio-gas');
  await expect(column).toHaveAttribute('width', '0'); // no gas before a run

  // 2. The lamp to 0.2 m on its rule, the bath to 30 °C: each on the piece that owns it.
  await pick(page, 'lamp', /^0\.2 m$/);
  await pick(page, 'bath', '30 °C');
  await expectStation(
    page,
    'configured distance=0.2 carbonate=0.05 temperature=30 resolution=0.01 step 3/6',
  );
  await shot(page, 'photosynthesis-1-before');

  // 3. Start: the lamp lights and the gas is collected for a minute; the column grows.
  await bar(page, 'run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await expect
    .poll(async () => Number(await column.getAttribute('width')), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expectStation(
    page,
    `completed .* volume=${VOLUME.toFixed(3)} bubbles=${BUBBLES}.000 .* limiting=1.000 step 4/6`,
    120_000,
  );
  await expect(ws.locator('.ws-state')).toHaveText('Completed');
  await shot(page, 'photosynthesis-2-collected');

  // 4. The results in the notebook: V, N and the limiting factor (named Light) beside the theory.
  const panel = await openNotebookResults(page);
  await expect(panel.locator('h2')).toContainText('Rate of photosynthesis');
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('intensity').locator('.measured')).toHaveText('2500.000 lux');
  await expect(result('volume').locator('.theory')).toHaveText(`${VOLUME.toFixed(3)} mL`);
  await expect(result('volume').locator('.measured')).toHaveText(`${VOLUME.toFixed(3)} mL`);
  await expect(result('bubbles').locator('.measured')).toHaveText(`${BUBBLES}.000`);
  await expect(result('limiting').locator('.measured')).toHaveText('1.000 (Light)');
  const reading = panel.locator('table.results-reading[data-reading="volume"] td');
  await expect(reading.first()).toHaveText(`${(Math.round(VOLUME / 0.01) * 0.01).toFixed(2)} mL`);
  await expect(panel.locator('svg[data-graph="volume-time"]')).toBeVisible();
  await expectStation(page, 'completed .* step 5/6');
  await page.keyboard.press('Escape'); // the results sheet
  await shot(page, 'photosynthesis-3-results');

  // 5. Exit: the same spot in the lab, the run still there.
  await exitWorkspace(page, stoodAt);
  await expectStation(page, 'completed .* step 5/6');
  await expect(workspace(page)).toBeHidden();

  // 6. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
