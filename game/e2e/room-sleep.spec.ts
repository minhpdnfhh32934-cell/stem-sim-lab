import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  continueFrom,
  doorsClosed,
  expectDebug,
  labSave,
  lookAngles,
  PROJECTILE_TARGETS as T,
  type Vec3,
  walkThrough,
  walkToDoor,
  walkUntil,
  settingsSection,
} from './support';
import { countWebGL, webglCounts } from './webgl';

// Rooms out of sight (world/dormancy.ts, Phú 2026-11-06): in the Physics Lab, far from its doors,
// the bay, the optics room and the range are not drawn and their buffers are freed; walking to the
// bay's door wakes the bay before the door opens, without a long frame; the setting turns it off.
// Frame times are SwiftShader's (software WebGL), not a GPU's.

/** In the lab, 7.6 m south of the bay's door (north wall, x −3), looking at it. */
const STAND: [number, number, number] = [-3, 0, 0];
const DOOR: [number, number, number] = [-3, 1.6, -7.625];

const asleep = async (page: Page) =>
  /Asleep:\s+(.*)/.exec(await page.locator('.debug-text').innerText())?.[1]?.trim() ?? '';

/** Display frame intervals (ms) from now on, kept in the page. */
async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const frames: number[] = [];
    (window as unknown as { frames: number[] }).frames = frames;
    let last = performance.now();
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () => page.evaluate(() => (window as unknown as { frames: number[] }).frames.slice());
}

test('far from its doors the lab draws only itself; the bay wakes before its door opens, without a long frame', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(countWebGL);
  const errors = await continueFrom(page, labSave(STAND, DOOR));
  await expect
    .poll(() => asleep(page), { timeout: 10_000 })
    .toBe('pendulum-bay, projectile-range, waves-optics');
  const sleeping = await webglCounts(page);

  const frames = await recordFrames(page);
  // To 4.6 m from the door: within 7 m it wakes; the door (2.2 m) stays shut.
  await walkUntil(page, 'w', ([, , z]) => z <= -3);
  await expect.poll(() => asleep(page), { timeout: 10_000 }).toBe('projectile-range, waves-optics');
  await expectDebug(page, 'Room', 'physics-lab');
  // The first interval runs from the recorder's start, not from a frame: left out.
  const intervals = (await frames()).slice(1);
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const longest = sorted[sorted.length - 1] ?? 0;
  const awake = await webglCounts(page);
  const line = `${sleeping.renderer} | room sleep: buffers asleep ${sleeping.live.Buffer}, bay awake ${awake.live.Buffer}; frames ${intervals.length}, median ${median.toFixed(1)} ms, longest ${longest.toFixed(1)} ms; in order ${intervals.map((ms) => ms.toFixed(0)).join(' ')}`;
  test.info().annotations.push({ type: 'room-sleep', description: line });
  process.stdout.write(`${line}\n`);
  expect(awake.live.Buffer ?? 0).toBeGreaterThan(sleeping.live.Buffer ?? 0); // the bay's buffers uploaded again
  // No frame of the wake as long as a load's: within 3 usual frames, 150 ms at least (software
  // rendering is uneven); a freed texture sampled again cost ~300 ms here.
  expect(longest).toBeLessThan(Math.max(3 * median, 150));

  // Through the door: the bay's room, the lab behind its door near.
  await walkUntil(page, 'w', ([, , z]) => z <= -9);
  await expectDebug(page, 'Room', 'pendulum-bay');
  expect(errors).toEqual([]);
});

test('with the setting off every room is drawn; turned on in the pause menu, the far ones sleep', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(countWebGL);
  await page.addInitScript(() => localStorage.setItem('simlab.settings.roomSleep', 'false'));
  const errors = await continueFrom(page, labSave(STAND, DOOR));
  await page.waitForTimeout(1000);
  expect(await asleep(page)).toBe('—');
  const all = await webglCounts(page);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsSection(page, 'graphics');
  const box = page.getByLabel('Draw only rooms you can see');
  await expect(box).not.toBeChecked();
  await box.check();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect
    .poll(() => asleep(page), { timeout: 10_000 })
    .toBe('pendulum-bay, projectile-range, waves-optics');
  const some = await webglCounts(page);
  const line = `${all.renderer} | room sleep off: draws ${all.draws}, buffers ${all.live.Buffer}; on: draws ${some.draws}, buffers ${some.live.Buffer}`;
  test.info().annotations.push({ type: 'room-sleep', description: line });
  process.stdout.write(`${line}\n`);
  expect(some.live.Buffer ?? 0).toBeLessThan(all.live.Buffer ?? 0);
  expect(await page.evaluate(() => localStorage.getItem('simlab.settings.roomSleep'))).toBe('true');
  expect(errors).toEqual([]);
});

