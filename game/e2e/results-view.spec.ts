import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  AT_DESK,
  AT_MONITOR,
  AT_PENDULUM_DESK,
  BAY,
  continueFrom,
  dial,
  expectDebug,
  expectStation,
  freeMouse,
  labSave,
  openResults,
  PENDULUM_TARGETS as P,
  PROJECTILE_TARGETS as T,
  RANGE,
  shot,
  use,
  type Vec3,
  menuContinue,
} from './support';

// Phase 6C.5 in the real app, through Continue. "Read the results" with no current run (after
// RESET) opens the station's kept runs; with no run and no history it is refused with its reason,
// as before; after a reload the kept run is back (the run history, P2b) and opens again. The desk screens are captured at
// three window sizes in their busiest state: dials turned after a completed run.

const NONE = 'No results yet: run the experiment first.';
const NO_CURRENT = 'No current run: set up the apparatus and press RUN, or tick a recorded run.';
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1699, height: 935 },
  { width: 430, height: 860 },
] as const;
/** East of the pendulum desk: dials, RUN, RESET and the results monitor all within reach. */
const BAY_STAND: Vec3 = [3.6, 0, -8.7];
/** The centres of the desk screens. */
const PENDULUM_SCREEN: Vec3 = [2.4, 1.1, -9.7];
const PROJECTILE_SCREEN: Vec3 = [-1.2, 1.1, 14.45];

/** The desk screen at every window size, without the developer overlay. */
async function deskShots(page: Page, name: string) {
  await page.keyboard.press('F3');
  await expect(page.locator('.debug')).toBeHidden();
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/${name}-${size.width}x${size.height}.png` });
  }
  await page.setViewportSize(SIZES[0]);
  await page.waitForTimeout(300);
  await page.keyboard.press('F3');
  await expect(page.locator('.debug')).toBeVisible();
}

/** Looks at the monitor: it offers to read the results, refused with `refusal` when given. */
async function lookAtMonitor(page: Page, aim: Aim, monitor: Vec3, id: string, refusal?: string) {
  await aim.at(monitor);
  await expectDebug(page, 'Focus', id);
  const prompt = page.locator('.hud-prompt');
  await expect(prompt).toContainText('Read the results');
  if (refusal) await expect(prompt).toContainText(refusal);
  else await expect(prompt).not.toContainText(NONE);
}

/** After RESET: the panel opens with no current run and the kept run, which reads as recorded. */
async function expectKeptRun(page: Page, aim: Aim, monitor: Vec3, id: string, reading: string) {
  await lookAtMonitor(page, aim, monitor, id);
  const panel = await openResults(page, aim, monitor, id);
  await expect(panel.locator('.results-main')).toContainText(NO_CURRENT);
  const rows = panel.locator('li.results-run[data-run]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).not.toHaveAttribute('aria-current', 'true');
  await freeMouse(page);
  await panel.getByRole('checkbox', { name: 'Select run 1' }).check();
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  await expect(panel.locator('h2 .results-badge')).toHaveText('recorded');
  await expect(panel.locator(`table.results-reading[data-reading="${reading}"]`)).toHaveCount(1);
  return panel;
}

test('pendulum: no run is refused; after RESET the kept run opens, also after a reload', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const save = labSave(BAY_STAND, P.monitor, { [`${BAY}/pendulum`]: { 'param.angle': 30 } });
  const errors = await continueFrom(page, save);
  const aim = new Aim(page);
  await aim.sync();
  const pendulum = `${BAY}/pendulum`;

  // No run and no history: refused with its reason, nothing opens (unchanged).
  await lookAtMonitor(page, aim, P.monitor, `${BAY}/monitor`, NONE);
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  await expect(page.locator('.results-panel')).toBeHidden();

  // A current run: the results open on it, as before.
  await use(page, aim, P.run, `${BAY}/button-run`, 'RUN');
  await expectStation(page, pendulum, 'completed ');
  const panel = await openResults(page, aim, P.monitor, `${BAY}/monitor`);
  await expect(panel.locator('h2')).toContainText('run 1 (completed)');
  await expect(panel.locator('h2 .results-badge')).toHaveText('current');

  // The desk screen with dials turned after the run: g Earth → Mars, d 0.01 → 0.001 s.
  await dial(page, aim, P.dialGravity, `${BAY}/dial-gravity`, 'f', 1);
  await dial(page, aim, P.dialResolution, `${BAY}/dial-resolution`, 'f', 1);
  await expectStation(page, pendulum, 'completed .*gravity=3.71 resolution=0.001 ');
  await approach(page, aim, AT_PENDULUM_DESK.x, AT_PENDULUM_DESK.z);
  await aim.at(PENDULUM_SCREEN);
  await deskShots(page, 'desk-pendulum');

  // RESET: no current run; "Read the results" opens the kept run.
  await use(page, aim, P.reset, `${BAY}/button-reset`, 'RESET');
  await expectStation(page, pendulum, 'configured ');
  await approach(page, aim, BAY_STAND[0], BAY_STAND[2]);
  await expectKeptRun(page, aim, P.monitor, `${BAY}/monitor`, 'period');
  await shot(page, 'results-view-pendulum-after-reset');

  // Reload and Continue: the run history kept it, so it opens again as recorded.
  await page.reload();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await expectDebug(page, 'Phase', 'playing');
  await aim.sync();
  await expectKeptRun(page, aim, P.monitor, `${BAY}/monitor`, 'period');
  expect(errors).toEqual([]);
});

test('projectile: the desk screen with dials turned after a shot; the kept run after RESET', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const save = labSave([AT_DESK.x, 0, AT_DESK.z], T.dialResolution, {
    [`${RANGE}/launcher`]: { loaded: `${RANGE}/ball-2` },
  });
  const errors = await continueFrom(page, save);
  const aim = new Aim(page);
  await aim.sync();
  const launcher = `${RANGE}/launcher`;

  // A shot, then g Earth → Mars and d 0.01 → 0.001 m: the busiest desk screen.
  await use(page, aim, T.run, `${RANGE}/button-run`, 'RUN');
  await expectStation(page, launcher, 'completed ');
  await dial(page, aim, T.dialGravity, `${RANGE}/dial-gravity`, 'f', 1);
  await dial(page, aim, T.dialResolution, `${RANGE}/dial-resolution`, 'f', 1);
  await expectStation(page, launcher, 'completed .*gravity=3.71 resolution=0.001 ');
  await aim.at(PROJECTILE_SCREEN);
  await deskShots(page, 'desk-projectile');

  // RESET puts the ball back; with no current run the monitor opens the kept shot.
  await use(page, aim, T.reset, `${RANGE}/button-reset`, 'RESET');
  await expectStation(page, launcher, 'configured ');
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  await expectKeptRun(page, aim, T.monitor, `${RANGE}/monitor`, 'range');
  await shot(page, 'results-view-projectile-after-reset');
  expect(errors).toEqual([]);
});
