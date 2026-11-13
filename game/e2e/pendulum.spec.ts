import { expect, type Page, test } from '@playwright/test';
import {
  afterFrame,
  Aim,
  approach,
  AT_PENDULUM_DESK as AT_DESK,
  BAY,
  continueFrom,
  EYE_HEIGHT,
  expectDebug,
  labSave,
  lookAngles,
  PENDULUM_TARGETS,
  pendulumPeriod30,
  PERIOD_RATIO_30,
  position,
  PROJECTILE_TARGETS,
  use,
  type Vec3,
  walkUntil,
  doorsClosed,
  walkThrough,
  walkToDoor,
  menuContinue,
} from './support';

// Phase 6C.2 in the real app: the pendulum station in the Physics Lab's pendulum bay, reached the
// way a returning player reaches it — Continue from a save of a player standing in the Physics
// Lab — and played with keyboard and mouse: read the board, set L and θ₀ (and try g), RUN, watch
// the swing, read the period against theory on the monitor, change θ₀ (RUN refused until RESET),
// RESET, RUN, STOP, then out through the doors and back, reload and Continue: the dials are kept.
// No developer scene jump. Rendering is software WebGL.

const T = {
  ...PENDULUM_TARGETS,
  labDoor: PROJECTILE_TARGETS.labDoor,
  hubDoorPhysics: PROJECTILE_TARGETS.hubDoorPhysics,
};
const AT_MONITOR = { x: 3.85, z: -10.1 };

// Theory written out here, independently of the game: L = 1.5 m, θ₀ = 30°, Earth.
const T0 = 2 * Math.PI * Math.sqrt(1.5 / 9.81);
const PERIOD = pendulumPeriod30(1.5, 9.81);

/** A player in the Physics Lab, west of the bench, facing the opening to the bay (−Z). */
const SAVE = labSave([-2.167, 0, -5.474], [-3, EYE_HEIGHT, -11.5]); // north of the teacher's bench (Phase T-1a)

const station = (page: Page) => page.locator('.debug-text');
async function expectStation(page: Page, pattern: string) {
  await expectDebug(page, 'Station', `${BAY}/pendulum ${pattern}`);
}

/**
 * Through the opening in the lab's north wall (x −4 … −2) into the bay: west of the teacher's
 * bench (Phase T-1a), then to the opening.
 */
async function enterBay(page: Page, aim: Aim) {
  await approach(page, aim, -3.367, -5.474);
  await approach(page, aim, -2.167, -5.674);
  await aim.at([-3, EYE_HEIGHT, -11.5]);
  await walkUntil(page, 'w', (p) => p[2] < -8.7);
  await expectDebug(page, 'Room', BAY);
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

/** Uses a desk control `times` times with E (raises a dial, presses a button). */
async function press(page: Page, aim: Aim, target: Vec3, id: string, label: string, times = 1) {
  await use(page, aim, target, `${BAY}/${id}`, label);
  for (let i = 1; i < times; i++) {
    await afterFrame(page);
    await page.keyboard.press('e');
  }
}
/** Lowers a dial `times` steps with F. */
async function lower(page: Page, aim: Aim, target: Vec3, id: string, times: number) {
  await aim.at(target);
  await expectDebug(page, 'Focus', `${BAY}/${id}`);
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('f');
    await afterFrame(page);
  }
}

