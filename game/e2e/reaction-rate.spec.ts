import { expect, type Page, test } from '@playwright/test';
import {
  bar,
  choose,
  exitWorkspace,
  openWorkspace,
  pieceButton,
  place,
  workspace,
} from './chem-workspace';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, position, shot, use, type Vec3 } from './support';

// The reaction-rate station on the Chemistry Lab's north wall bench, in the real app: found in the
// catalog, reached by Continue from a save of a player standing in the lab (no developer jump),
// played with keyboard and mouse: read the board, walk up to the colorimeter, E opens the
// workspace, the bath goes to 45 °C, the flasks go in it and the cuvette in the colorimeter (all
// clicks), "Mix and start the timer" runs it, the violet fades in the colorimeter, the timer's
// half-life against the rate law and Arrhenius written out here, Exit puts the player where they
// stood.

const LAB = 'chemistry-lab';
const COLORIMETER = `${LAB}/kinetics`;
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  instructions: [-4.329, 1.375, -10.95],
  colorimeter: [-5.979, 1.03, -10.5],
} satisfies Record<string, Vec3>;
const AT_COLORIMETER = { x: -5.979, z: -9.5 };
const FLASK = 'Put the crystal violet flask in the water bath first.';

// k′ = k₂₅·exp((Eₐ/R)(1/T₂₅ − 1/T))·[OH⁻]₀, written out here: 0.1 L/(mol·s), 60 kJ/mol, 45 °C,
// 0.25 mol/L; t½ = ln 2/k′, and the timer reads it to d = 0.1 s.
const R = 6.02214076e23 * 1.380649e-23;
const K = 0.1 * Math.exp((60_000 / R) * (1 / 298.15 - 1 / 318.15)) * 0.25; // 0.114 1/s
const HALF = Math.LN2 / K; // 6.05 s

/** A player in the lab in front of the reaction-rate board, looking at it. */
const SAVE = sceneSave(LAB, [-4.379, 0, -9.9], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${COLORIMETER} ${pattern}`),
    { timeout },
  );
}

test('reaction rate: Continue, walk up, E, flasks in the bath at 45 °C, mix, the violet fades, Exit', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="reaction-rate"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Chemistry Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  await expectStation(
    page,
    'idle initialConcentration=0.00001 naoh=0.2 temperature=25 timerResolution=0.1 step 0/7',
  );
  await expect(page.locator('.hud-objective')).toContainText('Reaction rate');

  // 1. Read the board, then walk up to the colorimeter: it offers to work at the bench (E).
  await use(page, aim, T.instructions, `${LAB}/kinetics-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Reaction rate — instructions');
  await approach(page, aim, AT_COLORIMETER.x, AT_COLORIMETER.z);
  const stoodAt = await position(page);
  const ws = await openWorkspace(page, aim, T.colorimeter, COLORIMETER, '2d-workspace');
  await expectStation(page, 'idle .* step 2/7');
  await expect(ws.locator('.ws-piece')).toHaveCount(5);
  await expect(ws.locator('.ws-line')).toHaveText(FLASK);

  // 2. Set up with clicks: the bath's temperature, the flasks in the bath, the cuvette in the slot.
  await choose(page, 'bath', '45 °C');
  await place(page, 'NaOH flask (plastic): [OH⁻]₀ = 0.25', 'bath');
  await place(page, 'Crystal violet flask: c₀ = 10', 'bath');
  await place(page, 'Cuvette', 'colorimeter');
  await expect(ws.locator('.ws-state')).toHaveText('Ready');
  await expectStation(
    page,
    'configured initialConcentration=0.00001 naoh=0.25 temperature=45 timerResolution=0.1 step 4/7',
  );

  // 3. Mix and start the timer: the violet appears in the colorimeter and fades.
  const dye = ws.locator('.ws-piece[data-piece="colorimeter"] rect.chem-liquid');
  await expect(dye).toHaveAttribute('display', 'none');
  await shot(page, 'reaction-rate-1-before');
  await bar(page, 'run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await expect(dye).toHaveAttribute('display', 'inline');
  const dark = Number(await dye.getAttribute('fill-opacity'));
  await expectStation(
    page,
    `completed .* rateConstant=${K.toFixed(3)} halfLife=${HALF.toFixed(3)} .* step 5/7`,
    60_000,
  );
  expect(Number(await dye.getAttribute('fill-opacity'))).toBeLessThan(dark); // a quarter of the dye left
  await shot(page, 'reaction-rate-2-faded');

  // 4. The timer's half-life to its resolution, and the results in the notebook.
  await pieceButton(page, 'timer').click();
  await expect(ws.locator('.ws-callout .ws-readings')).toContainText(
    `${(Math.round(HALF / 0.1) * 0.1).toFixed(1)} s`,
  );
  await page.keyboard.press('Escape');
  await ws.locator('.ws-results-button').click();
  const panel = ws.locator('.results-panel');
  await expect(panel).toBeVisible();
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('rateConstant').locator('.measured')).toHaveText(`${K.toFixed(3)} 1/s`);
  await expect(result('halfLife').locator('.measured')).toHaveText(`${HALF.toFixed(3)} s (Fast)`);
  await expect(panel.locator('svg[data-graph="ln-absorbance-time"]')).toBeVisible();
  await expectStation(page, 'completed .* step 6/7');
  await page.keyboard.press('Escape'); // the results sheet

  // 5. Exit: the same spot in the lab, the run still there.
  await exitWorkspace(page, stoodAt);
  await expectStation(page, 'completed .* step 6/7');
  await expect(workspace(page)).toBeHidden();

  // 6. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