test('five wakes and sleeps of the bay: the last two leave the same GL objects, nothing leaks', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(countWebGL);
  const errors = await continueFrom(page, labSave(STAND, DOOR));
  const objects = async () => {
    const { live } = await webglCounts(page);
    return live;
  };
  const asleepCounts: Record<string, number>[] = [];
  const awakeCounts: Record<string, number>[] = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    // Back to 10 m from the bay's door (past sleepM): the bay sleeps — and the range wakes, its
    // door 5 m away (no point of the lab is 7 m from both); then to 4.6 m: the bay wakes again.
    await walkUntil(page, 's', ([, , z]) => z >= 2.5);
    await expect.poll(() => asleep(page), { timeout: 10_000 }).toBe('pendulum-bay, waves-optics');
    asleepCounts.push(await objects());
    await walkUntil(page, 'w', ([, , z]) => z <= -3);
    await expect
      .poll(() => asleep(page), { timeout: 10_000 })
      .toBe('projectile-range, waves-optics');
    awakeCounts.push(await objects());
  }
  const line = `room sleep cycles: asleep ${asleepCounts.map((c) => c.Buffer).join(', ')} buffers; awake ${awakeCounts.map((c) => c.Buffer).join(', ')}`;
  test.info().annotations.push({ type: 'room-sleep', description: line });
  process.stdout.write(`${line}\n`);
  // The first cycles draw everything once (where a walk stops decides what is first drawn in
  // which: with the AC generator in the bay, Phase X, one run settled only in its fourth cycle,
  // on the same counts as its other runs); the last two must be equal.
  expect(asleepCounts[4]).toEqual(asleepCounts[3]);
  expect(awakeCounts[4]).toEqual(awakeCounts[3]);
  expect(errors).toEqual([]);
});

test('back from the hub, the rooms of the wing are drawn again when they wake', async ({
  page,
}) => {
  // Phú, 2026-11-06: after a visit to the other labs the range, the bay and the optics room stayed
  // dark and empty. Put to sleep while the wing, attached again, was being warmed, they kept the
  // warm-up's pending layer as their own and were never drawn when they woke.
  test.setTimeout(240_000);
  await page.addInitScript(countWebGL);
  const RANGE_DOOR: Vec3 = [-2, 1.6, 7.625];
  const HERE: Vec3 = [-3, 0, 2.5]; // 5.2 m from the range's door: it is awake
  const errors = await continueFrom(page, labSave(HERE, RANGE_DOOR));
  const aim = new Aim(page);
  [aim.yaw, aim.pitch] = lookAngles(HERE, RANGE_DOOR);
  await expect.poll(() => asleep(page), { timeout: 10_000 }).toBe('pendulum-bay, waves-optics');
  await page.waitForTimeout(1000);
  const before = (await webglCounts(page)).draws;

  // To the hub and back through the doors (the wing released, then attached and warmed again).
  await walkToDoor(page, aim, T.labDoor, 'physics-lab/door-hub');
  await walkThrough(page, {
    label: 'Back to SIMLAB Hub',
    to: 'simlab-hub',
    done: (p) => p[0] < 10.5,
  });
  await doorsClosed(page, 'simlab-hub');
  await walkToDoor(page, aim, T.hubDoorPhysics, 'simlab-hub/door-physics');
  await walkThrough(page, {
    label: 'Enter Physics Lab',
    to: 'physics-lab',
    done: (p) => p[0] > -2.6,
  });
  await doorsClosed(page, 'physics-lab');

  // Where it stood, looking the same way: the range drawn as before.
  await approach(page, aim, HERE[0], HERE[2], 0.2);
  await aim.at(RANGE_DOOR);
  await expect.poll(() => asleep(page), { timeout: 10_000 }).toBe('pendulum-bay, waves-optics');
  await page.waitForTimeout(1000);
  const after = (await webglCounts(page)).draws;
  const line = `room sleep after a hub trip: draws ${before} before, ${after} after`;
  test.info().annotations.push({ type: 'room-sleep', description: line });
  process.stdout.write(`${line}\n`);
  expect(after).toBeGreaterThan(0.9 * before);
  expect(errors).toEqual([]);
});
