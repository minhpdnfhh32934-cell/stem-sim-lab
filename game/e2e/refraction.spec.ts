import { expect, type Page, test } from '@playwright/test';
import { continueInto, sceneSave } from './saves';
import { Aim, approach, dial, expectDebug, openResults, shot, use, type Vec3 } from './support';

// The refraction station on the optics room's east wall (Phase T-1a), in the real app: found in the
// catalog, reached by Continue from a save of a player standing in the range (no developer jump),
// played with keyboard and mouse: read the board, crown glass at i = 40°, RUN (the ray box turns
// from 0° to 40°), r on the monitor against Snell's law written out here and the protractor's
// reading at d = 1°, the run marked in the catalog.

const ROOM = 'waves-optics';
// Interaction targets (centres of the faces the player looks at) and where the player stands.
const T = {
  instructions: [28.78, 2.425, -3.15],
  board: [28.85, 0.95, -2.3],
  dialIndex: [27.9, 0.875, -3.1],
  dialAngle: [27.9, 0.875, -2.7],
  run: [27.9, 0.875, -2.25],
  monitor: [29.2, 1.775, -1.85],
} satisfies Record<string, Vec3>;
const AT_DESK = { x: 27.35, z: -2.3 };

// Snell's law from air into crown glass, written out here: sin 40° = 1.52·sin r.
const R = (Math.asin(Math.sin((40 * Math.PI) / 180) / 1.52) * 180) / Math.PI; // 25.017°

/** A player in the range in front of the refraction board, looking at it. */
const SAVE = sceneSave('physics-lab', [27.35, 0, -3.15], T.instructions);

async function expectStation(page: Page, pattern: string, timeout = 15_000) {
  await expect(page.locator('.debug-text')).toContainText(
    new RegExp(`Station:\\s+${ROOM}/refraction ${pattern}`),
    { timeout },
  );
}

test('refraction: Continue, read, crown glass at 40°, RUN, r against Snell’s law', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const catalog = page.locator('.menu-catalog');
  const item = catalog.locator('.menu-catalog-item[data-experiment="refraction"]');
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-place')).toHaveText(
    'Played in Physics Laboratory · Waves & Optics Room',
  );
  await expect(item.locator('.menu-run')).toHaveText('Not yet run to the end');

  const errors = await continueInto(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();
  await expectDebug(page, 'Room', ROOM);
  await expectStation(page, 'configured index=1.49 direction=0 angle=20 resolution=1 step 0/7');
  await expect(page.locator('.hud-objective')).toContainText('Refraction');

  // 1. Read the board, then at the desk: n 1.49 → 1.52 (crown glass), i 20° → 40°.
  await use(page, aim, T.instructions, `${ROOM}/refraction-instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Refraction — instructions');
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await dial(page, aim, T.dialIndex, `${ROOM}/refraction-dial-index`, 'e', 1);
  await dial(page, aim, T.dialAngle, `${ROOM}/refraction-dial-angle`, 'e', 1);
  await expectStation(page, 'configured index=1.52 direction=0 angle=40 resolution=1 step 3/7');

  // 2. RUN: the ray box turns at 10 °/s and stops at 40°; the ray is refracted towards the normal.
  await use(page, aim, T.run, `${ROOM}/refraction-run`, 'RUN');
  await expectStation(
    page,
    `completed .* incidence=40.000 reflection=40.000 tir=0.000 .* refraction=${R.toFixed(3)} .* step 4/7`,
    60_000,
  );
  await aim.at(T.board);
  await page.waitForTimeout(400);
  await shot(page, 'refraction-1-rays');

  // 3. The monitor: r beside Snell's law, no total internal reflection, the protractor's reading.
  const panel = await openResults(page, aim, T.monitor, `${ROOM}/refraction-monitor`);
  await expect(panel.locator('h2')).toContainText('Refraction');
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  const result = (id: string) => panel.locator(`tr[data-result="${id}"]`);
  await expect(result('refraction').locator('.theory')).toHaveText(`${R.toFixed(3)} °`);
  await expect(result('refraction').locator('.measured')).toHaveText(`${R.toFixed(3)} °`);
  await expect(result('tir').locator('.measured')).toContainText('(No)');
  await expect(
    panel.locator('table.results-reading[data-reading="refraction"] td').first(),
  ).toHaveText(`${Math.round(R)} °`); // the nearest whole degree, at d = 1°
  await expect(panel.locator('svg[data-graph="refraction-incidence"]')).toBeVisible();
  await expectStation(page, 'completed .* step 5/7');
  await shot(page, 'refraction-2-results');

  // 4. Back in the menu (the game saves on leaving the page): the run is marked in the catalog.
  await page.reload();
  await page.getByRole('button', { name: 'Experiment catalog' }).click();
  await expect(item.locator('.menu-run')).toHaveText('Run completed');
  expect(errors).toEqual([]);
});
