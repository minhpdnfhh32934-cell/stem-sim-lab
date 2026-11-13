import { expect, type Page, test } from '@playwright/test';
import { openNotebookResults, pick, piece } from './bio-workspace';
import { bar, exitWorkspace, openWorkspace, workspace } from './chem-workspace';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, position, shot, use, type Vec3 } from './support';

// The osmosis station on the Biology Lab's west wall bench, in the real app: found in the catalog,
// reached by Continue from a save of a player standing in the lab (no developer jump), played with
// keyboard and mouse: read the board, walk up to the rack, E opens the workspace, 0.5 mol/L
// sucrose is picked on the bench, "Soak" runs the default 4 h soak, the cylinder in the tube and
// the balance change, the mass and its change against van 't Hoff written out here, Exit puts the
// player where they stood, the run marked in the catalog.

const LAB = 'biology-lab';
const RACK = `${LAB}/osmosis`;
// Interaction targets (centres of the faces the player looks at) and where the player stands. The
// station faces east: its board hangs on the west wall north of its bench, the desk is gone.
const T = {
  instructions: [-14.95, 1.375, -1.211],
  rack: [-14.6, 0.98, 0.389],
} satisfies Record<string, Vec3>;
const AT_RACK = { x: -13.2, z: 0.389 };

// Δm/m₀ = R·T·(C_iso − C)/E·(1 − e^(−t/τ)), written out here: 20 °C, C_iso 0.25 mol/L,
// E 5000 kPa, τ 2700 s, a 4 h soak in 0.5 mol/L; a 3 g cylinder on a balance reading 0.01 g.
const RT = 6.02214076e23 * 1.380649e-23 * 293.15; // kPa·L/mol
const U = ((RT * (0.25 - 0.5)) / 5000) * (1 - Math.exp(-14400 / 2700)); // −12.1 %
const MASS = 3 * (1 + U); // 2.636 g
const minus = (text: string) => text.replace('-', '−');

/** A player in the lab in front of the osmosis board, looking at it. */
const SAVE = sceneSave(LAB, [-14, 0, -1.211], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${RACK} ${pattern}`),
    { timeout },
  );
}

test('osmosis: Continue, read, walk up, E, 0.5 mol/L, Soak, the mass lost, Exit', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="osmosis"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Biology Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  await expectStation(
    page,
    'configured concentration=0.4 soakTime=14400 initialMass=3 balanceResolution=0.01 step 0/6',
  );
  await expect(page.locator('.hud-objective')).toContainText('Osmosis');

  // 1. Read the board, then walk up to the rack: it offers to work at the bench (E).
  await use(page, aim, T.instructions, `${LAB}/osmosis-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Osmosis — instructions');
  await approach(page, aim, AT_RACK.x, AT_RACK.z);
  const stoodAt = await position(page);
  const ws = await openWorkspace(page, aim, T.rack, RACK, '2d-workspace');
  await expectStation(page, 'configured .* step 2/6'); // the board read, the rack looked at
  // The bench is a workspace, not a desk: solutions, cylinders, a tube, a lens, a timer, a balance.
  await expect(ws.locator('.ws-piece')).toHaveCount(6);
  await expect(bar(page, 'run')).toHaveText('Soak');
  const cylinder = piece(page, 'tube').locator('rect.bio-flesh');
  const balance = piece(page, 'balance').locator('.bio-lcd');
  await expect(cylinder).toHaveAttribute('height', '0');
  await expect(balance).toHaveText('—'); // nothing to read before a run

  // 2. The sucrose solution is chosen on the bench, at its bottles.
  await pick(page, 'sucrose', '0.5 mol/L');
  await expectStation(
    page,
    'configured concentration=0.5 soakTime=14400 initialMass=3 balanceResolution=0.01 step 3/6',
  );
  await shot(page, 'osmosis-1-before');

  // 3. Soak: 4 h at 240 times speed, 60 s. The cylinder goes into the tube, then on the balance.
  await bar(page, 'run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await expect
    .poll(async () => Number(await cylinder.getAttribute('height')), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await expectStation(
    page,
    `completed .* finalMass=${MASS.toFixed(3)} percentChange=${(100 * U).toFixed(3)} direction=-1.000 step 4/6`,
    120_000,
  );
  await expect(ws.locator('.ws-state')).toHaveText('Completed');
  await expect(balance).toHaveText(`${(Math.round(MASS / 0.01) * 0.01).toFixed(2)} g`);
  await shot(page, 'osmosis-2-weighed');

  // 4. The results in the notebook: the mass and its change (named Loses water) beside theory.
  const panel = await openNotebookResults(page);
  await expect(panel.locator('h2')).toContainText('Osmosis');
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('finalMass').locator('.theory')).toHaveText(`${MASS.toFixed(3)} g`);
  await expect(result('finalMass').locator('.measured')).toHaveText(`${MASS.toFixed(3)} g`);
  await expect(result('percentChange').locator('.measured')).toHaveText(
    `${minus((100 * U).toFixed(3))} %`,
  );
  await expect(result('direction').locator('.measured')).toHaveText('−1.000 (Loses water)');
  const reading = panel.locator('table.results-reading[data-reading="finalMass"] td');
  await expect(reading.first()).toHaveText(`${(Math.round(MASS / 0.01) * 0.01).toFixed(2)} g`);
  await expect(panel.locator('svg[data-graph="percent-time"]')).toBeVisible();
  await expectStation(page, 'completed .* step 5/6');
  await page.keyboard.press('Escape'); // the results sheet
  await shot(page, 'osmosis-3-results');

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
