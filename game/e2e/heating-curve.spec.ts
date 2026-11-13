import { expect, type Page, test } from '@playwright/test';
import {
  bar,
  choose,
  exitWorkspace,
  openWorkspace,
  pieceButton,
  workspace,
} from './chem-workspace';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, position, shot, use, type Vec3 } from './support';

// The heating-curve station by the Chemistry Lab's fume hood, in the real app: found in the
// catalog, reached by Continue from a save of a player standing in the lab (no developer jump),
// played with keyboard and mouse: read the board, walk up to the hot plate, E opens the controls
// beside the apparatus (the 3D rig stays in view), 0.05 kg of ice from −5 °C at 800 W is chosen
// with clicks, RUN heats it, the thermometer and the hot plate change, the stopwatches' readings
// against Q = P·t written out here, Exit puts the player where they stood.

const LAB = 'chemistry-lab';
const PLATE = `${LAB}/heating`;
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  instructions: [9.95, 1.375, -7.1],
  plate: [7.979, 1.05, -7.25],
} satisfies Record<string, Vec3>;
// From the board (east of the bench) round the bench's east end to its front.
const EAST_OF_BENCH = { x: 8.643, z: -6.153 };
const AT_PLATE = { x: 7.543, z: -6.203 };

// Each stage's heat over P, written out here: 0.05 kg at 800 W with c_ice 2100 J/(kg·K) from
// −5 °C, L_f 334 kJ/kg, c_w 4180 J/(kg·K) over 100 K, then 5 % boiled at L_v 2257 kJ/kg.
const M = 0.05;
const P = 800;
const MELT = (M * 334_000) / P; // 20.875 s
const TO_BOIL = (M * 2100 * 5) / P + MELT + (M * 4180 * 100) / P; // 47.656 s

/** A player in the lab in front of the heating-curve board, looking at it. */
const SAVE = sceneSave(LAB, [8.55, 0, -7.303], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${PLATE} ${pattern}`),
    { timeout },
  );
}

test('heating curve: Continue, walk up, E, choose the ice and the power with clicks, RUN, the plateaus, Exit', async ({
  page,
}) => {
  test.setTimeout(360_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="heating-curve"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Chemistry Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  await expectStation(
    page,
    'configured mass=0.1 startTemperature=-10 power=500 resolution=0.1 step 0/8',
  );
  await expect(page.locator('.hud-objective')).toContainText('Heating curve of water');

  // 1. Read the board, then walk up to the hot plate: it offers to work at the bench (E).
  await use(page, aim, T.instructions, `${LAB}/heating-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Heating curve — instructions');
  await approach(page, aim, EAST_OF_BENCH.x, EAST_OF_BENCH.z);
  await approach(page, aim, AT_PLATE.x, AT_PLATE.z);
  const stoodAt = await position(page);
  const ws = await openWorkspace(page, aim, T.plate, PLATE, 'bench-embedded');
  await expectStation(page, 'configured .* step 2/8');
  // The controls stand beside the rig, not over the room: the pieces, no library, the curve card.
  await expect(ws).toHaveAttribute('data-overlay', 'anchored');
  await expect(ws.locator('.ws-piece')).toHaveCount(4);
  await expect(ws.locator('.ws-library')).toBeHidden();

  // 2. Choose with clicks, each at the piece that owns it: ice on the beaker, power on the plate.
  await choose(page, 'beaker', '0.05 kg');
  await choose(page, 'beaker', '−5 °C');
  await choose(page, 'plate', '800 W');
  await expectStation(
    page,
    'configured mass=0.05 startTemperature=-5 power=800 resolution=0.1 step 5/8',
  );

  // 3. RUN: 0 °C while the ice melts, 100 °C while 5 % boils away; the thermometer rises, the
  // plate glows.
  const mercury = ws.locator('.ws-piece[data-piece="thermometer"] rect.chem-mercury').first();
  const plate = ws.locator('.ws-piece[data-piece="plate"] ellipse.chem-plate');
  const column0 = await mercury.getAttribute('height');
  await expect(plate).toHaveAttribute('data-on', '0');
  await shot(page, 'heating-curve-1-before');
  await bar(page, 'run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await expect(plate).toHaveAttribute('data-on', '1');
  await page.waitForTimeout(10_000); // on the melting plateau (0.7 s to 21.5 s)
  expect(await mercury.getAttribute('height')).not.toBe(column0);
  await shot(page, 'heating-curve-2-melting');
  await expectStation(
    page,
    `completed .* meltingTime=${MELT.toFixed(3)} .* boilStartTime=${TO_BOIL.toFixed(3)} .* step 6/8`,
    90_000,
  );
  await expect(plate).toHaveAttribute('data-on', '0');
  await shot(page, 'heating-curve-3-boiled');

  // 4. The stopwatches' readings to their resolution, and the curve in the notebook.
  await pieceButton(page, 'stopwatch').click();
  const readings = ws.locator('.ws-callout .ws-readings');
  await expect(readings).toContainText('20.9 s');
  await expect(readings).toContainText('47.7 s');
  await page.keyboard.press('Escape');
  await ws.locator('.ws-results-button').click();
  const panel = ws.locator('.results-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('svg[data-graph="heating-curve"]')).toBeVisible();
  await expect(panel.locator('tr[data-result="state"] .measured')).toContainText('(Boiling)');
  await expectStation(page, 'completed .* step 7/8');
  await page.keyboard.press('Escape'); // the results sheet

  // 5. Exit: the same spot in the lab, the run still there.
  await exitWorkspace(page, stoodAt);
  await expectStation(page, 'completed .* step 7/8');
  await expect(workspace(page)).toBeHidden();

  // 6. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
