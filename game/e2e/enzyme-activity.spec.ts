import { expect, type Page, test } from '@playwright/test';
import { openNotebookResults, pick, piece } from './bio-workspace';
import { bar, exitWorkspace, openWorkspace, workspace } from './chem-workspace';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, expectDebug, position, shot, use, type Vec3 } from './support';

// The enzyme-activity station on the Biology Lab's north wall bench, in the real app: found in the
// catalog, reached by Continue from a save of a player standing in the lab (no developer jump),
// played with keyboard and mouse: read the board, walk up to the rig, E opens the workspace,
// 1 mol/L H₂O₂ at 40 °C and pH 8 with 1.5 mL of extract are picked on the bench, "Start" runs
// it, the gas syringe's plunger moves, the oxygen and the activity against Michaelis–Menten
// written out here, Exit puts the player where they stood, the run marked in the catalog.

const LAB = 'biology-lab';
const RIG = `${LAB}/enzyme`;
// Interaction targets (centres of the faces the player looks at) and where the player stands. The
// board hangs on the north wall east of the rig; the desk and the wall monitor are gone.
const T = {
  instructions: [4.3, 1.375, -7.45],
  rig: [1, 1.08, -7],
} satisfies Record<string, Vec3>;
const AT_BOARD = { x: 3.2, z: -6.5 };
const AT_RIG = { x: 1, z: -5.9 };

// v = V_max·S/(K_m + S), V_max = a·E·f_T·f_pH, written out here with the station's constants
// (K_m 0.1 mol/L, a 0.01 mol/(L·s) per mL, Q₁₀ 2, Tm 41 °C, w 3 °C, pH_opt 7, σ 1.5); S(t) from
// K_m·ln(S₀/S) + S₀ − S = V_max·t by bisection; O₂ = ½·ΔS·5 mL·24.06 L/mol.
const g = (t: number) => 2 ** ((t - 41) / 10) / (1 + Math.exp((t - 41) / 3));
const T_OPT = 41 + 3 * Math.log((0.3 * Math.LN2) / (1 - 0.3 * Math.LN2)); // 37.0 °C
const ACTIVITY = (g(40) / g(T_OPT)) * Math.exp(-1 / (2 * 1.5 ** 2)); // 0.726
const VMAX = 0.01 * 1.5 * ACTIVITY;
function left(t: number) {
  let [lo, hi] = [1e-300, 1];
  for (let i = 0; i < 2000; i++) {
    const mid = (lo + hi) / 2;
    if (0.1 * Math.log(1 / mid) + 1 - mid - VMAX * t > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const O2_10 = 0.5 * (1 - left(10)) * 5 * 24.06; // mL in the first 10 s
const O2_60 = 0.5 * (1 - left(60)) * 5 * 24.06; // mL after 60 s

/** A player in the lab in front of the enzyme board, looking at it. */
const SAVE = sceneSave(LAB, [AT_BOARD.x, 0, AT_BOARD.z], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${RIG} ${pattern}`),
    { timeout },
  );
}

test('enzyme activity: Continue, read, walk up, E, 1 mol/L at 40 °C and pH 8, Start, O₂, Exit', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="enzyme-activity"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText('Played in Biology Laboratory');
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', LAB);
  await expectStation(page, 'configured substrate=0.5 temperature=30 pH=6 enzymeVolume=1 step 0/9');
  await expect(page.locator('.hud-objective')).toContainText('Enzyme activity');

  // 1. Read the board, then walk up to the rig: it offers to work at the bench (E).
  await use(page, aim, T.instructions, `${LAB}/enzyme-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Enzyme activity — instructions');
  await approach(page, aim, AT_RIG.x, AT_RIG.z);
  const stoodAt = await position(page);
  const ws = await openWorkspace(page, aim, T.rig, RIG, '2d-workspace');
  await expectStation(page, 'configured .* step 2/9'); // the board read, the rig looked at
  // The bench is a workspace, not a desk: solutions, a buffer, a syringe, a bath, a tube, a gas
  // syringe and a stopwatch, each owning its own control.
  await expect(ws.locator('.ws-piece')).toHaveCount(7);
  await expect(bar(page, 'run')).toHaveText('Start');
  const plunger = piece(page, 'gas').locator('rect.bio-metal');
  const x0 = await plunger.getAttribute('x');

  // 2. S₀ 1 mol/L, 40 °C, pH 8, 1.5 mL of extract: each on the piece that owns it.
  await pick(page, 'peroxide', /^1 mol\/L$/);
  await pick(page, 'bath', '40 °C');
  await pick(page, 'buffer', 'pH 8');
  await pick(page, 'extract', /^1\.5 mL$/);
  await expectStation(page, 'configured substrate=1 temperature=40 pH=8 enzymeVolume=1.5 step 6/9');
  await shot(page, 'enzyme-activity-1-before');

  // 3. Start: the gas syringe collects for 60 s and its plunger moves out.
  await bar(page, 'run').click();
  await expect(ws.locator('.ws-state')).toHaveText('Running');
  await expect.poll(() => plunger.getAttribute('x'), { timeout: 20_000 }).not.toBe(x0);
  await expectStation(
    page,
    `completed .* windowOxygen=${O2_10.toFixed(3)} .* oxygen=${O2_60.toFixed(3)} .* activity=${ACTIVITY.toFixed(3)} .* step 7/9`,
    120_000,
  );
  await expect(ws.locator('.ws-state')).toHaveText('Completed');
  await shot(page, 'enzyme-activity-2-collected');

  // 4. The results in the notebook: the oxygen and the activity (named) beside the theory.
  const panel = await openNotebookResults(page);
  await expect(panel.locator('h2')).toContainText('Enzyme activity');
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('windowOxygen').locator('.theory')).toHaveText(`${O2_10.toFixed(3)} mL`);
  await expect(result('windowOxygen').locator('.measured')).toHaveText(`${O2_10.toFixed(3)} mL`);
  await expect(result('oxygen').locator('.measured')).toHaveText(`${O2_60.toFixed(3)} mL`);
  await expect(result('activity').locator('.measured')).toHaveText(
    `${ACTIVITY.toFixed(3)} (Moderate activity)`,
  );
  await expect(panel.locator('svg[data-graph="oxygen-time"]')).toBeVisible();
  // Spec 25's activity curves, one point per completed run (drawn from the run records alone).
  await expect(panel.locator('[data-scatter="activity-temperature"]')).toBeVisible();
  await expect(panel.locator('[data-scatter="activity-ph"]')).toBeVisible();
  await expectStation(page, 'completed .* step 8/9');
  await page.keyboard.press('Escape'); // the results sheet
  await shot(page, 'enzyme-activity-3-results');

  // 5. Exit: the same spot in the lab, the run still there.
  await exitWorkspace(page, stoodAt);
  await expectStation(page, 'completed .* step 8/9');
  await expect(workspace(page)).toBeHidden();

  // 6. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
