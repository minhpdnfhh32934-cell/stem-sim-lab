import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  Aim,
  approach,
  AT_DESK,
  AT_MONITOR,
  EYE_HEIGHT,
  expectDebug,
  lookAngles,
  newGame,
  position,
  PROJECTILE_TARGETS as T,
  projectileTheory as theory,
  RANGE,
  use,
  type Vec3,
  walkUntil,
  doorsClosed,
  walkThrough,
  walkToDoor,
} from './support';

// Phase 6B in the real app: the projectile-motion station in the Physics Lab's projectile range,
// played with keyboard and mouse — take a ball, load the launcher, set v₀, θ and g on the desk,
// RUN, watch the flight, read theory against measurement and the graphs, change a parameter,
// RESET, RUN again, STOP a run, then leave through the doors and come back. The Physics Lab is
// reached with the developer scene jump (setup only: the clean-area entry and the doors are
// covered by preparation.spec.ts and transitions.spec.ts). Rendering is software WebGL.

const station = (page: Page) => page.locator('.debug-text');
async function expectStation(page: Page, pattern: string) {
  await expectDebug(page, 'Station', `projectile-range/launcher ${pattern}`);
}

/** A screenshot without the developer overlay (its own F3 toggle hides and shows it). */
async function shot(page: Page, name: string) {
  await page.keyboard.press('F3');
  await expect(page.locator('.debug')).toBeHidden();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-results/${name}.png` });
  await page.keyboard.press('F3');
  await expect(page.locator('.debug')).toBeVisible();
}

/** Clicks a desk control `times` times (E), checking the prompt says what it is. */
async function press(page: Page, aim: Aim, target: Vec3, id: string, label: string, times = 1) {
  await use(page, aim, target, `${RANGE}/${id}`, label);
  for (let i = 1; i < times; i++) {
    await afterFrame(page);
    await page.keyboard.press('e');
  }
}

test('projectile motion: set up, run, read the results, change, reset, run again, stop', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await newGame(page);
  const aim = new Aim(page);

  // Setup shortcut: the developer jump to the Physics Lab (spawn (−4, 0, 0) facing +x).
  await page.evaluate(() => document.exitPointerLock());
  await page.getByLabel('Scene to load').selectOption('physics-lab');
  await page.getByRole('button', { name: 'Load scene' }).click();
  await expectDebug(page, 'Scene', 'physics-lab');
  await aim.sync();

  // Through the opening in the lab's south wall (x −3 … −1) into the projectile range, whose
  // station the HUD and debug panel follow from here (the lab's own is the free-fall tower).
  await approach(page, aim, -2, 4.8);
  await aim.at([-2, EYE_HEIGHT, 10.5]);
  await walkUntil(page, 'w', (p) => p[2] > 8.5);
  await expectDebug(page, 'Room', 'projectile-range');
  await expectStation(page, 'idle velocity=8 angle=45 gravity=9.81 resolution=0.01 step 0/5');
  await expect(page.locator('.hud-objective')).toContainText('Projectile motion');
  await aim.to(-Math.PI / 2, -0.08); // down the lane
  await page.waitForTimeout(600);
  await shot(page, 'experiment-1-lab-overview');

  // 1. Read the instructions.
  await approach(page, aim, -0.3, 9);
  await use(page, aim, T.instructions, `${RANGE}/instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Projectile motion — instructions');
  await expectStation(page, 'idle .* step 1/5');

  // 2. A ball from the cart, into the launcher (E while holding it, looking at the launcher).
  await approach(page, aim, -3.6, 10.4);
  await use(page, aim, T.ball, `${RANGE}/ball-2`, 'Grab');
  await expectDebug(page, 'Holding', `${RANGE}/ball-2`);
  await approach(page, aim, -2.1, 11.75);
  await aim.at(T.launcher);
  await expectDebug(page, 'Focus', `${RANGE}/launcher`);
  await expect(page.locator('.hud-prompt')).toContainText('Load into the launcher');
  await page.keyboard.press('e');
  await expectDebug(page, 'Holding', '—');
  await expectStation(page, 'configured .* step 2/5');

  // 3. Parameters at the desk: v₀ 8 → 5 m/s (F lowers), g Earth → Mars → Moon; θ stays 45°.
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await aim.at(T.muzzle); // the loaded launcher from the side: barrel at θ = 45°
  await page.waitForTimeout(400);
  await shot(page, 'experiment-2-setup');
  await aim.at(T.dialVelocity);
  await expectDebug(page, 'Focus', `${RANGE}/dial-velocity`);
  await expect(page.locator('.hud-prompt')).toContainText('Raise v₀');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('f');
    await afterFrame(page);
  }
  await aim.at(T.dialGravity);
  await expectDebug(page, 'Focus', `${RANGE}/dial-gravity`);
  await page.keyboard.press('f');
  await afterFrame(page);
  await page.keyboard.press('f');
  await expectStation(page, 'configured velocity=5 angle=45 gravity=1.62 resolution=0.01 step 3/5');

  // 4. RUN, and watch the flight down the lane (≈ 4.5 s on the Moon).
  const first = theory(5, 45, 1.62);
  await press(page, aim, T.run, 'button-run', 'RUN');
  await expectStation(page, 'running');
  await aim.at([7, 2.4, 11.75]);
  await expectStation(page, String.raw`running .* t=(1|2|3)\.`);
  await shot(page, 'experiment-3-running');
  await expectStation(page, `completed .* range=${first.range.toFixed(3)} .*step 4/5`);
  await expect(page.locator('.hud-toast').last()).toContainText(
    `Projectile motion — Flight time: ${Number(first.time.toPrecision(4))} s`,
  );
  await shot(page, 'experiment-4-landed');

  // 5. The results monitor: the trajectory on screen, then the full results (E).
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  await aim.at(T.monitor);
  await expectDebug(page, 'Focus', `${RANGE}/monitor`);
  await page.waitForTimeout(400);
  await shot(page, 'experiment-5-monitor');
  await page.keyboard.press('e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toContainText('Projectile motion');
  await expect(panel.locator('h2')).toContainText('(completed)');
  const rangeRow = panel.locator('tr[data-result="range"]');
  await expect(panel.locator('h2')).toContainText('run 1');
  await expect(rangeRow.locator('.theory')).toHaveText(`${first.range.toFixed(3)} m`);
  await expect(rangeRow.locator('.measured')).toHaveText(`${first.range.toFixed(3)} m`);
  await expect(rangeRow.locator('.error')).toHaveText(/^(0\.00 %|< 0\.01 %)$/);
  const graphs = panel.locator('svg[data-graph]');
  await expect(graphs).toHaveCount(3);
  const samples = Number(await graphs.first().getAttribute('data-samples'));
  expect(samples).toBeGreaterThan(400); // 100 per second for ≈ 4.5 s
  await expect(panel.locator('svg[data-graph="height-time"]')).toContainText('t (s)');
  await expect(panel.locator('svg[data-graph="trajectory"]')).toContainText('x (m)');
  await expect(panel.locator('svg[data-graph="trajectory"]')).toContainText('y (m)');
  await expect(panel.locator('svg[data-graph="velocity-time"] polyline')).toHaveCount(3);
  await expectStation(page, 'completed .* step 5/5');
  await shot(page, 'experiment-6-results');

  // 6. Change θ to 30° (looking away closes the results), RESET, RUN again: a shorter range.
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await expect(panel).toBeHidden();
  await aim.at(T.dialAngle);
  await expectDebug(page, 'Focus', `${RANGE}/dial-angle`);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('f');
    await afterFrame(page);
  }
  await expectStation(page, 'completed velocity=5 angle=30 gravity=1.62');
  await press(page, aim, T.run, 'button-run', 'RUN');
  await expect(page.locator('.hud-toast.warn').last()).toHaveText(
    'Press RESET before the next run.',
  );
  await press(page, aim, T.reset, 'button-reset', 'RESET');
  await expectStation(page, 'configured velocity=5 angle=30');
  const second = theory(5, 30, 1.62);
  await press(page, aim, T.run, 'button-run', 'RUN');
  await expectStation(page, `completed .* range=${second.range.toFixed(3)}`);
  expect(second.range).not.toBeCloseTo(first.range, 1);

  // 7. STOP keeps the data so far; RESET discards it. The aim at STOP is worked out before RUN:
  // this flight lasts 3.3 s, which a loaded machine can spend on a full aim-and-check.
  await press(page, aim, T.reset, 'button-reset', 'RESET');
  const stopAim = lookAngles(await position(page), T.stop);
  await press(page, aim, T.run, 'button-run', 'RUN');
  await aim.to(...stopAim);
  await page.keyboard.press('e');
  await expectDebug(page, 'Focus', `${RANGE}/button-stop`);
  await expectStation(page, String.raw`stopped .* t=\d`);
  await expect(page.locator('.hud-toast').last()).toContainText('Stopped at t =');
  await press(page, aim, T.reset, 'button-reset', 'RESET');
  await expectStation(page, 'configured velocity=5 angle=30 gravity=1.62 resolution=0.01 step 5/5');

  // 8. Leave through the doors and come back: the configuration is still there. West of the
  // launcher first: the straight line from the desk passes it closer than the player's radius.
  await approach(page, aim, -2.2, 12.3);
  await approach(page, aim, -2, 8.9);
  await aim.at([-2, EYE_HEIGHT, 0]);
  await walkUntil(page, 'w', (p) => p[2] < 6);
  await expectDebug(page, 'Room', 'physics-lab');
  await approach(page, aim, -3.3, 0.3);
  await aim.at(T.labDoor);
  await expectDebug(page, 'Focus', 'physics-lab/door-hub');
  // Through the door into the hub and away from it, until it has closed and the lab is gone.
  await walkThrough(page, {
    label: 'Back to SIMLAB Hub',
    to: 'simlab-hub',
    done: (p) => p[0] < 10.5, // 2.45 m past the hub's east door
  });
  await doorsClosed(page, 'simlab-hub');
  // Back the same way.
  await walkToDoor(page, aim, T.hubDoorPhysics, 'simlab-hub/door-physics');
  await walkThrough(page, {
    label: 'Enter Physics Lab',
    to: 'physics-lab',
    done: (p) => p[0] > -2.6,
  });
  await doorsClosed(page, 'physics-lab');
  // Into the range again, whose station the debug panel follows there.
  await aim.sync();
  await approach(page, aim, -2, 4.8);
  await aim.at([-2, EYE_HEIGHT, 10.5]);
  await walkUntil(page, 'w', (p) => p[2] > 8.5);
  await expectDebug(page, 'Room', 'projectile-range');
  await expectStation(page, 'configured velocity=5 angle=30 gravity=1.62');
  expect(errors).toEqual([]);
  await expect(station(page)).not.toContainText('[failed]');
});
