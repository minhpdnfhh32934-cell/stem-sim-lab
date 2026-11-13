import { expect, type Page, test } from '@playwright/test';
import {
  Aim,
  approach,
  doorsClosed,
  EYE_HEIGHT,
  expectDebug,
  handsFree,
  newGame,
  position,
  shot,
  use,
  type Vec3,
  walkThrough,
  walkUntil,
  menuContinue,
} from './support';

// Phases 5–6A in the real app: the cleanroom entry procedure and the way back out, played with
// keyboard and mouse. Preparation Room (x −3 … 3, z −3 … 3) → doorway at x = 0 → cleanroom
// corridor (x −1.5 … 1.5, z −11.25 … −3.25) with the hand-wash station on its west wall and the
// door to the clean area (SIMLAB Hub) at its far end; the Teacher Room door (east wall) is the
// way out of the preparation area. State is read from the dev debug panel and the HUD.

// Interaction targets (centres) from rooms.json / items.json.
const T = {
  noticeBoard: [-2.2, 1.4, -2.97],
  wardrobe: [-2.4, 1.0, -1.2], // front face
  labCoat: [-2.7, 1.25, -1.5],
  goggles: [-2.7, 1.235, -0.9],
  basin: [-1.25, 0.9, -7.6],
  faucet: [-1.4, 1.11, -7.6],
  soap: [-1.45, 1.2, -7.15],
  towels: [-1.44, 1.2, -8.15],
  sanitizer: [-1.45, 1.2, -8.6],
  gloves: [-1.43, 1.17, -9.1],
  bin: [-1.33, 0.3, -8.37], // the pedal bin under the hand-wash station's fittings
  doorHub: [0, 1.05, -11.2],
  doorTeacher: [2.95, 1.05, 1],
  hubDoorBack: [0, 1.05, 5.95], // in the hub: back to the preparation area
  teacherDoorBack: [-2.45, 1.05, 0], // in the Teacher Room
} satisfies Record<string, Vec3>;

/** Where the wardrobe, its PPE and the notice board are all well within the 2.2 m reach. */
const AT_WARDROBE = { x: -1.4, z: -1.5 };

const objective = (page: Page) => page.locator('.hud-objective');
const blockedPrompt = (page: Page) => page.locator('.hud-prompt .hud-blocked');

/** Walks towards a door until it is in focus (it may not be in reach yet). */
async function toDoor(page: Page, aim: Aim, door: Vec3, entityId: string) {
  await aim.at(door);
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', entityId);
  await page.keyboard.up('w');
}

test('the door to the clean area stays shut, with the reason, until the procedure is done', async ({
  page,
}) => {
  const errors = await newGame(page);
  await expect(objective(page)).toContainText('Step 1 of 15 · Briefing');
  await expectDebug(page, 'Procedure', 'cleanroom-entry not-started 0/15 next read-rules');
  // Spawn faces north through the doorway: walk down the corridor until the door is in focus.
  await page.keyboard.down('w');
  await expectDebug(page, 'Focus', 'cleanroom-corridor/door-hub');
  await page.keyboard.up('w');
  const prompt = page.locator('.hud-prompt');
  await expect(prompt).toContainText('Enter the clean area (SIMLAB Hub)');
  await expect(blockedPrompt(page)).toHaveText(
    'Entry blocked. Next: Read the cleanroom entry rules on the notice board.',
  );
  await page.screenshot({ path: 'test-results/prep-entry-blocked.png' });
  await page.keyboard.press('e');
  await expect(page.locator('.hud-toast.warn').last()).toHaveText(
    'Entry blocked. Next: Read the cleanroom entry rules on the notice board.',
  );
  await page.waitForTimeout(500);
  await expectDebug(page, 'Scene', 'preparation-room'); // still here
  expect(errors).toEqual([]);
});