test('pendulum: Continue, set up, run, read the period, change, reset, stop, leave, reload', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await continueFrom(page, SAVE);
  const aim = new Aim(page);
  await aim.sync();

  await enterBay(page, aim);
  await expectStation(page, 'configured length=1 angle=10 gravity=9.81 resolution=0.01 step 0/6');
  await expect(page.locator('.hud-objective')).toContainText('Simple pendulum');
  await expect(page.locator('.hud-objective')).toContainText('Read the pendulum instructions');
  await aim.at(T.rig);
  await page.waitForTimeout(600);
  await shot(page, 'pendulum-1-bay');

  // 1. Read the instructions on the west wall.
  await approach(page, aim, -3.8, -9.5);
  await use(page, aim, T.instructions, `${BAY}/instructions`, 'Inspect');
  await expect(page.locator('.hud-toast').last()).toContainText('Simple pendulum — instructions');
  await expectStation(page, 'configured .* step 1/6');

  // 2. At the desk: L 1 → 1.5 m, θ₀ 10° → 30°; g up to Jupiter and back down to Earth.
  await approach(page, aim, 1, -8.4);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await press(page, aim, T.dialLength, 'dial-length', 'Raise L', 2);
  await expectStation(page, 'configured length=1.5 angle=10 .* step 2/6');
  await press(page, aim, T.dialAngle, 'dial-angle', 'Raise θ₀', 4);
  await press(page, aim, T.dialGravity, 'dial-gravity', 'Raise g');
  await expectStation(
    page,
    'configured length=1.5 angle=30 gravity=24.79 resolution=0.01 step 3/6',
  );
  await lower(page, aim, T.dialGravity, 'dial-gravity', 1);
  await expectStation(page, 'configured length=1.5 angle=30 gravity=9.81 resolution=0.01 step 3/6');
  await aim.at(T.rig); // held at the release angle before the run
  await page.waitForTimeout(400);
  await shot(page, 'pendulum-2-setup');

  // 3. RUN, and watch it swing through the vertical to the far side: three periods, ≈ 7.5 s.
  await press(page, aim, T.run, 'button-run', 'RUN');
  await expectStation(page, 'running');
  await aim.at(T.rig);
  await expectStation(page, String.raw`running .* theta=-0\.\d{3}`);
  await shot(page, 'pendulum-3-running');
  await expectStation(
    page,
    `completed .* period-small-angle=${PERIOD.toFixed(3)} period=${PERIOD.toFixed(3)} amplitude=0.524 .*step 4/6`,
  );
  await expect(page.locator('.hud-toast').last()).toContainText(
    `Simple pendulum — T: ${Number(PERIOD.toPrecision(4))} s`,
  );

  // 4. The results monitor: θ–t on screen, then the full results (E).
  await approach(page, aim, AT_MONITOR.x, AT_DESK.z);
  await approach(page, aim, AT_MONITOR.x, AT_MONITOR.z);
  await aim.at(T.monitor);
  await expectDebug(page, 'Focus', `${BAY}/monitor`);
  await page.waitForTimeout(400);
  await shot(page, 'pendulum-4-monitor');
  await page.keyboard.press('e');
  const panel = page.locator('.results-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('h2')).toContainText('Simple pendulum');
  await expect(panel.locator('h2')).toContainText('(completed)');
  const exact = panel.locator('tr[data-result="period"]');
  await expect(exact.locator('.theory')).toHaveText(`${PERIOD.toFixed(3)} s`);
  await expect(exact.locator('.measured')).toHaveText(`${PERIOD.toFixed(3)} s`);
  await expect(exact.locator('.error')).toHaveText(/^(0\.00 %|< 0\.01 %)$/);
  // The small-angle formula is shown as what it is: 1.74 % short at 30°.
  const small = panel.locator('tr[data-result="period-small-angle"]');
  await expect(small.locator('.theory')).toHaveText(`${T0.toFixed(3)} s`);
  await expect(small.locator('.measured')).toHaveText(`${PERIOD.toFixed(3)} s`);
  await expect(small.locator('.error')).toHaveText(`${((PERIOD_RATIO_30 - 1) * 100).toFixed(2)} %`);
  await expect(panel).toContainText('exact only as θ₀ → 0');
  const graphs = panel.locator('svg[data-graph]');
  await expect(graphs).toHaveCount(4);
  const samples = Number(await graphs.first().getAttribute('data-samples'));
  expect(samples).toBeGreaterThan(700); // 100 per second for ≈ 7.5 s
  await expect(panel.locator('svg[data-graph="angle-time"]')).toContainText('θ (rad)');
  await expect(panel.locator('svg[data-graph="angle-time"]')).toContainText('t (s)');
  await expect(panel.locator('svg[data-graph="angular-velocity-time"]')).toContainText('ω (rad/s)');
  await expect(panel.locator('svg[data-graph="phase"]')).toContainText('θ (rad)');
  await expect(panel.locator('svg[data-graph="energy-time"] polyline')).toHaveCount(3);
  await expect(panel.locator('svg[data-graph="energy-time"]')).toContainText('E (J)');
  await expectStation(page, 'completed .* step 5/6');
  await shot(page, 'pendulum-5-results');
  // Four graphs are taller than a 720-pixel window: the wheel scrolls the results, pointer locked.
  const energy = panel.locator('svg[data-graph="energy-time"]');
  await expect(energy).not.toBeInViewport({ ratio: 1 });
  await page.mouse.wheel(0, 400);
  await expect(energy).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
  await shot(page, 'pendulum-6-results-scrolled');

  // 5. θ₀ to 20° (looking away closes the results): RUN is refused until RESET.
  await approach(page, aim, AT_MONITOR.x, AT_DESK.z);
  await approach(page, aim, AT_DESK.x, AT_DESK.z);
  await expect(panel).toBeHidden();
  await lower(page, aim, T.dialAngle, 'dial-angle', 2);
  await expectStation(page, 'completed length=1.5 angle=20 gravity=9.81');
  await press(page, aim, T.run, 'button-run', 'RUN');
  await expect(page.locator('.hud-toast.warn').last()).toHaveText(
    'Press RESET before the next run.',
  );
  await press(page, aim, T.reset, 'button-reset', 'RESET');
  await expectStation(page, 'configured length=1.5 angle=20 gravity=9.81 resolution=0.01 step 6/6');
  await expect(page.locator('.hud-objective')).toContainText('All steps done');

  // 6. RUN, then STOP mid-swing: the data so far is kept; RESET discards it. The aim at STOP is
  // worked out before RUN, so a slow machine does not spend the run aiming.
  const stopAim = lookAngles(await position(page), T.stop);
  await press(page, aim, T.run, 'button-run', 'RUN');
  await expectStation(page, 'running');
  await aim.to(...stopAim);
  await page.keyboard.press('e');
  await expectDebug(page, 'Focus', `${BAY}/button-stop`);
  await expectStation(page, String.raw`stopped .* t=\d`);
  await expect(page.locator('.hud-toast').last()).toContainText('Stopped at t =');
  await press(page, aim, T.reset, 'button-reset', 'RESET');
  await expectStation(page, 'configured length=1.5 angle=20 gravity=9.81');

  // 7. Out through the opening and the lab door to the hub, and back (the game autosaves on
  // arrival), then reload and Continue: the bay still has the dials as they were left.
  await approach(page, aim, 1, -8.4);
  await approach(page, aim, -3, -8.7);
  await aim.at([-3, EYE_HEIGHT, 0]);
  await walkUntil(page, 'w', (p) => p[2] > -6);
  await expectDebug(page, 'Room', 'physics-lab');
  // West of the teacher's bench (Phase T-1a), then south to the hub door.
  await approach(page, aim, -3.367, -5.274);
  await approach(page, aim, -4.2, 0.3);
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
  expect(errors).toEqual([]);

  await page.reload();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'physics-lab');
  await aim.sync();
  await enterBay(page, aim);
  await expectStation(page, 'configured length=1.5 angle=20 gravity=9.81');
  expect(errors).toEqual([]);
  await expect(station(page)).not.toContainText('[failed]');
});