test('full cleanroom entry and exit: preparation, refused entry, entry, Continue, de-gowning, exit', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await newGame(page);
  const aim = new Aim(page);
  const warn = page.locator('.hud-toast.warn').last();

  // To the wardrobe (a fixed spot: holding a key can stop anywhere within ~0.6 m).
  await approach(page, aim, AT_WARDROBE.x, AT_WARDROBE.z);
  await use(page, aim, T.wardrobe, 'preparation-room/wardrobe', 'Open');

  // Out of order: gowning before reading the rules is refused with the step to do.
  await aim.at(T.labCoat);
  await expectDebug(page, 'Focus', 'preparation-room/lab-coat');
  await expect(blockedPrompt(page)).toHaveText(
    'Not yet. Next: Read the cleanroom entry rules on the notice board.',
  );
  await page.keyboard.press('e');
  await expect(warn).toHaveText(
    'Not yet. Next: Read the cleanroom entry rules on the notice board.',
  );
  await expectDebug(page, 'Equipment', '—');

  // Briefing. The next step's object is outlined (no floor path: the panel says where).
  await expectDebug(page, 'Guide', '0 points, 0.00 m · preparation-room/notice-board');
  await aim.at(T.noticeBoard);
  await shot(page, 'prep-outline-board');
  await use(page, aim, T.noticeBoard, 'preparation-room/notice-board', 'Inspect');
  await expect(objective(page)).toContainText('Step 2 of 15 · Gowning');
  await expectDebug(page, 'Guide', '0 points, 0.00 m · preparation-room/lab-coat');

  // Gowning from the open wardrobe.
  await use(page, aim, T.labCoat, 'preparation-room/lab-coat', 'Put on lab coat');
  await expectDebug(page, 'Equipment', 'lab-coat');
  await use(page, aim, T.goggles, 'preparation-room/safety-goggles', 'Put on safety goggles');
  await expectDebug(page, 'Equipment', 'lab-coat, safety-goggles');
  await expect(objective(page)).toContainText('Step 4 of 15 · Hand washing');
  await expect(page.locator('.hud-visor.goggles')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/prep-gowned.png' });

  // In front of the doorway (x = 0), straight north into the corridor, then to the basin wall.
  await approach(page, aim, 0, -2);
  await aim.at([0, EYE_HEIGHT, -6]);
  await walkUntil(page, 'w', (p) => p[2] < -5);
  await approach(page, aim, -0.45, -7.6);
  await expectDebug(page, 'Room', 'cleanroom-corridor');

  // Washing before the water runs is refused.
  await aim.at(T.basin);
  await expectDebug(page, 'Focus', 'cleanroom-corridor/wash-basin');
  await page.keyboard.press('e');
  await expect(warn).toHaveText(
    'Not yet. Next: At the hand-wash basin in the corridor, turn on the water.',
  );

  await use(page, aim, T.faucet, 'cleanroom-corridor/faucet', 'Turn on water');
  await expect(objective(page)).toContainText('Wet your hands under the running water.');
  await page.screenshot({ path: 'test-results/prep-water-running.png' });
  await use(page, aim, T.basin, 'cleanroom-corridor/wash-basin', 'Wash hands');
  await use(page, aim, T.soap, 'cleanroom-corridor/soap-dispenser', 'Take soap');
  await expect(objective(page)).toContainText('Rub your palms together.');

  // Four timed rubbing steps: press once, keep looking at the basin until the step is done.
  await aim.at(T.basin);
  for (const [step, next] of [
    ['rub-palms', 'Rub the back of each hand'],
    ['rub-backs', 'Rub between your fingers'],
    ['rub-fingers', 'Rub your thumbs and fingertips'],
    ['rub-thumbs', 'Rinse'],
  ] as const) {
    await expectDebug(page, 'Focus', 'cleanroom-corridor/wash-basin');
    await page.keyboard.press('e');
    await expectDebug(page, 'Procedure', `cleanroom-entry in-progress \\d+/15 next ${step} timer`);
    if (step === 'rub-palms') {
      await expect(objective(page).locator('.hud-timer')).toHaveCount(1);
      // And large in the middle above the hotbar: what is being done, how far along.
      const progress = page.locator('.hud-progress');
      await expect(progress).toBeVisible();
      await expect(progress).toHaveAttribute('role', 'progressbar');
      await expect(progress).toContainText('Rub your palms together.');
      await page.screenshot({ path: 'test-results/prep-rubbing.png' });
    }
    await expect(objective(page)).toContainText(next, { timeout: 15_000 });
  }

  await expect(page.locator('.hud-progress')).toBeHidden(); // no step running
  await page.keyboard.press('e'); // rinse (still looking at the basin)
  await expect(objective(page)).toContainText('Turn off the water');
  await use(page, aim, T.faucet, 'cleanroom-corridor/faucet', 'Turn off water');
  await use(page, aim, T.towels, 'cleanroom-corridor/paper-towels', 'Dry hands');
  await expect(objective(page)).toContainText('Step 14 of 15 · Hand disinfection');
  await use(page, aim, T.sanitizer, 'cleanroom-corridor/hand-sanitizer', 'Rub in hand sanitizer');
  await expect(objective(page)).toContainText('Step 15 of 15 · Gloves', { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/prep-sanitized.png' });

  // Between the glove dispenser and the door, both in reach.
  await approach(page, aim, -0.45, -9.6);
  await use(page, aim, T.gloves, 'cleanroom-corridor/glove-dispenser', 'Put on nitrile gloves');
  await expectDebug(page, 'Equipment', 'lab-coat, safety-goggles, nitrile-gloves');
  await expectDebug(page, 'Procedure', 'cleanroom-entry ready 15/15');
  await expect(objective(page)).toContainText('Ready: Enter the clean area (SIMLAB Hub).');
  await page.screenshot({ path: 'test-results/prep-ready.png' });

  // Blocked, fixed, allowed: used gloves into the bin → the door says why → a fresh pair → through.
  await use(page, aim, T.bin, 'cleanroom-corridor/waste-bin', 'Discard used nitrile gloves');
  await expect(
    page.locator('.hud-toast', { hasText: 'Discarded: Nitrile gloves, used' }),
  ).toHaveCount(1);
  await expect(objective(page)).toContainText('Entry blocked. Put on: nitrile gloves.');
  await aim.at(T.doorHub);
  await expectDebug(page, 'Focus', 'cleanroom-corridor/door-hub');
  await expect(blockedPrompt(page)).toHaveText('Entry blocked. Put on: nitrile gloves.');
  await handsFree(page); // the gloves into the bin, done
  await page.keyboard.press('e');
  await expect(warn).toHaveText('Entry blocked. Put on: nitrile gloves.');
  await use(page, aim, T.gloves, 'cleanroom-corridor/glove-dispenser', 'Put on nitrile gloves');
  // Stepped up to the dispenser for them (Phase H-3): back in front of the door's middle, so
  // that the walk through it, and later the way back, go straight.
  await handsFree(page);
  await approach(page, aim, 0, -9.6, 0.15);
  await aim.at(T.doorHub);
  await expectDebug(page, 'Focus', 'cleanroom-corridor/door-hub');
  await expect(blockedPrompt(page)).toHaveCount(0);
  // It slides open; walk through into the hub and on, 2.5 m past its door (hub z 5.95).
  await walkThrough(page, {
    label: 'Enter the clean area (SIMLAB Hub)',
    to: 'simlab-hub',
    done: (p) => p[2] < 3.45,
  });
  await doorsClosed(page, 'simlab-hub'); // shut behind the player: the corridor is gone
  await page.screenshot({ path: 'test-results/prep-entered-hub.png' });
  const inHub = await position(page);

  // The autosave once the door closed behind records the procedure as done and what is worn.
  // A new game's own save (the menu's kept games, F-9): the only one in this browser.
  const save = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('simlab.save.') && !k.endsWith('.backup'),
    );
    return key === undefined ? null : localStorage.getItem(key);
  });
  const data = JSON.parse(save ?? '{}') as {
    version: number;
    player: { equipment: string[]; position: number[] };
    progression: { procedures: Record<string, { completed: string[]; entered: boolean }> };
  };
  expect(data.version).toBe(11); // SAVE_VERSION 11: the hub teacher's test papers (Phase Y-5)
  expect(data.player.equipment).toEqual(['lab-coat', 'safety-goggles', 'nitrile-gloves']);
  // Where the player stood then, in the hub's own coordinates (the panel rounds to 1 cm).
  expect(Math.abs(data.player.position[0]! - inHub[0])).toBeLessThan(0.6);
  expect(data.player.position[2]).toBeLessThan(4.2); // past the door, inside the hub
  expect(data.progression.procedures['cleanroom-entry']?.entered).toBe(true);
  expect(data.progression.procedures['cleanroom-entry']?.completed).toHaveLength(15);

  // Reload and Continue: the hub, where it was saved, the equipment.
  await page.reload();
  await menuContinue(page);
  await expectDebug(page, 'Scene', 'simlab-hub');
  await expectDebug(page, 'Equipment', 'lab-coat, safety-goggles, nitrile-gloves');
  const continued = await position(page);
  for (const i of [0, 2]) {
    expect(Math.abs(continued[i]! - data.player.position[i]!)).toBeLessThanOrEqual(0.006);
  }

  // Leave the clean area: turn round to the door just come through, back into the corridor.
  await aim.sync();
  await toDoor(page, aim, T.hubDoorBack, 'simlab-hub/door-preparation');
  await walkThrough(page, {
    label: 'Back to Preparation Room',
    to: 'preparation-room',
    done: (p) => p[2] > -8.75, // 2.45 m into the corridor
  });
  await expect(objective(page)).toContainText('Completed. You have entered the clean area.');
  await doorsClosed(page, 'preparation-room');
  await aim.sync();

  // De-gowning starts with the gloves: used, into the waste bin (never back into the dispenser).
  await use(page, aim, T.bin, 'cleanroom-corridor/waste-bin', 'Discard used nitrile gloves');
  await expectDebug(page, 'Equipment', 'lab-coat, safety-goggles');

  // Back through the corridor; the way out (Teacher Room door) refuses PPE.
  await aim.at([0, EYE_HEIGHT, 0]);
  await walkUntil(page, 'w', (p) => p[2] > -2);
  await toDoor(page, aim, T.doorTeacher, 'preparation-room/door-teacher');
  await expect(blockedPrompt(page)).toHaveText(
    'Take off your PPE before leaving: lab coat, safety goggles.',
  );
  await page.keyboard.press('e');
  await expect(warn).toHaveText('Take off your PPE before leaving: lab coat, safety goggles.');
  await page.waitForTimeout(500);
  await expectDebug(page, 'Scene', 'preparation-room');

  // Coat and goggles back in the wardrobe (still open), then out.
  await approach(page, aim, AT_WARDROBE.x, AT_WARDROBE.z);
  await use(page, aim, T.goggles, 'preparation-room/safety-goggles', 'Put back safety goggles');
  await use(page, aim, T.labCoat, 'preparation-room/lab-coat', 'Put back lab coat');
  await expectDebug(page, 'Equipment', '—');
  await expect(page.locator('.hud-visor.goggles')).toHaveCount(0);
  await toDoor(page, aim, T.doorTeacher, 'preparation-room/door-teacher');
  await expect(blockedPrompt(page)).toHaveCount(0);
  await walkThrough(page, {
    label: 'Go to Teacher Room',
    to: 'teacher-room',
    done: (p) => p[0] > -0.3,
  });
  await expect(warn).toHaveText(
    'Cleanroom entry reset. You left the preparation area. Prepare again from the start before entering.',
  );
  await doorsClosed(page, 'teacher-room');

  // Coming back, the preparation starts over.
  await aim.sync();
  await toDoor(page, aim, T.teacherDoorBack, 'teacher-room/door-preparation');
  await walkThrough(page, {
    label: 'Back to Preparation Room',
    to: 'preparation-room',
    done: (p) => p[0] < 0.9,
  });
  await expect(objective(page)).toContainText('Step 1 of 15 · Briefing');
  await expectDebug(page, 'Procedure', 'cleanroom-entry not-started 0/15 next read-rules');
  await page.screenshot({ path: 'test-results/prep-back-after-exit.png' });
  expect(errors).toEqual([]);
});
